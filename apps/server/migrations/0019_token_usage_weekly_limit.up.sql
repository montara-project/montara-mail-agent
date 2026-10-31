-- The allowance a call was made under, so a plan change doesn't rewrite the
-- overflow of past weeks and with it the pay-as-you-go balance. NULL on an
-- unlimited tier and on rows from before this column.
ALTER TABLE "token_usage" ADD COLUMN IF NOT EXISTS "weekly_limit" BIGINT;
