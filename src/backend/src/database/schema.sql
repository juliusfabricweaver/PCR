-- PCR Application Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT CHECK (role IN ('admin', 'user')) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- PCR Reports/Drafts table (single table for both drafts and completed reports)
CREATE TABLE IF NOT EXISTS pcr_reports (
    id TEXT PRIMARY KEY,
    form_data TEXT NOT NULL, -- JSON blob of all form data (PCRFormData)
    status TEXT CHECK (status IN ('draft', 'completed', 'submitted')) DEFAULT 'draft',
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL, -- Can be 'system' for automated tasks
    action TEXT NOT NULL, -- 'login', 'logout', 'create_pcr', 'update_pcr', 'submit_pcr', 'cleanup_pcr_reports', etc.
    resource_type TEXT, -- 'pcr_report', 'user', etc.
    resource_id TEXT, -- ID of the resource being acted upon
    details TEXT, -- JSON blob with additional details
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    -- Note: Removed FOREIGN KEY constraint to allow 'system' as user_id
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_pcr_reports_created_by ON pcr_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_pcr_reports_status ON pcr_reports(status);
CREATE INDEX IF NOT EXISTS idx_pcr_reports_created_at ON pcr_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
