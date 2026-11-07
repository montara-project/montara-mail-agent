// Package passkey runs the WebAuthn ceremonies: registering a passkey for a
// signed-in user, and signing in with one. Authula has no passkey plugin, so
// the sign-in route in cmd/api turns a verified passkey into an Authula
// session.
package passkey

import (
	"context"
	"errors"
	"net/url"
	"sync"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/uuid"

	"montara-mail-agent/server/internal/lib/apperr"
	"montara-mail-agent/server/internal/models"
	"montara-mail-agent/server/internal/repositories"
)

// ceremonyTTL is how long a challenge stays valid after it was handed out.
const ceremonyTTL = 5 * time.Minute

// maxPending caps the challenges held at once: sign-in options need no
// account, so anyone can ask for them (the auth rate limit slows that down).
const maxPending = 10000

// ErrNotRecognized answers every failed passkey sign-in alike.
var ErrNotRecognized = errors.New("passkey not recognized")

// pending is a ceremony waiting for the browser's answer. user is uuid.Nil for
// a sign-in, which starts before anyone is known.
type pending struct {
	session webauthn.SessionData
	user    uuid.UUID
}

// Service holds the relying party and the challenges in flight.
// ponytail: challenges live in memory, so a ceremony must finish on the replica
// that began it; move them to the database once there is more than one.
type Service struct {
	wa   *webauthn.WebAuthn
	repo *repositories.PasskeyRepository

	mu      sync.Mutex
	pending map[string]pending
}

// New builds the relying party for the web app's origins. Its ID is the host
// of the first origin, so every origin must sit on that domain.
func New(name string, origins []string, repo *repositories.PasskeyRepository) (*Service, error) {
	if len(origins) == 0 {
		return nil, errors.New("passkeys need the web app's origin")
	}
	first, err := url.Parse(origins[0])
	if err != nil || first.Hostname() == "" {
		return nil, errors.New("passkeys need a web app origin with a host")
	}
	wa, err := webauthn.New(&webauthn.Config{
		RPID:          first.Hostname(),
		RPDisplayName: name,
		RPOrigins:     origins,
	})
	if err != nil {
		return nil, err
	}
	return &Service{wa: wa, repo: repo, pending: map[string]pending{}}, nil
}

// user is the WebAuthn view of an account. Its handle is the user id, which
// is how a sign-in finds the account from the passkey alone.
type user struct {
	id          uuid.UUID
	name, label string
	credentials []webauthn.Credential
}

func (u user) WebAuthnID() []byte                         { return u.id[:] }
func (u user) WebAuthnName() string                       { return u.name }
func (u user) WebAuthnDisplayName() string                { return u.label }
func (u user) WebAuthnCredentials() []webauthn.Credential { return u.credentials }

func (s *Service) load(ctx context.Context, id uuid.UUID) (user, error) {
	keys, err := s.repo.ListByUser(ctx, id)
	if err != nil {
		return user{}, err
	}
	u := user{id: id}
	for _, k := range keys {
		u.credentials = append(u.credentials, k.Credential)
	}
	return u, nil
}

// hold keeps a ceremony until its answer comes back, keyed by its challenge.
func (s *Service) hold(session *webauthn.SessionData, uid uuid.UUID) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	for challenge, p := range s.pending {
		if now.After(p.session.Expires) {
			delete(s.pending, challenge)
		}
	}
	if len(s.pending) >= maxPending {
		return apperr.New(apperr.KindUnavailable, "too many passkey requests, try again in a minute")
	}
	session.Expires = now.Add(ceremonyTTL)
	s.pending[session.Challenge] = pending{session: *session, user: uid}
	return nil
}

// take hands out a held ceremony once: a challenge never verifies twice.
func (s *Service) take(challenge string) (pending, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.pending[challenge]
	delete(s.pending, challenge)
	if !ok || time.Now().After(p.session.Expires) {
		return pending{}, false
	}
	return p, true
}

