import type { Page } from '@playwright/test';

export const installTauriMock = () => {
  // 1. Setup mock internals
  (window as any).__TAURI_INTERNALS__ = (window as any).__TAURI_INTERNALS__ || {};
  (window as any).__TAURI_EVENT_PLUGIN_INTERNALS__ =
    (window as any).__TAURI_EVENT_PLUGIN_INTERNALS__ || {};

  const callbacks = new Map<number, (data: any) => void>();
  let callbackIdCounter = 1;

  (window as any).__TAURI_INTERNALS__.transformCallback = (callback: any, once = false) => {
    const id = callbackIdCounter++;
    callbacks.set(id, (data) => {
      if (once) {
        callbacks.delete(id);
      }
      callback(data);
    });
    return id;
  };

  (window as any).__TAURI_INTERNALS__.unregisterCallback = (id: number) => {
    callbacks.delete(id);
  };

  const eventListeners = new Map<string, Set<number>>();

  (window as any).__TAURI_EVENT_PLUGIN_INTERNALS__.unregisterListener = (
    event: string,
    id: number,
  ) => {
    eventListeners.get(event)?.delete(id);
    callbacks.delete(id);
  };

  const emitEvent = (event: string, payload: any) => {
    const listeners = eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callbackId) => {
        const runCb = callbacks.get(callbackId);
        if (runCb) {
          runCb({ event, payload });
        }
      });
    }
  };

  // Seed mock database in sessionStorage
  const seedDatabase = () => {
    if (!sessionStorage.getItem('memor_db_seeded')) {
      const defaultProjects = [
        {
          id: 1,
          name: 'Work',
          priority: 2,
          archived: false,
          deleted: false,
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          name: 'Personal',
          priority: 1,
          archived: false,
          deleted: false,
          created_at: new Date().toISOString(),
        },
      ];

      const todayStr = new Date().toISOString().split('T')[0];

      const defaultTasks = [
        {
          task_id: 101,
          project_id: 1,
          title: 'E2E Testing Implementation',
          status: 'in_progress',
          project_priority: 2,
          is_daily_priority: true,
          is_weekly_priority: true,
          completion_percentage: 50,
          planned_for_next_day: true,
          created_at: `${todayStr}T12:00:00`,
          updated_at: new Date().toISOString(),
          completed_at: null,
          deleted: false,
        },
        {
          task_id: 102,
          project_id: 1,
          title: 'Lint & Format Configuration',
          status: 'done',
          project_priority: 1,
          is_daily_priority: false,
          is_weekly_priority: false,
          completion_percentage: 100,
          planned_for_next_day: false,
          created_at: `${todayStr}T12:00:00`,
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          deleted: false,
        },
        {
          task_id: 201,
          project_id: 2,
          title: 'Buy groceries',
          status: 'todo',
          project_priority: 1,
          is_daily_priority: false,
          is_weekly_priority: true,
          completion_percentage: 0,
          planned_for_next_day: true,
          created_at: `${todayStr}T12:00:00`,
          updated_at: new Date().toISOString(),
          completed_at: null,
          deleted: false,
        },
        {
          task_id: 301,
          project_id: null,
          title: 'Read book chapter',
          status: 'todo',
          project_priority: 0,
          is_daily_priority: true,
          is_weekly_priority: false,
          completion_percentage: 0,
          planned_for_next_day: true,
          created_at: `${todayStr}T12:00:00`,
          updated_at: new Date().toISOString(),
          completed_at: null,
          deleted: false,
        },
      ];

      const defaultTaskUpdates = [
        {
          id: 1,
          task_id: 101,
          task_title: 'E2E Testing Implementation',
          date: todayStr,
          update_text: 'Started implementing playwright scripts',
          completion_percentage: 50,
          status: 'in_progress',
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          task_id: 102,
          task_title: 'Lint & Format Configuration',
          date: todayStr,
          update_text: 'Configured prettier and eslint hook',
          completion_percentage: 100,
          status: 'done',
          created_at: new Date().toISOString(),
        },
      ];

      sessionStorage.setItem('memor_db_projects', JSON.stringify(defaultProjects));
      sessionStorage.setItem('memor_db_tasks', JSON.stringify(defaultTasks));
      sessionStorage.setItem('memor_db_task_updates', JSON.stringify(defaultTaskUpdates));
      sessionStorage.setItem(
        'memor_db_config',
        JSON.stringify({
          keyring_enabled: false,
          auto_lock_timeout_mins: 15,
          trash_retention_days: 30,
        }),
      );
      sessionStorage.setItem('memor_db_seeded', 'true');
    }
  };

  seedDatabase();

  const getProjects = () => JSON.parse(sessionStorage.getItem('memor_db_projects') || '[]');
  const saveProjects = (p: any) => sessionStorage.setItem('memor_db_projects', JSON.stringify(p));
  const getTasks = () => JSON.parse(sessionStorage.getItem('memor_db_tasks') || '[]');
  const saveTasks = (t: any) => sessionStorage.setItem('memor_db_tasks', JSON.stringify(t));
  const getTaskUpdates = () => JSON.parse(sessionStorage.getItem('memor_db_task_updates') || '[]');
  const saveTaskUpdates = (u: any) =>
    sessionStorage.setItem('memor_db_task_updates', JSON.stringify(u));

  // 2. Set up mock invoke router
  (window as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args: any = {}) => {
    console.log(`[Tauri Mock IPC] invoke('${cmd}')`, args);

    // Event listening interceptors
    if (cmd === 'plugin:event|listen') {
      const { event, handler } = args;
      if (!eventListeners.has(event)) {
        eventListeners.set(event, new Set());
      }
      eventListeners.get(event)!.add(handler);
      return handler;
    }

    if (cmd === 'plugin:event|unlisten') {
      const { event, eventId } = args;
      eventListeners.get(event)?.delete(eventId);
      return;
    }

    switch (cmd) {
      case 'is_first_run':
        return false;

      case 'is_db_locked':
        return sessionStorage.getItem('memor_db_unlocked') !== 'true';

      case 'unlock_db_with_saved_key':
        return sessionStorage.getItem('memor_db_unlocked') === 'true';

      case 'unlock_db': {
        const { password } = args;
        if (password === 'password123') {
          sessionStorage.setItem('memor_db_unlocked', 'true');
          return;
        }
        throw new Error('Invalid password or decryption error');
      }

      case 'lock_db': {
        sessionStorage.setItem('memor_db_unlocked', 'false');
        emitEvent('database-locked', null);
        return;
      }

      case 'get_config': {
        return JSON.parse(
          sessionStorage.getItem('memor_db_config') ||
            '{"keyring_enabled":false,"auto_lock_timeout_mins":15,"trash_retention_days":30}',
        );
      }

      case 'update_config': {
        sessionStorage.setItem('memor_db_config', JSON.stringify(args.config));
        return;
      }

      case 'get_projects': {
        const { date } = args;
        const targetDate = date || new Date().toISOString().split('T')[0];
        const allProjects = getProjects().filter((p: any) => !p.deleted && !p.archived);
        const allTasks = getTasks().filter((t: any) => !t.deleted);

        allProjects.sort(
          (a: any, b: any) => b.priority - a.priority || a.name.localeCompare(b.name),
        );

        const result = allProjects.map((p: any) => {
          const projTasks = allTasks.filter((t: any) => t.project_id === p.id);
          const filteredTasks = projTasks.filter((t: any) => {
            const createdDate = (t.created_at || t.updated_at).split('T')[0];
            return createdDate <= targetDate;
          });

          return {
            project_id: p.id,
            project_name: p.name,
            project_priority: p.priority,
            tasks: {
              needs_to_do: filteredTasks.filter((t: any) => t.status === 'todo'),
              on_my_plate: filteredTasks.filter((t: any) => t.status === 'in_progress'),
              done: filteredTasks.filter((t: any) => t.status === 'done'),
            },
          };
        });

        // Add Ad-hoc project at the end
        const adhocTasks = allTasks.filter(
          (t: any) => t.project_id === null || t.project_id === undefined,
        );
        const filteredAdhoc = adhocTasks.filter((t: any) => {
          const createdDate = (t.created_at || t.updated_at).split('T')[0];
          return createdDate <= targetDate;
        });

        result.push({
          project_id: null,
          project_name: 'Ad-hoc',
          project_priority: 0,
          tasks: {
            needs_to_do: filteredAdhoc.filter((t: any) => t.status === 'todo'),
            on_my_plate: filteredAdhoc.filter((t: any) => t.status === 'in_progress'),
            done: filteredAdhoc.filter((t: any) => t.status === 'done'),
          },
        });

        return result;
      }

      case 'create_project': {
        const { name, priority } = args;
        const projects = getProjects();
        if (projects.some((p: any) => p.name.toLowerCase() === name.toLowerCase() && !p.deleted)) {
          throw new Error('Project with this name already exists');
        }
        const newId = projects.length > 0 ? Math.max(...projects.map((p: any) => p.id)) + 1 : 1;
        const newProj = {
          id: newId,
          name,
          priority,
          archived: false,
          deleted: false,
          created_at: new Date().toISOString(),
        };
        projects.push(newProj);
        saveProjects(projects);
        emitEvent('tasks-changed', null);
        return newId;
      }

      case 'update_project': {
        const { id, name, priority } = args;
        const projects = getProjects();
        const proj = projects.find((p: any) => p.id === id);
        if (!proj) throw new Error('Project not found');
        proj.name = name;
        proj.priority = priority;
        saveProjects(projects);
        emitEvent('tasks-changed', null);
        return;
      }

      case 'delete_project': {
        const { id, deleteTasks } = args;
        const projects = getProjects();
        const proj = projects.find((p: any) => p.id === id);
        if (!proj) throw new Error('Project not found');
        proj.deleted = true;
        proj.deleted_at = new Date().toISOString();
        saveProjects(projects);

        const tasks = getTasks();
        if (deleteTasks) {
          tasks.forEach((t: any) => {
            if (t.project_id === id) {
              t.deleted = true;
              t.deleted_at = new Date().toISOString();
            }
          });
        } else {
          tasks.forEach((t: any) => {
            if (t.project_id === id) {
              t.project_id = null;
            }
          });
        }
        saveTasks(tasks);
        emitEvent('tasks-changed', null);
        return;
      }

      case 'archive_project': {
        const { id } = args;
        const projects = getProjects();
        const proj = projects.find((p: any) => p.id === id);
        if (!proj) throw new Error('Project not found');
        proj.archived = true;
        saveProjects(projects);
        emitEvent('tasks-changed', null);
        return;
      }

      case 'unarchive_project': {
        const { id } = args;
        const projects = getProjects();
        const proj = projects.find((p: any) => p.id === id);
        if (!proj) throw new Error('Project not found');
        proj.archived = false;
        saveProjects(projects);
        emitEvent('tasks-changed', null);
        return;
      }

      case 'get_archived_projects': {
        return getProjects()
          .filter((p: any) => p.archived && !p.deleted)
          .map((p: any) => ({
            id: p.id,
            name: p.name,
            priority: p.priority,
            created_at: p.created_at,
          }));
      }

      case 'get_trash_items': {
        const projects = getProjects()
          .filter((p: any) => p.deleted)
          .map((p: any) => ({
            id: p.id,
            name: p.name,
            priority: p.priority,
            deleted_at: p.deleted_at || new Date().toISOString(),
          }));

        const tasks = getTasks()
          .filter((t: any) => t.deleted)
          .map((t: any) => {
            const proj = getProjects().find((p: any) => p.id === t.project_id);
            return {
              id: t.task_id,
              title: t.title,
              project_name: proj ? proj.name : null,
              deleted_at: t.deleted_at || new Date().toISOString(),
            };
          });

        return { projects, tasks };
      }

      case 'restore_project': {
        const { id, restoreTasks } = args;
        const projects = getProjects();
        const proj = projects.find((p: any) => p.id === id);
        if (!proj) throw new Error('Project not found');
        proj.deleted = false;
        proj.deleted_at = null;
        saveProjects(projects);

        if (restoreTasks) {
          const tasks = getTasks();
          tasks.forEach((t: any) => {
            if (t.project_id === id && t.deleted) {
              t.deleted = false;
              t.deleted_at = null;
            }
          });
          saveTasks(tasks);
        }
        emitEvent('tasks-changed', null);
        return;
      }

      case 'restore_task': {
        const { id } = args;
        const tasks = getTasks();
        const task = tasks.find((t: any) => t.task_id === id);
        if (!task) throw new Error('Task not found');
        task.deleted = false;
        task.deleted_at = null;

        if (task.project_id !== null) {
          const proj = getProjects().find((p: any) => p.id === task.project_id);
          if (!proj || proj.deleted) {
            task.project_id = null;
          }
        }
        saveTasks(tasks);
        emitEvent('tasks-changed', null);
        return;
      }

      case 'purge_project': {
        const { id } = args;
        const projects = getProjects().filter((p: any) => p.id !== id);
        saveProjects(projects);
        const tasks = getTasks().filter((t: any) => t.project_id !== id);
        saveTasks(tasks);
        emitEvent('tasks-changed', null);
        return;
      }

      case 'purge_task': {
        const { id } = args;
        const tasks = getTasks().filter((t: any) => t.task_id !== id);
        saveTasks(tasks);
        emitEvent('tasks-changed', null);
        return;
      }

      case 'create_task': {
        const {
          projectId,
          title,
          status,
          projectPriority,
          isDailyPriority,
          isWeeklyPriority,
          completionPercentage,
          date,
        } = args;
        const tasks = getTasks();
        const newId = tasks.length > 0 ? Math.max(...tasks.map((t: any) => t.task_id)) + 1 : 1001;

        const targetDate = date || new Date().toISOString().split('T')[0];
        const finalPercent =
          completionPercentage !== undefined && completionPercentage !== null
            ? completionPercentage
            : status === 'done'
              ? 100
              : 0;
        const finalStatus = finalPercent >= 100 ? 'done' : status;

        const newTask = {
          task_id: newId,
          project_id: projectId !== undefined && projectId !== 'adhoc' ? Number(projectId) : null,
          title,
          status: finalStatus,
          project_priority: projectPriority || 0,
          is_daily_priority: !!isDailyPriority,
          is_weekly_priority: !!isWeeklyPriority,
          completion_percentage: finalPercent,
          planned_for_next_day: true,
          created_at: `${targetDate}T12:00:00`,
          updated_at: new Date().toISOString(),
          completed_at: finalStatus === 'done' ? new Date().toISOString() : null,
          deleted: false,
        };
        tasks.push(newTask);
        saveTasks(tasks);

        const updates = getTaskUpdates();
        updates.push({
          id: updates.length > 0 ? Math.max(...updates.map((u: any) => u.id)) + 1 : 1,
          task_id: newId,
          task_title: title,
          date: targetDate,
          update_text: 'Task created',
          completion_percentage: finalPercent,
          status: finalStatus,
          created_at: new Date().toISOString(),
        });
        saveTaskUpdates(updates);

        emitEvent('tasks-changed', null);
        return newId;
      }

      case 'update_task': {
        const {
          id,
          projectId,
          title,
          status,
          projectPriority,
          isDailyPriority,
          isWeeklyPriority,
          completionPercentage,
          updateText,
          date,
          plannedForNextDay,
        } = args;
        const tasks = getTasks();
        const task = tasks.find((t: any) => t.task_id === id);
        if (!task) throw new Error('Task not found');

        const currStatus = task.status;
        const currPercent = task.completion_percentage;
        const targetDate = date || new Date().toISOString().split('T')[0];

        task.project_id =
          projectId !== undefined
            ? projectId === 'adhoc' || projectId === null
              ? null
              : Number(projectId)
            : task.project_id;
        task.title = title !== undefined ? title : task.title;
        task.project_priority =
          projectPriority !== undefined ? projectPriority : task.project_priority;
        task.is_daily_priority =
          isDailyPriority !== undefined ? !!isDailyPriority : task.is_daily_priority;
        task.is_weekly_priority =
          isWeeklyPriority !== undefined ? !!isWeeklyPriority : task.is_weekly_priority;

        if (plannedForNextDay !== undefined) {
          task.planned_for_next_day = !!plannedForNextDay;
        }

        let finalPercent =
          completionPercentage !== undefined && completionPercentage !== null
            ? completionPercentage
            : status !== currStatus && status === 'done'
              ? 100
              : currPercent;

        let finalStatus = status !== undefined ? status : task.status;
        if (finalPercent >= 100) {
          finalStatus = 'done';
          finalPercent = 100;
        }

        const hasPercentChange = finalPercent !== currPercent;
        const hasStatusChange = finalStatus !== currStatus;
        const hasText = updateText && updateText.trim() !== '';

        task.status = finalStatus;
        task.completion_percentage = finalPercent;
        task.updated_at = new Date().toISOString();
        if (finalStatus === 'done') {
          task.completed_at = task.completed_at || new Date().toISOString();
        } else {
          task.completed_at = null;
        }
        saveTasks(tasks);

        if (hasPercentChange || hasStatusChange || hasText) {
          const logText = hasText
            ? updateText
            : hasStatusChange
              ? `Status updated to ${finalStatus}`
              : `Progress updated to ${finalPercent}%`;

          const updates = getTaskUpdates();
          updates.push({
            id: updates.length > 0 ? Math.max(...updates.map((u: any) => u.id)) + 1 : 1,
            task_id: id,
            task_title: task.title,
            date: targetDate,
            update_text: logText,
            completion_percentage: finalPercent,
            status: finalStatus,
            created_at: new Date().toISOString(),
          });
          saveTaskUpdates(updates);
        }

        emitEvent('tasks-changed', null);
        return;
      }

      case 'delete_task': {
        const { id } = args;
        const tasks = getTasks();
        const task = tasks.find((t: any) => t.task_id === id);
        if (!task) throw new Error('Task not found');
        task.deleted = true;
        task.deleted_at = new Date().toISOString();
        saveTasks(tasks);
        emitEvent('tasks-changed', null);
        return;
      }

      case 'get_task_updates': {
        const { taskId } = args;
        return getTaskUpdates()
          .filter((u: any) => u.task_id === taskId)
          .sort((a: any, b: any) => b.created_at.localeCompare(a.created_at));
      }

      case 'create_task_update': {
        const { taskId, date, updateText, completionPercentage, status } = args;
        const updates = getTaskUpdates();
        const tasks = getTasks();
        const task = tasks.find((t: any) => t.task_id === taskId);
        if (!task) throw new Error('Task not found');

        const newId = updates.length > 0 ? Math.max(...updates.map((u: any) => u.id)) + 1 : 1;
        const newUpdate = {
          id: newId,
          task_id: taskId,
          task_title: task.title,
          date,
          update_text: updateText,
          completion_percentage: completionPercentage,
          status,
          created_at: new Date().toISOString(),
        };
        updates.push(newUpdate);
        saveTaskUpdates(updates);

        task.status = status;
        task.completion_percentage = completionPercentage;
        task.updated_at = new Date().toISOString();
        if (status === 'done') {
          task.completed_at = task.completed_at || new Date().toISOString();
        } else {
          task.completed_at = null;
        }
        saveTasks(tasks);

        emitEvent('tasks-changed', null);
        return newId;
      }

      case 'update_task_update': {
        const { id, updateText, completionPercentage, status } = args;
        const updates = getTaskUpdates();
        const up = updates.find((u: any) => u.id === id);
        if (!up) throw new Error('Update not found');

        up.update_text = updateText;
        up.completion_percentage = completionPercentage;
        up.status = status;
        saveTaskUpdates(updates);

        const taskUpdates = updates
          .filter((u: any) => u.task_id === up.task_id)
          .sort(
            (a: any, b: any) =>
              b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at),
          );
        const tasks = getTasks();
        const task = tasks.find((t: any) => t.task_id === up.task_id);
        if (task && taskUpdates.length > 0) {
          task.status = taskUpdates[0].status;
          task.completion_percentage = taskUpdates[0].completion_percentage;
          task.updated_at = new Date().toISOString();
          if (task.status === 'done') {
            task.completed_at = task.completed_at || new Date().toISOString();
          } else {
            task.completed_at = null;
          }
          saveTasks(tasks);
        }

        emitEvent('tasks-changed', null);
        return;
      }

      case 'delete_task_update': {
        const { id } = args;
        const updates = getTaskUpdates();
        const up = updates.find((u: any) => u.id === id);
        if (!up) throw new Error('Update not found');

        const taskId = up.task_id;
        const filtered = updates.filter((u: any) => u.id !== id);
        saveTaskUpdates(filtered);

        const taskUpdates = filtered
          .filter((u: any) => u.task_id === taskId)
          .sort(
            (a: any, b: any) =>
              b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at),
          );
        const tasks = getTasks();
        const task = tasks.find((t: any) => t.task_id === taskId);
        if (task) {
          if (taskUpdates.length > 0) {
            task.status = taskUpdates[0].status;
            task.completion_percentage = taskUpdates[0].completion_percentage;
          } else {
            task.status = 'todo';
            task.completion_percentage = 0;
          }
          task.updated_at = new Date().toISOString();
          if (task.status === 'done') {
            task.completed_at = task.completed_at || new Date().toISOString();
          } else {
            task.completed_at = null;
          }
          saveTasks(tasks);
        }

        emitEvent('tasks-changed', null);
        return;
      }

      case 'get_timeline': {
        const activeProjectIds = getProjects()
          .filter((p: any) => !p.deleted && !p.archived)
          .map((p: any) => p.id);
        const tasks = getTasks();

        return getTaskUpdates()
          .filter((u: any) => {
            const task = tasks.find((t: any) => t.task_id === u.task_id);
            if (!task || task.deleted) return false;
            if (task.project_id === null || task.project_id === undefined) return true;
            return activeProjectIds.includes(task.project_id);
          })
          .sort(
            (a: any, b: any) =>
              b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at),
          );
      }

      case 'get_daily_summary': {
        const { date } = args;
        const projects = getProjects().filter((p: any) => !p.deleted && !p.archived);
        const tasks = getTasks().filter((t: any) => !t.deleted);

        const startStr = `${date}T00:00:00`;
        const endStr = `${date}T23:59:59`;

        const projectSummaries = projects.map((p: any) => {
          const projTasks = tasks.filter((t: any) => t.project_id === p.id);
          const completed = projTasks
            .filter(
              (t: any) =>
                t.status === 'done' &&
                t.completed_at &&
                t.completed_at >= startStr &&
                t.completed_at <= endStr,
            )
            .map((t: any) => t.title);
          const in_progress = projTasks
            .filter(
              (t: any) =>
                t.status === 'in_progress' && t.updated_at >= startStr && t.updated_at <= endStr,
            )
            .map((t: any) => t.title);
          const pending = projTasks
            .filter((t: any) => t.status === 'todo')
            .map((t: any) => t.title);
          return { project_name: p.name, completed, in_progress, pending };
        });

        const adhocTasks = tasks.filter(
          (t: any) => t.project_id === null || t.project_id === undefined,
        );
        const completedAdhoc = adhocTasks
          .filter(
            (t: any) =>
              t.status === 'done' &&
              t.completed_at &&
              t.completed_at >= startStr &&
              t.completed_at <= endStr,
          )
          .map((t: any) => t.title);
        const inProgressAdhoc = adhocTasks
          .filter(
            (t: any) =>
              t.status === 'in_progress' && t.updated_at >= startStr && t.updated_at <= endStr,
          )
          .map((t: any) => t.title);
        const pendingAdhoc = adhocTasks
          .filter((t: any) => t.status === 'todo')
          .map((t: any) => t.title);
        projectSummaries.push({
          project_name: 'Ad-hoc',
          completed: completedAdhoc,
          in_progress: inProgressAdhoc,
          pending: pendingAdhoc,
        });

        const filtered = projectSummaries.filter(
          (p: any) => p.completed.length > 0 || p.in_progress.length > 0 || p.pending.length > 0,
        );

        return {
          summary_type: 'daily',
          start_date: date,
          end_date: date,
          projects: filtered,
        };
      }

      case 'get_weekly_summary': {
        const { startDate } = args;
        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        const endDate = end.toISOString().split('T')[0];

        const projects = getProjects().filter((p: any) => !p.deleted && !p.archived);
        const tasks = getTasks().filter((t: any) => !t.deleted);

        const startStr = `${startDate}T00:00:00`;
        const endStr = `${endDate}T23:59:59`;

        const projectSummaries = projects.map((p: any) => {
          const projTasks = tasks.filter((t: any) => t.project_id === p.id);
          const completed = projTasks
            .filter(
              (t: any) =>
                t.status === 'done' &&
                t.completed_at &&
                t.completed_at >= startStr &&
                t.completed_at <= endStr,
            )
            .map((t: any) => t.title);
          const in_progress = projTasks
            .filter(
              (t: any) =>
                t.status === 'in_progress' && t.updated_at >= startStr && t.updated_at <= endStr,
            )
            .map((t: any) => t.title);
          const pending = projTasks
            .filter((t: any) => t.status === 'todo')
            .map((t: any) => t.title);
          return { project_name: p.name, completed, in_progress, pending };
        });

        const adhocTasks = tasks.filter(
          (t: any) => t.project_id === null || t.project_id === undefined,
        );
        const completedAdhoc = adhocTasks
          .filter(
            (t: any) =>
              t.status === 'done' &&
              t.completed_at &&
              t.completed_at >= startStr &&
              t.completed_at <= endStr,
          )
          .map((t: any) => t.title);
        const inProgressAdhoc = adhocTasks
          .filter(
            (t: any) =>
              t.status === 'in_progress' && t.updated_at >= startStr && t.updated_at <= endStr,
          )
          .map((t: any) => t.title);
        const pendingAdhoc = adhocTasks
          .filter((t: any) => t.status === 'todo')
          .map((t: any) => t.title);
        projectSummaries.push({
          project_name: 'Ad-hoc',
          completed: completedAdhoc,
          in_progress: inProgressAdhoc,
          pending: pendingAdhoc,
        });

        const filtered = projectSummaries.filter(
          (p: any) => p.completed.length > 0 || p.in_progress.length > 0 || p.pending.length > 0,
        );

        return {
          summary_type: 'weekly',
          start_date: startDate,
          end_date: endDate,
          projects: filtered,
        };
      }

      default:
        console.warn(`[Tauri Mock IPC] unhandled invoke command: ${cmd}`);
        return null;
    }
  };
};

export async function injectTauriMock(page: Page) {
  await page.addInitScript(installTauriMock);
}
