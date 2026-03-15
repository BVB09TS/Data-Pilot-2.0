CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,           -- e.g. connections.create, runs.status.update
  resource_type TEXT NOT NULL,    -- connections | nodes | edges | runs | policies | environments
  resource_id TEXT,               -- UUID of affected resource
  meta JSONB DEFAULT '{}',        -- request body snapshot / diff
  ip TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_workspace_idx ON audit_events(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_resource_idx  ON audit_events(resource_type, resource_id);