// BeginRegistration returns the options for navigator.credentials.create.
// Passkeys the user already has are excluded, so one device registers once.
func (s *Service) BeginRegistration(ctx context.Context, uid uuid.UUID, email, name string) (*protocol.CredentialCreation, error) {
	u, err := s.load(ctx, uid)
	if err != nil {
		return nil, err
	}
	u.name, u.label = email, name
	if u.label == "" {
		u.label = email
	}
	exclude := make([]protocol.CredentialDescriptor, 0, len(u.credentials))
	for _, c := range u.credentials {
		exclude = append(exclude, c.Descriptor())
	}
	creation, session, err := s.wa.BeginRegistration(u,
		webauthn.WithAuthenticatorSelection(protocol.AuthenticatorSelection{UserVerification: protocol.VerificationRequired}),
		webauthn.WithResidentKeyRequirement(protocol.ResidentKeyRequirementRequired),
		webauthn.WithExclusions(exclude),
	)
	if err != nil {
		return nil, err
	}
	if err := s.hold(session, uid); err != nil {
		return nil, err
	}
	return creation, nil
}

// FinishRegistration verifies the browser's answer to BeginRegistration and
// stores the passkey under name.
func (s *Service) FinishRegistration(ctx context.Context, uid uuid.UUID, name string, response []byte) (models.Passkey, error) {
	parsed, err := protocol.ParseCredentialCreationResponseBytes(response)
	if err != nil {
		return models.Passkey{}, apperr.New(apperr.KindBadRequest, "the passkey answer can't be read")
	}
	p, ok := s.take(parsed.Response.CollectedClientData.Challenge)
	if !ok || p.user != uid {
		return models.Passkey{}, apperr.New(apperr.KindBadRequest, "the passkey request expired, try again")
	}
	u, err := s.load(ctx, uid)
	if err != nil {
		return models.Passkey{}, err
	}
	credential, err := s.wa.CreateCredential(u, p.session, parsed)
	if err != nil {
		return models.Passkey{}, apperr.New(apperr.KindBadRequest, "the passkey couldn't be verified")
	}
	return s.repo.Create(ctx, uid, name, *credential)
}

// BeginLogin returns the options for navigator.credentials.get. It names no
// account: the browser offers whichever passkeys it has for this site.
func (s *Service) BeginLogin() (*protocol.CredentialAssertion, error) {
	assertion, session, err := s.wa.BeginDiscoverableLogin(webauthn.WithUserVerification(protocol.VerificationRequired))
	if err != nil {
		return nil, err
	}
	if err := s.hold(session, uuid.Nil); err != nil {
		return nil, err
	}
	return assertion, nil
}

// FinishLogin verifies the browser's answer to BeginLogin and returns the
// user it signs in. Any failure is ErrNotRecognized, or an infrastructure error.
func (s *Service) FinishLogin(ctx context.Context, response []byte) (uuid.UUID, error) {
	parsed, err := protocol.ParseCredentialRequestResponseBytes(response)
	if err != nil {
		return uuid.Nil, ErrNotRecognized
	}
	p, ok := s.take(parsed.Response.CollectedClientData.Challenge)
	if !ok || p.user != uuid.Nil {
		return uuid.Nil, ErrNotRecognized
	}

	var lookupErr error
	found, credential, err := s.wa.ValidatePasskeyLogin(func(_, handle []byte) (webauthn.User, error) {
		id, err := uuid.FromBytes(handle)
		if err != nil {
			return nil, err
		}
		u, err := s.load(ctx, id)
		lookupErr = err
		return u, err
	}, p.session, parsed)
	if lookupErr != nil {
		return uuid.Nil, lookupErr
	}
	if err != nil {
		return uuid.Nil, ErrNotRecognized
	}
	// A counter that went backwards means the key was copied.
	if credential.Authenticator.CloneWarning {
		return uuid.Nil, ErrNotRecognized
	}
	if err := s.repo.UpdateUse(ctx, *credential); err != nil {
		return uuid.Nil, err
	}
	return found.(user).id, nil
}

// DeleteAll removes every passkey of the user, as a password change does:
// whoever knew the old password could have added one. Their registrations in
// flight go too, so one begun before the change can't finish after it.
// ponytail: a FinishRegistration already past take() can still insert after
// the delete; a per-user credentials version checked on insert closes that.
func (s *Service) DeleteAll(ctx context.Context, uid uuid.UUID) error {
	s.mu.Lock()
	for challenge, p := range s.pending {
		if p.user == uid {
			delete(s.pending, challenge)
		}
	}
	s.mu.Unlock()
	return s.repo.DeleteAllByUser(ctx, uid)
}
