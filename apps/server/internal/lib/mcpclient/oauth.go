package mcpclient

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/auth"
	"github.com/modelcontextprotocol/go-sdk/oauthex"
	"golang.org/x/oauth2"
)

// OAuth is what a hosted server's sign-in needs and keeps: the endpoints and
// the client registration discovery found, and the token the user granted.
// It is stored sealed, since it holds the client secret and the tokens.
type OAuth struct {
	AuthURL      string        `json:"auth_url"`
	TokenURL     string        `json:"token_url"`
	ClientID     string        `json:"client_id"`
	ClientSecret string        `json:"client_secret,omitempty"`
	Resource     string        `json:"resource"`
	Scopes       []string      `json:"scopes,omitempty"`
	Token        *oauth2.Token `json:"token,omitempty"`
}

// Discover finds the authorization server that guards serverURL, following
// the MCP authorization spec (protected resource metadata, then the
// authorization server's metadata), and registers this app with it through
// dynamic client registration.
func Discover(ctx context.Context, serverURL, redirectURI string, c *http.Client) (OAuth, error) {
	prm := protectedResource(ctx, serverURL, c)
	issuer := prm.AuthorizationServers[0]

	asm, err := auth.GetAuthServerMetadata(ctx, issuer, c)
	if err != nil {
		return OAuth{}, fmt.Errorf("reading the authorization server's metadata: %w", err)
	}
	if asm == nil {
		// The 2025-03-26 spec's defaults, for servers without metadata.
		root := strings.TrimRight(issuer, "/")
		asm = &oauthex.AuthServerMeta{
			AuthorizationEndpoint: root + "/authorize",
			TokenEndpoint:         root + "/token",
			RegistrationEndpoint:  root + "/register",
		}
	}
	if asm.RegistrationEndpoint == "" {
		return OAuth{}, errors.New("the server's sign-in doesn't let apps register themselves, which this app needs")
	}

	// A public client with PKCE where the server allows one; else a secret.
	method := "client_secret_post"
	if len(asm.TokenEndpointAuthMethodsSupported) == 0 || slices.Contains(asm.TokenEndpointAuthMethodsSupported, "none") {
		method = "none"
	}
	scopes := prm.ScopesSupported
	reg, err := oauthex.RegisterClient(ctx, asm.RegistrationEndpoint, &oauthex.ClientRegistrationMetadata{
		RedirectURIs:            []string{redirectURI},
		TokenEndpointAuthMethod: method,
		GrantTypes:              []string{"authorization_code", "refresh_token"},
		ResponseTypes:           []string{"code"},
		ClientName:              "Montara Mail",
		Scope:                   strings.Join(scopes, " "),
	}, c)
	if err != nil {
		return OAuth{}, fmt.Errorf("registering with the server's sign-in: %w", err)
	}
	return OAuth{
		AuthURL:      asm.AuthorizationEndpoint,
		TokenURL:     asm.TokenEndpoint,
		ClientID:     reg.ClientID,
		ClientSecret: reg.ClientSecret,
		Resource:     prm.Resource,
		Scopes:       scopes,
	}, nil
}

// protectedResource reads the server's protected resource metadata from the
// well-known places (at the endpoint's path, then at the root). A server that
// publishes none is its own authorization server, as the 2025-03-26 spec had
// it.
func protectedResource(ctx context.Context, serverURL string, c *http.Client) *oauthex.ProtectedResourceMetadata {
	if u, err := url.Parse(serverURL); err == nil {
		at := *u
		at.Path = "/.well-known/oauth-protected-resource/" + strings.TrimLeft(u.Path, "/")
		root := *u
		root.Path = "/.well-known/oauth-protected-resource"
		bare := *u
		bare.Path = ""
		for _, try := range []struct{ metadata, resource string }{
			{at.String(), serverURL},
			{root.String(), bare.String()},
		} {
			prm, err := oauthex.GetProtectedResourceMetadata(ctx, try.metadata, try.resource, c)
			if err == nil && prm != nil && len(prm.AuthorizationServers) > 0 {
				return prm
			}
		}
		return &oauthex.ProtectedResourceMetadata{Resource: serverURL, AuthorizationServers: []string{bare.String()}}
	}
	return &oauthex.ProtectedResourceMetadata{Resource: serverURL, AuthorizationServers: []string{serverURL}}
}

func (o OAuth) config(redirectURI string) *oauth2.Config {
	// The client registered as public ("none") or with client_secret_post:
	// either way its credentials go in the token request's body.
	return &oauth2.Config{
		ClientID:     o.ClientID,
		ClientSecret: o.ClientSecret,
		Endpoint:     oauth2.Endpoint{AuthURL: o.AuthURL, TokenURL: o.TokenURL, AuthStyle: oauth2.AuthStyleInParams},
		RedirectURL:  redirectURI,
		Scopes:       o.Scopes,
	}
}

// AuthCodeURL is the consent page the browser goes to; state carries the
// signed flow, verifier the PKCE secret, and resource names the server the
// token is for (RFC 8707).
func (o OAuth) AuthCodeURL(redirectURI, state, verifier string) string {
	return o.config(redirectURI).AuthCodeURL(state,
		oauth2.S256ChallengeOption(verifier),
		oauth2.SetAuthURLParam("resource", o.Resource),
	)
}

// Exchange trades the consent's code for a token.
func (o OAuth) Exchange(ctx context.Context, redirectURI, code, verifier string, c *http.Client) (*oauth2.Token, error) {
	ctx = context.WithValue(ctx, oauth2.HTTPClient, c)
	return o.config(redirectURI).Exchange(ctx, code,
		oauth2.VerifierOption(verifier),
		oauth2.SetAuthURLParam("resource", o.Resource),
	)
}

// Fresh returns a usable access token, refreshing an expired one; changed
// says the caller should store the new token.
func (o OAuth) Fresh(ctx context.Context, c *http.Client) (token *oauth2.Token, changed bool, err error) {
	if o.Token == nil {
		return nil, false, ErrUnauthorized
	}
	if o.Token.Valid() {
		return o.Token, false, nil
	}
	if o.Token.RefreshToken == "" {
		return nil, false, ErrUnauthorized
	}
	ctx = context.WithValue(ctx, oauth2.HTTPClient, c)
	fresh, err := o.config("").TokenSource(ctx, o.Token).Token()
	if err != nil {
		return nil, false, fmt.Errorf("%w: %v", ErrUnauthorized, err)
	}
	return fresh, true, nil
}
