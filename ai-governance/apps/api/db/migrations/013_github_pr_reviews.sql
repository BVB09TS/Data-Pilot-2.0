-- GitHub App installations (one per repo/org connected to a workspace)
CREATE TABLE IF NOT EXISTS github_installations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_login    TEXT NOT NULL,                -- GitHub org or user login
  repo_full_name   TEXT NOT NULL,                -- e.g. "acme/analytics"
  encrypted_token  TEXT NOT NULL,                -- encrypted PAT
  webhook_id       BIGINT,                       -- GitHub webhook id (for cleanup)
  webhook_secret   TEXT NOT NULL DEFAULT '',     -- HMAC secret for webhook verification
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, repo_full_name)
);

-- PR review runs — one record per PR review triggered
CREATE TABLE IF NOT EXISTS pr_reviews (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  installation_id  UUID NOT NULL REFERENCES github_installations(id) ON DELETE CASCADE,
  repo_full_name   TEXT NOT NULL,
  pr_number        INTEGER NOT NULL,
  pr_title         TEXT,
  pr_author        TEXT,
  base_branch      TEXT,
  head_branch      TEXT,
  commit_sha       TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','running','completed','failed')),
  findings         JSONB NOT NULL DEFAULT '[]',  -- array of Finding objects
  summary          TEXT,                         -- plain-text summary posted to PR
  github_comment_id BIGINT,                      -- id of the comment we posted
  files_changed    INTEGER NOT NULL DEFAULT 0,
  dbt_files_found  INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS pr_reviews_workspace_id_idx ON pr_reviews(workspace_id);
CREATE INDEX IF NOT EXISTS pr_reviews_installation_id_idx ON pr_reviews(installation_id);
