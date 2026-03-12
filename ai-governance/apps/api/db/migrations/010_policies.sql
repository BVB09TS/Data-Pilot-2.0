CREATE TABLE policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',   -- active | inactive | draft
  rules JSONB NOT NULL DEFAULT '[]',        -- array of rule objects
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE policy_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  policy_id UUID REFERENCES policies(id) ON DELETE CASCADE,
  node_id UUID REFERENCES nodes(id) ON DELETE SET NULL,
  run_id UUID REFERENCES runs(id) ON DELETE SET NULL,
  result TEXT NOT NULL,          -- pass | fail | warn | skip
  violations JSONB DEFAULT '[]', -- list of violated rules
  evaluated_at TIMESTAMPTZ DEFAULT now()
);
