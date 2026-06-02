use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TaskJson {
    pub task_id: i64,
    pub title: String,
    pub project_priority: i32,
    pub is_daily_priority: bool,
    pub is_weekly_priority: bool,
    pub status: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
    pub completion_percentage: i32,
    pub planned_for_next_day: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TaskUpdateJson {
    pub id: i64,
    pub task_id: i64,
    pub task_title: String,
    pub date: String,
    pub update_text: String,
    pub completion_percentage: i32,
    pub status: String,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TasksJsonGroup {
    pub needs_to_do: Vec<TaskJson>,
    pub on_my_plate: Vec<TaskJson>,
    pub done: Vec<TaskJson>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProjectStatusResponse {
    pub project_id: Option<i64>,
    pub project_name: String,
    pub project_priority: i32,
    pub tasks: TasksJsonGroup,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProjectSummary {
    pub project_name: String,
    pub completed: Vec<String>,
    pub in_progress: Vec<String>,
    pub pending: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SummaryResponse {
    pub summary_type: String,
    pub start_date: String,
    pub end_date: String,
    pub projects: Vec<ProjectSummary>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ArchivedProjectJson {
    pub id: i64,
    pub name: String,
    pub priority: i32,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TrashProject {
    pub id: i64,
    pub name: String,
    pub priority: i32,
    pub deleted_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TrashTask {
    pub id: i64,
    pub title: String,
    pub project_name: Option<String>,
    pub deleted_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TrashResponse {
    pub projects: Vec<TrashProject>,
    pub tasks: Vec<TrashTask>,
}

pub fn open_encrypted_db<P: AsRef<std::path::Path>>(path: P, password: &str) -> Result<Connection> {
    let conn = Connection::open(path)?;

    // SQLCipher requires setting the key using pragma_update
    conn.pragma_update(None, "key", password)?;

    // Verify the key by running a test query
    {
        let mut stmt = conn.prepare("SELECT count(*) FROM sqlite_master;")?;
        let _ = stmt.query([])?;
    }

    Ok(conn)
}

pub fn run_migrations(conn: &Connection) -> Result<()> {
    conn.execute("PRAGMA foreign_keys = ON;", [])?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            priority INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NULLABLE,
            title TEXT NOT NULL,
            status TEXT CHECK(status IN ('todo', 'in_progress', 'done')) NOT NULL,
            project_priority INTEGER DEFAULT 0,
            is_daily_priority BOOLEAN DEFAULT 0,
            is_weekly_priority BOOLEAN DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME NULLABLE,
            completion_percentage INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
        );",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS task_daily_priorities (
            task_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            is_daily_priority BOOLEAN NOT NULL DEFAULT 0,
            planned_for_next_day BOOLEAN NOT NULL DEFAULT 1,
            PRIMARY KEY (task_id, date),
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS task_updates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            update_text TEXT NOT NULL,
            completion_percentage INTEGER NOT NULL DEFAULT 0,
            status TEXT CHECK(status IN ('todo', 'in_progress', 'done')) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS carry_over_runs (
            date TEXT PRIMARY KEY
        );",
        [],
    )?;

    // Safe alterations
    let has_completion_percentage: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM pragma_table_info('tasks') WHERE name='completion_percentage');",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);
    if !has_completion_percentage {
        if let Err(e) = conn.execute(
            "ALTER TABLE tasks ADD COLUMN completion_percentage INTEGER DEFAULT 0;",
            [],
        ) {
            eprintln!("Migration completion_percentage warning/error: {:?}", e);
        }
    }

    let has_created_at: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM pragma_table_info('tasks') WHERE name='created_at');",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);
    if !has_created_at {
        if let Err(e) = conn.execute("ALTER TABLE tasks ADD COLUMN created_at DATETIME;", []) {
            eprintln!("Migration created_at warning/error: {:?}", e);
        }
    }
    let _ = conn.execute("UPDATE tasks SET created_at = COALESCE(updated_at, CURRENT_TIMESTAMP) WHERE created_at IS NULL;", []);

    // Safe alterations for archiving and soft-deletes
    let has_archived: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM pragma_table_info('projects') WHERE name='archived');",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);
    if !has_archived {
        let _ = conn.execute(
            "ALTER TABLE projects ADD COLUMN archived BOOLEAN DEFAULT 0;",
            [],
        );
    }

    let has_deleted_proj: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM pragma_table_info('projects') WHERE name='deleted');",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);
    if !has_deleted_proj {
        let _ = conn.execute(
            "ALTER TABLE projects ADD COLUMN deleted BOOLEAN DEFAULT 0;",
            [],
        );
    }

    let has_deleted_at_proj: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM pragma_table_info('projects') WHERE name='deleted_at');",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);
    if !has_deleted_at_proj {
        let _ = conn.execute("ALTER TABLE projects ADD COLUMN deleted_at DATETIME;", []);
    }

    let has_deleted_tasks: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM pragma_table_info('tasks') WHERE name='deleted');",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);
    if !has_deleted_tasks {
        let _ = conn.execute(
            "ALTER TABLE tasks ADD COLUMN deleted BOOLEAN DEFAULT 0;",
            [],
        );
    }

    let has_deleted_at_tasks: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM pragma_table_info('tasks') WHERE name='deleted_at');",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);
    if !has_deleted_at_tasks {
        let _ = conn.execute("ALTER TABLE tasks ADD COLUMN deleted_at DATETIME;", []);
    }

    // Perform data migrations
    let count_priorities: i64 =
        conn.query_row("SELECT count(*) FROM task_daily_priorities;", [], |row| {
            row.get(0)
        })?;
    if count_priorities == 0 {
        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        conn.execute(
            "INSERT INTO task_daily_priorities (task_id, date, is_daily_priority, planned_for_next_day)
             SELECT id, ?, is_daily_priority, 1 FROM tasks WHERE is_daily_priority = 1;",
            params![today],
        )?;
    }

    let count_updates: i64 =
        conn.query_row("SELECT count(*) FROM task_updates;", [], |row| row.get(0))?;
    if count_updates == 0 {
        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        conn.execute(
            "INSERT INTO task_updates (task_id, date, update_text, completion_percentage, status, created_at)
             SELECT 
                id, 
                COALESCE(substr(updated_at, 1, 10), ?), 
                'Initial state', 
                CASE WHEN status = 'done' THEN 100 ELSE 0 END,
                status,
                COALESCE(updated_at, CURRENT_TIMESTAMP)
             FROM tasks;",
            params![today],
        )?;
    }

    let count_runs: i64 = conn.query_row("SELECT count(*) FROM carry_over_runs;", [], |row| {
        row.get(0)
    })?;
    if count_runs == 0 {
        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        let _ = conn.execute(
            "INSERT OR IGNORE INTO carry_over_runs (date) VALUES (?);",
            params![today],
        );
    }

    Ok(())
}

