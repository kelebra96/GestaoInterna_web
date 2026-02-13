-- Migration: Add RLS policies for expiry_reports table
-- This allows the mobile app (using anon key) to insert and select reports

-- Enable RLS on the table if not already enabled
ALTER TABLE IF EXISTS expiry_reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Allow all inserts on expiry_reports" ON expiry_reports;
DROP POLICY IF EXISTS "Allow all selects on expiry_reports" ON expiry_reports;
DROP POLICY IF EXISTS "Allow all updates on expiry_reports" ON expiry_reports;
DROP POLICY IF EXISTS "Allow all deletes on expiry_reports" ON expiry_reports;

-- Policy: Allow anyone to insert expiry reports
-- In production, you might want to restrict this based on company_id or require authentication
CREATE POLICY "Allow all inserts on expiry_reports"
ON expiry_reports
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Policy: Allow anyone to select expiry reports
-- In production, restrict to users who belong to the same company/store
CREATE POLICY "Allow all selects on expiry_reports"
ON expiry_reports
FOR SELECT
TO anon, authenticated
USING (true);

-- Policy: Allow anyone to update expiry reports
-- In production, restrict to owner or admins
CREATE POLICY "Allow all updates on expiry_reports"
ON expiry_reports
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Policy: Allow soft deletes (status update to 'deleted')
CREATE POLICY "Allow all deletes on expiry_reports"
ON expiry_reports
FOR DELETE
TO anon, authenticated
USING (true);

-- Also enable RLS on user_report_actions if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_report_actions') THEN
        ALTER TABLE user_report_actions ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Allow all operations on user_report_actions" ON user_report_actions;

        CREATE POLICY "Allow all operations on user_report_actions"
        ON user_report_actions
        FOR ALL
        TO anon, authenticated
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;

-- Enable RLS on expiry_notifications_log if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'expiry_notifications_log') THEN
        ALTER TABLE expiry_notifications_log ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Allow all operations on expiry_notifications_log" ON expiry_notifications_log;

        CREATE POLICY "Allow all operations on expiry_notifications_log"
        ON expiry_notifications_log
        FOR ALL
        TO anon, authenticated
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;

-- Grant necessary permissions
GRANT ALL ON expiry_reports TO anon;
GRANT ALL ON expiry_reports TO authenticated;

-- If sequences exist, grant usage
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_class WHERE relname = 'expiry_reports_id_seq') THEN
        GRANT USAGE, SELECT ON SEQUENCE expiry_reports_id_seq TO anon;
        GRANT USAGE, SELECT ON SEQUENCE expiry_reports_id_seq TO authenticated;
    END IF;
END $$;

-- Enable Realtime for the table (if not already)
-- This is handled in Supabase dashboard, but we can set up publication
DO $$
BEGIN
    -- Check if publication exists
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime FOR TABLE expiry_reports;
    ELSE
        -- Add table to existing publication if not already there
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE expiry_reports;
        EXCEPTION
            WHEN duplicate_object THEN
                NULL; -- Table already in publication
        END;
    END IF;
END $$;

COMMENT ON POLICY "Allow all inserts on expiry_reports" ON expiry_reports IS
'Temporary permissive policy - in production, restrict based on company_id';

COMMENT ON POLICY "Allow all selects on expiry_reports" ON expiry_reports IS
'Temporary permissive policy - in production, restrict based on store_id/company_id';
