use crate::{
    error::{AppError, AppResult},
    models::*,
};
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};

pub struct Database {
    pub connection: Mutex<Connection>,
    pub path: PathBuf,
    pub data_dir: PathBuf,
}

fn quadrant_flags(value: &str) -> AppResult<(bool, bool)> {
    match value {
        "q1" => Ok((true, true)),
        "q2" => Ok((true, false)),
        "q3" => Ok((false, true)),
        "q4" => Ok((false, false)),
        _ => Err(AppError::Validation("无效象限".into())),
    }
}

impl Database {
    pub fn open(data_dir: &Path) -> AppResult<Self> {
        fs::create_dir_all(data_dir)?;
        let path = data_dir.join("blackhole-tasks.db");
        let conn = Connection::open(&path)?;
        conn.execute_batch("PRAGMA foreign_keys=ON;PRAGMA journal_mode=WAL;PRAGMA synchronous=NORMAL;PRAGMA busy_timeout=5000;")?;
        conn.execute_batch(include_str!("../migrations/0001_initial.sql"))?;
        conn.execute("INSERT OR IGNORE INTO schema_migrations(version,name,applied_at) VALUES(1,'initial',?1)",[Utc::now().to_rfc3339()])?;
        Ok(Self {
            connection: Mutex::new(conn),
            path,
            data_dir: data_dir.to_path_buf(),
        })
    }
    pub fn list_tasks(&self) -> AppResult<Vec<Task>> {
        let conn = self
            .connection
            .lock()
            .map_err(|_| AppError::Database("数据库锁已损坏".into()))?;
        let mut stmt=conn.prepare("SELECT id,title,description,status,important,urgent,quadrant,priority,progress,canvas_x,canvas_y,width,height,parent_id,collapsed,start_at,due_at,completed_at,archived_at,estimated_minutes,actual_minutes,created_at,updated_at,version FROM tasks ORDER BY created_at")?;
        let rows = stmt.query_map([], row_to_task)?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }
    pub fn get_task(&self, id: &str) -> AppResult<Task> {
        let conn = self
            .connection
            .lock()
            .map_err(|_| AppError::Database("数据库锁已损坏".into()))?;
        conn.query_row("SELECT id,title,description,status,important,urgent,quadrant,priority,progress,canvas_x,canvas_y,width,height,parent_id,collapsed,start_at,due_at,completed_at,archived_at,estimated_minutes,actual_minutes,created_at,updated_at,version FROM tasks WHERE id=?1",[id],row_to_task).optional()?.ok_or_else(||AppError::NotFound(format!("任务 {id}")))
    }
    pub fn create_task(&self, input: CreateTaskInput) -> AppResult<Task> {
        if input.title.trim().is_empty() {
            return Err(AppError::Validation("标题不能为空".into()));
        }
        let quadrant = input.quadrant.unwrap_or_else(|| "q1".into());
        let (important, urgent) = quadrant_flags(&quadrant)?;
        let priority = input.priority.unwrap_or(2);
        if !(0..=4).contains(&priority) {
            return Err(AppError::Validation("优先级必须在 0 到 4".into()));
        }
        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let conn = self
            .connection
            .lock()
            .map_err(|_| AppError::Database("数据库锁已损坏".into()))?;
        conn.execute("INSERT INTO tasks(id,title,description,status,important,urgent,quadrant,priority,progress,canvas_x,canvas_y,width,height,parent_id,collapsed,due_at,created_at,updated_at,version) VALUES(?1,?2,?3,'todo',?4,?5,?6,?7,0,?8,?9,240,96,?10,0,?11,?12,?12,1)",params![id,input.title.trim(),input.description.unwrap_or_default(),important,urgent,quadrant,priority,input.canvas_x.unwrap_or(80.0),input.canvas_y.unwrap_or(80.0),input.parent_id,input.due_at,now])?;
        drop(conn);
        self.get_task(&id)
    }
    pub fn update_task(&self, id: &str, patch: serde_json::Value) -> AppResult<Task> {
        let mut task = self.get_task(id)?;
        let object = patch
            .as_object()
            .ok_or_else(|| AppError::Validation("更新内容必须是对象".into()))?;
        macro_rules! string {($key:literal,$field:ident)=>{if let Some(v)=object.get($key){task.$field=v.as_str().ok_or_else(||AppError::Validation(format!("{} 必须是字符串",$key)))?.to_string();}}}
        string!("title", title);
        string!("description", description);
        string!("status", status);
        string!("quadrant", quadrant);
        if task.title.trim().is_empty() {
            return Err(AppError::Validation("标题不能为空".into()));
        }
        if !["todo", "doing", "blocked", "done", "archived"].contains(&task.status.as_str()) {
            return Err(AppError::Validation("无效状态".into()));
        }
        let (important, urgent) = quadrant_flags(&task.quadrant)?;
        task.important = important;
        task.urgent = urgent;
        if let Some(v) = object.get("priority") {
            task.priority = v
                .as_i64()
                .ok_or_else(|| AppError::Validation("priority 必须是整数".into()))?
        }
        if let Some(v) = object.get("progress") {
            task.progress = v
                .as_i64()
                .ok_or_else(|| AppError::Validation("progress 必须是整数".into()))?
                .clamp(0, 100)
        }
        if let Some(v) = object.get("collapsed") {
            task.collapsed = v
                .as_bool()
                .ok_or_else(|| AppError::Validation("collapsed 必须是布尔值".into()))?
        }
        if let Some(v) = object.get("canvasX") {
            task.canvas_x = v
                .as_f64()
                .ok_or_else(|| AppError::Validation("canvasX 必须是数字".into()))?
        }
        if let Some(v) = object.get("canvasY") {
            task.canvas_y = v
                .as_f64()
                .ok_or_else(|| AppError::Validation("canvasY 必须是数字".into()))?
        }
        if let Some(v) = object.get("dueAt") {
            task.due_at = if v.is_null() {
                None
            } else {
                Some(
                    v.as_str()
                        .ok_or_else(|| AppError::Validation("dueAt 必须是日期字符串".into()))?
                        .into(),
                )
            }
        }
        task.updated_at = Utc::now().to_rfc3339();
        task.version += 1;
        let conn = self
            .connection
            .lock()
            .map_err(|_| AppError::Database("数据库锁已损坏".into()))?;
        conn.execute("UPDATE tasks SET title=?2,description=?3,status=?4,important=?5,urgent=?6,quadrant=?7,priority=?8,progress=?9,canvas_x=?10,canvas_y=?11,collapsed=?12,due_at=?13,updated_at=?14,version=?15 WHERE id=?1",params![id,task.title,task.description,task.status,task.important,task.urgent,task.quadrant,task.priority,task.progress,task.canvas_x,task.canvas_y,task.collapsed,task.due_at,task.updated_at,task.version])?;
        drop(conn);
        self.get_task(id)
    }
    pub fn delete_task(&self, id: &str) -> AppResult<()> {
        let conn = self
            .connection
            .lock()
            .map_err(|_| AppError::Database("数据库锁已损坏".into()))?;
        if conn.execute("DELETE FROM tasks WHERE id=?1", [id])? == 0 {
            return Err(AppError::NotFound(format!("任务 {id}")));
        }
        Ok(())
    }
    pub fn complete_task(&self, id: &str) -> AppResult<Task> {
        let now = Utc::now().to_rfc3339();
        let conn = self
            .connection
            .lock()
            .map_err(|_| AppError::Database("数据库锁已损坏".into()))?;
        conn.execute("UPDATE tasks SET status='done',progress=100,completed_at=?2,updated_at=?2,version=version+1 WHERE id=?1",params![id,now])?;
        drop(conn);
        self.get_task(id)
    }
    pub fn update_positions(&self, updates: Vec<TaskPositionUpdate>) -> AppResult<()> {
        let mut conn = self
            .connection
            .lock()
            .map_err(|_| AppError::Database("数据库锁已损坏".into()))?;
        let tx = conn.transaction()?;
        for item in updates {
            let (important, urgent) = quadrant_flags(&item.quadrant)?;
            tx.execute("UPDATE tasks SET canvas_x=?2,canvas_y=?3,quadrant=?4,important=?5,urgent=?6,updated_at=?7,version=version+1 WHERE id=?1",params![item.id,item.canvas_x,item.canvas_y,item.quadrant,important,urgent,Utc::now().to_rfc3339()])?;
        }
        tx.commit()?;
        Ok(())
    }
    pub fn list_relations(&self) -> AppResult<Vec<TaskRelation>> {
        let conn = self
            .connection
            .lock()
            .map_err(|_| AppError::Database("数据库锁已损坏".into()))?;
        let mut stmt=conn.prepare("SELECT id,source_task_id,target_task_id,relation_type,label,created_at,updated_at FROM task_relations ORDER BY created_at")?;
        let relations = stmt
            .query_map([], |r| {
                Ok(TaskRelation {
                    id: r.get(0)?,
                    source_task_id: r.get(1)?,
                    target_task_id: r.get(2)?,
                    relation_type: r.get(3)?,
                    label: r.get(4)?,
                    created_at: r.get(5)?,
                    updated_at: r.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(relations)
    }
    pub fn create_relation(&self, input: CreateRelationInput) -> AppResult<TaskRelation> {
        if !["parent_child", "dependency", "reference"].contains(&input.relation_type.as_str()) {
            return Err(AppError::Validation("无效关系类型".into()));
        }
        if input.source_task_id == input.target_task_id {
            return Err(AppError::Validation("任务不能关联自身".into()));
        }
        if input.relation_type != "reference"
            && self.would_cycle(
                &input.source_task_id,
                &input.target_task_id,
                &input.relation_type,
            )?
        {
            return Err(AppError::Conflict("该关系会形成循环".into()));
        }
        if input.relation_type == "parent_child" {
            let conn = self
                .connection
                .lock()
                .map_err(|_| AppError::Database("数据库锁已损坏".into()))?;
            let count:i64=conn.query_row("SELECT COUNT(*) FROM task_relations WHERE target_task_id=?1 AND relation_type='parent_child'",[&input.target_task_id],|r|r.get(0))?;
            if count > 0 {
                return Err(AppError::Conflict("一个任务最多有一个父任务".into()));
            }
        }
        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let conn = self
            .connection
            .lock()
            .map_err(|_| AppError::Database("数据库锁已损坏".into()))?;
        conn.execute("INSERT INTO task_relations(id,source_task_id,target_task_id,relation_type,label,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?6)",params![id,input.source_task_id,input.target_task_id,input.relation_type,input.label,now])?;
        drop(conn);
        self.list_relations()?
            .into_iter()
            .find(|r| r.id == id)
            .ok_or_else(|| AppError::NotFound("新建关系".into()))
    }
    pub fn delete_relation(&self, id: &str) -> AppResult<()> {
        let conn = self
            .connection
            .lock()
            .map_err(|_| AppError::Database("数据库锁已损坏".into()))?;
        conn.execute("DELETE FROM task_relations WHERE id=?1", [id])?;
        Ok(())
    }
    fn would_cycle(&self, source: &str, target: &str, kind: &str) -> AppResult<bool> {
        let relations = self.list_relations()?;
        let mut stack = vec![target.to_string()];
        let mut visited = std::collections::HashSet::new();
        while let Some(current) = stack.pop() {
            if current == source {
                return Ok(true);
            }
            if !visited.insert(current.clone()) {
                continue;
            }
            for relation in relations
                .iter()
                .filter(|r| r.relation_type == kind && r.source_task_id == current)
            {
                stack.push(relation.target_task_id.clone())
            }
        }
        Ok(false)
    }
    pub fn list_tags(&self) -> AppResult<Vec<Tag>> {
        let conn = self
            .connection
            .lock()
            .map_err(|_| AppError::Database("数据库锁已损坏".into()))?;
        let mut stmt = conn.prepare(
            "SELECT id,name,created_at,updated_at FROM tags ORDER BY name COLLATE NOCASE",
        )?;
        let tags = stmt
            .query_map([], |r| {
                Ok(Tag {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    created_at: r.get(2)?,
                    updated_at: r.get(3)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(tags)
    }
    pub fn create_tag(&self, name: &str) -> AppResult<Tag> {
        let name = name.trim();
        if name.is_empty() {
            return Err(AppError::Validation("标签名不能为空".into()));
        }
        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let conn = self
            .connection
            .lock()
            .map_err(|_| AppError::Database("数据库锁已损坏".into()))?;
        conn.execute(
            "INSERT INTO tags(id,name,created_at,updated_at) VALUES(?1,?2,?3,?3)",
            params![id, name, now],
        )?;
        Ok(Tag {
            id,
            name: name.into(),
            created_at: now.clone(),
            updated_at: now,
        })
    }
    pub fn rename_tag(&self, id: &str, name: &str) -> AppResult<Tag> {
        let name = name.trim();
        if name.is_empty() {
            return Err(AppError::Validation("标签名不能为空".into()));
        }
        let now = Utc::now().to_rfc3339();
        let conn = self
            .connection
            .lock()
            .map_err(|_| AppError::Database("数据库锁已损坏".into()))?;
        if conn.execute(
            "UPDATE tags SET name=?2,updated_at=?3 WHERE id=?1",
            params![id, name, now],
        )? == 0
        {
            return Err(AppError::NotFound(format!("标签 {id}")));
        }
        Ok(Tag {
            id: id.into(),
            name: name.into(),
            created_at: now.clone(),
            updated_at: now,
        })
    }
    pub fn delete_tag(&self, id: &str) -> AppResult<()> {
        let conn = self
            .connection
            .lock()
            .map_err(|_| AppError::Database("数据库锁已损坏".into()))?;
        conn.execute("DELETE FROM tags WHERE id=?1", [id])?;
        Ok(())
    }
    pub fn set_task_tags(&self, task_id: &str, tag_ids: Vec<String>) -> AppResult<()> {
        let mut conn = self
            .connection
            .lock()
            .map_err(|_| AppError::Database("数据库锁已损坏".into()))?;
        let tx = conn.transaction()?;
        tx.execute("DELETE FROM task_tags WHERE task_id=?1", [task_id])?;
        for tag_id in tag_ids {
            tx.execute(
                "INSERT INTO task_tags(task_id,tag_id) VALUES(?1,?2)",
                params![task_id, tag_id],
            )?;
        }
        tx.commit()?;
        Ok(())
    }
    pub fn get_settings(&self) -> AppResult<AppSettings> {
        let conn = self
            .connection
            .lock()
            .map_err(|_| AppError::Database("数据库锁已损坏".into()))?;
        let json: Option<String> = conn
            .query_row(
                "SELECT setting_value FROM app_settings WHERE setting_key='settings'",
                [],
                |r| r.get(0),
            )
            .optional()?;
        match json {
            Some(v) => Ok(serde_json::from_str(&v)?),
            None => Ok(AppSettings::default()),
        }
    }
    pub fn save_settings(&self, settings: &AppSettings) -> AppResult<()> {
        let conn = self
            .connection
            .lock()
            .map_err(|_| AppError::Database("数据库锁已损坏".into()))?;
        conn.execute("INSERT INTO app_settings(setting_key,setting_value,updated_at) VALUES('settings',?1,?2) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=excluded.updated_at",params![serde_json::to_string(settings)?,Utc::now().to_rfc3339()])?;
        Ok(())
    }
    pub fn backup(&self) -> AppResult<PathBuf> {
        let dir = self.data_dir.join("backups");
        fs::create_dir_all(&dir)?;
        let path = dir.join(format!("backup-{}.db", Utc::now().format("%Y%m%d-%H%M%S")));
        let conn = self
            .connection
            .lock()
            .map_err(|_| AppError::Database("数据库锁已损坏".into()))?;
        let mut target = Connection::open(&path)?;
        let backup = rusqlite::backup::Backup::new(&conn, &mut target)?;
        backup.run_to_completion(100, std::time::Duration::from_millis(20), None)?;
        drop(backup);
        drop(target);
        prune_backups(&dir, 14)?;
        Ok(path)
    }
    pub fn list_backups(&self) -> AppResult<Vec<PathBuf>> {
        let dir = self.data_dir.join("backups");
        fs::create_dir_all(&dir)?;
        let mut paths = fs::read_dir(dir)?
            .filter_map(Result::ok)
            .map(|e| e.path())
            .filter(|p| p.extension().is_some_and(|v| v == "db"))
            .collect::<Vec<_>>();
        paths.sort();
        paths.reverse();
        Ok(paths)
    }
    pub fn restore_backup(&self, path: &Path) -> AppResult<()> {
        let canonical = path.canonicalize()?;
        let backup_root = self.data_dir.join("backups").canonicalize()?;
        if !canonical.starts_with(&backup_root) {
            return Err(AppError::Validation(
                "只能恢复应用备份目录内的数据库".into(),
            ));
        }
        let source = Connection::open(canonical)?;
        source.execute_batch("PRAGMA integrity_check;")?;
        let mut target = self
            .connection
            .lock()
            .map_err(|_| AppError::Database("数据库锁已损坏".into()))?;
        let backup = rusqlite::backup::Backup::new(&source, &mut target)?;
        backup.run_to_completion(100, std::time::Duration::from_millis(20), None)?;
        Ok(())
    }
    pub fn export_json(&self) -> AppResult<String> {
        let package = serde_json::json!({"format":"blackhole-tasks","formatVersion":1,"exportedAt":Utc::now().to_rfc3339(),"appVersion":"0.1.0","tasks":self.list_tasks()?,"relations":self.list_relations()?,"tags":self.list_tags()?,"settings":self.get_settings()?});
        Ok(serde_json::to_string_pretty(&package)?)
    }
    pub fn import_json(&self, json: &str, mode: &str) -> AppResult<serde_json::Value> {
        if !["merge", "replace"].contains(&mode) {
            return Err(AppError::Validation(
                "导入模式必须是 merge 或 replace".into(),
            ));
        }
        let value: serde_json::Value = serde_json::from_str(json)?;
        if value.get("format").and_then(|v| v.as_str()) != Some("blackhole-tasks") {
            return Err(AppError::Validation("不是 BlackHole Tasks 导出文件".into()));
        }
        if value.get("formatVersion").and_then(|v| v.as_i64()) != Some(1) {
            return Err(AppError::Validation("不支持的导出格式版本".into()));
        }
        let tasks: Vec<Task> = serde_json::from_value(
            value
                .get("tasks")
                .cloned()
                .ok_or_else(|| AppError::Validation("缺少 tasks".into()))?,
        )?;
        let relations: Vec<TaskRelation> = serde_json::from_value(
            value
                .get("relations")
                .cloned()
                .unwrap_or_else(|| serde_json::json!([])),
        )?;
        let relation_count = relations.len();
        if mode == "replace" {
            self.backup()?;
        }
        let mut conn = self
            .connection
            .lock()
            .map_err(|_| AppError::Database("数据库锁已损坏".into()))?;
        let tx = conn.transaction()?;
        if mode == "replace" {
            tx.execute("DELETE FROM task_relations", [])?;
            tx.execute("DELETE FROM task_tags", [])?;
            tx.execute("DELETE FROM tasks", [])?;
        }
        let mut id_map = std::collections::HashMap::new();
        for task in tasks {
            let new_id = if mode == "merge"
                && tx.query_row(
                    "SELECT EXISTS(SELECT 1 FROM tasks WHERE id=?1)",
                    [&task.id],
                    |r| r.get::<_, bool>(0),
                )? {
                uuid::Uuid::new_v4().to_string()
            } else {
                task.id.clone()
            };
            id_map.insert(task.id.clone(), new_id.clone());
            let (important, urgent) = quadrant_flags(&task.quadrant)?;
            tx.execute("INSERT INTO tasks(id,title,description,status,important,urgent,quadrant,priority,progress,canvas_x,canvas_y,width,height,parent_id,collapsed,start_at,due_at,completed_at,archived_at,estimated_minutes,actual_minutes,created_at,updated_at,version) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,NULL,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23)",params![new_id,task.title,task.description,task.status,important,urgent,task.quadrant,task.priority.clamp(0,4),task.progress.clamp(0,100),task.canvas_x,task.canvas_y,task.width,task.height,task.collapsed,task.start_at,task.due_at,task.completed_at,task.archived_at,task.estimated_minutes,task.actual_minutes,task.created_at,task.updated_at,task.version])?;
        }
        for relation in relations {
            let Some(source) = id_map.get(&relation.source_task_id) else {
                continue;
            };
            let Some(target) = id_map.get(&relation.target_task_id) else {
                continue;
            };
            tx.execute("INSERT OR IGNORE INTO task_relations(id,source_task_id,target_task_id,relation_type,label,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7)",params![uuid::Uuid::new_v4().to_string(),source,target,relation.relation_type,relation.label,relation.created_at,relation.updated_at])?;
        }
        tx.commit()?;
        Ok(
            serde_json::json!({"importedTasks":id_map.len(),"importedRelations":relation_count,"mode":mode}),
        )
    }
    pub fn validate_cycle(&self, source: &str, target: &str, kind: &str) -> AppResult<bool> {
        Ok(!self.would_cycle(source, target, kind)?)
    }
}

fn row_to_task(r: &rusqlite::Row<'_>) -> rusqlite::Result<Task> {
    Ok(Task {
        id: r.get(0)?,
        title: r.get(1)?,
        description: r.get(2)?,
        status: r.get(3)?,
        important: r.get(4)?,
        urgent: r.get(5)?,
        quadrant: r.get(6)?,
        priority: r.get(7)?,
        progress: r.get(8)?,
        canvas_x: r.get(9)?,
        canvas_y: r.get(10)?,
        width: r.get(11)?,
        height: r.get(12)?,
        parent_id: r.get(13)?,
        collapsed: r.get(14)?,
        start_at: r.get(15)?,
        due_at: r.get(16)?,
        completed_at: r.get(17)?,
        archived_at: r.get(18)?,
        estimated_minutes: r.get(19)?,
        actual_minutes: r.get(20)?,
        created_at: r.get(21)?,
        updated_at: r.get(22)?,
        version: r.get(23)?,
        tags: vec![],
    })
}
fn prune_backups(dir: &Path, keep: usize) -> AppResult<()> {
    let mut files = fs::read_dir(dir)?
        .filter_map(Result::ok)
        .filter(|e| e.path().extension().is_some_and(|v| v == "db"))
        .collect::<Vec<_>>();
    files.sort_by_key(|e| e.file_name());
    let remove = files.len().saturating_sub(keep);
    for entry in files.into_iter().take(remove) {
        fs::remove_file(entry.path())?
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn flags_are_consistent() {
        assert_eq!(quadrant_flags("q3").unwrap(), (false, true));
        assert!(quadrant_flags("x").is_err())
    }
    #[test]
    fn crud_and_cycle_validation() {
        let dir = std::env::temp_dir().join(format!("blackhole-test-{}", uuid::Uuid::new_v4()));
        let db = Database::open(&dir).unwrap();
        let a = db
            .create_task(CreateTaskInput {
                title: "A".into(),
                description: None,
                quadrant: None,
                priority: None,
                canvas_x: None,
                canvas_y: None,
                due_at: None,
                parent_id: None,
            })
            .unwrap();
        let b = db
            .create_task(CreateTaskInput {
                title: "B".into(),
                description: None,
                quadrant: None,
                priority: None,
                canvas_x: None,
                canvas_y: None,
                due_at: None,
                parent_id: None,
            })
            .unwrap();
        db.create_relation(CreateRelationInput {
            source_task_id: a.id.clone(),
            target_task_id: b.id.clone(),
            relation_type: "dependency".into(),
            label: None,
        })
        .unwrap();
        assert!(db
            .create_relation(CreateRelationInput {
                source_task_id: b.id,
                target_task_id: a.id,
                relation_type: "dependency".into(),
                label: None
            })
            .is_err());
        drop(db);
        std::fs::remove_dir_all(dir).unwrap();
    }
}