// PROJECTS CRUD

pub fn create_project(conn: &Connection, name: &str, priority: i32) -> Result<i64> {
    conn.execute(
        "INSERT INTO projects (name, priority) VALUES (?, ?);",
        params![name, priority],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update_project(conn: &Connection, id: i64, name: &str, priority: i32) -> Result<()> {
    conn.execute(
        "UPDATE projects SET name = ?, priority = ? WHERE id = ?;",
        params![name, priority, id],
    )?;
    Ok(())
}

pub fn delete_project(conn: &Connection, id: i64, delete_tasks: bool) -> Result<()> {
    let now = chrono::Local::now().to_rfc3339();
    conn.execute(
        "UPDATE projects SET deleted = 1, deleted_at = ? WHERE id = ?;",
        params![now, id],
    )?;

    if delete_tasks {
        conn.execute(
            "UPDATE tasks SET deleted = 1, deleted_at = ? WHERE project_id = ?;",
            params![now, id],
        )?;
    } else {
        conn.execute(
            "UPDATE tasks SET project_id = NULL WHERE project_id = ?;",
            params![id],
        )?;
    }
    Ok(())
}

// TASKS CRUD

pub fn sync_task_with_latest_update(conn: &Connection, task_id: i64) -> Result<()> {
    let mut stmt = conn.prepare(
        "SELECT status, completion_percentage 
         FROM task_updates 
         WHERE task_id = ? 
         ORDER BY date DESC, created_at DESC, id DESC 
         LIMIT 1;",
    )?;
    let mut rows = stmt.query(params![task_id])?;
    if let Some(row) = rows.next()? {
        let status: String = row.get(0)?;
        let completion_percentage: i32 = row.get(1)?;
        conn.execute(
            "UPDATE tasks SET status = ?, completion_percentage = ? WHERE id = ?;",
            params![status, completion_percentage, task_id],
        )?;
    } else {
        conn.execute(
            "UPDATE tasks SET status = 'todo', completion_percentage = 0 WHERE id = ?;",
            params![task_id],
        )?;
    }
    Ok(())
}

pub fn get_task_updates(conn: &Connection, task_id: i64) -> Result<Vec<TaskUpdateJson>> {
    let mut stmt = conn.prepare(
        "SELECT tu.id, tu.task_id, t.title, tu.date, tu.update_text, tu.completion_percentage, tu.status, tu.created_at
         FROM task_updates tu
         JOIN tasks t ON tu.task_id = t.id
         WHERE tu.task_id = ?
         ORDER BY tu.date DESC, tu.created_at DESC, tu.id DESC;"
    )?;
    let rows = stmt.query_map(params![task_id], |row| {
        Ok(TaskUpdateJson {
            id: row.get(0)?,
            task_id: row.get(1)?,
            task_title: row.get(2)?,
            date: row.get(3)?,
            update_text: row.get(4)?,
            completion_percentage: row.get(5)?,
            status: row.get(6)?,
            created_at: row.get(7)?,
        })
    })?;
    let mut results = Vec::new();
    for r in rows {
        results.push(r?);
    }
    Ok(results)
}

pub fn create_task_update(
    conn: &Connection,
    task_id: i64,
    date: &str,
    update_text: &str,
    completion_percentage: i32,
    status: &str,
) -> Result<i64> {
    let completion_percentage = completion_percentage.clamp(0, 100);
    conn.execute(
        "INSERT INTO task_updates (task_id, date, update_text, completion_percentage, status) VALUES (?, ?, ?, ?, ?);",
        params![task_id, date, update_text, completion_percentage, status],
    )?;
    let id = conn.last_insert_rowid();
    sync_task_with_latest_update(conn, task_id)?;
    Ok(id)
}

pub fn update_task_update(
    conn: &Connection,
    id: i64,
    update_text: &str,
    completion_percentage: i32,
    status: &str,
) -> Result<()> {
    let completion_percentage = completion_percentage.clamp(0, 100);

    let task_id: i64 = conn.query_row(
        "SELECT task_id FROM task_updates WHERE id = ?;",
        params![id],
        |row| row.get(0),
    )?;

    conn.execute(
        "UPDATE task_updates SET update_text = ?, completion_percentage = ?, status = ? WHERE id = ?;",
        params![update_text, completion_percentage, status, id],
    )?;

    sync_task_with_latest_update(conn, task_id)?;
    Ok(())
}

pub fn delete_task_update(conn: &Connection, id: i64) -> Result<()> {
    let task_id: i64 = conn.query_row(
        "SELECT task_id FROM task_updates WHERE id = ?;",
        params![id],
        |row| row.get(0),
    )?;

    conn.execute("DELETE FROM task_updates WHERE id = ?;", params![id])?;

    sync_task_with_latest_update(conn, task_id)?;
    Ok(())
}

pub fn get_timeline(conn: &Connection) -> Result<Vec<TaskUpdateJson>> {
    let mut stmt = conn.prepare(
        "SELECT tu.id, tu.task_id, t.title, tu.date, tu.update_text, tu.completion_percentage, tu.status, tu.created_at
         FROM task_updates tu
         JOIN tasks t ON tu.task_id = t.id
         WHERE t.deleted = 0 AND (t.project_id IS NULL OR t.project_id IN (SELECT id FROM projects WHERE deleted = 0 AND archived = 0))
         ORDER BY tu.date DESC, tu.created_at DESC, tu.id DESC;"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(TaskUpdateJson {
            id: row.get(0)?,
            task_id: row.get(1)?,
            task_title: row.get(2)?,
            date: row.get(3)?,
            update_text: row.get(4)?,
            completion_percentage: row.get(5)?,
            status: row.get(6)?,
            created_at: row.get(7)?,
        })
    })?;
    let mut results = Vec::new();
    for r in rows {
        results.push(r?);
    }
    Ok(results)
}

