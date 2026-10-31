-- Billing: pricing plans, subscriptions, and the IDR wallet that renews
-- subscriptions automatically. The first purchase goes through BorderPay's
-- QRIS checkout (like the token top-ups); renewals are deducted from the
-- wallet balance on the daily billing sweep, and an unaffordable renewal
-- expires the plan.

-- What can be bought. free and enterprise are display-only rows: their limits
-- are enforced from this table, but they cannot be checked out. NULL limits
-- mean unlimited; amounts are rupiah integers, never floats.
CREATE TABLE IF NOT EXISTS "plans" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT uuidv7(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- free | pro_monthly | pro_yearly | enterprise
  "code" VARCHAR NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  -- NULL on the display-only plans (free, enterprise).
  "billing_interval" VARCHAR CHECK ("billing_interval" IN ('month', 'year')),
  "amount" BIGINT NOT NULL DEFAULT 0 CHECK (amount >= 0),
  "currency" VARCHAR(3) NOT NULL DEFAULT 'IDR',
  -- Promo: what comes off amount until discount_ends_at; NULL = no promo.
  "discount_amount" BIGINT CHECK (discount_amount > 0 AND discount_amount <= amount),
  "discount_ends_at" TIMESTAMPTZ,
  -- NULL = unlimited.
  "max_email_accounts" INTEGER,
  "max_organizations" INTEGER,
  "weekly_tokens" BIGINT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0
);

-- One paid period of a recurring plan, per user. pending until BorderPay's
-- webhook confirms the checkout, active until current_period_end (the daily
-- billing sweep renews it from the wallet or expires it), then expired as
-- history. auto_renew off means the sweep simply expires it at period end.
CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT uuidv7(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "user_id" UUID NOT NULL REFERENCES "users" ("id"),
  "plan_id" UUID NOT NULL REFERENCES "plans" ("id"),
  "status" VARCHAR NOT NULL DEFAULT 'pending',
  -- NULL until the payment lands; the period then starts that moment.
  "current_period_start" TIMESTAMPTZ,
  "current_period_end" TIMESTAMPTZ,
  -- What this period cost, kept apart from the plan, whose price may change.
  "amount" BIGINT NOT NULL DEFAULT 0,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'IDR',
  -- BorderPay's reference, also the webhook's dispatch key; the checkout
  -- generates it and passes it as the merchant reference.
  "reference_id" VARCHAR UNIQUE NOT NULL,
  "pay_url" TEXT NOT NULL DEFAULT '',
  "auto_renew" BOOLEAN NOT NULL DEFAULT true,
  "canceled_at" TIMESTAMPTZ,
  CHECK (status != 'active' OR (current_period_start IS NOT NULL AND current_period_end IS NOT NULL)),
  CHECK (current_period_start IS NULL OR current_period_end IS NULL OR current_period_end > current_period_start)
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON "subscriptions" ("user_id", "created_at" DESC);
-- One live subscription per user; ended ones stay as history.
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_one_live ON "subscriptions" ("user_id")
  WHERE status IN ('pending', 'active');

-- The IDR wallet that auto-renewal draws from.
CREATE TABLE IF NOT EXISTS "wallet_balances" (
  "user_id" UUID PRIMARY KEY REFERENCES "users" ("id"),
  "balance_idr" BIGINT NOT NULL DEFAULT 0 CHECK (balance_idr >= 0),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The wallet's audit ledger: every movement of rupiah. amount_idr is signed —
-- top-ups credit, subscription charges debit.
CREATE TABLE IF NOT EXISTS "wallet_transactions" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT uuidv7(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "user_id" UUID NOT NULL REFERENCES "users" ("id"),
  -- topup | subscription_charge | adjustment
  "kind" VARCHAR NOT NULL,
  "amount_idr" BIGINT NOT NULL,
  -- wallet_topup | subscription | ''
  "reference_type" VARCHAR NOT NULL DEFAULT '',
  "reference_id" UUID,
  "note" TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON "wallet_transactions" ("user_id", "created_at" DESC);

-- An IDR top-up for the wallet, mirror of token_topups.
CREATE TABLE IF NOT EXISTS "wallet_topups" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT uuidv7(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "user_id" UUID NOT NULL REFERENCES "users" ("id"),
  "amount_idr" INTEGER NOT NULL CHECK (amount_idr > 0),
  "status" VARCHAR NOT NULL DEFAULT 'pending',
  "reference_id" VARCHAR UNIQUE NOT NULL,
  "pay_url" TEXT NOT NULL DEFAULT '',
  "paid_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_wallet_topups_user ON "wallet_topups" ("user_id", "created_at" DESC);

-- The plan value 'subscribed' becomes 'pro': pricing rows now carry the plan
-- data, and users.plan keeps naming the tier, not the state.
UPDATE "users" SET plan = 'pro' WHERE plan = 'subscribed';
ALTER TABLE "users" ADD CONSTRAINT users_plan_check CHECK (plan IN ('free', 'pro', 'enterprise'));
