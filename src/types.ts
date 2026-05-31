export interface Task {
  task_id: number;
  title: string;
  project_priority: number; // 0=Low, 1=Medium, 2=High
  is_daily_priority: boolean;
  is_weekly_priority: boolean;
  status: "todo" | "in_progress" | "done";
  updated_at: string;
  completed_at: string | null;
  completion_percentage: number;
  planned_for_next_day: boolean;
}

export interface TaskUpdate {
  id: number;
  task_id: number;
  task_title: string;
  date: string;
  update_text: string;
  completion_percentage: number;
  status: "todo" | "in_progress" | "done";
  created_at: string;
}

export interface TasksGroup {
  needs_to_do: Task[];
  on_my_plate: Task[];
  done: Task[];
}

export interface Project {
  project_id: number | null; // null represents Ad-hoc
  project_name: string;
  project_priority: number;
  tasks: TasksGroup;
}

export interface ProjectSummary {
  project_name: string;
  completed: string[];
  in_progress: string[];
  pending: string[];
}

export interface SummaryResponse {
  summary_type: "daily" | "weekly";
  start_date: string;
  end_date: string;
  projects: ProjectSummary[];
}

export interface AppConfig {
  keyring_enabled: boolean;
  auto_lock_timeout_mins: number; // 0 = Never
  trash_retention_days: number;
}

export interface ArchivedProject {
  id: number;
  name: string;
  priority: number;
  created_at: string;
}

export interface TrashProject {
  id: number;
  name: string;
  priority: number;
  deleted_at: string;
}

export interface TrashTask {
  id: number;
  title: string;
  project_name: string | null;
  deleted_at: string;
}

export interface TrashResponse {
  projects: TrashProject[];
  tasks: TrashTask[];
}