pub fn carry_over_priorities(conn: &Connection, target_date: &str) -> Result<()> {
    let already_run: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM carry_over_runs WHERE date = ?);",
        params![target_date],
        |row| row.get(0),
    )?;

    if already_run {
        return Ok(());
    }

    let mut stmt_prev = conn.prepare(
        "SELECT date FROM task_daily_priorities 
         WHERE date < ? 
         ORDER BY date DESC 
         LIMIT 1;",
    )?;
    let mut rows_prev = stmt_prev.query(params![target_date])?;
    let prev_date = if let Some(row) = rows_prev.next()? {
        Some(row.get::<_, String>(0)?)
    } else {
        None
    };

    if let Some(p_date) = prev_date {
        let mut stmt_tasks = conn.prepare(
            "SELECT tdp.task_id 
             FROM task_daily_priorities tdp
             JOIN tasks t ON tdp.task_id = t.id
             LEFT JOIN (
                 SELECT tu.task_id, tu.completion_percentage
                 FROM task_updates tu
                 WHERE tu.id = (
                     SELECT tu2.id 
                     FROM task_updates tu2 
                     WHERE tu2.task_id = tu.task_id AND tu2.date <= ?
                     ORDER BY tu2.created_at DESC, tu2.id DESC 
                     LIMIT 1
                 )
             ) tu ON t.id = tu.task_id
             WHERE tdp.date = ? 
               AND tdp.is_daily_priority = 1 
               AND tdp.planned_for_next_day = 1
               AND t.deleted = 0
               AND (t.project_id IS NULL OR t.project_id IN (SELECT id FROM projects WHERE deleted = 0 AND archived = 0))
               AND COALESCE(tu.completion_percentage, t.completion_percentage, 0) < 100;"
        )?;

        let task_ids_rows =
            stmt_tasks.query_map(params![p_date, p_date], |row| row.get::<_, i64>(0))?;

        let mut carry_over_ids = Vec::new();
        for id_res in task_ids_rows {
            carry_over_ids.push(id_res?);
        }

        for task_id in carry_over_ids {
            conn.execute(
                "INSERT INTO task_daily_priorities (task_id, date, is_daily_priority, planned_for_next_day)
                 VALUES (?, ?, 1, 1)
                 ON CONFLICT(task_id, date) DO UPDATE SET is_daily_priority = 1;",
                params![task_id, target_date],
            )?;
        }
    }

    conn.execute(
        "INSERT OR IGNORE INTO carry_over_runs (date) VALUES (?);",
        params![target_date],
    )?;

    Ok(())
}

