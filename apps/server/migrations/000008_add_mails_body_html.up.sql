-- The message's text/html part, rendered by the client in a sandboxed frame;
-- '' when it has none. NULL marks mail synced before this column existed:
-- the sync re-reads those bodies and fills it in.
ALTER TABLE "mails" ADD COLUMN IF NOT EXISTS "body_html" TEXT;
