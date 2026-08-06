PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS tasks (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','doing','blocked','done','archived')),
 important INTEGER NOT NULL DEFAULT 1, urgent INTEGER NOT NULL DEFAULT 1, quadrant TEXT NOT NULL DEFAULT 'q1' CHECK(quadrant IN ('q1','q2','q3','q4')),
 priority INTEGER NOT NULL DEFAULT 2 CHECK(priority BETWEEN 0 AND 4), progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
 canvas_x REAL NOT NULL DEFAULT 0, canvas_y REAL NOT NULL DEFAULT 0, width REAL NOT NULL DEFAULT 240, height REAL NOT NULL DEFAULT 96,
 parent_id TEXT NULL REFERENCES tasks(id) ON DELETE SET NULL, collapsed INTEGER NOT NULL DEFAULT 0,
 start_at TEXT NULL, due_at TEXT NULL, completed_at TEXT NULL, archived_at TEXT NULL, estimated_minutes INTEGER NULL, actual_minutes INTEGER NULL,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_quadrant ON tasks(quadrant);
CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at);
CREATE TABLE IF NOT EXISTS task_relations (
 id TEXT PRIMARY KEY, source_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, target_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
 relation_type TEXT NOT NULL CHECK(relation_type IN ('parent_child','dependency','reference')), label TEXT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(source_task_id,target_task_id,relation_type), CHECK(source_task_id <> target_task_id)
);
CREATE INDEX IF NOT EXISTS idx_relations_source ON task_relations(source_task_id);
CREATE INDEX IF NOT EXISTS idx_relations_target ON task_relations(target_task_id);
CREATE INDEX IF NOT EXISTS idx_relations_type ON task_relations(relation_type);
CREATE TABLE IF NOT EXISTS tags (id TEXT PRIMARY KEY,name TEXT NOT NULL COLLATE NOCASE UNIQUE,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS task_tags (task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,PRIMARY KEY(task_id,tag_id));
CREATE TABLE IF NOT EXISTS app_settings (setting_key TEXT PRIMARY KEY,setting_value TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at TEXT NOT NULL);

