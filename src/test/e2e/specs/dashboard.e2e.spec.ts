import { test, expect } from '../fixtures';
import {
  changeSelectValue,
  createDialogState,
  confirmTaskDelete,
  installDialogHandler,
  login,
  resetDialogState,
  resetMockSession,
  selectInPrimaryModalFormByOption,
  setRangeValue,
  sidebarItem,
  taskAction,
  taskCompletionRange,
  taskDeleteModal,
  visibleModal,
} from '../helpers';

test.describe('Dashboard e2e', () => {
  const dialog = createDialogState();

  test.beforeEach(async ({ page }) => {
    resetDialogState(dialog);
    installDialogHandler(page, dialog);
    await resetMockSession(page);
  });

  test('Project Management - CRUD & Archiving', async ({ page }) => {
    // Log in
    await page.fill('#master-password', 'password123');
    await page.click('button[type="submit"]');

    // 1. Create a Project
    await page.locator('.sidebar-header button:visible').click(); // Click '+'
    await page.fill('#p-name', 'Vacation Planning');
    await changeSelectValue(selectInPrimaryModalFormByOption(page, 'High Priority'), '2');
    await page.click('button:has-text("Create Project")');

    // Verify project appears in sidebar container
    await expect(page.locator('.project-list')).toContainText('Vacation Planning');

    // 2. Archive the Project
    await sidebarItem(page, 'Vacation Planning').click();
    await page.click('button[title="Archive Project"]'); // Click Archive button in project header

    // Verify project disappears from sidebar
    await expect(page.locator('.project-list')).not.toContainText('Vacation Planning');

    // Verify project is in Archived list
    await sidebarItem(page, 'Archived Projects').click();
    await expect(visibleModal(page).locator('h3')).toHaveText('📁 Archived Projects');
    await expect(visibleModal(page)).toContainText('Vacation Planning');

    // 3. Restore the Project
    await visibleModal(page).getByRole('button', { name: 'Restore Project' }).click();
    await visibleModal(page).getByRole('button', { name: 'Close' }).click();

    // Verify project is back in sidebar
    await expect(page.locator('.project-list')).toContainText('Vacation Planning');

    // 4. Delete the Project
    await sidebarItem(page, 'Vacation Planning').click();
    await page.click('button[title="Delete Project"]'); // Click Delete button in project header

    // Confirm delete in modal
    await page.click('button:has-text("Yes, Delete Project and Tasks")');

    // Verify project is permanently gone from sidebar
    await expect(page.locator('.project-list')).not.toContainText('Vacation Planning');
  });

  test('Task Management - CRUD & History notes & Trash', async ({ page }) => {
    // Log in
    await page.fill('#master-password', 'password123');
    await page.click('button[type="submit"]');

    // Select "Work" project
    await sidebarItem(page, 'Work').click();

    // 1. Add Task
    await page.click('button:has-text("Add Task")');
    await page.fill('#t-title', 'Verify Mocked IPC');
    await changeSelectValue(selectInPrimaryModalFormByOption(page, 'High Priority'), '2');
    await page.locator('.ui.checkbox:has(#task-daily-priority-checkbox)').click(); // Add to My Day
    await page.click('button[type="submit"]'); // Create Task

    // Verify task is in "On My Plate" column (needs_to_do)
    const todoColumn = page.locator('.column-card:has-text("On My Plate")');
    await expect(todoColumn).toContainText('Verify Mocked IPC');

    // 2. Edit Task & Log quick comment
    await taskAction(todoColumn, 'Verify Mocked IPC', 'edit').click();
    const statusSelect = selectInPrimaryModalFormByOption(page, 'In Progress');
    await changeSelectValue(statusSelect, 'in_progress'); // Move to In Progress
    await setRangeValue(page, 'input[aria-labelledby="t-percent-label"]', '60'); // 60% progress
    await page.fill('#t-comment', 'First draft of test specs'); // Add Quick Note
    await page.click('button[type="submit"]'); // Save Core Details

    // Verify task moves to "In Progress" column (on_my_plate) and shows 60%
    const inProgressColumn = page.locator('.column-card:has-text("In Progress")');
    await expect(inProgressColumn).toContainText('Verify Mocked IPC');
    await expect(
      inProgressColumn.locator('.task-card:has-text("Verify Mocked IPC")'),
    ).toContainText('60%');

    // 3. Add date-associated history note
    await taskAction(inProgressColumn, 'Verify Mocked IPC', 'edit').click();
    await page.fill('#new-note-text-input', 'Mocking Tauri listen / event channels');
    await page.fill('#new-note-percent-range', '90'); // Set note progress to 90%
    await page.click('button:has-text("Log Note")');

    // Verify note is added to notes list
    await expect(visibleModal(page)).toContainText('Mocking Tauri listen / event channels');
    await page.click('button:has-text("Cancel")');

    // 4. Delete task
    await taskAction(inProgressColumn, 'Verify Mocked IPC', 'delete').click();
    await confirmTaskDelete(page);
    await expect(inProgressColumn).not.toContainText('Verify Mocked IPC');

    // 5. Restore task from Trash Bin
    await sidebarItem(page, 'Trash Bin').click();
    await expect(visibleModal(page)).toContainText('Verify Mocked IPC');
    await visibleModal(page).getByRole('button', { name: 'Restore' }).click();
    await visibleModal(page).getByRole('button', { name: 'Close' }).click();

    // Verify task is back in Dashboard under In Progress column (since it was restored to its last state)
    await expect(inProgressColumn).toContainText('Verify Mocked IPC');

    // 6. Purge task permanently
    await taskAction(inProgressColumn, 'Verify Mocked IPC', 'delete').click();
    await confirmTaskDelete(page);
    await sidebarItem(page, 'Trash Bin').click();
    await visibleModal(page).getByRole('button', { name: 'Purge' }).click();
    await expect(visibleModal(page)).not.toContainText('Verify Mocked IPC');
    await visibleModal(page).getByRole('button', { name: 'Close' }).click();
  });

  test('Plan Tomorrow carry over and carry over errors', async ({ page }) => {
    await page.goto('/');
    await page.fill('#master-password', 'password123');
    await page.click('button[type="submit"]');

    await page.click('button:has-text("Dashboard")');
    await sidebarItem(page, 'My Day').click();

    await page.click('button:has-text("Plan Tomorrow")');
    await expect(visibleModal(page).locator('h3')).toContainText("Plan Tomorrow's Carry-Over");
    await expect(visibleModal(page)).toContainText('E2E Testing Implementation');

    // Uncheck and check carry over
    await visibleModal(page).locator('.ui.checkbox').first().click();
    await visibleModal(page).locator('.ui.checkbox').first().click();

    // Toggle carry over error alert
    await page.evaluate(() => {
      const originalInvoke = (window as any).__TAURI_INTERNALS__.invoke;
      (window as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
        if (cmd === 'update_task') {
          throw new Error('Update task failed');
        }
        return originalInvoke(cmd, args);
      };
    });
    dialog.expectedMessage = 'Failed to toggle carry-over';
    dialog.action = 'accept';
    const dialogPromise = page.waitForEvent('dialog');
    // Use page.click instead of page.uncheck since controlled state doesn't change on failure
    await visibleModal(page).locator('.ui.checkbox').first().click();
    await dialogPromise;

    await visibleModal(page).getByRole('button', { name: 'Close' }).click();

    // Plan Tomorrow empty carry-over state (delete uncompleted tasks to empty it)
    const inProgressColumn = page.locator('.column-card:has-text("In Progress")');
    await taskAction(inProgressColumn, 'E2E Testing Implementation', 'delete').click();
    await confirmTaskDelete(page);

    const todoColumn = page.locator('.column-card:has-text("On My Plate")');
    await taskAction(todoColumn, 'Read book chapter', 'delete').click();
    await confirmTaskDelete(page);

    await page.click('button:has-text("Plan Tomorrow")');
    await expect(visibleModal(page)).toContainText(
      'No uncompleted priorities on your day to plan!',
    );
    await visibleModal(page).getByRole('button', { name: 'Close' }).click();
  });

  test('Task note status/percent synchronization and inline note CRUD', async ({ page }) => {
    await page.goto('/');
    await page.fill('#master-password', 'password123');
    await page.click('button[type="submit"]');

    const inProgressColumn = page.locator('.column-card:has-text("In Progress")');
    await taskAction(inProgressColumn, 'E2E Testing Implementation', 'edit').click();

    // Done status synchronizes percent to 100
    await page.selectOption('#new-note-status-select', 'done');
    await expect(page.locator('#new-note-percent-range')).toHaveValue('100');

    // Change back
    await page.selectOption('#new-note-status-select', 'todo');

    // Slider percent 100 updates status to done - use React-compatible value setter
    await page.evaluate(() => {
      const slider = document.getElementById('new-note-percent-range') as HTMLInputElement;
      // Clear React's internal value tracker to force onChange to fire
      const tracker = (slider as any)._valueTracker;
      if (tracker) tracker.setValue('');
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      nativeSetter?.call(slider, '100');
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('#new-note-percent-range')).toHaveValue('100');
    await expect(page.locator('#new-note-status-select')).toHaveValue('done');

    // Slider percent < 100 updates status to in_progress (when currently done)
    await page.evaluate(() => {
      const slider = document.getElementById('new-note-percent-range') as HTMLInputElement;
      const tracker = (slider as any)._valueTracker;
      if (tracker) tracker.setValue('');
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      nativeSetter?.call(slider, '50');
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('#new-note-status-select')).toHaveValue('in_progress');

    // Inline note CRUD
    await visibleModal(page)
      .locator('.glass-panel:has-text("Started implementing playwright scripts") button')
      .first()
      .click();
    const editNotePanel = visibleModal(page).locator(
      '.glass-panel:has(select[id^="edit-note-status-"])',
    );
    await editNotePanel.locator('input[type="text"]').fill('Updated inline note text');

    // Status sync inside inline note edit
    await page.selectOption('select[id^="edit-note-status-"]', 'done');
    const editNoteRange = visibleModal(page).locator(
      '.glass-panel:has(select[id^="edit-note-status-"]) input[type="range"]',
    );
    await expect(editNoteRange).toHaveValue('100');

    await page.selectOption('select[id^="edit-note-status-"]', 'todo');
    await expect(editNoteRange).toHaveValue('0');

    // Move range slider to 100 using React-compatible value setter
    await page.evaluate(() => {
      const panel = document.querySelector(
        '.ui.modal .glass-panel:has(select[id^="edit-note-status-"])',
      );
      const slider = panel?.querySelector('input[type="range"]') as HTMLInputElement;
      const tracker = (slider as any)._valueTracker;
      if (tracker) tracker.setValue('');
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      nativeSetter?.call(slider, '100');
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(editNoteRange).toHaveValue('100');
    await expect(page.locator('select[id^="edit-note-status-"]')).toHaveValue('done');

    // Move range slider to 50 to change status to in_progress
    await page.evaluate(() => {
      const panel = document.querySelector(
        '.ui.modal .glass-panel:has(select[id^="edit-note-status-"])',
      );
      const slider = panel?.querySelector('input[type="range"]') as HTMLInputElement;
      const tracker = (slider as any)._valueTracker;
      if (tracker) tracker.setValue('');
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      nativeSetter?.call(slider, '50');
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('select[id^="edit-note-status-"]')).toHaveValue('in_progress');

    // Save
    await visibleModal(page).getByRole('button', { name: 'Save', exact: true }).click();
    await expect(visibleModal(page)).toContainText('Updated inline note text');

    // Cancel inline note edit
    await visibleModal(page)
      .locator('.glass-panel:has-text("Updated inline note text") button')
      .first()
      .click();
    await editNotePanel.getByRole('button', { name: 'Cancel' }).click();

    // Dismiss note deletion prompt
    dialog.expectedMessage = 'Are you sure you want to delete this note?';
    dialog.action = 'dismiss';
    await visibleModal(page)
      .locator('.glass-panel:has-text("Updated inline note text") button')
      .nth(1)
      .click();
    await expect(visibleModal(page)).toContainText('Updated inline note text');

    // Accept note deletion
    dialog.expectedMessage = 'Are you sure you want to delete this note?';
    dialog.action = 'accept';
    await visibleModal(page)
      .locator('.glass-panel:has-text("Updated inline note text") button')
      .nth(1)
      .click();
    await expect(visibleModal(page)).toContainText('No progress logs recorded.');

    await visibleModal(page).getByRole('button', { name: 'Cancel' }).first().click();
  });

  test('Task note actions - error alerts', async ({ page }) => {
    await page.goto('/');
    await page.fill('#master-password', 'password123');
    await page.click('button[type="submit"]');

    const inProgressColumn = page.locator('.column-card:has-text("In Progress")');
    await taskAction(inProgressColumn, 'E2E Testing Implementation', 'edit').click();

    // Register single invoke mock override for notes failures
    await page.evaluate(() => {
      const originalInvoke = (window as any).__TAURI_INTERNALS__.invoke;
      (window as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
        if (cmd === 'create_task_update') {
          throw new Error('Create note failed');
        }
        if (cmd === 'update_task_update') {
          throw new Error('Update note failed');
        }
        if (cmd === 'delete_task_update') {
          throw new Error('Delete note failed');
        }
        return originalInvoke(cmd, args);
      };
    });

    // 1. Log note fail alert
    await page.fill('#new-note-text-input', 'Fail note content');
    dialog.expectedMessage = 'Failed to add note';
    dialog.action = 'accept';
    let dialogPromise = page.waitForEvent('dialog');
    await page.click('button:has-text("Log Note")');
    await dialogPromise;

    // 2. Edit note fail alert
    await visibleModal(page)
      .locator('.glass-panel:has-text("Started implementing playwright scripts") button')
      .first()
      .click();
    await visibleModal(page)
      .locator('.glass-panel:has(select[id^="edit-note-status-"]) input[type="text"]')
      .fill('Fail note edit content');
    dialog.expectedMessage = 'Failed to update note';
    dialog.action = 'accept';
    dialogPromise = page.waitForEvent('dialog');
    await visibleModal(page).getByRole('button', { name: 'Save', exact: true }).click();
    await dialogPromise;

    // Cancel edit mode to return the list item to view mode, re-enabling the delete button
    await visibleModal(page)
      .locator('.glass-panel:has(select[id^="edit-note-status-"])')
      .getByRole('button', { name: 'Cancel' })
      .click();

    // 3. Delete note fail alert
    dialogPromise = page.waitForEvent('dialog');
    await visibleModal(page)
      .locator('.glass-panel:has-text("Started implementing playwright scripts") button')
      .nth(1)
      .click();
    await dialogPromise;

    await visibleModal(page).getByRole('button', { name: 'Cancel' }).first().click();
  });

  test('Project deletion options and Trash Bin restoration/purging', async ({ page }) => {
    await page.goto('/');
    await page.fill('#master-password', 'password123');
    await page.click('button[type="submit"]');

    // Select Personal project
    await sidebarItem(page, 'Personal').click();

    // Click delete project button
    await page.click('button[title="Delete Project"]');

    // 1. Cancel Project deletion
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('.project-list')).toContainText('Personal');

    // Click delete project again
    await page.click('button[title="Delete Project"]');

    // 2. Keep Tasks as Ad-hoc
    await page.click('button:has-text("Keep Tasks as Ad-hoc")');
    await expect(page.locator('.project-list')).not.toContainText('Personal');

    // 3. Trash Bin - Restore Project
    await sidebarItem(page, 'Trash Bin').click();
    await expect(visibleModal(page)).toContainText('Personal');

    await visibleModal(page)
      .locator('.glass-panel:has-text("Personal") button:has-text("Restore")')
      .click();

    await visibleModal(page).getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('.project-list')).toContainText('Personal');

    // 4. Trash Bin - Purge Project
    await sidebarItem(page, 'Personal').click();
    await page.click('button[title="Delete Project"]');
    await page.click('button:has-text("Yes, Delete Project and Tasks")');

    await sidebarItem(page, 'Trash Bin').click();

    // Purge project - dismiss
    dialog.expectedMessage = 'WARNING: This will permanently delete this project';
    dialog.action = 'dismiss';
    await visibleModal(page)
      .locator('.glass-panel:has-text("Personal") button:has-text("Purge")')
      .click();
    await expect(visibleModal(page)).toContainText('Personal');

    // Purge project - accept
    dialog.expectedMessage = 'WARNING: This will permanently delete this project';
    dialog.action = 'accept';
    await visibleModal(page)
      .locator('.glass-panel:has-text("Personal") button:has-text("Purge")')
      .click();
    await expect(visibleModal(page)).not.toContainText('Personal');

    await visibleModal(page).getByRole('button', { name: 'Close' }).click();
  });

  test('Trash items remaining days styling', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__TAURI_INTERNALS__ = (window as any).__TAURI_INTERNALS__ || {};
      const originalInvoke = (window as any).__TAURI_INTERNALS__.invoke;
      (window as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
        if (cmd === 'get_trash_items') {
          const now = new Date();
          const date2Days = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString();
          const date8Days = new Date(now.getTime() - 22 * 24 * 60 * 60 * 1000).toISOString();
          return {
            projects: [
              { id: 991, name: 'Urgent Project', priority: 2, deleted_at: date2Days },
              { id: 992, name: 'Warning Project', priority: 1, deleted_at: date8Days },
            ],
            tasks: [],
          };
        }
        return originalInvoke ? originalInvoke(cmd, args) : undefined;
      };
    });

    await page.goto('/');
    await page.fill('#master-password', 'password123');
    await page.click('button[type="submit"]');

    await sidebarItem(page, 'Trash Bin').click();
    await expect(visibleModal(page)).toContainText('2 days left');
    await expect(visibleModal(page)).toContainText('8 days left');
    await visibleModal(page).getByRole('button', { name: 'Close' }).click();
  });

  test('Dashboard operations - failure alerts', async ({ page }) => {
    await page.goto('/');
    await page.fill('#master-password', 'password123');
    await page.click('button[type="submit"]');

    // 1. Create project failure
    await page.evaluate(() => {
      const originalInvoke = (window as any).__TAURI_INTERNALS__.invoke;
      (window as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
        if (cmd === 'create_project') {
          throw new Error('Database write error');
        }
        return originalInvoke(cmd, args);
      };
    });
    await page.locator('.sidebar-header button:visible').first().click();
    await page.fill('#p-name', 'Error Project');
    dialog.expectedMessage = 'Failed to create project';
    dialog.action = 'accept';
    let dialogPromise = page.waitForEvent('dialog');
    await page.click('button:has-text("Create Project")');
    await dialogPromise;
    await visibleModal(page).getByRole('button', { name: 'Cancel' }).click();

    // 2. Create task failure
    await page.evaluate(() => {
      const originalInvoke = (window as any).__TAURI_INTERNALS__.invoke;
      (window as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
        if (cmd === 'create_task') {
          throw new Error('Database write error');
        }
        return originalInvoke(cmd, args);
      };
    });
    await page.click('button:has-text("Add Task")');
    await page.fill('#t-title', 'Error Task');
    dialog.expectedMessage = 'Failed to save task';
    dialog.action = 'accept';
    dialogPromise = page.waitForEvent('dialog');
    await page.click('button[type="submit"]');
    await dialogPromise;
    await visibleModal(page).getByRole('button', { name: 'Cancel' }).click();

    // 3. Save task edit failure
    await page.evaluate(() => {
      const originalInvoke = (window as any).__TAURI_INTERNALS__.invoke;
      (window as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
        if (cmd === 'update_task') {
          throw new Error('Database edit error');
        }
        return originalInvoke(cmd, args);
      };
    });
    const inProgressColumn = page.locator('.column-card:has-text("In Progress")');
    await taskAction(inProgressColumn, 'E2E Testing Implementation', 'edit').click();
    dialog.expectedMessage = 'Failed to save task';
    dialog.action = 'accept';
    dialogPromise = page.waitForEvent('dialog');
    await page.click('button[type="submit"]');
    await dialogPromise;
    await visibleModal(page).getByRole('button', { name: 'Cancel' }).click();

    // 4. Archive project failure
    await page.evaluate(() => {
      const originalInvoke = (window as any).__TAURI_INTERNALS__.invoke;
      (window as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
        if (cmd === 'archive_project') {
          throw new Error('Archive error');
        }
        return originalInvoke(cmd, args);
      };
    });
    await sidebarItem(page, 'Work').click();
    dialog.expectedMessage = 'Failed to archive project';
    dialog.action = 'accept';
    dialogPromise = page.waitForEvent('dialog');
    await page.click('button[title="Archive Project"]');
    await dialogPromise;

    // 5. Delete project failure
    await page.evaluate(() => {
      const originalInvoke = (window as any).__TAURI_INTERNALS__.invoke;
      (window as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
        if (cmd === 'delete_project') {
          throw new Error('Delete error');
        }
        return originalInvoke(cmd, args);
      };
    });
    await page.click('button[title="Delete Project"]');
    dialog.expectedMessage = 'Failed to delete project';
    dialog.action = 'accept';
    dialogPromise = page.waitForEvent('dialog');
    await page.click('button:has-text("Yes, Delete Project and Tasks")');
    await dialogPromise;

    // Close the delete project modal
    await visibleModal(page)
      .filter({ hasText: 'delete all tasks' })
      .getByRole('button', { name: 'Cancel' })
      .click();

    // 6. Delete task failure
    await page.evaluate(() => {
      const originalInvoke = (window as any).__TAURI_INTERNALS__.invoke;
      (window as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
        if (cmd === 'delete_task') {
          throw new Error('Delete task error');
        }
        return originalInvoke(cmd, args);
      };
    });
    dialog.expectedMessage = 'Failed to delete task';
    dialog.action = 'accept';
    dialogPromise = page.waitForEvent('dialog');
    await taskAction(inProgressColumn, 'E2E Testing Implementation', 'delete').click();
    await confirmTaskDelete(page);
    await dialogPromise;
    await taskDeleteModal(page).getByRole('button', { name: 'Cancel' }).click();

    // 7. Unarchive & Delete archived failures
    await page.evaluate(() => {
      const originalInvoke = (window as any).__TAURI_INTERNALS__.invoke;
      (window as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
        if (cmd === 'get_archived_projects') {
          return [
            { id: 88, name: 'Archived Proj', priority: 1, created_at: new Date().toISOString() },
          ];
        }
        if (cmd === 'unarchive_project') {
          throw new Error('Unarchive failed');
        }
        if (cmd === 'delete_project') {
          throw new Error('Delete archived failed');
        }
        return originalInvoke(cmd, args);
      };
    });
    await sidebarItem(page, 'Archived Projects').click();
    dialog.expectedMessage = 'Failed to unarchive project';
    dialog.action = 'accept';
    dialogPromise = page.waitForEvent('dialog');
    await visibleModal(page).getByRole('button', { name: 'Restore Project' }).click();
    await dialogPromise;

    await visibleModal(page).getByRole('button', { name: 'Delete' }).click();
    await visibleModal(page).getByRole('button', { name: 'Close' }).click();

    // 8. Trash restoration & purging failures
    await page.evaluate(() => {
      const originalInvoke = (window as any).__TAURI_INTERNALS__.invoke;
      (window as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
        if (cmd === 'get_trash_items') {
          return {
            projects: [
              { id: 89, name: 'Trash Proj', priority: 1, deleted_at: new Date().toISOString() },
            ],
            tasks: [
              {
                id: 90,
                title: 'Trash Task',
                project_name: 'Work',
                deleted_at: new Date().toISOString(),
              },
            ],
          };
        }
        if (cmd === 'restore_project') {
          throw new Error('Restore proj failed');
        }
        if (cmd === 'restore_task') {
          throw new Error('Restore task failed');
        }
        if (cmd === 'purge_project') {
          throw new Error('Purge proj failed');
        }
        if (cmd === 'purge_task') {
          throw new Error('Purge task failed');
        }
        return originalInvoke(cmd, args);
      };
    });
    await sidebarItem(page, 'Trash Bin').click();

    await visibleModal(page)
      .locator('.glass-panel:has-text("Trash Proj") button:has-text("Restore")')
      .click();
    await visibleModal(page)
      .locator('.glass-panel:has-text("Trash Proj") button:has-text("Purge")')
      .click();
    await visibleModal(page)
      .locator('.glass-panel:has-text("Trash Task") button:has-text("Restore")')
      .click();
    await visibleModal(page)
      .locator('.glass-panel:has-text("Trash Task") button:has-text("Purge")')
      .click();

    await visibleModal(page).getByRole('button', { name: 'Close' }).click();
  });

  test('Task drag and drop and drop failure alert', async ({ page }) => {
    await page.goto('/');
    await page.fill('#master-password', 'password123');
    await page.click('button[type="submit"]');

    const inProgressColumn = page.locator('.column-card:has-text("In Progress")');

    await page.dragAndDrop(
      '.task-card:has-text("Read book chapter")',
      '.column-card:has-text("In Progress")',
    );
    await expect(inProgressColumn).toContainText('Read book chapter');

    await page.evaluate(() => {
      const originalInvoke = (window as any).__TAURI_INTERNALS__.invoke;
      (window as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
        if (cmd === 'update_task') {
          throw new Error('Drop update failed');
        }
        return originalInvoke(cmd, args);
      };
    });
    dialog.expectedMessage = 'Failed to move task';
    dialog.action = 'accept';
    const dialogPromise = page.waitForEvent('dialog');
    await page.dragAndDrop(
      '.task-card:has-text("Read book chapter")',
      '.column-card:has-text("Done")',
    );
    await dialogPromise;
  });

  test('Weekly Focus view and sidebar project clicks', async ({ page }) => {
    await page.goto('/');
    await page.fill('#master-password', 'password123');
    await page.click('button[type="submit"]');

    await sidebarItem(page, 'Weekly Focus').click();
    await expect(page.locator('.view-title')).toContainText('Weekly Focus Priorities');

    await sidebarItem(page, 'Work').click();
    await expect(page.locator('.view-title')).toContainText('Work');

    await page.click('button[title="Previous Day"]');
    await page.click('button:has-text("Go to Today")');
  });

  test('empty dashboard forms stay open and priority checkboxes remain coupled', async ({
    page,
  }) => {
    await login(page);

    await page.locator('.sidebar-header button:visible').first().click();
    await page.click('button:has-text("Create Project")');
    await expect(visibleModal(page).locator('h3')).toHaveText('Create New Project');
    await visibleModal(page).getByRole('button', { name: 'Cancel' }).click();

    await page.click('button:has-text("Add Task")');
    await page.click('button:has-text("Create Task")');
    await expect(visibleModal(page).locator('h3')).toHaveText('Add New Task');

    const dailyCheckbox = page.locator('#task-daily-priority-checkbox');
    const weeklyCheckbox = page.locator('#task-weekly-priority-checkbox');
    await page.locator('.ui.checkbox:has(#task-weekly-priority-checkbox)').click();
    await page.locator('.ui.checkbox:has(#task-weekly-priority-checkbox)').click();
    await expect(dailyCheckbox).not.toBeChecked();

    await page.locator('.ui.checkbox:has(#task-daily-priority-checkbox)').click();
    await expect(weeklyCheckbox).toBeChecked();

    await page.locator('.ui.checkbox:has(#task-weekly-priority-checkbox)').click();
    await expect(dailyCheckbox).not.toBeChecked();
    await expect(weeklyCheckbox).not.toBeChecked();

    await visibleModal(page).getByRole('button', { name: 'Cancel' }).click();
  });

  test('past date banner allows dated task creation and returns to today', async ({ page }) => {
    await login(page);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    await page.fill('.dashboard-view input[type="date"]', yesterdayStr);
    await expect(page.locator('.dashboard-view')).toContainText(
      `Viewing past date: ${yesterdayStr}`,
    );

    await page.click('button:has-text("Add Task")');
    await page.fill('#t-title', 'Backfill yesterday retro');
    await page.click('button:has-text("Create Task")');

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const tasks = JSON.parse(sessionStorage.getItem('memor_db_tasks') || '[]');
          return tasks.find((task: any) => task.title === 'Backfill yesterday retro');
        }),
      )
      .toMatchObject({
        title: 'Backfill yesterday retro',
        created_at: `${yesterdayStr}T12:00:00`,
        is_daily_priority: true,
      });

    await page.click('button:has-text("Go to Today")');
    await expect(page.locator('.dashboard-view')).not.toContainText('Viewing past date:');
  });

  test('core task status and progress controls synchronize while editing', async ({ page }) => {
    await login(page);

    await sidebarItem(page, 'Weekly Focus').click();
    const todoColumn = page.locator('.column-card:has-text("On My Plate")');
    await taskAction(todoColumn, 'Buy groceries', 'edit').click();

    const statusSelect = selectInPrimaryModalFormByOption(page, 'Done');
    await changeSelectValue(statusSelect, 'done');
    await expect(taskCompletionRange(page)).toHaveValue('100');

    await setRangeValue(page, 'input[aria-labelledby="t-percent-label"]', '50');
    await expect(statusSelect).toHaveValue('in_progress');

    await page.click('button:has-text("Save Core Details")');

    const inProgressColumn = page.locator('.column-card:has-text("In Progress")');
    await expect(inProgressColumn).toContainText('Buy groceries');
    await expect(inProgressColumn.locator('.task-card:has-text("Buy groceries")')).toContainText(
      '50%',
    );
  });
});
