-- =====================================================================
-- TASK 2: Supabase RLS Audit & Hardening
-- =====================================================================

-- Run all queries in Supabase SQL Editor in this order

-- =====================================================================
-- PART 1: Audit current RLS status on all tables
-- =====================================================================

-- Query 1: Check which tables have RLS enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- This will show all public schema tables with RLS status (true/false)
-- Run this FIRST to see what you're working with

-- =====================================================================
-- PART 2: Enable RLS on tables where it's OFF
-- =====================================================================

-- Run these commands for any table from PART 1 that shows rowsecurity = false:

ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_action_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- PART 3: List all existing RLS policies
-- =====================================================================

-- Query 2: Show all policies on all tables (run to see what exists)
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual as policy_condition,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- This lists every policy you have - use to confirm coverage

-- =====================================================================
-- PART 4: Comprehensive RLS Policies for PLXYGROUND
-- =====================================================================

-- CREATORS TABLE
-- Allow public to view active creators
-- Allow authenticated users (creators) to view and edit their own profile
-- Allow admins via service role

-- Drop old policies if they exist (optional, for fresh setup)
-- DROP POLICY IF EXISTS "creators_public_select" ON creators;
-- DROP POLICY IF EXISTS "creators_authenticated_select" ON creators;
-- DROP POLICY IF EXISTS "creators_own_update" ON creators;
-- DROP POLICY IF EXISTS "creators_service_all" ON creators;

