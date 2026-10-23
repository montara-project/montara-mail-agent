-- Mail synced from an account's IMAP folders. (folder, uid_validity, uid)
-- identifies the message on the server; a new uid_validity means the server
-- renumbered the folder, so its rows are dropped and synced again.
CREATE TABLE IF NOT EXISTS "mails" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT uuidv7(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "email_account_id" UUID NOT NULL REFERENCES "email_accounts" ("id") ON DELETE CASCADE,
  "folder" VARCHAR NOT NULL,
  "uid_validity" BIGINT NOT NULL,
  "uid" BIGINT NOT NULL,
  "message_id" VARCHAR NOT NULL DEFAULT '',
  "from_name" VARCHAR NOT NULL DEFAULT '',
  "from_email" VARCHAR NOT NULL DEFAULT '',
  "to" JSONB NOT NULL DEFAULT '[]',
  "cc" JSONB NOT NULL DEFAULT '[]',
  "subject" VARCHAR NOT NULL DEFAULT '',
  "body" TEXT NOT NULL DEFAULT '',
  -- The text/html part, rendered by the client in a sandboxed frame; '' when
  -- it has none. NULL means the body still has to be read: the sync re-reads
  -- those bodies and fills it in.
  "body_html" TEXT,
  "received_at" TIMESTAMPTZ NOT NULL,
  "is_read" BOOLEAN NOT NULL DEFAULT false,
  "is_starred" BOOLEAN NOT NULL DEFAULT false,
  -- important or low_priority; NULL until the AI or the user classifies it.
  "importance" VARCHAR,
  -- ai or user: a user's choice is never overwritten by the AI.
  "importance_by" VARCHAR,
  "summary" TEXT,
  UNIQUE ("email_account_id", "folder", "uid")
);

CREATE INDEX IF NOT EXISTS idx_mails_account_folder_received ON "mails" ("email_account_id", "folder", "received_at" DESC);
