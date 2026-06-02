import { Card, Progress, Label, Button } from 'semantic-ui-react';
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

  // Map CSS variable colors to Semantic UI progress colors
  let semanticProgressColor: any = 'blue';
  if (progressColor === 'var(--warn)') {
    semanticProgressColor = 'orange';
  } else if (progressColor === 'var(--accent)') {
    semanticProgressColor = 'green';
  } else if (progressColor === 'var(--primary)') {
    semanticProgressColor = 'blue';
  }

  // Priority Label color
  let priorityLabelColor: any = 'grey';
  if (task.project_priority === 2) {
    priorityLabelColor = 'red';
  } else if (task.project_priority === 1) {
    priorityLabelColor = 'orange';
  } else if (task.project_priority === 0) {
    priorityLabelColor = 'green';
  }

  const stopActionEvent = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDragStart = (event: React.DragEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, [data-task-card-actions="true"]')) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onDragStart(event, task.task_id);
  };

  return (
    <div
      className="task-card"
      draggable
      onDragOver={(event: React.DragEvent) => {
        event.preventDefault();
        const transfer = event.dataTransfer;
        if (transfer) {
          transfer.dropEffect = 'move';
        }
      }}
      onDragStart={handleDragStart}
      style={{
        cursor: 'grab',
        opacity: isDone ? 0.7 : 1,
        position: 'relative',
        zIndex: 1,
      }}
    >
      <Card
        fluid
        style={{
          background: 'rgba(30, 41, 59, 0.6)',
          border: '1px solid var(--glass-border)',
          borderRadius: '8px',
          margin: 0,
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)',
          overflow: 'visible',
          width: '100%',
        }}
      >
        <Card.Content style={{ padding: '12px' }}>
          <Card.Header
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: isDone ? 'var(--text-low)' : 'var(--text-high)',
              textDecoration: isDone ? 'line-through' : 'none',
              wordBreak: 'break-word',
            }}
          >
            {task.title}
          </Card.Header>

          <div style={{ marginTop: '8px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '10px',
                color: 'var(--text-low)',
                marginBottom: '4px',
              }}
            >
              <span>Progress</span>
              <span>{task.completion_percentage}%</span>
            </div>
            <Progress
              percent={task.completion_percentage}
              size="tiny"
              color={semanticProgressColor}
              style={{ margin: 0 }}
            />
          </div>
        </Card.Content>

        <Card.Content
          extra
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 12px',
            background: 'transparent',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            pointerEvents: 'auto',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <Label size="mini" color={priorityLabelColor} style={{ margin: 0 }}>
              {priority.text}
            </Label>
            {task.is_daily_priority && (
              <Label size="mini" color="yellow" style={{ margin: 0 }}>
                Day
              </Label>
            )}
            {task.is_weekly_priority && (
              <Label size="mini" color="blue" style={{ margin: 0 }}>
                Week
              </Label>
            )}
          </div>
          <div
            data-task-card-actions="true"
            draggable={false}
            onDragStart={stopActionEvent}
            style={{ display: 'flex', gap: '4px' }}
          >
            <Button
              aria-label={`Edit ${task.title}`}
              title="Edit Task"
              type="button"
              draggable={false}
              icon="edit"
              size="mini"
              basic
              inverted
              onDragStart={stopActionEvent}
              onClick={(event: React.MouseEvent) => {
                event.preventDefault();
                event.stopPropagation();
                onEdit(task);
              }}
              style={{
                alignItems: 'center',
                color: 'var(--text-low)',
                display: 'inline-flex',
                height: '28px',
                justifyContent: 'center',
                lineHeight: 1,
                margin: 0,
                minHeight: '28px',
                minWidth: '28px',
                padding: 0,
                pointerEvents: 'auto',
                position: 'relative',
                width: '28px',
                zIndex: 3,
              }}
            />
            <Button
              aria-label={`Delete ${task.title}`}
              title="Delete Task"
              type="button"
              draggable={false}
              icon="trash"
              size="mini"
              basic
              negative
              onDragStart={stopActionEvent}
              onClick={(event: React.MouseEvent) => {
                event.preventDefault();
                event.stopPropagation();
                onDelete(task.task_id);
              }}
              style={{
                alignItems: 'center',
                display: 'inline-flex',
                height: '28px',
                justifyContent: 'center',
                lineHeight: 1,
                margin: 0,
                minHeight: '28px',
                minWidth: '28px',
                padding: 0,
                pointerEvents: 'auto',
                position: 'relative',
                width: '28px',
                zIndex: 3,
              }}
            />
          </div>
        </Card.Content>
      </Card>
    </div>
  );
};
