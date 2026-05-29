-- Add content_hash to files for deduplication
ALTER TABLE files ADD COLUMN IF NOT EXISTS content_hash text;
CREATE INDEX IF NOT EXISTS files_hash_idx ON files(user_id, content_hash) WHERE status = 'done';