-- Add environment_id FK and unique constraint to nodes.
-- Fixes parser.ts INSERT which references both columns.
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS environment_id UUID REFERENCES environments(id) ON DELETE SET NULL;
ALTER TABLE nodes ADD CONSTRAINT IF NOT EXISTS nodes_workspace_name_unique UNIQUE (workspace_id, name);
