-- Reverse of 0018: the pro/enterprise values have no old equivalent, so the
-- plan value reverts to the closest prior state before the tables go away.
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS users_plan_check;
UPDATE "users" SET plan = 'subscribed' WHERE plan = 'pro';
UPDATE "users" SET plan = 'free' WHERE plan = 'enterprise';

DROP TABLE IF EXISTS "wallet_topups";
DROP TABLE IF EXISTS "wallet_transactions";
DROP TABLE IF EXISTS "wallet_balances";
DROP TABLE IF EXISTS "subscriptions";
DROP TABLE IF EXISTS "plans";
