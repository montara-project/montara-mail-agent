-- The AI agent's own data: conversations with the copilot, the messages that
-- make them up, the outbound actions it proposed (sent only after an explicit
-- approval), and the drafts the background automation queues for review.
CREATE TABLE IF NOT EXISTS "agent_conversations" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT uuidv7(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "organization_id" UUID NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users" ("id"),
  -- The mailbox the conversation is about; null talks about the organization
  -- as a whole.
  "email_account_id" UUID REFERENCES "email_accounts" ("id") ON DELETE SET NULL,
  "title" VARCHAR NOT NULL DEFAULT 'New conversation'
);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_org
  ON "agent_conversations" ("organization_id", "user_id", "updated_at" DESC);

-- role: user | assistant | tool. A tool row answers the assistant row before
-- it: tool_name names the call, tool_payload carries its arguments (assistant)
-- or its result (tool), tokens_* the cost of the assistant turn.
CREATE TABLE IF NOT EXISTS "agent_messages" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT uuidv7(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "conversation_id" UUID NOT NULL REFERENCES "agent_conversations" ("id") ON DELETE CASCADE,
  "role" VARCHAR NOT NULL,
  "content" TEXT NOT NULL DEFAULT '',
  "tool_name" VARCHAR,
  "tool_payload" JSONB,
  "tokens_in" INTEGER NOT NULL DEFAULT 0,
  "tokens_out" INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation
  ON "agent_messages" ("conversation_id", "created_at");

-- kind: send_reply | send_email | forward. status: pending | approved | denied
-- | done | failed. payload carries {mail_id?, to, cc, subject, text, html} in
-- the shape the executor needs; an approved row is the only way mail leaves
-- through the agent.
CREATE TABLE IF NOT EXISTS "agent_actions" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT uuidv7(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "conversation_id" UUID NOT NULL REFERENCES "agent_conversations" ("id") ON DELETE CASCADE,
  "organization_id" UUID NOT NULL REFERENCES "organizations" ("id"),
  "user_id" UUID NOT NULL REFERENCES "users" ("id"),
  "kind" VARCHAR NOT NULL,
  "payload" JSONB NOT NULL,
  "status" VARCHAR NOT NULL DEFAULT 'pending',
  "error" TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_actions_conversation
  ON "agent_actions" ("conversation_id", "status");

-- The background automation's proposals for the same review: a drafted reply
-- waiting for a decision before anything is sent.
CREATE TABLE IF NOT EXISTS "agent_drafts" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT uuidv7(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "organization_id" UUID NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "email_account_id" UUID NOT NULL REFERENCES "email_accounts" ("id") ON DELETE CASCADE,
  "mail_id" UUID REFERENCES "mails" ("id") ON DELETE SET NULL,
  "to" JSONB NOT NULL,
  "cc" JSONB,
  "subject" VARCHAR NOT NULL,
  "text" TEXT NOT NULL,
  "html" TEXT,
  "status" VARCHAR NOT NULL DEFAULT 'pending',
  "decided_by" UUID REFERENCES "users" ("id")
);

CREATE INDEX IF NOT EXISTS idx_agent_drafts_org
  ON "agent_drafts" ("organization_id", "status", "created_at" DESC);
