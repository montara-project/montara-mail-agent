package repositories

import (
	"context"
	"encoding/json"

	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/uuid"

	"montara-mail-agent/server/internal/models"
)

// PasskeyRepository manages the users' passkeys (see migration 0021).
type PasskeyRepository struct {
	BaseRepository
}

func scanPasskey(row rowScanner) (models.Passkey, error) {
	var p models.Passkey
	var credential []byte
	if err := row.Scan(&p.ID, &p.CreatedAt, &p.UserID, &p.Name, &credential, &p.LastUsedAt); err != nil {
		return p, translateNotFound("passkeys", err)
	}
	return p, json.Unmarshal(credential, &p.Credential)
}

const passkeyColumns = `id, created_at, user_id, name, credential, last_used_at`

// ListByUser returns the user's passkeys, oldest first.
func (r *PasskeyRepository) ListByUser(ctx context.Context, userID uuid.UUID) ([]models.Passkey, error) {
	rows, err := r.queryContext(ctx, `SELECT `+passkeyColumns+` FROM passkeys WHERE user_id = $1 ORDER BY created_at`, userID)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanPasskey)
}

// Create stores a passkey just registered.
func (r *PasskeyRepository) Create(ctx context.Context, userID uuid.UUID, name string, credential webauthn.Credential) (models.Passkey, error) {
	raw, err := json.Marshal(credential)
	if err != nil {
		return models.Passkey{}, err
	}
	return scanPasskey(r.queryRowContext(ctx, `
		INSERT INTO passkeys (user_id, name, credential_id, credential) VALUES ($1, $2, $3, $4)
		RETURNING `+passkeyColumns, userID, name, credential.ID, raw))
}

// UpdateUse saves the credential record a sign-in updated (its sign count and
// flags) and stamps the use.
func (r *PasskeyRepository) UpdateUse(ctx context.Context, credential webauthn.Credential) error {
	raw, err := json.Marshal(credential)
	if err != nil {
		return err
	}
	res, err := r.execContext(ctx, `UPDATE passkeys SET credential = $2, last_used_at = now() WHERE credential_id = $1`, credential.ID, raw)
	if err != nil {
		return err
	}
	return requireAffected(res, "passkey")
}

// Delete removes one of the user's passkeys. Another user's reads as missing.
func (r *PasskeyRepository) Delete(ctx context.Context, userID, id uuid.UUID) error {
	res, err := r.execContext(ctx, `DELETE FROM passkeys WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return err
	}
	return requireAffected(res, "passkey")
}

// DeleteAllByUser removes every passkey of the user.
func (r *PasskeyRepository) DeleteAllByUser(ctx context.Context, userID uuid.UUID) error {
	_, err := r.execContext(ctx, `DELETE FROM passkeys WHERE user_id = $1`, userID)
	return err
}
