ALTER TABLE "email_accounts"
  DROP COLUMN "oauth_access_token",
  DROP COLUMN "oauth_refresh_token",
  DROP COLUMN "oauth_token_expiry";
-- OAuth-connected accounts have no password to require; they go first.
DELETE FROM "email_accounts" WHERE "password" IS NULL;
ALTER TABLE "email_accounts" ALTER COLUMN "password" SET NOT NULL;
