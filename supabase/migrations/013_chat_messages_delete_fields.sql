-- Migration 013: Add missing delete tracking fields to chat_messages

-- Add fields for delete tracking
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS deleted_for_everyone_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_for_everyone_at TIMESTAMP WITH TIME ZONE;

-- Index for delete tracking queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_deleted_at ON chat_messages(deleted_at);

-- Comments
COMMENT ON COLUMN chat_messages.deleted_at IS 'Timestamp when soft delete occurred';
COMMENT ON COLUMN chat_messages.deleted_for_everyone_by IS 'User who deleted the message for everyone';
COMMENT ON COLUMN chat_messages.deleted_for_everyone_at IS 'Timestamp when deleted for everyone';