// TASKS CRUD

pub fn create_task(
    conn: &Connection,
    project_id: Option<i64>,
    title: &str,
    status: &str,
    project_priority: i32,
    is_daily_priority: bool,
    is_weekly_priority: bool,
    completion_percentage: Option<i32>,
    date: Option<&str>,
) -> Result<i64> {
    let target_date = date
        .map(|d| d.to_string())
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());
    let initial_percent = completion_percentage
        .unwrap_or(if status == "done" { 100 } else { 0 })
        .clamp(0, 100);

    let initial_status = if initial_percent >= 100 {
        "done"
    } else if initial_percent <= 0 {
        "todo"
    } else {
        status
    };

    let completed_at = if initial_status == "done" {
        Some(chrono::Local::now().to_rfc3339())
    } else {
        None
    };
    let updated_at = chrono::Local::now().to_rfc3339();
    let created_at = date
        .map(|d| format!("{}T12:00:00", d))
        .unwrap_or_else(|| chrono::Local::now().to_rfc3339());

    conn.execute(
        "INSERT INTO tasks (project_id, title, status, project_priority, is_daily_priority, is_weekly_priority, updated_at, completed_at, completion_percentage, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
        params![
            project_id,
            title,
            initial_status,
            project_priority,
            if is_daily_priority { 1 } else { 0 },
            if is_weekly_priority { 1 } else { 0 },
            updated_at,
            completed_at,
            initial_percent,
            created_at
        ],
    )?;
    let new_id = conn.last_insert_rowid();

    conn.execute(
        "INSERT INTO task_updates (task_id, date, update_text, completion_percentage, status) VALUES (?, ?, ?, ?, ?);",
        params![new_id, target_date, "Task created", initial_percent, initial_status],
    )?;

    if is_daily_priority {
        conn.execute(
            "INSERT INTO task_daily_priorities (task_id, date, is_daily_priority, planned_for_next_day) VALUES (?, ?, 1, 1);",
            params![new_id, target_date],
        )?;
    }

    Ok(new_id)
}

