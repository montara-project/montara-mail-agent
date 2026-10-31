ALTER TABLE "token_usage" ADD COLUMN IF NOT EXISTS "email_account_id" UUID REFERENCES "email_accounts" ("id") ON DELETE SET NULL;
