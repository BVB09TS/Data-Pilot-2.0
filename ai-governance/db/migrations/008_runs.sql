CREATE TABLE runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id UUID REFERENCES environments(id),
  node_id UUID REFERENCES nodes(id),
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  logs JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_runs_workspace_id ON runs(workspace_id);
CREATE INDEX idx_runs_node_id ON runs(node_id);
CREATE INDEX idx_runs_status ON runs(status);