pub fn update_task(
    conn: &Connection,
    id: i64,
    project_id: Option<i64>,
    title: &str,
    status: &str,
    project_priority: i32,
    is_daily_priority: bool,
    is_weekly_priority: bool,
    completion_percentage: Option<i32>,
    update_text: Option<&str>,
    date: Option<&str>,
    planned_for_next_day: Option<bool>,
) -> Result<()> {
    let target_date = date
        .map(|d| d.to_string())
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());

    let (curr_status, curr_percent): (String, i32) = conn.query_row(
        "SELECT status, completion_percentage FROM tasks WHERE id = ?;",
        params![id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;

    let new_percent = match completion_percentage {
        Some(p) => p.clamp(0, 100),
        None => {
            if status != curr_status {
                match status {
                    "done" => 100,
                    _ => curr_percent,
                }
            } else {
                curr_percent
            }
        }
    };

    let new_status = if status == "done" || new_percent >= 100 {
        "done"
    } else {
        status
    };

    let final_percent = if new_status == "done" {
        100
    } else {
        new_percent
    };

    let completed_at: Option<String> = if new_status == "done" {
        if curr_status == "done" {
            conn.query_row(
                "SELECT completed_at FROM tasks WHERE id = ?;",
                params![id],
                |row| row.get(0),
            )?
        } else {
            Some(chrono::Local::now().to_rfc3339())
        }
    } else {
        None
    };

    let updated_at = chrono::Local::now().to_rfc3339();

    conn.execute(
        "UPDATE tasks 
         SET project_id = ?, title = ?, status = ?, project_priority = ?, is_daily_priority = ?, is_weekly_priority = ?, updated_at = ?, completed_at = ?, completion_percentage = ?
         WHERE id = ?;",
        params![
            project_id,
            title,
            new_status,
            project_priority,
            if is_daily_priority { 1 } else { 0 },
            if is_weekly_priority { 1 } else { 0 },
            updated_at,
            completed_at,
            final_percent,
            id
        ],
    )?;

    let has_percent_change = final_percent != curr_percent;
    let has_status_change = new_status != curr_status;
    let has_text = update_text.is_some() && !update_text.unwrap().trim().is_empty();

    if has_percent_change || has_status_change || has_text {
        let log_text = if has_text {
            update_text.unwrap().to_string()
        } else if has_status_change {
            format!("Status updated to {}", new_status)
        } else {
            format!("Progress updated to {}%", final_percent)
        };

        conn.execute(
            "INSERT INTO task_updates (task_id, date, update_text, completion_percentage, status) VALUES (?, ?, ?, ?, ?);",
            params![id, target_date, log_text, final_percent, new_status],
        )?;
    }

    let planned_next = planned_for_next_day.unwrap_or(true);
    conn.execute(
        "INSERT INTO task_daily_priorities (task_id, date, is_daily_priority, planned_for_next_day)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(task_id, date) DO UPDATE SET
            is_daily_priority = excluded.is_daily_priority,
            planned_for_next_day = excluded.planned_for_next_day;",
        params![
            id,
            target_date,
            if is_daily_priority { 1 } else { 0 },
            if planned_next { 1 } else { 0 }
        ],
    )?;

    Ok(())
}

pub fn delete_task(conn: &Connection, id: i64) -> Result<()> {
    let now = chrono::Local::now().to_rfc3339();
    conn.execute(
        "UPDATE tasks SET deleted = 1, deleted_at = ? WHERE id = ?;",
        params![now, id],
    )?;
    Ok(())
}

pub fn archive_project(conn: &Connection, id: i64) -> Result<()> {
    conn.execute(
        "UPDATE projects SET archived = 1 WHERE id = ?;",
        params![id],
    )?;
    Ok(())
}

pub fn unarchive_project(conn: &Connection, id: i64) -> Result<()> {
    conn.execute(
        "UPDATE projects SET archived = 0 WHERE id = ?;",
        params![id],
    )?;
    Ok(())
}

pub fn restore_project(conn: &Connection, id: i64, restore_tasks: bool) -> Result<()> {
    conn.execute(
        "UPDATE projects SET deleted = 0, deleted_at = NULL WHERE id = ?;",
        params![id],
    )?;
    if restore_tasks {
        conn.execute(
            "UPDATE tasks SET deleted = 0, deleted_at = NULL WHERE project_id = ? AND deleted = 1;",
            params![id],
        )?;
    }
    Ok(())
}

pub fn restore_task(conn: &Connection, id: i64) -> Result<()> {
    let project_id: Option<i64> = conn.query_row(
        "SELECT project_id FROM tasks WHERE id = ?;",
        params![id],
        |row| row.get(0),
    )?;

    let should_orphan = if let Some(pid) = project_id {
        let proj_deleted: bool = conn
            .query_row(
                "SELECT deleted FROM projects WHERE id = ?;",
                params![pid],
                |row| row.get(0),
            )
            .unwrap_or(false);
        proj_deleted
    } else {
        false
    };

    if should_orphan {
        conn.execute(
            "UPDATE tasks SET deleted = 0, deleted_at = NULL, project_id = NULL WHERE id = ?;",
            params![id],
        )?;
    } else {
        conn.execute(
            "UPDATE tasks SET deleted = 0, deleted_at = NULL WHERE id = ?;",
            params![id],
        )?;
    }
    Ok(())
}

pub fn get_archived_projects(conn: &Connection) -> Result<Vec<ArchivedProjectJson>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, priority, created_at 
         FROM projects 
         WHERE archived = 1 AND deleted = 0 
         ORDER BY priority DESC, name ASC;",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(ArchivedProjectJson {
            id: row.get(0)?,
            name: row.get(1)?,
            priority: row.get(2)?,
            created_at: row.get(3)?,
        })
    })?;
    let mut results = Vec::new();
    for r in rows {
        results.push(r?);
    }
    Ok(results)
}

pub fn get_trash_items(conn: &Connection) -> Result<TrashResponse> {
    let mut stmt_proj = conn.prepare(
        "SELECT id, name, priority, deleted_at 
         FROM projects 
         WHERE deleted = 1 
         ORDER BY deleted_at DESC;",
    )?;
    let proj_rows = stmt_proj.query_map([], |row| {
        Ok(TrashProject {
            id: row.get(0)?,
            name: row.get(1)?,
            priority: row.get(2)?,
            deleted_at: row.get(3)?,
        })
    })?;
    let mut projects = Vec::new();
    for r in proj_rows {
        projects.push(r?);
    }

    let mut stmt_tasks = conn.prepare(
        "SELECT t.id, t.title, p.name as project_name, t.deleted_at 
         FROM tasks t
         LEFT JOIN projects p ON t.project_id = p.id
         WHERE t.deleted = 1 
         ORDER BY t.deleted_at DESC;",
    )?;
    let task_rows = stmt_tasks.query_map([], |row| {
        Ok(TrashTask {
            id: row.get(0)?,
            title: row.get(1)?,
            project_name: row.get(2)?,
            deleted_at: row.get(3)?,
        })
    })?;
    let mut tasks = Vec::new();
    for r in task_rows {
        tasks.push(r?);
    }

    Ok(TrashResponse { projects, tasks })
}

pub fn purge_project(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM projects WHERE id = ?;", params![id])?;
    Ok(())
}

pub fn purge_task(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM tasks WHERE id = ?;", params![id])?;
    Ok(())
}

pub fn cleanup_expired_trash(conn: &Connection, trash_retention_days: i32) -> Result<()> {
    conn.execute(
        "DELETE FROM tasks WHERE deleted = 1 AND datetime(deleted_at) < datetime('now', '-' || ? || ' days');",
        params![trash_retention_days],
    )?;
    conn.execute(
        "DELETE FROM projects WHERE deleted = 1 AND datetime(deleted_at) < datetime('now', '-' || ? || ' days');",
        params![trash_retention_days],
    )?;
    Ok(())
}

