-- Findings produced by the DataPilot audit pipeline.
-- Each finding belongs to a run and references the node (model) it concerns.

CREATE TABLE IF NOT EXISTS findings (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id          UUID        NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  node_id         UUID        REFERENCES nodes(id) ON DELETE SET NULL,

  -- Classification
  type            TEXT        NOT NULL,   -- dead_model | orphan | broken_ref | duplicate_metric | grain_join | logic_drift | missing_tests | deprecated_source
  severity        TEXT        NOT NULL,   -- critical | high | medium | low
  title           TEXT        NOT NULL,
  description     TEXT        NOT NULL,

  -- LLM-generated detail
  recommendation TEXT,
  llm_reasoning  TEXT,

  -- Cost tracking (optional, set by LLM gateway)
  cost_usd        NUMERIC(10, 6) DEFAULT 0,

  -- Context payload (raw evidence, e.g. model metadata, SQL excerpt)
  metadata        JSONB       NOT NULL DEFAULT '{}',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS findings_workspace_id  ON findings(workspace_id);
CREATE INDEX IF NOT EXISTS findings_run_id        ON findings(run_id);
CREATE INDEX IF NOT EXISTS findings_node_id       ON findings(node_id);
CREATE INDEX IF NOT EXISTS findings_type          ON findings(type);
CREATE INDEX IF NOT EXISTS findings_severity      ON findings(severity);
