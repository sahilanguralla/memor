export type DashboardView = 'my_day' | 'weekly_focus' | 'project';

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface PriorityLabel {
  className: 'high' | 'med' | 'low';
  text: 'High' | 'Med' | 'Low';
}
