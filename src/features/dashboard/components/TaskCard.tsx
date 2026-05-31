import { Task } from '../../../domain/types';
import { getPriorityLabel } from '../utils';

interface TaskCardProps {
  isDone: boolean;
  onDelete: (taskId: number) => void;
  onDragStart: (event: React.DragEvent, taskId: number) => void;
  onEdit: (task: Task) => void;
  progressColor: string;
  task: Task;
}

export const TaskCard = ({
  isDone,
  onDelete,
  onDragStart,
  onEdit,
  progressColor,
  task,
}: TaskCardProps) => {
  const priority = getPriorityLabel(task.project_priority);

  return (
    <div
      className="task-card"
      draggable
      onDragStart={(event) => onDragStart(event, task.task_id)}
      style={isDone ? { opacity: 0.7 } : undefined}
    >
      <div
        className="task-title"
        style={isDone ? { textDecoration: 'line-through', color: 'var(--text-low)' } : undefined}
      >
        {task.title}
      </div>

      <div style={{ marginTop: '4px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '10px',
            color: 'var(--text-low)',
            marginBottom: '2px',
          }}
        >
          <span>Progress</span>
          <span>{task.completion_percentage}%</span>
        </div>
        <div
          style={{
            height: '4px',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${task.completion_percentage}%`,
              height: '100%',
              background: progressColor,
              transition: 'width 0.2s ease',
            }}
          />
        </div>
      </div>

      <div className="task-footer">
        <div className="task-badges">
          <span className={`task-badge ${priority.className}`}>{priority.text}</span>
          {task.is_daily_priority && <span className="task-badge daily">Day</span>}
          {task.is_weekly_priority && <span className="task-badge weekly">Week</span>}
        </div>
        <div className="task-actions">
          <button type="button" className="action-btn" onClick={() => onEdit(task)}>
            ✏️
          </button>
          <button
            type="button"
            className="action-btn delete"
            onClick={() => onDelete(task.task_id)}
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
};
