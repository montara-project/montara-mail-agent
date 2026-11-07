-- WebAuthn passkeys a user signs in with instead of a password. "credential"
-- holds go-webauthn's credential record (public key, sign count, flags);
-- "credential_id" is its id, the key a sign-in looks the row up by.
CREATE TABLE IF NOT EXISTS "passkeys" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT uuidv7(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "user_id" UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "name" VARCHAR NOT NULL,
  "credential_id" BYTEA NOT NULL,
  "credential" JSONB NOT NULL,
  "last_used_at" TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_passkeys_credential_id ON "passkeys" ("credential_id");
CREATE INDEX IF NOT EXISTS idx_passkeys_user ON "passkeys" ("user_id", "created_at");
