-- The metering hook never sets email_account_id (the LLMFor chokepoint does
-- not carry an account); drop the unused column.
ALTER TABLE "token_usage" DROP COLUMN IF EXISTS "email_account_id";