// GET PROJECTS STATUS

pub fn get_projects_status(
    conn: &Connection,
    date_param: Option<&str>,
) -> Result<Vec<ProjectStatusResponse>> {
    let target_date = date_param
        .map(|d| d.to_string())
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());

    let _ = carry_over_priorities(conn, &target_date);

    let mut stmt = conn.prepare("SELECT id, name, priority FROM projects WHERE deleted = 0 AND archived = 0 ORDER BY priority DESC, name ASC;")?;
    let projects_rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, i32>(2)?,
        ))
    })?;

    let mut projects = Vec::new();
    for p in projects_rows {
        let (id, name, priority) = p?;
        projects.push(ProjectStatusResponse {
            project_id: Some(id),
            project_name: name,
            project_priority: priority,
            tasks: TasksJsonGroup {
                needs_to_do: Vec::new(),
                on_my_plate: Vec::new(),
                done: Vec::new(),
            },
        });
    }

    let mut adhoc_project = ProjectStatusResponse {
        project_id: None,
        project_name: "Ad-hoc".to_string(),
        project_priority: 0,
        tasks: TasksJsonGroup {
            needs_to_do: Vec::new(),
            on_my_plate: Vec::new(),
            done: Vec::new(),
        },
    };

    let mut stmt_tasks = conn.prepare(
        "SELECT 
            t.id, 
            t.project_id, 
            t.title, 
            t.project_priority,
            COALESCE(tdp.is_daily_priority, 0) as date_is_daily_priority,
            t.is_weekly_priority,
            t.updated_at,
            t.completed_at,
            COALESCE(tu.completion_percentage, t.completion_percentage, 0) as date_percent,
            COALESCE(tdp.planned_for_next_day, 1) as date_planned_next,
            COALESCE(tu.status, t.status) as date_status
         FROM tasks t
         LEFT JOIN task_daily_priorities tdp ON t.id = tdp.task_id AND tdp.date = ?
         LEFT JOIN (
             SELECT task_id, completion_percentage, status
             FROM task_updates tu
             WHERE tu.id = (
                 SELECT tu2.id 
                 FROM task_updates tu2 
                 WHERE tu2.task_id = tu.task_id AND tu2.date <= ?
                 ORDER BY tu2.created_at DESC, tu2.id DESC 
                 LIMIT 1
             )
         ) tu ON t.id = tu.task_id
         WHERE t.deleted = 0 
           AND (t.project_id IS NULL OR t.project_id IN (SELECT id FROM projects WHERE deleted = 0 AND archived = 0))
           AND date(COALESCE(t.created_at, t.updated_at, 'now')) <= date(?)
         ORDER BY t.project_priority DESC, t.id ASC;"
    )?;

    let tasks_rows =
        stmt_tasks.query_map(params![target_date, target_date, target_date], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, Option<i64>>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i32>(3)?,
                row.get::<_, bool>(4)?,
                row.get::<_, bool>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, Option<String>>(7)?,
                row.get::<_, i32>(8)?,
                row.get::<_, bool>(9)?,
                row.get::<_, String>(10)?,
            ))
        })?;

    for t in tasks_rows {
        let (
            id,
            project_id,
            title,
            p_priority,
            is_daily,
            is_weekly,
            updated_at,
            completed_at,
            completion_percentage,
            planned_next,
            status,
        ) = t?;

        let task_json = TaskJson {
            task_id: id,
            title,
            project_priority: p_priority,
            is_daily_priority: is_daily,
            is_weekly_priority: is_weekly,
            status: status.clone(),
            updated_at,
            completed_at,
            completion_percentage,
            planned_for_next_day: planned_next,
        };

        if let Some(pid) = project_id {
            if let Some(proj) = projects.iter_mut().find(|p| p.project_id == Some(pid)) {
                match status.as_str() {
                    "todo" => proj.tasks.needs_to_do.push(task_json),
                    "in_progress" => proj.tasks.on_my_plate.push(task_json),
                    "done" => proj.tasks.done.push(task_json),
                    _ => {}
                }
            } else {
                match status.as_str() {
                    "todo" => adhoc_project.tasks.needs_to_do.push(task_json),
                    "in_progress" => adhoc_project.tasks.on_my_plate.push(task_json),
                    "done" => adhoc_project.tasks.done.push(task_json),
                    _ => {}
                }
            }
        } else {
            match status.as_str() {
                "todo" => adhoc_project.tasks.needs_to_do.push(task_json),
                "in_progress" => adhoc_project.tasks.on_my_plate.push(task_json),
                "done" => adhoc_project.tasks.done.push(task_json),
                _ => {}
            }
        }
    }

    projects.push(adhoc_project);
    Ok(projects)
}

// SUMMARIES

