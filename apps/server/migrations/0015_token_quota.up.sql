-- Token usage metering, weekly quotas, PAYG balances and BorderPay top-ups.
-- Every LLM call lands one token_usage row (tera-router's usage_records
-- pattern), summed per user over a Monday-based week against the plan limit,
-- with a no-expiry pay-as-you-go balance for overflow.

CREATE TABLE IF NOT EXISTS "token_usage" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT uuidv7(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "user_id" UUID NOT NULL REFERENCES "users" ("id"),
  "organization_id" UUID REFERENCES "organizations" ("id") ON DELETE SET NULL,
  "email_account_id" UUID REFERENCES "email_accounts" ("id") ON DELETE SET NULL,
  "provider" VARCHAR NOT NULL DEFAULT '',
  "model" VARCHAR NOT NULL DEFAULT '',
  "purpose" VARCHAR NOT NULL DEFAULT 'complete',
  "input_tokens" INTEGER NOT NULL DEFAULT 0,
  "output_tokens" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_token_usage_user ON "token_usage" ("user_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "token_balances" (
  "user_id" UUID PRIMARY KEY REFERENCES "users" ("id"),
  "balance_tokens" BIGINT NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "token_topups" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT uuidv7(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "user_id" UUID NOT NULL REFERENCES "users" ("id"),
  "amount_idr" INTEGER NOT NULL,
  "tokens" BIGINT NOT NULL,
  "status" VARCHAR NOT NULL DEFAULT 'pending',
  "reference_id" VARCHAR UNIQUE NOT NULL,
  "pay_url" TEXT NOT NULL DEFAULT '',
  "paid_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_token_topups_user ON "token_topups" ("user_id", "created_at" DESC);

-- The platform-user provider scope: a provider every plain user falls back to
-- ahead of the global one. One row per (org, platform) combination; the
-- NULLS NOT DISTINCT index keeps one platform row and one global row.
ALTER TABLE "llm_providers" ADD COLUMN IF NOT EXISTS "platform_user" BOOLEAN NOT NULL DEFAULT false;
DROP INDEX IF EXISTS uq_llm_providers_scope;
CREATE UNIQUE INDEX IF NOT EXISTS uq_llm_providers_scope
  ON "llm_providers" ("organization_id", "platform_user") NULLS NOT DISTINCT;

-- The plan a user is on: free (10M tokens/week, 20 mailboxes) or subscribed
-- (100M tokens/week, shown as Unlimited; no mailbox cap). Set by hand for now.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "plan" VARCHAR NOT NULL DEFAULT 'free';
