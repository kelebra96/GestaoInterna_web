-- Migration: Fix RLS policy for users table to allow viewing own profile
-- Created: 2026-01-12
-- Description: Adds policy to allow authenticated users to view their own profile data

-- Drop existing policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own profile" ON users;

-- Create policy to allow users to view their own profile
-- This is essential for mobile app authentication flow
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    id = auth.uid()
  );

-- Comment explaining the policy
COMMENT ON POLICY "Users can view own profile" ON users IS
  'Allows authenticated users to view their own profile data using auth.uid()';
