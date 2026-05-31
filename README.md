# Memor — Secure Cross-Platform Task Tracker

**Memor** is a premium, secure, cross-platform desktop application designed to track tasks grouped by projects (or ad-hoc) and programmatically generate daily/weekly productivity summaries.

---

## Key Features

- 🔒 **SQLCipher Database Encryption**: SQLite database is fully encrypted and decrypted using a user-defined master password.
- 🔑 **System Keyring & Biometric Unlock**: Integrates with the OS credential manager (GNOME Keyring / KWallet) to securely store credentials, enabling auto-unlock on launch using your system password/fingerprint.
- ⏱️ **Idle Auto-Lock Timeout**: Automatically clears decrypted data from memory and locks the application after a configurable period of inactivity.
- 📂 **Flexible Prioritization**: Tracks tasks ("Needs to do", "On My Plate", "Done") with customizable project-level and task-level priorities.
- ☀️ **Smart Focus Filters**: Includes dedicated "My Day" and "Weekly Focus" views for prioritized execution.
- 📥 **System Tray Background Mode**: Minimizing or closing the window keeps the application running in the background system tray.
- 🔌 **Local HTTP API**: Starts a local unauthenticated HTTP server on port `3030` allowing integration with command-line tools or external scripts.

---

## Technical Stack

- **Frontend**: React (SPA), TypeScript, Vite
- **Backend**: Tauri (v2), Rust, SQLite/SQLCipher (`rusqlite`)
- **HTTP Server**: `tiny_http`
- **Security**: OS Keyring Integration (`keyring-rs`)

---

## Getting Started

### 1. System Dependencies (Linux/Ubuntu)

Ensure you have the required GTK, WebKit2GTK, and OpenSSL development libraries installed:

```bash
sudo apt-get update && sudo apt-get install -y \
  libsoup-3.0-dev \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

### 2. Install Project Dependencies

Use `nvm` (Node v20+) to install JavaScript dependencies:

```bash
npm install
```

### 3. Running the Application

To compile and launch the application in development mode:

```bash
npm run tauri dev
```

---

## Local HTTP API Documentation (`127.0.0.1:3030`)

If the database is locked, all endpoints will return `401 Unauthorized` with:

```json
{ "error": "Database is locked. Please unlock in the Memor application first." }
```

### 1. Retrieve Projects & Tasks

- **Endpoint**: `GET /projects` or `GET /projects?date=YYYY-MM-DD` (defaults to today's local date)
- **Response Format**: Task objects now include `completion_percentage` and `planned_for_next_day`.

```json
[
  {
    "project_id": 1,
    "project_name": "Project Alpha",
    "project_priority": 2,
    "tasks": {
      "needs_to_do": [
        {
          "task_id": 101,
          "title": "Design DB schema",
          "completion_percentage": 0,
          "planned_for_next_day": true
        }
      ],
      "on_my_plate": [
        {
          "task_id": 102,
          "title": "Write Rust backend",
          "completion_percentage": 45,
          "planned_for_next_day": true
        }
      ],
      "done": [
        {
          "task_id": 103,
          "title": "Initialize Tauri project",
          "completion_percentage": 100,
          "planned_for_next_day": true
        }
      ]
    }
  }
]
```

### 2. Create Project

- **Endpoint**: `POST /projects`
- **Payload**:

```json
{
  "name": "Project Gamma",
  "priority": 1
}
```

### 3. Create or Update Task

- **Endpoint**: `POST /tasks`
- **Payload (Create)**:

```json
{
  "title": "Setup OAuth2 flow",
  "status": "todo",
  "project_id": 1,
  "project_priority": 2,
  "is_daily_priority": true,
  "completion_percentage": 10,
  "date": "2026-05-31"
}
```

- **Payload (Update)**: Pass the `task_id` (or `id`) to perform a partial update on the task. Optionally pass progress details or comments:

```json
{
  "task_id": 102,
  "status": "in_progress",
  "completion_percentage": 60,
  "update_text": "Completed database connections",
  "date": "2026-05-31",
  "planned_for_next_day": true
}
```

### 4. Retrieve Task Activity Timeline

- **Endpoint**: `GET /timeline`
- **Response Format**: Returns a chronological history of all task updates and notes:

```json
[
  {
    "id": 1,
    "task_id": 102,
    "task_title": "Write Rust backend",
    "date": "2026-05-31",
    "update_text": "Completed database connections",
    "completion_percentage": 60,
    "status": "in_progress",
    "created_at": "2026-05-31T08:32:00Z"
  }
]
```

### 5. Manage Task Progress Updates & Daily Notes

- **Retrieve Task Notes**: `GET /task_updates?task_id=102`
- **Create Note**: `POST /task_updates`
  - **Payload**:
  ```json
  {
    "task_id": 102,
    "date": "2026-05-31",
    "update_text": "Created models",
    "completion_percentage": 25,
    "status": "in_progress"
  }
  ```
- **Update Note**: `PUT /task_updates`
  - **Payload**:
  ```json
  {
    "id": 1,
    "update_text": "Created models and initial tables",
    "completion_percentage": 30,
    "status": "in_progress"
  }
  ```
- **Delete Note**: `DELETE /task_updates?id=1`

### 6. Daily Summary

- **Endpoint**: `GET /summary/daily?date=YYYY-MM-DD` (defaults to today's local date)
- **Response Format**:

```json
{
  "summary_type": "daily",
  "start_date": "2026-05-30",
  "end_date": "2026-05-30",
  "projects": [
    {
      "project_name": "Project Alpha",
      "completed": ["Initialize Tauri project"],
      "in_progress": ["Write Rust backend"],
      "pending": ["Design DB schema"]
    }
  ]
}
```

### 7. Weekly Summary

- **Endpoint**: `GET /summary/weekly?start_date=YYYY-MM-DD` (defaults to 7 days ago)
- **Response Format**: Same structure as the daily summary, covering a 7-day period starting from `start_date`.

---

## Upcoming Features

The following features are planned for future releases:

1. **Create memory**: Store quick ideas, notes, and raw texts as searchable memory logs.
2. **Enable notifications**: Support system/desktop notifications for task reminders, focus reminders, and idle timeout alerts.
3. **Create knowledge for project**: Attach project-specific documentation, guides, or wikis.
4. **Add links to project/task**: Link external resources, reference URLs, or local files directly to projects and tasks.

---

## Building Native Installers

Tauri compiles and packages the application into native installers for each platform, meaning users do not need to install Node, Rust, or any compilation toolchains to run the app.

To compile and package the app for production on your current OS:

```bash
npm run tauri build
```

This will output the installers in `src-tauri/target/release/bundle/`:

- 🐧 **Linux**: `.deb` (Debian/Ubuntu package) or `.AppImage` (standalone portable binary)
- 🍏 **macOS**: `.dmg` (Apple disk image) or `.app` (application bundle)
- 🪟 **Windows**: `.msi` (Microsoft Installer) or `.exe` (setup executable)