pub fn get_summary(
    conn: &Connection,
    summary_type: &str,
    start_date: &str,
    end_date: &str,
) -> Result<SummaryResponse> {
    // Find all tasks completed/updated in the range, or currently pending
    // We want dates in YYYY-MM-DD format. We query tasks active in that range.
    // Daily summary: start_date == end_date.

    // 1. Get all projects
    let mut stmt_proj = conn.prepare("SELECT id, name FROM projects WHERE deleted = 0 AND archived = 0 ORDER BY priority DESC, name ASC;")?;
    let proj_rows = stmt_proj.query_map([], |row| {
        Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
    })?;

    let mut project_summaries = Vec::new();
    let mut project_ids = Vec::new();

    for p in proj_rows {
        let (id, name) = p?;
        project_ids.push(Some(id));
        project_summaries.push(ProjectSummary {
            project_name: name,
            completed: Vec::new(),
            in_progress: Vec::new(),
            pending: Vec::new(),
        });
    }

    // Add Ad-hoc
    project_ids.push(None);
    project_summaries.push(ProjectSummary {
        project_name: "Ad-hoc".to_string(),
        completed: Vec::new(),
        in_progress: Vec::new(),
        pending: Vec::new(),
    });

    // 2. Fetch all tasks
    // - completed: status = 'done' and completed_at is between start_date and end_date
    // - in_progress: status = 'in_progress' and updated_at is between start_date and end_date
    // - pending: status = 'todo'
    // To match the dates, we can use substr(completed_at, 1, 10) for ISO dates (YYYY-MM-DD)
    let start_date_str = format!("{}T00:00:00", start_date);
    let end_date_str = format!("{}T23:59:59", end_date);

    let mut stmt_tasks = conn.prepare(
        "SELECT t.id, t.project_id, t.title, t.status, t.updated_at, t.completed_at 
         FROM tasks t
         WHERE t.deleted = 0 AND (t.project_id IS NULL OR t.project_id IN (SELECT id FROM projects WHERE deleted = 0 AND archived = 0));"
    )?;

    let task_rows = stmt_tasks.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, Option<i64>>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, Option<String>>(5)?,
        ))
    })?;

    for t in task_rows {
        let (_id, project_id, title, status, updated_at, completed_at) = t?;

        // Find correct project index
        let proj_idx = if let Some(pid) = project_id {
            project_ids.iter().position(|&x| x == Some(pid))
        } else {
            project_ids.iter().position(|&x| x.is_none())
        };

        if let Some(idx) = proj_idx {
            let summary = &mut project_summaries[idx];

            if status == "done" {
                if let Some(ref cat) = completed_at {
                    if cat >= &start_date_str && cat <= &end_date_str {
                        summary.completed.push(title);
                    }
                }
            } else if status == "in_progress" {
                if updated_at >= start_date_str && updated_at <= end_date_str {
                    summary.in_progress.push(title);
                }
            } else if status == "todo" {
                summary.pending.push(title);
            }
        }
    }

    // Filter out projects with no tasks in any category to keep the summary concise,
    // except if it is "Ad-hoc" (or let's filter all empty projects, including Ad-hoc).
    let filtered_projects: Vec<ProjectSummary> = project_summaries
        .into_iter()
        .filter(|p| !p.completed.is_empty() || !p.in_progress.is_empty() || !p.pending.is_empty())
        .collect();

    Ok(SummaryResponse {
        summary_type: summary_type.to_string(),
        start_date: start_date.to_string(),
        end_date: end_date.to_string(),
        projects: filtered_projects,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_task_notes_and_carry_over() -> Result<()> {
        let conn = Connection::open_in_memory()?;
        run_migrations(&conn)?;

        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        let tomorrow = (chrono::Local::now() + chrono::Duration::days(1))
            .format("%Y-%m-%d")
            .to_string();

        // 1. Create a project
        let project_id = create_project(&conn, "Test Project", 2)?;

        // 2. Create tasks
        let task_id1 = create_task(
            &conn,
            Some(project_id),
            "Task 1",
            "todo",
            1,
            true,
            false,
            Some(0),
            Some(&today),
        )?;
        let _task_id2 = create_task(
            &conn,
            Some(project_id),
            "Task 2",
            "todo",
            0,
            false,
            false,
            Some(0),
            Some(&today),
        )?;

        // 3. Create Note (Progress update)
        let note_id = create_task_update(
            &conn,
            task_id1,
            &today,
            "Started research",
            30,
            "in_progress",
        )?;
        update_task_update(
            &conn,
            note_id,
            "Started research and models",
            50,
            "in_progress",
        )?;

        // Print table states
        {
            let mut stmt = conn.prepare("SELECT id, task_id, date, update_text, completion_percentage, status, created_at FROM task_updates;")?;
            let rows = stmt.query_map([], |r| {
                Ok(format!(
                    "Update: id={}, task_id={}, date={}, text={}, %={}, status={}, created_at={}",
                    r.get::<_, i64>(0)?,
                    r.get::<_, i64>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, String>(3)?,
                    r.get::<_, i32>(4)?,
                    r.get::<_, String>(5)?,
                    r.get::<_, String>(6)?
                ))
            })?;
            for r in rows {
                println!("{}", r?);
            }
        }

        // Check project status for a date
        let projects_status = get_projects_status(&conn, Some(&today))?;
        println!("Projects Status for today: {:?}", projects_status);

        let tasks = &projects_status[0].tasks;
        assert_eq!(tasks.on_my_plate.len(), 1);
        assert_eq!(tasks.on_my_plate[0].task_id, task_id1);
        assert_eq!(tasks.on_my_plate[0].completion_percentage, 50);

        // 6. Test Carry Over to tomorrow
        let projects_status_tomorrow = get_projects_status(&conn, Some(&tomorrow))?;
        let tasks_tomorrow = &projects_status_tomorrow[0].tasks;

        // Task 1 should have carried over because it was not completed (50% < 100%) and planned_for_next_day was true
        assert_eq!(tasks_tomorrow.on_my_plate.len(), 1);
        assert_eq!(tasks_tomorrow.on_my_plate[0].task_id, task_id1);
        assert!(tasks_tomorrow.on_my_plate[0].is_daily_priority);

        // 7. Delete Note and check sync
        delete_task_update(&conn, note_id)?;
        let task1_deleted_note: (String, i32) = conn.query_row(
            "SELECT status, completion_percentage FROM tasks WHERE id = ?;",
            params![task_id1],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )?;
        assert_eq!(task1_deleted_note.0, "todo");
        assert_eq!(task1_deleted_note.1, 0);

        Ok(())
    }

    #[test]
    fn test_archiving_and_soft_delete() -> Result<()> {
        let conn = Connection::open_in_memory()?;
        run_migrations(&conn)?;

        let today = chrono::Local::now().format("%Y-%m-%d").to_string();

        // 1. Create a project and tasks
        let project_id = create_project(&conn, "Test Project", 2)?;
        let task_id1 = create_task(
            &conn,
            Some(project_id),
            "Task 1",
            "todo",
            1,
            false,
            false,
            Some(0),
            Some(&today),
        )?;
        let _task_id2 = create_task(
            &conn,
            Some(project_id),
            "Task 2",
            "todo",
            1,
            false,
            false,
            Some(0),
            Some(&today),
        )?;

        // 2. Test Archiving
        archive_project(&conn, project_id)?;
        let archived = get_archived_projects(&conn)?;
        assert_eq!(archived.len(), 1);
        assert_eq!(archived[0].id, project_id);

        // Active project query should exclude archived projects
        let active = get_projects_status(&conn, Some(&today))?;
        // Should only contain Ad-hoc project container, not Test Project
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].project_id, None);

        // Unarchive project
        unarchive_project(&conn, project_id)?;
        let archived = get_archived_projects(&conn)?;
        assert_eq!(archived.len(), 0);

        let active = get_projects_status(&conn, Some(&today))?;
        assert_eq!(active.len(), 2); // Test Project and Ad-hoc

        // 3. Delete Project with tasks
        delete_project(&conn, project_id, true)?;
        let trash = get_trash_items(&conn)?;
        assert_eq!(trash.projects.len(), 1);
        assert_eq!(trash.projects[0].id, project_id);
        assert_eq!(trash.tasks.len(), 2);

        // Active query should be empty (except Ad-hoc)
        let active = get_projects_status(&conn, Some(&today))?;
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].tasks.needs_to_do.len(), 0);

        // Restore project and tasks
        restore_project(&conn, project_id, true)?;
        let trash = get_trash_items(&conn)?;
        assert_eq!(trash.projects.len(), 0);
        assert_eq!(trash.tasks.len(), 0);

        // 4. Delete Project keeping tasks (convert to Ad-hoc)
        delete_project(&conn, project_id, false)?;
        let trash = get_trash_items(&conn)?;
        assert_eq!(trash.projects.len(), 1);
        assert_eq!(trash.tasks.len(), 0); // Tasks should not be deleted

        // Active query should show the tasks under Ad-hoc
        let active = get_projects_status(&conn, Some(&today))?;
        assert_eq!(active.len(), 1); // Only Ad-hoc
        assert_eq!(active[0].tasks.needs_to_do.len(), 2); // 2 tasks migrated to Ad-hoc!

        // 5. Delete and restore individual task
        let task_id = task_id1;
        delete_task(&conn, task_id)?;
        let trash = get_trash_items(&conn)?;
        assert_eq!(trash.tasks.len(), 1);
        assert_eq!(trash.tasks[0].id, task_id);

        restore_task(&conn, task_id)?;
        let trash = get_trash_items(&conn)?;
        assert_eq!(trash.tasks.len(), 0);

        // 6. Test purge
        delete_task(&conn, task_id)?;
        purge_task(&conn, task_id)?;
        let trash = get_trash_items(&conn)?;
        assert_eq!(trash.tasks.len(), 0);

        // Cleanup expired trash test (older than 30 days)
        conn.execute(
            "UPDATE projects SET deleted_at = datetime('now', '-35 days') WHERE id = ?;",
            params![project_id],
        )?;
        cleanup_expired_trash(&conn, 30)?; // Delete projects older than 30 days
        let trash = get_trash_items(&conn)?;
        assert_eq!(trash.projects.len(), 0);

        Ok(())
    }
}
