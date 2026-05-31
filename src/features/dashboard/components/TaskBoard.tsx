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
  color: string;
  isDone?: boolean;
  key: keyof TasksGroup;
  label: string;
  progressColor: string;
  status: TaskStatus;
}[] = [
  {
    color: 'var(--warn)',
    key: 'needs_to_do',
    label: 'On My Plate',
    progressColor: 'var(--primary)',
    status: 'todo',
  },
  {
    color: 'var(--primary)',
    key: 'on_my_plate',
    label: 'In Progress',
    progressColor: 'var(--primary)',
    status: 'in_progress',
  },
  {
    color: 'var(--accent)',
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
    <div className="board-columns">
      {columns.map((column) => {
        const columnTasks = tasks[column.key];

        return (
          <div
            key={column.key}
            className="column-card"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => onDropTask(event, column.status)}
          >
            <div className="column-header">
              <div className="column-title">
                <span style={{ color: column.color }}>●</span> {column.label}
              </div>
              <span className="column-count">{columnTasks.length}</span>
            </div>
            <div className="column-body">
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
          </div>
        );
      })}
    </div>
  );
};
