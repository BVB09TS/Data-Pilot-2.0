-- Add password_hash to support local email/password auth.
-- Nullable so existing OAuth-only users are unaffected.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
