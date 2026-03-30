-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing objects if they exist (for fresh setup)
-- WARNING: This will delete all data!
-- DROP POLICY IF EXISTS "creators_public_select" ON creators;
-- DROP POLICY IF EXISTS "creator_accounts_own_select" ON creator_accounts;
-- etc.

-- =====================================================================
-- CREATORS TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS creators (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('CREATOR', 'BUSINESS')),
  bio TEXT,
  location TEXT,
  profile_slug TEXT UNIQUE,
  social_links TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE creators ENABLE ROW LEVEL SECURITY;

-- Public can view active creators
CREATE POLICY "creators_public_select" ON creators
  FOR SELECT
  USING (is_active = 1);

-- Creators can view their own profile
CREATE POLICY "creators_own_select" ON creators
  FOR SELECT
  USING (auth.uid()::text = id::text OR role = 'CREATOR');

-- =====================================================================
-- CREATOR_ACCOUNTS TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS creator_accounts (
  id BIGSERIAL PRIMARY KEY,
  creator_id BIGINT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_approved INTEGER DEFAULT 1,
  is_email_verified INTEGER DEFAULT 0,
  is_suspended INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(creator_id, email)
);

ALTER TABLE creator_accounts ENABLE ROW LEVEL SECURITY;

-- Users can only access their own account
CREATE POLICY "creator_accounts_own_select" ON creator_accounts
  FOR SELECT
  USING (creator_id = (auth.uid())::bigint OR auth.role() = 'service_role');

CREATE POLICY "creator_accounts_own_update" ON creator_accounts
  FOR UPDATE
  USING (creator_id = (auth.uid())::bigint OR auth.role() = 'service_role');

-- Service role can insert
CREATE POLICY "creator_accounts_service_insert" ON creator_accounts
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- =====================================================================
-- CONTENT TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS content (
  id BIGSERIAL PRIMARY KEY,
  creator_id BIGINT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('article', 'video_embed', 'image_story')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  media_url TEXT NOT NULL,
  order_priority INTEGER DEFAULT 0,
  is_published INTEGER DEFAULT 0,
  published_at TIMESTAMP WITH TIME ZONE,
  feed_rank_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE content ENABLE ROW LEVEL SECURITY;

-- Public can view published content
CREATE POLICY "content_public_select" ON content
  FOR SELECT
  USING (is_published = 1);

-- Creators can view their own content and submitted content
CREATE POLICY "content_creator_select" ON content
  FOR SELECT
  USING (
    creator_id = (auth.uid())::bigint OR
    auth.role() = 'service_role'
  );

-- Creators can insert their own content
CREATE POLICY "content_creator_insert" ON content
  FOR INSERT
  WITH CHECK (creator_id = (auth.uid())::bigint OR auth.role() = 'service_role');

-- Creators can update their own content
CREATE POLICY "content_creator_update" ON content
  FOR UPDATE
  USING (creator_id = (auth.uid())::bigint OR auth.role() = 'service_role');

-- Creators can delete their own content
CREATE POLICY "content_creator_delete" ON content
  FOR DELETE
  USING (creator_id = (auth.uid())::bigint OR auth.role() = 'service_role');

-- =====================================================================
-- OPPORTUNITIES TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS opportunities (
  id BIGSERIAL PRIMARY KEY,
  creator_id BIGINT REFERENCES creators(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  role_type TEXT,
  body TEXT NOT NULL,
  requirements TEXT,
  benefits TEXT,
  is_published INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;

-- Public can view published opportunities
CREATE POLICY "opportunities_public_select" ON opportunities
  FOR SELECT
  USING (is_published = 1);

-- Creators can view all opportunities
CREATE POLICY "opportunities_creator_select" ON opportunities
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Creators can insert their own opportunities
CREATE POLICY "opportunities_creator_insert" ON opportunities
  FOR INSERT
  WITH CHECK (creator_id = (auth.uid())::bigint OR auth.role() = 'service_role');

-- Creators can update their own opportunities
CREATE POLICY "opportunities_creator_update" ON opportunities
  FOR UPDATE
  USING (creator_id = (auth.uid())::bigint OR auth.role() = 'service_role');

-- =====================================================================
-- ADMINS TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS admins (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'ADMIN' CHECK (role = 'ADMIN'),
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Only service role can access admins
CREATE POLICY "admins_service_access" ON admins
  FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================================
-- MODERATION_QUEUE TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS moderation_queue (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  title_or_name TEXT NOT NULL,
  submitted_by BIGINT,
  report_count INTEGER DEFAULT 0,
  assigned_admin BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  entity_id BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE moderation_queue ENABLE ROW LEVEL SECURITY;

-- Only admins (service role) can access
CREATE POLICY "moderation_queue_admin_all" ON moderation_queue
  FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================================
-- AUDIT_LOG TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  action_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  target TEXT NOT NULL,
  before_snapshot TEXT,
  after_snapshot TEXT,
  reason TEXT,
  metadata TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Only service role can access audit logs
CREATE POLICY "audit_log_service_only" ON audit_log
  FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================================
-- BULK_ACTION_LOG TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS bulk_action_log (
  id BIGSERIAL PRIMARY KEY,
  admin TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_ids TEXT NOT NULL,
  previous_state TEXT NOT NULL,
  undo_window_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  undone_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE bulk_action_log ENABLE ROW LEVEL SECURITY;

-- Only service role can access
CREATE POLICY "bulk_action_log_service_only" ON bulk_action_log
  FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================================
-- REFRESH_TOKENS TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGSERIAL PRIMARY KEY,
  subject_id BIGINT NOT NULL,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('CREATOR', 'BUSINESS', 'ADMIN')),
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role can access
CREATE POLICY "refresh_tokens_service_only" ON refresh_tokens
  FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================================
-- INDEXES
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_creators_profile_slug ON creators(profile_slug);
CREATE INDEX IF NOT EXISTS idx_creators_role ON creators(role);
CREATE INDEX IF NOT EXISTS idx_creator_accounts_creator_id ON creator_accounts(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_accounts_email ON creator_accounts(email);
CREATE INDEX IF NOT EXISTS idx_content_published ON content(is_published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_creator ON content(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_feed_rank ON content(feed_rank_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_published ON opportunities(is_published);
CREATE INDEX IF NOT EXISTS idx_opportunities_creator ON opportunities(creator_id);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_status ON moderation_queue(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_entity ON moderation_queue(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_subject ON refresh_tokens(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- =====================================================================
-- TRIGGERS FOR updated_at (auto-update timestamp)
-- =====================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER creators_updated_at
BEFORE UPDATE ON creators
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER creator_accounts_updated_at
BEFORE UPDATE ON creator_accounts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER content_updated_at
BEFORE UPDATE ON content
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER opportunities_updated_at
BEFORE UPDATE ON opportunities
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER admins_updated_at
BEFORE UPDATE ON admins
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER moderation_queue_updated_at
BEFORE UPDATE ON moderation_queue
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
