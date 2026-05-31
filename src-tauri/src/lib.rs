#![allow(clippy::too_many_arguments, clippy::type_complexity)]

pub mod db;
pub mod http_server;
pub mod keyring_helper;

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, State};

fn default_trash_retention_days() -> i32 {
    30
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppConfig {
    pub keyring_enabled: bool,
    pub auto_lock_timeout_mins: i32,
    #[serde(default = "default_trash_retention_days")]
    pub trash_retention_days: i32,
}

pub struct AppState {
    pub db: Arc<Mutex<Option<rusqlite::Connection>>>,
    pub db_path: PathBuf,
    pub config_path: PathBuf,
}

fn read_config(path: &std::path::Path) -> AppConfig {
    if path.exists() {
        if let Ok(content) = std::fs::read_to_string(path) {
            if let Ok(config) = serde_json::from_str::<AppConfig>(&content) {
                return config;
            }
        }
    }
    AppConfig {
        keyring_enabled: false,
        auto_lock_timeout_mins: 15,
        trash_retention_days: 30,
    }
}

fn write_config(path: &std::path::Path, config: &AppConfig) {
    if let Ok(content) = serde_json::to_string(config) {
        let _ = std::fs::write(path, content);
    }
}

// TAURI COMMANDS

#[tauri::command]
fn is_first_run(state: State<'_, AppState>) -> bool {
    !state.db_path.exists()
}

#[tauri::command]
fn is_db_locked(state: State<'_, AppState>) -> bool {
    state.db.lock().unwrap().is_none()
}

#[tauri::command]
fn lock_db(state: State<'_, AppState>, app: AppHandle) {
    let mut db_guard = state.db.lock().unwrap();
    *db_guard = None;
    let _ = app.emit("database-locked", ());
}

#[tauri::command]
fn unlock_db_with_saved_key(state: State<'_, AppState>) -> Result<bool, String> {
    let config = read_config(&state.config_path);
    if !config.keyring_enabled {
        return Ok(false);
    }

    let password = match keyring_helper::get_password() {
        Ok(pass) => pass,
        Err(_) => return Ok(false),
    };

    let mut db_guard = state.db.lock().unwrap();
    match db::open_encrypted_db(&state.db_path, &password) {
        Ok(conn) => {
            let _ = db::run_migrations(&conn);
            let config = read_config(&state.config_path);
            let _ = db::cleanup_expired_trash(&conn, config.trash_retention_days);
            *db_guard = Some(conn);
            Ok(true)
        }
        Err(_) => {
            // Decryption failed: saved password is stale or database was modified
            let _ = keyring_helper::delete_password();
            Ok(false)
        }
    }
}

#[tauri::command]
fn unlock_db(
    password: String,
    save_in_keyring: bool,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut db_guard = state.db.lock().unwrap();
    match db::open_encrypted_db(&state.db_path, &password) {
        Ok(conn) => {
            let _ = db::run_migrations(&conn);
            let config = read_config(&state.config_path);
            let _ = db::cleanup_expired_trash(&conn, config.trash_retention_days);
            *db_guard = Some(conn);

            let mut config = read_config(&state.config_path);
            config.keyring_enabled = save_in_keyring;
            write_config(&state.config_path, &config);

            if save_in_keyring {
                if let Err(e) = keyring_helper::save_password(&password) {
                    eprintln!("Warning: Failed to save to keyring: {}", e);
                }
            } else {
                let _ = keyring_helper::delete_password();
            }

            Ok(())
        }
        Err(e) => Err(format!("Invalid password or decryption error: {}", e)),
    }
}

#[tauri::command]
fn get_projects(
    date: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<db::ProjectStatusResponse>, String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database is locked")?;
    db::get_projects_status(conn, date.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_project(
    name: String,
    priority: i32,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<i64, String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database is locked")?;
    let id = db::create_project(conn, &name, priority).map_err(|e| e.to_string())?;
    let _ = app.emit("tasks-changed", ());
    Ok(id)
}

#[tauri::command]
fn update_project(
    id: i64,
    name: String,
    priority: i32,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database is locked")?;
    db::update_project(conn, id, &name, priority).map_err(|e| e.to_string())?;
    let _ = app.emit("tasks-changed", ());
    Ok(())
}

#[tauri::command]
fn delete_project(
    id: i64,
    delete_tasks: bool,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database is locked")?;
    db::delete_project(conn, id, delete_tasks).map_err(|e| e.to_string())?;
    let _ = app.emit("tasks-changed", ());
    Ok(())
}

#[tauri::command]
fn archive_project(id: i64, app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database is locked")?;
    db::archive_project(conn, id).map_err(|e| e.to_string())?;
    let _ = app.emit("tasks-changed", ());
    Ok(())
}

#[tauri::command]
fn unarchive_project(id: i64, app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database is locked")?;
    db::unarchive_project(conn, id).map_err(|e| e.to_string())?;
    let _ = app.emit("tasks-changed", ());
    Ok(())
}

#[tauri::command]
fn restore_project(
    id: i64,
    restore_tasks: bool,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database is locked")?;
    db::restore_project(conn, id, restore_tasks).map_err(|e| e.to_string())?;
    let _ = app.emit("tasks-changed", ());
    Ok(())
}

#[tauri::command]
fn restore_task(id: i64, app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database is locked")?;
    db::restore_task(conn, id).map_err(|e| e.to_string())?;
    let _ = app.emit("tasks-changed", ());
    Ok(())
}

#[tauri::command]
fn get_archived_projects(
    state: State<'_, AppState>,
) -> Result<Vec<db::ArchivedProjectJson>, String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database is locked")?;
    db::get_archived_projects(conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_trash_items(state: State<'_, AppState>) -> Result<db::TrashResponse, String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database is locked")?;
    db::get_trash_items(conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn purge_project(id: i64, app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database is locked")?;
    db::purge_project(conn, id).map_err(|e| e.to_string())?;
    let _ = app.emit("tasks-changed", ());
    Ok(())
}

#[tauri::command]
fn purge_task(id: i64, app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database is locked")?;
    db::purge_task(conn, id).map_err(|e| e.to_string())?;
    let _ = app.emit("tasks-changed", ());
    Ok(())
}

#[tauri::command]
fn create_task(
    project_id: Option<i64>,
    title: String,
    status: String,
    project_priority: i32,
    is_daily_priority: bool,
    is_weekly_priority: bool,
    completion_percentage: Option<i32>,
    date: Option<String>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<i64, String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database is locked")?;
    let id = db::create_task(
        conn,
        project_id,
        &title,
        &status,
        project_priority,
        is_daily_priority,
        is_weekly_priority,
        completion_percentage,
        date.as_deref(),
    )
    .map_err(|e| e.to_string())?;
    let _ = app.emit("tasks-changed", ());
    Ok(id)
}

#[tauri::command]
fn update_task(
    id: i64,
    project_id: Option<i64>,
    title: String,
    status: String,
    project_priority: i32,
    is_daily_priority: bool,
    is_weekly_priority: bool,
    completion_percentage: Option<i32>,
    update_text: Option<String>,
    date: Option<String>,
    planned_for_next_day: Option<bool>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database is locked")?;
    db::update_task(
        conn,
        id,
        project_id,
        &title,
        &status,
        project_priority,
        is_daily_priority,
        is_weekly_priority,
        completion_percentage,
        update_text.as_deref(),
        date.as_deref(),
        planned_for_next_day,
    )
    .map_err(|e| e.to_string())?;
    let _ = app.emit("tasks-changed", ());
    Ok(())
}

#[tauri::command]
fn delete_task(id: i64, app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database is locked")?;
    db::delete_task(conn, id).map_err(|e| e.to_string())?;
    let _ = app.emit("tasks-changed", ());
    Ok(())
}

#[tauri::command]
fn get_task_updates(
    task_id: i64,
    state: State<'_, AppState>,
) -> Result<Vec<db::TaskUpdateJson>, String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database is locked")?;
    db::get_task_updates(conn, task_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_task_update(
    task_id: i64,
    date: String,
    update_text: String,
    completion_percentage: i32,
    status: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<i64, String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database is locked")?;
    let id = db::create_task_update(
        conn,
        task_id,
        &date,
        &update_text,
        completion_percentage,
        &status,
    )
    .map_err(|e| e.to_string())?;
    let _ = app.emit("tasks-changed", ());
    Ok(id)
}

#[tauri::command]
fn update_task_update(
    id: i64,
    update_text: String,
    completion_percentage: i32,
    status: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database is locked")?;
    db::update_task_update(conn, id, &update_text, completion_percentage, &status)
        .map_err(|e| e.to_string())?;
    let _ = app.emit("tasks-changed", ());
    Ok(())
}

#[tauri::command]
fn delete_task_update(id: i64, app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database is locked")?;
    db::delete_task_update(conn, id).map_err(|e| e.to_string())?;
    let _ = app.emit("tasks-changed", ());
    Ok(())
}

#[tauri::command]
fn get_timeline(state: State<'_, AppState>) -> Result<Vec<db::TaskUpdateJson>, String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database is locked")?;
    db::get_timeline(conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_daily_summary(
    date: String,
    state: State<'_, AppState>,
) -> Result<db::SummaryResponse, String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database is locked")?;
    db::get_summary(conn, "daily", &date, &date).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_weekly_summary(
    start_date: String,
    state: State<'_, AppState>,
) -> Result<db::SummaryResponse, String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database is locked")?;

    let parsed_start = chrono::NaiveDate::parse_from_str(&start_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid start_date: {}", e))?;
    let parsed_end = parsed_start + chrono::Duration::days(6);
    let end_date = parsed_end.format("%Y-%m-%d").to_string();

    db::get_summary(conn, "weekly", &start_date, &end_date).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_config(state: State<'_, AppState>) -> AppConfig {
    read_config(&state.config_path)
}

#[tauri::command]
fn update_config(config: AppConfig, state: State<'_, AppState>) -> Result<(), String> {
    let current = read_config(&state.config_path);
    if current.keyring_enabled && !config.keyring_enabled {
        let _ = keyring_helper::delete_password();
    }
    write_config(&state.config_path, &config);
    Ok(())
}

// MAIN RUNNER

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Setup app data directories and database paths
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");
            std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");

            let db_path = app_data_dir.join("memor.db");
            let config_path = app_data_dir.join("config.json");

            let db_state = Arc::new(Mutex::new(None));

            // Start background HTTP API server
            http_server::start_server(Arc::clone(&db_state), app.handle().clone());

            // Register state
            app.manage(AppState {
                db: db_state,
                db_path,
                config_path,
            });

            // Set up System Tray Menu
            let show_item = MenuItem::with_id(app, "show", "Show Memor", true, None::<&str>)?;
            let lock_item = MenuItem::with_id(app, "lock", "Lock Database", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Exit", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&show_item, &lock_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .icon(
                    app.default_window_icon()
                        .cloned()
                        .expect("Default window icon missing"),
                )
                .menu(&tray_menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "lock" => {
                        let state: State<AppState> = app.state();
                        let mut db_guard = state.db.lock().unwrap();
                        *db_guard = None;
                        let _ = app.emit("database-locked", ());
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Intercept close button and hide instead
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            is_first_run,
            is_db_locked,
            lock_db,
            unlock_db_with_saved_key,
            unlock_db,
            get_projects,
            create_project,
            update_project,
            delete_project,
            create_task,
            update_task,
            delete_task,
            get_daily_summary,
            get_weekly_summary,
            get_config,
            update_config,
            get_task_updates,
            create_task_update,
            update_task_update,
            delete_task_update,
            get_timeline,
            archive_project,
            unarchive_project,
            restore_project,
            restore_task,
            get_archived_projects,
            get_trash_items,
            purge_project,
            purge_task
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
