use crate::db;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::Emitter;

pub fn start_server(db: Arc<Mutex<Option<Connection>>>, app_handle: tauri::AppHandle) {
    std::thread::spawn(move || {
        let server = match tiny_http::Server::http("127.0.0.1:3030") {
            Ok(s) => s,
            Err(e) => {
                eprintln!("Failed to start HTTP server on port 3030: {}", e);
                return;
            }
        };

        println!("Local HTTP server listening on http://127.0.0.1:3030");

        for mut request in server.incoming_requests() {
            // Handle CORS OPTIONS preflight
            if request.method() == &tiny_http::Method::Options {
                let response = tiny_http::Response::new(
                    tiny_http::StatusCode(204),
                    vec![
                        tiny_http::Header::from_bytes(
                            &b"Access-Control-Allow-Origin"[..],
                            &b"*"[..],
                        )
                        .unwrap(),
                        tiny_http::Header::from_bytes(
                            &b"Access-Control-Allow-Methods"[..],
                            &b"GET, POST, PUT, DELETE, OPTIONS"[..],
                        )
                        .unwrap(),
                        tiny_http::Header::from_bytes(
                            &b"Access-Control-Allow-Headers"[..],
                            &b"Content-Type"[..],
                        )
                        .unwrap(),
                    ],
                    &[][..],
                    Some(0),
                    None,
                );
                let _ = request.respond(response);
                continue;
            }

            let url_string = format!("http://127.0.0.1:3030{}", request.url());
            let parsed_url = match url::Url::parse(&url_string) {
                Ok(u) => u,
                Err(_) => {
                    respond_error(request, 400, "Invalid URL");
                    continue;
                }
            };

            let path = parsed_url.path();
            let query: HashMap<String, String> = parsed_url.query_pairs().into_owned().collect();

            // Check database unlock state
            let mut db_guard = db.lock().unwrap();
            let conn = match &mut *db_guard {
                Some(c) => c,
                None => {
                    respond_error(
                        request,
                        401,
                        "Database is locked. Please unlock in the Memor application first.",
                    );
                    continue;
                }
            };

            match (request.method(), path) {
                (&tiny_http::Method::Get, "/projects") => {
                    let date_param = query.get("date").map(|s| s.as_str());
                    match db::get_projects_status(conn, date_param) {
                        Ok(status) => respond_json(request, 200, &status),
                        Err(e) => respond_error(request, 500, &format!("Database error: {}", e)),
                    }
                }
                (&tiny_http::Method::Post, "/projects") => {
                    #[derive(Deserialize)]
                    struct CreateProjectPayload {
                        name: String,
                        priority: Option<i32>,
                    }

                    let mut body = String::new();
                    if request.as_reader().read_to_string(&mut body).is_err() {
                        respond_error(request, 400, "Failed to read request body");
                        continue;
                    }

                    let payload: CreateProjectPayload = match serde_json::from_str(&body) {
                        Ok(p) => p,
                        Err(e) => {
                            respond_error(request, 400, &format!("Invalid JSON: {}", e));
                            continue;
                        }
                    };

                    let priority = payload.priority.unwrap_or(0);
                    match db::create_project(conn, &payload.name, priority) {
                        Ok(id) => {
                            let _ = app_handle.emit("tasks-changed", ());
                            respond_json(
                                request,
                                201,
                                &serde_json::json!({
                                    "project_id": id,
                                    "project_name": payload.name,
                                    "project_priority": priority
                                }),
                            );
                        }
                        Err(e) => {
                            respond_error(request, 500, &format!("Failed to create project: {}", e))
                        }
                    }
                }
                (&tiny_http::Method::Post, "/tasks") => {
                    #[derive(Deserialize, Debug)]
                    struct TaskPayload {
                        task_id: Option<i64>,
                        id: Option<i64>,
                        project_id: Option<i64>,
                        title: Option<String>,
                        status: Option<String>,
                        project_priority: Option<i32>,
                        is_daily_priority: Option<bool>,
                        is_weekly_priority: Option<bool>,
                        completion_percentage: Option<i32>,
                        update_text: Option<String>,
                        date: Option<String>,
                        planned_for_next_day: Option<bool>,
                    }

                    let mut body = String::new();
                    if request.as_reader().read_to_string(&mut body).is_err() {
                        respond_error(request, 400, "Failed to read request body");
                        continue;
                    }

                    let payload: TaskPayload = match serde_json::from_str(&body) {
                        Ok(p) => p,
                        Err(e) => {
                            respond_error(request, 400, &format!("Invalid JSON: {}", e));
                            continue;
                        }
                    };

                    let target_id = payload.task_id.or(payload.id);
                    let today_str = chrono::Local::now().format("%Y-%m-%d").to_string();

                    if let Some(tid) = target_id {
                        let target_date = payload.date.as_deref().unwrap_or(&today_str);
                        let existing: Result<(Option<i64>, String, String, i32, bool, bool, i32, bool), _> = conn.query_row(
                            "SELECT 
                                t.project_id, 
                                t.title, 
                                COALESCE(tu.status, t.status) as date_status, 
                                t.project_priority, 
                                COALESCE(tdp.is_daily_priority, 0) as date_is_daily, 
                                t.is_weekly_priority,
                                COALESCE(tu.completion_percentage, t.completion_percentage, 0) as date_percent,
                                COALESCE(tdp.planned_for_next_day, 1) as date_planned_next
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
                             WHERE t.id = ? AND t.deleted = 0;",
                            rusqlite::params![target_date, target_date, tid],
                            |row| {
                                Ok((
                                    row.get(0)?,
                                    row.get(1)?,
                                    row.get(2)?,
                                    row.get(3)?,
                                    row.get(4)?,
                                    row.get(5)?,
                                    row.get(6)?,
                                    row.get(7)?,
                                ))
                            },
                        );

                        match existing {
                            Ok((
                                curr_proj,
                                curr_title,
                                curr_status,
                                curr_p_priority,
                                curr_daily,
                                curr_weekly,
                                curr_percent,
                                curr_planned_next,
                            )) => {
                                let new_proj = payload.project_id.or(curr_proj);
                                let new_title = payload.title.as_deref().unwrap_or(&curr_title);
                                let new_status = payload.status.as_deref().unwrap_or(&curr_status);
                                let new_p_priority =
                                    payload.project_priority.unwrap_or(curr_p_priority);
                                let new_daily = payload.is_daily_priority.unwrap_or(curr_daily);
                                let new_weekly = payload.is_weekly_priority.unwrap_or(curr_weekly);
                                let new_percent =
                                    payload.completion_percentage.or(Some(curr_percent));
                                let new_planned_next =
                                    payload.planned_for_next_day.or(Some(curr_planned_next));

                                match db::update_task(
                                    conn,
                                    tid,
                                    new_proj,
                                    new_title,
                                    new_status,
                                    new_p_priority,
                                    new_daily,
                                    new_weekly,
                                    new_percent,
                                    payload.update_text.as_deref(),
                                    payload.date.as_deref(),
                                    new_planned_next,
                                ) {
                                    Ok(_) => {
                                        let _ = app_handle.emit("tasks-changed", ());
                                        respond_json(
                                            request,
                                            200,
                                            &serde_json::json!({ "status": "success", "task_id": tid }),
                                        );
                                    }
                                    Err(e) => respond_error(
                                        request,
                                        500,
                                        &format!("Failed to update task: {}", e),
                                    ),
                                }
                            }
                            Err(_) => respond_error(request, 404, "Task not found"),
                        }
                    } else {
                        let title = match payload.title {
                            Some(t) => t,
                            None => {
                                respond_error(request, 400, "Missing required field: title");
                                continue;
                            }
                        };

                        let status = payload.status.unwrap_or_else(|| "todo".to_string());
                        let project_id = payload.project_id;
                        let p_priority = payload.project_priority.unwrap_or(0);
                        let is_daily = payload.is_daily_priority.unwrap_or(false);
                        let is_weekly = payload.is_weekly_priority.unwrap_or(false);
                        let percent = payload.completion_percentage;
                        let date = payload.date;

                        match db::create_task(
                            conn,
                            project_id,
                            &title,
                            &status,
                            p_priority,
                            is_daily,
                            is_weekly,
                            percent,
                            date.as_deref(),
                        ) {
                            Ok(new_id) => {
                                let _ = app_handle.emit("tasks-changed", ());
                                respond_json(
                                    request,
                                    201,
                                    &serde_json::json!({
                                        "status": "success",
                                        "task_id": new_id
                                    }),
                                );
                            }
                            Err(e) => respond_error(
                                request,
                                500,
                                &format!("Failed to create task: {}", e),
                            ),
                        }
                    }
                }
                (&tiny_http::Method::Get, "/summary/daily") => {
                    let date_str = match query.get("date") {
                        Some(d) => d.clone(),
                        None => chrono::Local::now().format("%Y-%m-%d").to_string(),
                    };

                    match db::get_summary(conn, "daily", &date_str, &date_str) {
                        Ok(summary) => respond_json(request, 200, &summary),
                        Err(e) => respond_error(
                            request,
                            500,
                            &format!("Failed to generate summary: {}", e),
                        ),
                    }
                }
                (&tiny_http::Method::Get, "/summary/weekly") => {
                    let start_date_str = match query.get("start_date") {
                        Some(sd) => sd.clone(),
                        None => {
                            let seven_days_ago = chrono::Local::now() - chrono::Duration::days(6);
                            seven_days_ago.format("%Y-%m-%d").to_string()
                        }
                    };

                    let parsed_start =
                        match chrono::NaiveDate::parse_from_str(&start_date_str, "%Y-%m-%d") {
                            Ok(d) => d,
                            Err(_) => {
                                respond_error(
                                    request,
                                    400,
                                    "Invalid start_date format. Must be YYYY-MM-DD",
                                );
                                continue;
                            }
                        };

                    let parsed_end = parsed_start + chrono::Duration::days(6);
                    let end_date_str = parsed_end.format("%Y-%m-%d").to_string();

                    match db::get_summary(conn, "weekly", &start_date_str, &end_date_str) {
                        Ok(summary) => respond_json(request, 200, &summary),
                        Err(e) => respond_error(
                            request,
                            500,
                            &format!("Failed to generate summary: {}", e),
                        ),
                    }
                }
                (&tiny_http::Method::Get, "/timeline") => match db::get_timeline(conn) {
                    Ok(timeline) => respond_json(request, 200, &timeline),
                    Err(e) => {
                        respond_error(request, 500, &format!("Failed to fetch timeline: {}", e))
                    }
                },
                (&tiny_http::Method::Get, "/task_updates") => {
                    let task_id_str = match query.get("task_id") {
                        Some(t) => t,
                        None => {
                            respond_error(
                                request,
                                400,
                                "Missing required query parameter: task_id",
                            );
                            continue;
                        }
                    };
                    let task_id = match task_id_str.parse::<i64>() {
                        Ok(id) => id,
                        Err(_) => {
                            respond_error(request, 400, "Invalid task_id");
                            continue;
                        }
                    };
                    match db::get_task_updates(conn, task_id) {
                        Ok(updates) => respond_json(request, 200, &updates),
                        Err(e) => respond_error(request, 500, &format!("Database error: {}", e)),
                    }
                }
                (&tiny_http::Method::Post, "/task_updates") => {
                    #[derive(Deserialize)]
                    struct CreateUpdatePayload {
                        task_id: i64,
                        date: String,
                        update_text: String,
                        completion_percentage: i32,
                        status: String,
                    }
                    let mut body = String::new();
                    if request.as_reader().read_to_string(&mut body).is_err() {
                        respond_error(request, 400, "Failed to read request body");
                        continue;
                    }
                    let payload: CreateUpdatePayload = match serde_json::from_str(&body) {
                        Ok(p) => p,
                        Err(e) => {
                            respond_error(request, 400, &format!("Invalid JSON: {}", e));
                            continue;
                        }
                    };
                    match db::create_task_update(
                        conn,
                        payload.task_id,
                        &payload.date,
                        &payload.update_text,
                        payload.completion_percentage,
                        &payload.status,
                    ) {
                        Ok(new_id) => {
                            let _ = app_handle.emit("tasks-changed", ());
                            respond_json(
                                request,
                                201,
                                &serde_json::json!({
                                    "status": "success",
                                    "update_id": new_id
                                }),
                            );
                        }
                        Err(e) => {
                            respond_error(request, 500, &format!("Failed to create update: {}", e))
                        }
                    }
                }
                (&tiny_http::Method::Put, "/task_updates") => {
                    #[derive(Deserialize)]
                    struct UpdatePayload {
                        id: i64,
                        update_text: String,
                        completion_percentage: i32,
                        status: String,
                    }
                    let mut body = String::new();
                    if request.as_reader().read_to_string(&mut body).is_err() {
                        respond_error(request, 400, "Failed to read request body");
                        continue;
                    }
                    let payload: UpdatePayload = match serde_json::from_str(&body) {
                        Ok(p) => p,
                        Err(e) => {
                            respond_error(request, 400, &format!("Invalid JSON: {}", e));
                            continue;
                        }
                    };
                    match db::update_task_update(
                        conn,
                        payload.id,
                        &payload.update_text,
                        payload.completion_percentage,
                        &payload.status,
                    ) {
                        Ok(_) => {
                            let _ = app_handle.emit("tasks-changed", ());
                            respond_json(request, 200, &serde_json::json!({ "status": "success" }));
                        }
                        Err(e) => {
                            respond_error(request, 500, &format!("Failed to update note: {}", e))
                        }
                    }
                }
                (&tiny_http::Method::Delete, "/task_updates") => {
                    let id_str = match query.get("id") {
                        Some(i) => i,
                        None => {
                            respond_error(request, 400, "Missing required query parameter: id");
                            continue;
                        }
                    };
                    let id = match id_str.parse::<i64>() {
                        Ok(parsed) => parsed,
                        Err(_) => {
                            respond_error(request, 400, "Invalid id");
                            continue;
                        }
                    };
                    match db::delete_task_update(conn, id) {
                        Ok(_) => {
                            let _ = app_handle.emit("tasks-changed", ());
                            respond_json(request, 200, &serde_json::json!({ "status": "success" }));
                        }
                        Err(e) => {
                            respond_error(request, 500, &format!("Failed to delete note: {}", e))
                        }
                    }
                }
                _ => {
                    respond_error(request, 404, "Endpoint not found");
                }
            }
        }
    });
}

fn respond_json<T: Serialize>(request: tiny_http::Request, status_code: u16, data: &T) {
    let json_bytes = match serde_json::to_vec(data) {
        Ok(b) => b,
        Err(_) => {
            let _ = request.respond(tiny_http::Response::new(
                tiny_http::StatusCode(500),
                vec![],
                &b"Internal Server Error"[..],
                Some(21),
                None,
            ));
            return;
        }
    };

    let response = tiny_http::Response::new(
        tiny_http::StatusCode(status_code),
        vec![
            tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap(),
            tiny_http::Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap(),
            tiny_http::Header::from_bytes(
                &b"Access-Control-Allow-Methods"[..],
                &b"GET, POST, PUT, DELETE, OPTIONS"[..],
            )
            .unwrap(),
            tiny_http::Header::from_bytes(
                &b"Access-Control-Allow-Headers"[..],
                &b"Content-Type"[..],
            )
            .unwrap(),
        ],
        json_bytes.as_slice(),
        Some(json_bytes.len()),
        None,
    );

    let _ = request.respond(response);
}

fn respond_error(request: tiny_http::Request, status_code: u16, message: &str) {
    let payload = serde_json::json!({ "error": message });
    respond_json(request, status_code, &payload);
}
