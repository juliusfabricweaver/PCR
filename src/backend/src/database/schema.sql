-- PCR Application Database Schema
-- SQLite database schema with proper constraints and indexes

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA temp_store = memory;
PRAGMA mmap_size = 268435456; -- 256MB

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL CHECK(length(username) >= 3 AND length(username) <= 50),
    password_hash TEXT NOT NULL CHECK(length(password_hash) >= 60),
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Drafts table for encrypted form data
CREATE TABLE IF NOT EXISTS drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    data_encrypted BLOB NOT NULL,
    iv BLOB NOT NULL,
    salt BLOB NOT NULL,
    auth_tag BLOB NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for draft queries
CREATE INDEX IF NOT EXISTS idx_drafts_user_id ON drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_drafts_expires_at ON drafts(expires_at);
CREATE INDEX IF NOT EXISTS idx_drafts_created_at ON drafts(created_at DESC);

-- Submissions table for completed forms
CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    data TEXT NOT NULL, -- JSON string of form data
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for submission queries
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON submissions(submitted_at DESC);

-- Logs table for audit trail
CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL CHECK(action IN (
        'login', 'logout', 'draft_saved', 'draft_loaded', 'form_submitted', 
        'form_cleared', 'user_created', 'user_deleted', 'failed_login', 
        'account_locked', 'session_expired'
    )),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    details TEXT, -- JSON string for additional details
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for log queries
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_action ON logs(action);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_action_timestamp ON logs(action, timestamp DESC);

-- Sessions table for active user sessions
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    data TEXT NOT NULL, -- JSON session data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for session management
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity DESC);

-- Login attempts table for rate limiting and security
CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    locked_until DATETIME NULL
);

-- Create indexes for login attempt tracking
CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts(username);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at ON login_attempts(attempted_at DESC);

-- Configuration table for application settings
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'string' CHECK(type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Migration tracking table
CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Triggers to update updated_at timestamps
CREATE TRIGGER IF NOT EXISTS users_updated_at 
    AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS app_config_updated_at 
    AFTER UPDATE ON app_config
BEGIN
    UPDATE app_config SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
END;

-- Trigger to clean up expired drafts
CREATE TRIGGER IF NOT EXISTS cleanup_expired_drafts
    AFTER INSERT ON drafts
BEGIN
    DELETE FROM drafts WHERE expires_at < CURRENT_TIMESTAMP;
END;

-- Trigger to clean up expired sessions
CREATE TRIGGER IF NOT EXISTS cleanup_expired_sessions
    AFTER INSERT ON sessions
BEGIN
    DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP;
END;

-- Views for common queries
CREATE VIEW IF NOT EXISTS user_stats AS
SELECT 
    u.id,
    u.username,
    u.role,
    u.created_at,
    COUNT(DISTINCT d.id) as draft_count,
    COUNT(DISTINCT s.id) as submission_count,
    MAX(s.submitted_at) as last_submission
FROM users u
LEFT JOIN drafts d ON u.id = d.user_id AND d.expires_at > CURRENT_TIMESTAMP
LEFT JOIN submissions s ON u.id = s.user_id
GROUP BY u.id, u.username, u.role, u.created_at;

CREATE VIEW IF NOT EXISTS recent_activity AS
SELECT 
    l.id,
    l.action,
    l.timestamp,
    l.details,
    u.username,
    u.role
FROM logs l
LEFT JOIN users u ON l.user_id = u.id
ORDER BY l.timestamp DESC;

-- Initial configuration data
INSERT OR IGNORE INTO app_config (key, value, type, description) VALUES 
('app_version', '1.0.0', 'string', 'Application version'),
('db_version', '1.0.0', 'string', 'Database schema version'),
('session_timeout', '900', 'number', 'Session timeout in seconds (15 minutes)'),
('draft_expiry', '86400', 'number', 'Draft expiry time in seconds (24 hours)'),
('max_login_attempts', '5', 'number', 'Maximum login attempts before lockout'),
('lockout_duration', '1800', 'number', 'Account lockout duration in seconds (30 minutes)'),
('password_min_length', '8', 'number', 'Minimum password length'),
('bcrypt_rounds', '12', 'number', 'BCrypt hash rounds'),
('created_at', datetime('now'), 'string', 'Database creation timestamp');

