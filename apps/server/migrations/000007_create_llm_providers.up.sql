-- The LLM an organization's AI features call. The API key is sealed with the
-- app secret (see lib.SecretBox).
CREATE TABLE IF NOT EXISTS "llm_providers" (
  "organization_id" UUID PRIMARY KEY NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- openai or anthropic: the wire format, not the vendor.
  "kind" VARCHAR NOT NULL,
  "base_url" VARCHAR NOT NULL,
  "model" VARCHAR NOT NULL,
  "api_key" BYTEA NOT NULL
);
