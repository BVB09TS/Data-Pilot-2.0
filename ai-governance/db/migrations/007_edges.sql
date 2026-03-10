CREATE TABLE edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  source_node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
  target_node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
  label TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_node_id, target_node_id)
);

CREATE INDEX idx_edges_workspace_id ON edges(workspace_id);
CREATE INDEX idx_edges_source_node_id ON edges(source_node_id);
CREATE INDEX idx_edges_target_node_id ON edges(target_node_id);
