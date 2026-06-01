import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Project, Task, TaskUpdate, ArchivedProject, TrashResponse } from '../../domain/types';
import { showAlert, showConfirm } from '../../shared/utils/dialogs';
import { DashboardHeader } from './components/DashboardHeader';
import { DashboardSidebar } from './components/DashboardSidebar';
import { TaskBoard } from './components/TaskBoard';
import { DashboardView, TaskStatus } from './types';
import { getPriorityLabel } from './utils';

interface DashboardProps {
  projects: Project[];
  refreshData: (date?: string) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
}

const statusLabels: { [key: string]: string } = {
  todo: 'todo',
  in_progress: 'in progress',
  done: 'done',
};

export const Dashboard: React.FC<DashboardProps> = ({
  projects,
  refreshData,
  selectedDate,
  setSelectedDate,
}) => {
  const [activeView, setActiveView] = useState<DashboardView>('my_day');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  // Modals state
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showPlanTomorrowModal, setShowPlanTomorrowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Archiving & Trash states
  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [archivedProjects, setArchivedProjects] = useState<ArchivedProject[]>([]);
  const [trashItems, setTrashItems] = useState<TrashResponse | null>(null);
  const [trashRetentionDays, setTrashRetentionDays] = useState<number>(30);
  const [projectToDeleteId, setProjectToDeleteId] = useState<number | null>(null);

  const projectNameInputRef = useRef<HTMLInputElement>(null);
  const taskTitleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showProjectModal) {
      setTimeout(() => projectNameInputRef.current?.focus(), 50);
    }
  }, [showProjectModal]);

  useEffect(() => {
    if (showTaskModal) {
      setTimeout(() => taskTitleInputRef.current?.focus(), 50);
    }
  }, [showTaskModal]);

  const fetchArchivedProjects = async () => {
    try {
      const res = await invoke<ArchivedProject[]>('get_archived_projects');
      setArchivedProjects(res);
    } catch (err) {
      console.error('Failed to fetch archived projects:', err);
    }
  };

  const fetchTrashItems = async () => {
    try {
      const res = await invoke<TrashResponse>('get_trash_items');
      setTrashItems(res);
    } catch (err) {
      console.error('Failed to fetch trash items:', err);
    }
  };

  // Fetch trash retention config
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await invoke<{ trash_retention_days: number }>('get_config');
        setTrashRetentionDays(config.trash_retention_days);
      } catch (err) {
        console.error('Failed to fetch config in dashboard:', err);
      }
    };
    fetchConfig();
  }, []);

  // Fetch archived projects when modal opens
  useEffect(() => {
    if (showArchivedModal) {
      fetchArchivedProjects();
    }
  }, [showArchivedModal]);

  // Fetch trash items when modal opens
  useEffect(() => {
    if (showTrashModal) {
      fetchTrashItems();
    }
  }, [showTrashModal]);

  const handleArchiveActiveProject = async (id: number) => {
    try {
      await invoke('archive_project', { id });
      setActiveView('my_day');
      setSelectedProjectId(null);
      refreshData(selectedDate);
    } catch (err) {
      showAlert(`Failed to archive project: ${err}`);
    }
  };

  const handleDeleteActiveProject = (id: number) => {
    setProjectToDeleteId(id);
  };

  const handleConfirmDeleteProject = async (deleteTasks: boolean) => {
    if (!projectToDeleteId) return;
    try {
      await invoke('delete_project', { id: projectToDeleteId, deleteTasks });
      setProjectToDeleteId(null);
      setActiveView('my_day');
      setSelectedProjectId(null);
      refreshData(selectedDate);
    } catch (err) {
      showAlert(`Failed to delete project: ${err}`);
    }
  };

  const handleUnarchiveProject = async (id: number) => {
    try {
      await invoke('unarchive_project', { id });
      fetchArchivedProjects();
      refreshData(selectedDate);
    } catch (err) {
      showAlert(`Failed to unarchive project: ${err}`);
    }
  };

  const handleDeleteArchivedProject = async (id: number) => {
    if (!showConfirm('Are you sure you want to move this project to the Trash?')) return;
    try {
      await invoke('delete_project', { id, deleteTasks: true });
      fetchArchivedProjects();
      refreshData(selectedDate);
    } catch (err) {
      showAlert(`Failed to delete project: ${err}`);
    }
  };

  const handleRestoreProject = async (id: number) => {
    const restoreTasks = showConfirm(
      'Do you want to restore all tasks associated with this project as well?\n(If Cancel, only the project structure will be restored)',
    );
    try {
      await invoke('restore_project', { id, restoreTasks });
      fetchTrashItems();
      refreshData(selectedDate);
    } catch (err) {
      showAlert(`Failed to restore project: ${err}`);
    }
  };

  const handleRestoreTask = async (id: number) => {
    try {
      await invoke('restore_task', { id });
      fetchTrashItems();
      refreshData(selectedDate);
    } catch (err) {
      showAlert(`Failed to restore task: ${err}`);
    }
  };

  const handlePurgeProject = async (id: number) => {
    if (
      !showConfirm(
        '⚠️ WARNING: This will permanently delete this project from the database. This action CANNOT be undone. Are you sure?',
      )
    )
      return;
    try {
      await invoke('purge_project', { id });
      fetchTrashItems();
    } catch (err) {
      showAlert(`Failed to permanently delete project: ${err}`);
    }
  };

  const handlePurgeTask = async (id: number) => {
    if (
      !showConfirm(
        '⚠️ WARNING: This will permanently delete this task from the database. This action CANNOT be undone. Are you sure?',
      )
    )
      return;
    try {
      await invoke('purge_task', { id });
      fetchTrashItems();
    } catch (err) {
      showAlert(`Failed to permanently delete task: ${err}`);
    }
  };

  const getDaysRemaining = (deletedAtStr: string) => {
    const deletedAt = new Date(deletedAtStr);
    const now = new Date();
    const diffTime = now.getTime() - deletedAt.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const remaining = trashRetentionDays - diffDays;
    return remaining > 0 ? remaining : 0;
  };

  const renderDaysRemaining = (deletedAtStr: string) => {
    const daysLeft = getDaysRemaining(deletedAtStr);
    if (daysLeft <= 3) {
      return (
        <span style={{ color: 'var(--danger)', fontSize: '11px', fontWeight: '600' }}>
          ⏳ {daysLeft} days left
        </span>
      );
    }
    if (daysLeft <= 10) {
      return (
        <span style={{ color: 'var(--warn)', fontSize: '11px', fontWeight: '500' }}>
          ⏳ {daysLeft} days left
        </span>
      );
    }
    return (
      <span style={{ color: 'var(--text-low)', fontSize: '11px' }}>⏳ {daysLeft} days left</span>
    );
  };

  // Form states
  const [projectName, setProjectName] = useState('');
  const [projectPriority, setProjectPriority] = useState(0);

  const [taskTitle, setTaskTitle] = useState('');
  const [taskProjectId, setTaskProjectId] = useState<string>('adhoc');
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('todo');
  const [taskProjectPriority, setTaskProjectPriority] = useState(0);
  const [taskDailyPriority, setTaskDailyPriority] = useState(false);
  const [taskWeeklyPriority, setTaskWeeklyPriority] = useState(false);
  const [taskPercent, setTaskPercent] = useState(0);
  const [taskComment, setTaskComment] = useState('');

  // Notes state for editing task
  const [taskNotes, setTaskNotes] = useState<TaskUpdate[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [newNotePercent, setNewNotePercent] = useState(0);
  const [newNoteStatus, setNewNoteStatus] = useState<TaskStatus>('todo');

  // Note edit state
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [editNotePercent, setEditNotePercent] = useState(0);
  const [editNoteStatus, setEditNoteStatus] = useState<TaskStatus>('todo');

  const todayStr = new Date().toISOString().split('T')[0];
  const isPastDay = selectedDate < todayStr;

  // Fetch updates list for the task being edited
  const fetchTaskNotes = async (taskId: number) => {
    try {
      const res = await invoke<TaskUpdate[]>('get_task_updates', { taskId });
      setTaskNotes(res);
    } catch (err) {
      console.error('Failed to fetch task updates:', err);
    }
  };

  useEffect(() => {
    if (editingTask) {
      fetchTaskNotes(editingTask.task_id);
    } else {
      setTaskNotes([]);
    }
  }, [editingTask]);

  // Setup task form when editing or adding
  useEffect(() => {
    if (editingTask) {
      setTaskTitle(editingTask.title);
      const parentProj = projects.find(
        (p) =>
          p.tasks.needs_to_do.some((t) => t.task_id === editingTask.task_id) ||
          p.tasks.on_my_plate.some((t) => t.task_id === editingTask.task_id) ||
          p.tasks.done.some((t) => t.task_id === editingTask.task_id),
      );
      setTaskProjectId(
        parentProj?.project_id !== null && parentProj?.project_id !== undefined
          ? parentProj.project_id.toString()
          : 'adhoc',
      );
      setTaskStatus(editingTask.status);
      setTaskProjectPriority(editingTask.project_priority);
      setTaskDailyPriority(editingTask.is_daily_priority);
      setTaskWeeklyPriority(editingTask.is_weekly_priority);
      setTaskPercent(editingTask.completion_percentage);
      setTaskComment('');
      setNewNotePercent(editingTask.completion_percentage);
      setNewNoteStatus(editingTask.status);
    } else {
      setTaskTitle('');
      setTaskProjectId(selectedProjectId !== null ? selectedProjectId.toString() : 'adhoc');
      setTaskStatus('todo');
      setTaskProjectPriority(0);
      setTaskDailyPriority(activeView === 'my_day');
      setTaskWeeklyPriority(activeView === 'weekly_focus');
      setTaskPercent(0);
      setTaskComment('');
    }
  }, [editingTask, showTaskModal, projects, selectedProjectId, activeView]);

  const getTaskProjectIdVal = (task: Task): number | null => {
    const p = projects.find(
      (proj) =>
        proj.tasks.needs_to_do.some((t) => t.task_id === task.task_id) ||
        proj.tasks.on_my_plate.some((t) => t.task_id === task.task_id) ||
        proj.tasks.done.some((t) => t.task_id === task.task_id),
    );
    return p?.project_id !== undefined ? p.project_id : null;
  };

  // Handle Project Creation
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    try {
      await invoke('create_project', { name: projectName, priority: projectPriority });
      setProjectName('');
      setProjectPriority(0);
      setShowProjectModal(false);
      refreshData(selectedDate);
    } catch (err) {
      showAlert(`Failed to create project: ${err}`);
    }
  };

  // Handle Task Create/Update
  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const projectIdVal = taskProjectId === 'adhoc' ? null : Number(taskProjectId);

    try {
      if (editingTask) {
        await invoke('update_task', {
          id: editingTask.task_id,
          projectId: projectIdVal,
          title: taskTitle,
          status: taskStatus,
          projectPriority: taskProjectPriority,
          isDailyPriority: taskDailyPriority,
          isWeeklyPriority: taskWeeklyPriority,
          completionPercentage: taskPercent,
          updateText: taskComment.trim() ? taskComment : null,
          date: selectedDate,
        });
      } else {
        await invoke('create_task', {
          projectId: projectIdVal,
          title: taskTitle,
          status: taskStatus,
          projectPriority: taskProjectPriority,
          isDailyPriority: taskDailyPriority,
          isWeeklyPriority: taskWeeklyPriority,
          completionPercentage: taskPercent,
          date: selectedDate,
        });
      }
      setShowTaskModal(false);
      setEditingTask(null);
      refreshData(selectedDate);
    } catch (err) {
      showAlert(`Failed to save task: ${err}`);
    }
  };

  // Handle Task Deletion
  const handleDeleteTask = async (taskId: number) => {
    if (!showConfirm('Are you sure you want to delete this task?')) return;
    try {
      await invoke('delete_task', { id: taskId });
      refreshData(selectedDate);
    } catch (err) {
      showAlert(`Failed to delete task: ${err}`);
    }
  };

  // Drag and Drop implementation
  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    e.dataTransfer.setData('text/plain', taskId.toString());
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = Number(e.dataTransfer.getData('text/plain'));
    if (!taskId) return;

    let foundTask: Task | null = null;
    let foundProjId: number | null = null;

    for (let i = 0; i < projects.length; i += 1) {
      const p = projects[i];
      const allTasks = [...p.tasks.needs_to_do, ...p.tasks.on_my_plate, ...p.tasks.done];
      const match = allTasks.find((t) => t.task_id === taskId);
      if (match) {
        foundTask = match;
        foundProjId = p.project_id;
        break;
      }
    }

    if (foundTask) {
      try {
        const newPercent = targetStatus === 'done' ? 100 : undefined;
        await invoke('update_task', {
          id: taskId,
          projectId: foundProjId,
          title: (foundTask as Task).title,
          status: targetStatus,
          projectPriority: (foundTask as Task).project_priority,
          isDailyPriority: (foundTask as Task).is_daily_priority,
          isWeeklyPriority: (foundTask as Task).is_weekly_priority,
          completionPercentage: newPercent,
          date: selectedDate,
        });
        refreshData(selectedDate);
      } catch (err) {
        showAlert(`Failed to move task: ${err}`);
      }
    }
  };

  // Helper to filter tasks for the main board based on selection
  const getFilteredTasks = (): { needs_to_do: Task[]; on_my_plate: Task[]; done: Task[] } => {
    if (activeView === 'my_day') {
      const allTasks: Task[] = [];
      projects.forEach((p) => {
        allTasks.push(...p.tasks.needs_to_do, ...p.tasks.on_my_plate, ...p.tasks.done);
      });
      const dailyTasks = allTasks.filter((t) => t.is_daily_priority);
      return {
        needs_to_do: dailyTasks.filter((t) => t.status === 'todo'),
        on_my_plate: dailyTasks.filter((t) => t.status === 'in_progress'),
        done: dailyTasks.filter((t) => t.status === 'done'),
      };
    }

    if (activeView === 'weekly_focus') {
      const allTasks: Task[] = [];
      projects.forEach((p) => {
        allTasks.push(...p.tasks.needs_to_do, ...p.tasks.on_my_plate, ...p.tasks.done);
      });
      const weeklyTasks = allTasks.filter((t) => t.is_weekly_priority);
      return {
        needs_to_do: weeklyTasks.filter((t) => t.status === 'todo'),
        on_my_plate: weeklyTasks.filter((t) => t.status === 'in_progress'),
        done: weeklyTasks.filter((t) => t.status === 'done'),
      };
    }

    const currentProj = projects.find((p) => p.project_id === selectedProjectId);
    if (currentProj) {
      return currentProj.tasks;
    }

    return { needs_to_do: [], on_my_plate: [], done: [] };
  };

  const currentTasks = getFilteredTasks();

  // Note actions
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || !editingTask) return;

    try {
      await invoke('create_task_update', {
        taskId: editingTask.task_id,
        date: selectedDate,
        updateText: newNoteText.trim(),
        completionPercentage: newNotePercent,
        status: newNoteStatus,
      });
      setNewNoteText('');
      fetchTaskNotes(editingTask.task_id);
      refreshData(selectedDate);
    } catch (err) {
      showAlert(`Failed to add note: ${err}`);
    }
  };

  const handleStartEditNote = (note: TaskUpdate) => {
    setEditingNoteId(note.id);
    setEditNoteText(note.update_text);
    setEditNotePercent(note.completion_percentage);
    setEditNoteStatus(note.status);
  };

  const handleSaveEditNote = async (noteId: number) => {
    if (!editNoteText.trim() || !editingTask) return;
    try {
      await invoke('update_task_update', {
        id: noteId,
        updateText: editNoteText.trim(),
        completionPercentage: editNotePercent,
        status: editNoteStatus,
      });
      setEditingNoteId(null);
      fetchTaskNotes(editingTask.task_id);
      refreshData(selectedDate);
    } catch (err) {
      showAlert(`Failed to update note: ${err}`);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!showConfirm('Are you sure you want to delete this note?') || !editingTask) return;
    try {
      await invoke('delete_task_update', { id: noteId });
      fetchTaskNotes(editingTask.task_id);
      refreshData(selectedDate);
    } catch (err) {
      showAlert(`Failed to delete note: ${err}`);
    }
  };

  const adjustDate = (days: number) => {
    const parts = selectedDate.split('-');
    if (parts.length === 3) {
      const year = Number(parts[0]);
      const month = Number(parts[1]) - 1; // 0-indexed
      const day = Number(parts[2]);

      const dateObj = new Date(year, month, day);
      dateObj.setDate(dateObj.getDate() + days);

      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getDate()).padStart(2, '0');
      setSelectedDate(`${y}-${m}-${d}`);
    }
  };

  // Get current day's priorities that are not completed (for plan tomorrow)
  const carryOverTasks = projects.flatMap((p) =>
    [...p.tasks.needs_to_do, ...p.tasks.on_my_plate].filter((t) => t.is_daily_priority),
  );

  return (
    <div className="dashboard-container">
      <DashboardSidebar
        activeView={activeView}
        onOpenArchived={() => setShowArchivedModal(true)}
        onOpenCreateProject={() => setShowProjectModal(true)}
        onOpenTrash={() => setShowTrashModal(true)}
        onSelectProject={(projectId) => {
          setActiveView('project');
          setSelectedProjectId(projectId);
        }}
        onSelectView={(view) => {
          setActiveView(view);
          setSelectedProjectId(null);
        }}
        projects={projects}
        selectedProjectId={selectedProjectId}
      />

      {/* Main Board */}
      <div className="dashboard-view">
        {/* Past Date Banner */}
        {isPastDay && (
          <div
            className="glass-panel"
            style={{
              padding: '10px 16px',
              marginBottom: '16px',
              background: 'var(--warn-glow)',
              borderColor: 'var(--warn)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--warn)', fontWeight: '500', fontSize: '14px' }}>
              ⚠️ Viewing past date: <strong>{selectedDate}</strong>. Changes will be logged for this
              day.
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSelectedDate(todayStr)}
              style={{ padding: '4px 10px', fontSize: '12px' }}
            >
              Go to Today
            </button>
          </div>
        )}

        <DashboardHeader
          activeView={activeView}
          onAddTask={() => {
            setEditingTask(null);
            setShowTaskModal(true);
          }}
          onArchiveProject={handleArchiveActiveProject}
          onDateChange={setSelectedDate}
          onDeleteProject={handleDeleteActiveProject}
          onOpenPlanTomorrow={() => setShowPlanTomorrowModal(true)}
          onShiftDate={adjustDate}
          projects={projects}
          selectedDate={selectedDate}
          selectedProjectId={selectedProjectId}
        />

        <TaskBoard
          onDeleteTask={handleDeleteTask}
          onDropTask={handleDrop}
          onEditTask={(task) => {
            setEditingTask(task);
            setShowTaskModal(true);
          }}
          onTaskDragStart={handleDragStart}
          tasks={currentTasks}
        />
      </div>

      {/* CREATE PROJECT MODAL */}
      {showProjectModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <h3 className="modal-header">Create New Project</h3>
            <form
              onSubmit={handleCreateProject}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div className="form-group">
                <label htmlFor="p-name">
                  Project Name
                  <input
                    type="text"
                    id="p-name"
                    ref={projectNameInputRef}
                    className="form-input"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. Project Apollo"
                    required
                  />
                </label>
              </div>
              <div className="form-group">
                <label htmlFor="p-priority">
                  Project Priority
                  <select
                    id="p-priority"
                    className="form-select"
                    value={projectPriority}
                    onChange={(e) => setProjectPriority(Number(e.target.value))}
                  >
                    <option value={0}>Low Priority</option>
                    <option value={1}>Medium Priority</option>
                    <option value={2}>High Priority</option>
                  </select>
                </label>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'flex-end',
                  marginTop: '8px',
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowProjectModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PLAN TOMORROW MODAL */}
      {showPlanTomorrowModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '560px' }}>
            <h3
              className="modal-header"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              🔮 Plan Tomorrow&apos;s Carry-Over
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-med)', marginTop: '-8px' }}>
              Toggle carry-over for today&apos;s active priorities that aren&apos;t completed yet.
              Supported tasks will copy to tomorrow.
            </p>
            <div
              style={{
                maxHeight: '300px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                margin: '8px 0',
              }}
            >
              {carryOverTasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-low)' }}>
                  No uncompleted priorities on your day to plan!
                </div>
              ) : (
                carryOverTasks.map((t) => (
                  <div
                    key={t.task_id}
                    className="glass-panel"
                    style={{
                      padding: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>{t.title}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-low)', marginTop: '2px' }}>
                        Progress: {t.completion_percentage}% | Status: {t.status}
                      </div>
                    </div>
                    <label
                      className="form-checkbox"
                      style={{ margin: 0 }}
                      htmlFor={`planned-next-day-${t.task_id}`}
                    >
                      <input
                        id={`planned-next-day-${t.task_id}`}
                        type="checkbox"
                        checked={t.planned_for_next_day}
                        onChange={async (e) => {
                          try {
                            const pId = getTaskProjectIdVal(t);
                            await invoke('update_task', {
                              id: t.task_id,
                              projectId: pId,
                              title: t.title,
                              status: t.status,
                              projectPriority: t.project_priority,
                              isDailyPriority: t.is_daily_priority,
                              isWeeklyPriority: t.is_weekly_priority,
                              completionPercentage: t.completion_percentage,
                              updateText: null,
                              date: selectedDate,
                              plannedForNextDay: e.target.checked,
                            });
                            refreshData(selectedDate);
                          } catch (err) {
                            showAlert(`Failed to toggle carry-over: ${err}`);
                          }
                        }}
                      />
                      <span style={{ fontSize: '13px' }}>Carry over</span>
                    </label>
                  </div>
                ))
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowPlanTomorrowModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE/EDIT TASK MODAL */}
      {showTaskModal && (
        <div className="modal-overlay" style={{ overflowY: 'auto' }}>
          <div
            className="modal-content glass-panel"
            style={{ maxWidth: '600px', margin: '40px auto' }}
          >
            <h3 className="modal-header">{editingTask ? 'Edit Task Details' : 'Add New Task'}</h3>
            <form
              onSubmit={handleSaveTask}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <div className="form-group">
                <label htmlFor="t-title">
                  Task Title
                  <input
                    type="text"
                    id="t-title"
                    ref={taskTitleInputRef}
                    className="form-input"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="What needs to be done?"
                    required
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label htmlFor="t-proj">
                    Project
                    <select
                      id="t-proj"
                      className="form-select"
                      value={taskProjectId}
                      onChange={(e) => setTaskProjectId(e.target.value)}
                    >
                      {projects.map((p) => (
                        <option
                          key={p.project_id ?? 'adhoc'}
                          value={p.project_id !== null ? p.project_id.toString() : 'adhoc'}
                        >
                          {p.project_name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="form-group">
                  <label htmlFor="t-priority">
                    Overall Task Priority
                    <select
                      id="t-priority"
                      className="form-select"
                      value={taskProjectPriority}
                      onChange={(e) => setTaskProjectPriority(Number(e.target.value))}
                    >
                      <option value={0}>Low Priority</option>
                      <option value={1}>Medium Priority</option>
                      <option value={2}>High Priority</option>
                    </select>
                  </label>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {editingTask && (
                  <div className="form-group">
                    <label htmlFor="t-status">
                      Status
                      <select
                        id="t-status"
                        className="form-select"
                        value={taskStatus}
                        onChange={(e) => {
                          const statusVal = e.target.value as 'todo' | 'in_progress' | 'done';
                          setTaskStatus(statusVal);
                          if (statusVal === 'done') {
                            setTaskPercent(100);
                          }
                        }}
                      >
                        <option value="todo">On My Plate (Todo)</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                    </label>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="t-percent">
                    Completion Percentage ({taskPercent}%)
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="range"
                        id="t-percent"
                        min="0"
                        max="100"
                        value={taskPercent}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setTaskPercent(val);
                          if (val === 100) {
                            setTaskStatus('done');
                          } else if (editingTask && taskStatus === 'done') {
                            setTaskStatus('in_progress');
                          }
                        }}
                        style={{ flex: 1, accentColor: 'var(--primary)' }}
                      />
                      <span style={{ fontSize: '14px', fontWeight: '600', width: '36px' }}>
                        {taskPercent}%
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '20px', marginTop: '2px' }}>
                <label className="form-checkbox" htmlFor="task-daily-priority-checkbox">
                  <input
                    id="task-daily-priority-checkbox"
                    type="checkbox"
                    checked={taskDailyPriority}
                    onChange={(e) => {
                      const { checked } = e.target;
                      setTaskDailyPriority(checked);
                      if (checked) {
                        setTaskWeeklyPriority(true);
                      }
                    }}
                  />
                  <span>☀️ Add to My Day</span>
                </label>

                <label className="form-checkbox" htmlFor="task-weekly-priority-checkbox">
                  <input
                    id="task-weekly-priority-checkbox"
                    type="checkbox"
                    checked={taskWeeklyPriority}
                    onChange={(e) => {
                      const { checked } = e.target;
                      setTaskWeeklyPriority(checked);
                      if (!checked) {
                        setTaskDailyPriority(false);
                      }
                    }}
                  />
                  <span>📅 Add to Weekly Focus</span>
                </label>
              </div>

              {editingTask && (
                <div className="form-group">
                  <label htmlFor="t-comment">
                    Add a Quick Update Log Note (Optional)
                    <input
                      type="text"
                      id="t-comment"
                      className="form-input"
                      value={taskComment}
                      onChange={(e) => setTaskComment(e.target.value)}
                      placeholder="Describe what you worked on..."
                    />
                  </label>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'flex-end',
                  marginTop: '6px',
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowTaskModal(false);
                    setEditingTask(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingTask ? 'Save Core Details' : 'Create Task'}
                </button>
              </div>
            </form>

            {/* Task Logs / Notes CRUD Panel */}
            {editingTask && (
              <div
                style={{
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  marginTop: '16px',
                  paddingTop: '16px',
                }}
              >
                <h4
                  style={{
                    fontSize: '15px',
                    fontWeight: '600',
                    color: 'var(--text-high)',
                    marginBottom: '4px',
                  }}
                >
                  📜 Task Updates History & Daily Notes
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-med)', marginBottom: '12px' }}>
                  Add date-associated logs below. Updates affect the progress on their logged dates.
                </p>

                {/* Add note inline form */}
                <form
                  onSubmit={handleAddNote}
                  className="glass-panel"
                  style={{
                    padding: '12px',
                    marginBottom: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <label htmlFor="new-note-text-input">
                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: 'var(--primary)',
                        marginBottom: '4px',
                      }}
                    >
                      ✏️ Add Log Note for {selectedDate}
                    </div>
                    <input
                      id="new-note-text-input"
                      type="text"
                      className="form-input"
                      placeholder="e.g. Completed initial OAuth boilerplate code"
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      required
                    />
                  </label>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label
                        style={{ fontSize: '11px', color: 'var(--text-low)', whiteSpace: 'nowrap' }}
                        htmlFor="new-note-percent-range"
                      >
                        Note Progress:
                        <input
                          id="new-note-percent-range"
                          type="range"
                          min="0"
                          max="100"
                          value={newNotePercent}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setNewNotePercent(val);
                            if (val === 100) {
                              setNewNoteStatus('done');
                            } else if (newNoteStatus === 'done') {
                              setNewNoteStatus('in_progress');
                            }
                          }}
                          style={{ flex: 1, accentColor: 'var(--primary)' }}
                        />
                      </label>
                      <span style={{ fontSize: '12px', fontWeight: '600' }}>{newNotePercent}%</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label
                        style={{ fontSize: '11px', color: 'var(--text-low)' }}
                        htmlFor="new-note-status-select"
                      >
                        Status:
                        <select
                          id="new-note-status-select"
                          className="form-select"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                          value={newNoteStatus}
                          onChange={(e) => {
                            const s = e.target.value as 'todo' | 'in_progress' | 'done';
                            setNewNoteStatus(s);
                            if (s === 'done') {
                              setNewNotePercent(100);
                            } else if (s === 'todo') {
                              setNewNotePercent(0);
                            }
                          }}
                        >
                          <option value="todo">Todo</option>
                          <option value="in_progress">In Progress</option>
                          <option value="done">Done</option>
                        </select>
                      </label>
                    </div>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ padding: '4px 12px', fontSize: '12px' }}
                    >
                      Log Note
                    </button>
                  </div>
                </form>

                {/* Notes list */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    maxHeight: '250px',
                    overflowY: 'auto',
                  }}
                >
                  {taskNotes.length === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '16px',
                        color: 'var(--text-low)',
                        fontSize: '13px',
                      }}
                    >
                      No progress logs recorded.
                    </div>
                  ) : (
                    taskNotes.map((note) => (
                      <div key={note.id} className="glass-panel" style={{ padding: '10px 12px' }}>
                        {editingNoteId === note.id ? (
                          /* Edit note inline mode */
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <input
                              type="text"
                              className="form-input"
                              value={editNoteText}
                              onChange={(e) => setEditNoteText(e.target.value)}
                              required
                            />
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '10px',
                              }}
                            >
                              <div
                                style={{
                                  flex: 1,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                }}
                              >
                                <span style={{ fontSize: '11px', color: 'var(--text-low)' }}>
                                  Progress:
                                </span>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={editNotePercent}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setEditNotePercent(val);
                                    if (val === 100) {
                                      setEditNoteStatus('done');
                                    } else if (editNoteStatus === 'done') {
                                      setEditNoteStatus('in_progress');
                                    }
                                  }}
                                  style={{ flex: 1, accentColor: 'var(--primary)' }}
                                />
                                <span style={{ fontSize: '12px' }}>{editNotePercent}%</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <label
                                  style={{ fontSize: '11px', color: 'var(--text-low)' }}
                                  htmlFor={`edit-note-status-${note.id}`}
                                >
                                  Status:
                                  <select
                                    id={`edit-note-status-${note.id}`}
                                    className="form-select"
                                    style={{ padding: '2px 6px', fontSize: '12px' }}
                                    value={editNoteStatus}
                                    onChange={(e) => {
                                      const s = e.target.value as 'todo' | 'in_progress' | 'done';
                                      setEditNoteStatus(s);
                                      if (s === 'done') {
                                        setEditNotePercent(100);
                                      } else if (s === 'todo') {
                                        setEditNotePercent(0);
                                      }
                                    }}
                                  >
                                    <option value="todo">Todo</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="done">Done</option>
                                  </select>
                                </label>
                              </div>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  style={{ padding: '4px 8px', fontSize: '11px' }}
                                  onClick={() => handleSaveEditNote(note.id)}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: '11px' }}
                                  onClick={() => setEditingNoteId(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* View note mode */
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  fontSize: '13px',
                                  fontWeight: '500',
                                  color: 'var(--text-high)',
                                }}
                              >
                                {note.update_text}
                              </div>
                              <div
                                style={{
                                  display: 'flex',
                                  gap: '8px',
                                  marginTop: '4px',
                                  flexWrap: 'wrap',
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: '10px',
                                    padding: '1px 5px',
                                    background: 'rgba(255,255,255,0.04)',
                                    borderRadius: '4px',
                                    color: 'var(--text-med)',
                                  }}
                                >
                                  📅 {note.date}
                                </span>
                                <span
                                  style={{
                                    fontSize: '10px',
                                    padding: '1px 5px',
                                    background: 'var(--primary-glow)',
                                    borderRadius: '4px',
                                    color: '#a5b4fc',
                                  }}
                                >
                                  📈 {note.completion_percentage}%
                                </span>
                                <span
                                  style={{
                                    fontSize: '10px',
                                    padding: '1px 5px',
                                    background:
                                      note.status === 'done'
                                        ? 'var(--accent-glow)'
                                        : 'rgba(255,255,255,0.06)',
                                    borderRadius: '4px',
                                    color:
                                      note.status === 'done' ? 'var(--accent)' : 'var(--text-low)',
                                  }}
                                >
                                  {statusLabels[note.status] || note.status}
                                </span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                type="button"
                                className="action-btn"
                                onClick={() => handleStartEditNote(note)}
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                className="action-btn delete"
                                onClick={() => handleDeleteNote(note.id)}
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CUSTOM PROJECT DELETE CONFIRMATION MODAL */}
      {projectToDeleteId !== null && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '440px' }}>
            <h3 className="modal-header">Delete Project</h3>
            <p
              style={{
                fontSize: '14px',
                color: 'var(--text-high)',
                margin: '8px 0 16px 0',
                lineHeight: '1.5',
              }}
            >
              Do you want to delete all tasks and updates in this project?
              <br />
              <span style={{ fontSize: '13px', color: 'var(--text-med)' }}>
                (If No, tasks will remain active as Ad-hoc tasks)
              </span>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: 'var(--danger)', color: '#fff' }}
                onClick={() => handleConfirmDeleteProject(true)}
              >
                💥 Yes, Delete Project and All Tasks
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleConfirmDeleteProject(false)}
              >
                📦 No, Keep Tasks as Ad-hoc
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginTop: '8px' }}
                onClick={() => setProjectToDeleteId(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ARCHIVED PROJECTS MODAL */}
      {showArchivedModal && (
        <div className="modal-overlay">
          <div
            className="modal-content glass-panel"
            style={{
              maxWidth: '560px',
              maxHeight: '80vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <h3 className="modal-header">📁 Archived Projects</h3>
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                margin: '12px 0',
              }}
            >
              {archivedProjects.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-low)' }}>
                  No archived projects.
                </div>
              ) : (
                archivedProjects.map((p) => (
                  <div
                    key={p.id}
                    className="glass-panel"
                    style={{
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div
                        style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-high)' }}
                      >
                        {p.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-low)', marginTop: '2px' }}>
                        Priority: {getPriorityLabel(p.priority).text} | Created:{' '}
                        {new Date(p.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                        onClick={() => handleUnarchiveProject(p.id)}
                      >
                        Restore Project
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{
                          padding: '4px 10px',
                          fontSize: '12px',
                          borderColor: 'rgba(239,68,68,0.2)',
                          color: '#ef4444',
                        }}
                        onClick={() => handleDeleteArchivedProject(p.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                borderTop: '1px solid var(--panel-border)',
                paddingTop: '12px',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowArchivedModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TRASH MODAL */}
      {showTrashModal && (
        <div className="modal-overlay">
          <div
            className="modal-content glass-panel"
            style={{
              maxWidth: '640px',
              maxHeight: '80vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <h3
              className="modal-header"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span>🗑️ Trash Bin</span>
              <span style={{ fontSize: '11px', color: 'var(--text-low)', fontWeight: 'normal' }}>
                Retention: {trashRetentionDays} days
              </span>
            </h3>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                margin: '12px 0',
              }}
            >
              {/* Deleted Projects Section */}
              <div>
                <h4
                  style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: 'var(--primary)',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    paddingBottom: '4px',
                    marginBottom: '8px',
                  }}
                >
                  Projects ({trashItems?.projects.length || 0})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {!trashItems || trashItems.projects.length === 0 ? (
                    <div
                      style={{
                        padding: '12px',
                        textAlign: 'center',
                        color: 'var(--text-low)',
                        fontSize: '13px',
                      }}
                    >
                      No deleted projects.
                    </div>
                  ) : (
                    trashItems.projects.map((p) => (
                      <div
                        key={p.id}
                        className="glass-panel"
                        style={{
                          padding: '10px 12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: '500', fontSize: '13px' }}>{p.name}</div>
                          <div
                            style={{
                              display: 'flex',
                              gap: '8px',
                              marginTop: '2px',
                              alignItems: 'center',
                            }}
                          >
                            <span style={{ fontSize: '10px', color: 'var(--text-low)' }}>
                              Deleted: {new Date(p.deleted_at).toLocaleDateString()}
                            </span>
                            {renderDaysRemaining(p.deleted_at)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '3px 8px', fontSize: '11px' }}
                            onClick={() => handleRestoreProject(p.id)}
                          >
                            Restore
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{
                              padding: '3px 8px',
                              fontSize: '11px',
                              color: '#ef4444',
                              borderColor: 'rgba(239,68,68,0.2)',
                            }}
                            onClick={() => handlePurgeProject(p.id)}
                          >
                            Purge
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Deleted Tasks Section */}
              <div>
                <h4
                  style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: 'var(--primary)',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    paddingBottom: '4px',
                    marginBottom: '8px',
                  }}
                >
                  Tasks ({trashItems?.tasks.length || 0})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {!trashItems || trashItems.tasks.length === 0 ? (
                    <div
                      style={{
                        padding: '12px',
                        textAlign: 'center',
                        color: 'var(--text-low)',
                        fontSize: '13px',
                      }}
                    >
                      No deleted tasks.
                    </div>
                  ) : (
                    trashItems.tasks.map((t) => (
                      <div
                        key={t.id}
                        className="glass-panel"
                        style={{
                          padding: '10px 12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: '500', fontSize: '13px' }}>{t.title}</div>
                          <div
                            style={{
                              display: 'flex',
                              gap: '8px',
                              marginTop: '2px',
                              alignItems: 'center',
                            }}
                          >
                            {t.project_name && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  color: 'var(--text-low)',
                                  background: 'rgba(255,255,255,0.04)',
                                  padding: '1px 4px',
                                  borderRadius: '3px',
                                }}
                              >
                                Project: {t.project_name}
                              </span>
                            )}
                            <span style={{ fontSize: '10px', color: 'var(--text-low)' }}>
                              Deleted: {new Date(t.deleted_at).toLocaleDateString()}
                            </span>
                            {renderDaysRemaining(t.deleted_at)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '3px 8px', fontSize: '11px' }}
                            onClick={() => handleRestoreTask(t.id)}
                          >
                            Restore
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{
                              padding: '3px 8px',
                              fontSize: '11px',
                              color: '#ef4444',
                              borderColor: 'rgba(239,68,68,0.2)',
                            }}
                            onClick={() => handlePurgeTask(t.id)}
                          >
                            Purge
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                borderTop: '1px solid var(--panel-border)',
                paddingTop: '12px',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowTrashModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
