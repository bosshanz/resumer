CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  github_id TEXT UNIQUE NOT NULL,
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS resumes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '未命名简历',
  content TEXT NOT NULL DEFAULT '',
  template_id TEXT NOT NULL DEFAULT 'minimal',
  theme_variables TEXT NOT NULL DEFAULT '{}',
  photo TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);

CREATE TABLE IF NOT EXISTS rewrite_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_resume_id TEXT NOT NULL,
  result_resume_id TEXT,
  job_description TEXT NOT NULL DEFAULT '',
  draft_content TEXT NOT NULL DEFAULT '',
  change_notes TEXT NOT NULL DEFAULT '[]',
  pending_items TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'generating',
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rewrite_sessions_user_id ON rewrite_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_rewrite_sessions_source ON rewrite_sessions(source_resume_id);
