-- Workspace settings: LLM API keys and default project path
-- Keys are stored encrypted at rest (via pgcrypto if available, otherwise plain text with env-key AES)
-- The API layer masks keys to last-4 chars on GET responses.

CREATE TABLE IF NOT EXISTS workspace_settings (
  workspace_id       UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  groq_api_key       TEXT,
  openai_api_key     TEXT,
  anthropic_api_key  TEXT,
  default_project_path TEXT,
  updated_at         TIMESTAMPTZ DEFAULT now()
);