CREATE POLICY "creators_public_select" ON creators
  FOR SELECT
  USING (is_active = 1 OR auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "creators_authenticated_select" ON creators
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "creators_own_update" ON creators
  FOR UPDATE
  USING (id = (auth.uid())::bigint OR auth.role() = 'service_role')
  WITH CHECK (id = (auth.uid())::bigint OR auth.role() = 'service_role');

CREATE POLICY "creators_service_all" ON creators
  FOR ALL
  USING (auth.role() = 'service_role');

-- CREATOR_ACCOUNTS TABLE
-- Users can only view/update their own account
-- Service role (backend) can do anything

-- DROP POLICY IF EXISTS "creator_accounts_own_select" ON creator_accounts;
-- DROP POLICY IF EXISTS "creator_accounts_own_update" ON creator_accounts;
-- DROP POLICY IF EXISTS "creator_accounts_service_all" ON creator_accounts;

CREATE POLICY "creator_accounts_own_select" ON creator_accounts
  FOR SELECT
  USING (creator_id = (auth.uid())::bigint OR auth.role() = 'service_role');

CREATE POLICY "creator_accounts_own_update" ON creator_accounts
  FOR UPDATE
  USING (creator_id = (auth.uid())::bigint OR auth.role() = 'service_role')
  WITH CHECK (creator_id = (auth.uid())::bigint OR auth.role() = 'service_role');

CREATE POLICY "creator_accounts_service_all" ON creator_accounts
  FOR ALL
  USING (auth.role() = 'service_role');

-- CONTENT TABLE
-- Public can view published content
-- Creators can view/edit/delete their own content
-- Service role can do anything

-- DROP POLICY IF EXISTS "content_public_select" ON content;
-- DROP POLICY IF EXISTS "content_creator_read" ON content;
-- DROP POLICY IF EXISTS "content_creator_insert" ON content;
-- DROP POLICY IF EXISTS "content_creator_update" ON content;
-- DROP POLICY IF EXISTS "content_creator_delete" ON content;
-- DROP POLICY IF EXISTS "content_service_all" ON content;

CREATE POLICY "content_public_select" ON content
  FOR SELECT
  USING (is_published = 1);

CREATE POLICY "content_creator_read" ON content
  FOR SELECT
  USING (creator_id = (auth.uid())::bigint OR auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "content_creator_insert" ON content
  FOR INSERT
  WITH CHECK (creator_id = (auth.uid())::bigint OR auth.role() = 'service_role');

CREATE POLICY "content_creator_update" ON content
  FOR UPDATE
  USING (creator_id = (auth.uid())::bigint OR auth.role() = 'service_role')
  WITH CHECK (creator_id = (auth.uid())::bigint OR auth.role() = 'service_role');

CREATE POLICY "content_creator_delete" ON content
  FOR DELETE
  USING (creator_id = (auth.uid())::bigint OR auth.role() = 'service_role');

CREATE POLICY "content_service_all" ON content
  FOR ALL
  USING (auth.role() = 'service_role');

-- OPPORTUNITIES TABLE
-- Public can view published opportunities
-- Authenticated users can view all opportunities
-- Creators can create and edit their own
-- Service role can do anything

-- DROP POLICY IF EXISTS "opportunities_public_select" ON opportunities;
-- DROP POLICY IF EXISTS "opportunities_authenticated_select" ON opportunities;
-- DROP POLICY IF EXISTS "opportunities_creator_insert" ON opportunities;
-- DROP POLICY IF EXISTS "opportunities_creator_update" ON opportunities;
-- DROP POLICY IF EXISTS "opportunities_service_all" ON opportunities;

CREATE POLICY "opportunities_public_select" ON opportunities
  FOR SELECT
  USING (is_published = 1);

CREATE POLICY "opportunities_authenticated_select" ON opportunities
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "opportunities_creator_insert" ON opportunities
  FOR INSERT
  WITH CHECK (creator_id = (auth.uid())::bigint OR auth.role() = 'service_role');

CREATE POLICY "opportunities_creator_update" ON opportunities
  FOR UPDATE
  USING (creator_id = (auth.uid())::bigint OR auth.role() = 'service_role')
  WITH CHECK (creator_id = (auth.uid())::bigint OR auth.role() = 'service_role');

CREATE POLICY "opportunities_service_all" ON opportunities
  FOR ALL
  USING (auth.role() = 'service_role');

-- ADMINS TABLE
-- Only backend (service role) can access
-- This table is separate from creator accounts for security

-- DROP POLICY IF EXISTS "admins_service_only" ON admins;

CREATE POLICY "admins_service_only" ON admins
  FOR ALL
  USING (auth.role() = 'service_role');

-- MODERATION_QUEUE TABLE
-- Only backend (service role) can access
-- This prevents users from manipulating the queue

-- DROP POLICY IF EXISTS "moderation_queue_service_only" ON moderation_queue;

CREATE POLICY "moderation_queue_service_only" ON moderation_queue
  FOR ALL
  USING (auth.role() = 'service_role');

-- AUDIT_LOG TABLE
-- Only backend (service role) can insert/read
-- This ensures audit trail integrity

-- DROP POLICY IF EXISTS "audit_log_service_only" ON audit_log;

CREATE POLICY "audit_log_service_only" ON audit_log
  FOR ALL
  USING (auth.role() = 'service_role');

-- BULK_ACTION_LOG TABLE
-- Only backend (service role) can access
-- This tracks admin bulk operations

-- DROP POLICY IF EXISTS "bulk_action_log_service_only" ON bulk_action_log;

CREATE POLICY "bulk_action_log_service_only" ON bulk_action_log
  FOR ALL
  USING (auth.role() = 'service_role');

-- REFRESH_TOKENS TABLE
-- Only backend (service role) can access
-- Tokens are sensitive and should never be accessible to users

-- DROP POLICY IF EXISTS "refresh_tokens_service_only" ON refresh_tokens;

CREATE POLICY "refresh_tokens_service_only" ON refresh_tokens
  FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================================
-- PART 5: Policy Verification Query
-- =====================================================================

-- Query 3: Final verification - list all policies
-- Run this AFTER adding policies to confirm everything is in place

SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  qual as condition_summary
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Expected output: 
-- Each table should have policies covering SELECT, INSERT, UPDATE, DELETE
-- Service role should have access to sensitive tables (admins, audit_log, etc.)
-- Public/authenticated should only see published content or their own data

-- =====================================================================
-- PART 6: Test RLS Policies Work
-- =====================================================================

-- Testing is done in your Next.js app using the Supabase client:
-- See TASK 3 for middleware that validates this works with auth.uid()

-- Quick manual test in Supabase SQL Editor:
-- 1. Impersonate a user by setting auth context
-- 2. Query a table
-- 3. Should only see rows that match the RLS policy

-- Example: In Supabase SQL Editor, using a test user with ID 123:
-- SELECT * FROM creators WHERE id = 123;
-- This will respect the RLS policy and only show if allowed
