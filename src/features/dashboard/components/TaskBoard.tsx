import { Grid, Segment, Header, Label, Icon } from 'semantic-ui-react';
import { TasksGroup, Task } from '../../../domain/types';
import { TaskStatus } from '../types';
import { TaskCard } from './TaskCard';

interface TaskBoardProps {
  onDeleteTask: (taskId: number) => void;
  onDropTask: (event: React.DragEvent, targetStatus: TaskStatus) => void;
  onEditTask: (task: Task) => void;
  onTaskDragStart: (event: React.DragEvent, taskId: number) => void;
  tasks: TasksGroup;
}

const columns: {
  semanticColor: any;
  isDone?: boolean;
  key: keyof TasksGroup;
  label: string;
  progressColor: string;
  status: TaskStatus;
}[] = [
  {
    semanticColor: 'orange',
    key: 'needs_to_do',
    label: 'On My Plate',
    progressColor: 'var(--warn)',
    status: 'todo',
  },
  {
    semanticColor: 'blue',
    key: 'on_my_plate',
    label: 'In Progress',
    progressColor: 'var(--primary)',
    status: 'in_progress',
  },
  {
    semanticColor: 'green',
    isDone: true,
    key: 'done',
    label: 'Done',
    progressColor: 'var(--accent)',
    status: 'done',
  },
];

export const TaskBoard = ({
  onDeleteTask,
  onDropTask,
  onEditTask,
  onTaskDragStart,
  tasks,
}: TaskBoardProps) => {
  return (
    <Grid
      columns={3}
      stackable
      className="board-columns"
      style={{ margin: 0, width: '100%', flex: 1, minHeight: 0 }}
    >
      {columns.map((column) => {
        const columnTasks = tasks[column.key];

        return (
          <Grid.Column key={column.key} style={{ padding: '0 10px', height: '100%' }}>
            <Segment
              className="column-card"
              onDragOver={(event: React.DragEvent) => event.preventDefault()}
              onDrop={(event: React.DragEvent) => onDropTask(event, column.status)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                background: 'rgba(15, 23, 42, 0.3)',
                border: '1px solid var(--panel-border)',
                borderRadius: '12px',
                padding: '16px',
                minHeight: '350px',
              }}
            >
              <div
                className="column-header"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                  paddingBottom: '8px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                <Header
                  as="h4"
                  className="column-title"
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--text-med)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    margin: 0,
                  }}
                >
                  <Icon name="circle" color={column.semanticColor} size="small" /> {column.label}
                </Header>
                <Label
                  circular
                  size="mini"
                  style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-low)' }}
                >
                  {columnTasks.length}
                </Label>
              </div>
              <div
                className="column-body"
                onDragOver={(event: React.DragEvent) => {
                  event.preventDefault();
                  const transfer = event.dataTransfer;
                  if (transfer) {
                    transfer.dropEffect = 'move';
                  }
                }}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  overflowY: 'auto',
                }}
              >
                {columnTasks.map((task) => (
                  <TaskCard
                    key={task.task_id}
                    isDone={Boolean(column.isDone)}
                    onDelete={onDeleteTask}
                    onDragStart={onTaskDragStart}
                    onEdit={onEditTask}
                    progressColor={column.progressColor}
                    task={task}
                  />
                ))}
              </div>
            </Segment>
          </Grid.Column>
        );
      })}
    </Grid>
  );
};
