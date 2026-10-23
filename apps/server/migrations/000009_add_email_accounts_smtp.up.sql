-- Where an account sends mail from (forwards). Known providers get their
-- fixed server (see constant.ProviderServers); a custom IMAP account gets the
-- usual guess, its IMAP host with "smtp." in front, on 465.
ALTER TABLE "email_accounts" ADD COLUMN IF NOT EXISTS "smtp_host" VARCHAR NOT NULL DEFAULT '';
ALTER TABLE "email_accounts" ADD COLUMN IF NOT EXISTS "smtp_port" INTEGER NOT NULL DEFAULT 465;

UPDATE "email_accounts" SET
  "smtp_host" = CASE "provider"
    WHEN 'gmail' THEN 'smtp.gmail.com'
    WHEN 'outlook' THEN 'smtp.office365.com'
    WHEN 'yahoo' THEN 'smtp.mail.yahoo.com'
    WHEN 'icloud' THEN 'smtp.mail.me.com'
    ELSE regexp_replace("imap_host", '^imap\.', 'smtp.')
  END,
  "smtp_port" = CASE "provider" WHEN 'outlook' THEN 587 WHEN 'icloud' THEN 587 ELSE 465 END
WHERE "smtp_host" = '';
