-- Messages table for chat persistence
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  text TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helpful index for queries per room/time
CREATE INDEX IF NOT EXISTS idx_messages_room_time ON messages (room_id, created_at DESC);
