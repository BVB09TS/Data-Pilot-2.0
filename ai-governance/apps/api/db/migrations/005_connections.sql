CREATE TABLE connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id UUID REFERENCES environments(id),
  type TEXT NOT NULL,
  provider TEXT,
  name TEXT NOT NULL,
  encrypted_secret TEXT,
  config JSONB DEFAULT '{}',
  is_enabled BOOLEAN DEFAULT true,
  last_health_check TIMESTAMPTZ,
  health_status TEXT DEFAULT 'unknown',
  created_at TIMESTAMPTZ DEFAULT now()
);
