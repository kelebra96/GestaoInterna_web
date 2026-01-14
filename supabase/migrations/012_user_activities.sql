-- Migration 012: User Activities
-- Log de atividades por usuário

CREATE TABLE IF NOT EXISTS user_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Activity details
  type VARCHAR(50) NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,

  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX idx_user_activities_created_at ON user_activities(created_at DESC);
CREATE INDEX idx_user_activities_type ON user_activities(type);

-- Composite index for common queries
CREATE INDEX idx_user_activities_user_created ON user_activities(user_id, created_at DESC);

-- Comments
COMMENT ON TABLE user_activities IS 'Activity log per user';
COMMENT ON COLUMN user_activities.type IS 'Activity type: info, warning, error, success, etc.';
