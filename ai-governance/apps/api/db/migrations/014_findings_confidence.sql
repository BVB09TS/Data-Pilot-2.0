-- Add confidence score to findings (0.0-1.0; 1.0 = deterministic, <1.0 = LLM-assisted)
ALTER TABLE findings ADD COLUMN IF NOT EXISTS confidence NUMERIC(4,3) DEFAULT 1.0;
