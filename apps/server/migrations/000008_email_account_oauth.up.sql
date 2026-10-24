-- A mailbox connected over OAuth carries sealed tokens instead of a password
-- (see lib.SecretBox); both never leave the server.
ALTER TABLE "email_accounts" ALTER COLUMN "password" DROP NOT NULL;
ALTER TABLE "email_accounts"
  ADD COLUMN "oauth_access_token" BYTEA,
  ADD COLUMN "oauth_refresh_token" BYTEA,
  ADD COLUMN "oauth_token_expiry" TIMESTAMPTZ;
