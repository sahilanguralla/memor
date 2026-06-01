import { test, expect } from '../../test/e2e/fixtures';

test.describe('Memor E2E Coverage Expansion Suite', () => {
  let dialogAction: 'accept' | 'dismiss' | 'default' = 'default';
  let expectedMessage: string | null = null;

  test.beforeEach(async ({ page }) => {
    dialogAction = 'default';
    expectedMessage = null;

    // Custom global dialog handler to support specific dismiss/accept flows cleanly
    page.on('dialog', async (dialog) => {
      const msg = dialog.message();
      if (expectedMessage && msg.includes(expectedMessage)) {
        if (dialogAction === 'accept') {
          await dialog.accept();
        } else {
          await dialog.dismiss();
        }
        expectedMessage = null;
        dialogAction = 'default';
      } else {
        await dialog.accept();
      }
    });

    // Clear session storage to ensure a clean state for each test
    await page.goto('/');
    await page.evaluate(() => {
      sessionStorage.clear();
    });
    await page.goto('/');
  });

  test('Lock Screen - Auto Unlock success, error, and empty password validation', async ({
    page,
  }) => {
    // 1. Auto unlock success (mock unlock_db_with_saved_key returns true)
    await page.addInitScript(() => {
      (window as any).__TAURI_INTERNALS__ = (window as any).__TAURI_INTERNALS__ || {};
      const originalInvoke = (window as any).__TAURI_INTERNALS__.invoke;
      (window as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
        if (cmd === 'unlock_db_with_saved_key') {
          return true;
        }
        return originalInvoke ? originalInvoke(cmd, args) : undefined;
      };
    });
    await page.goto('/');
    await expect(page.locator('.brand h1')).toHaveText('Memor');

    // 2. Auto unlock error handling and empty password validation
    await page.goto('/');
    await page.evaluate(() => sessionStorage.clear());
    await page.addInitScript(() => {
      (window as any).__TAURI_INTERNALS__ = (window as any).__TAURI_INTERNALS__ || {};
      const originalInvoke = (window as any).__TAURI_INTERNALS__.invoke;
      (window as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
        if (cmd === 'unlock_db_with_saved_key') {
          throw new Error('Auto unlock database failed');
        }
        return originalInvoke ? originalInvoke(cmd, args) : undefined;
      };
    });
    await page.goto('/');

    await expect(page.locator('.lock-card h2')).toHaveText('Memor Decryption');
    // Click submit with empty password
    await page.click('button[type="submit"]');
    await expect(page.locator('.lock-error')).toHaveText('Please enter a master password.');
  });

  test('Lock Screen - First Run setup flows', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__TAURI_INTERNALS__ = (window as any).__TAURI_INTERNALS__ || {};
      const originalInvoke = (window as any).__TAURI_INTERNALS__.invoke;
      (window as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
        if (cmd === 'is_first_run') {
          return true;
        }
        return originalInvoke ? originalInvoke(cmd, args) : undefined;
      };
    });
    await page.goto('/');

    await expect(page.locator('.lock-card h2')).toHaveText('Setup Master Password');

    // Passwords mismatch
    await page.fill('#master-password', 'pass123');
    await page.fill('#confirm-password', 'pass456');
    await page.click('button[type="submit"]');
    await expect(page.locator('.lock-error')).toHaveText('Passwords do not match.');

    // Correct passwords matching
    await page.fill('#master-password', 'password123');
    await page.fill('#confirm-password', 'password123');
    await page.check('#keyring-checkbox');
    await page.click('button[type="submit"]');

    await expect(page.locator('.brand h1')).toHaveText('Memor');
  });

  test('Settings & Idle Timer Coverage', async ({ page }) => {
    await page.goto('/');
    await page.fill('#master-password', 'password123');
    await page.click('button[type="submit"]');

    // Go to settings
    await page.click('button:has-text("Settings")');

    // Never auto lock timeout configuration (timeout <= 0)
    await page.selectOption('#lock-timeout', '0');
    await expect(page.locator('#lock-timeout')).toHaveValue('0');

    // Config update failure showAlert handling (inject dynamic evaluate invoke)
    await page.evaluate(() => {
      const originalInvoke = (window as any).__TAURI_INTERNALS__.invoke;
      (window as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
        if (cmd === 'update_config') {
          throw new Error('Failed to update config');
        }
        return originalInvoke(cmd, args);
      };
    });
    expectedMessage = 'Failed to save settings';
    dialogAction = 'accept';
    const dialogPromise = page.waitForEvent('dialog');
    await page.selectOption('#lock-timeout', '60');
    await dialogPromise;

    // Manual lock failure catch blocks
    await page.evaluate(() => {
      const originalInvoke = (window as any).__TAURI_INTERNALS__.invoke;
      (window as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
        if (cmd === 'lock_db') {
          throw new Error('Failed to lock database connection');
        }
        return originalInvoke(cmd, args);
      };
    });
    await page.click('button:has-text("Lock Database Now")');
    await expect(page.locator('.view-title')).toContainText('Application Settings');

    await page.click('button:has-text("Lock")');
    await expect(page.locator('.view-title')).toContainText('Application Settings');
  });

  test('Settings - get_config failure fallback', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__TAURI_INTERNALS__ = (window as any).__TAURI_INTERNALS__ || {};
      const originalInvoke = (window as any).__TAURI_INTERNALS__.invoke;
      (window as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
        if (cmd === 'get_config') {
          throw new Error('Config read failed');
        }
        return originalInvoke ? originalInvoke(cmd, args) : undefined;
      };
    });
    await page.goto('/');
    await page.fill('#master-password', 'password123');
    await page.click('button[type="submit"]');

    await page.click('button:has-text("Settings")');
    await expect(page.locator('.view-title')).toContainText('Application Settings');
  });

  test('Plan Tomorrow carry over and carry over errors', async ({ page }) => {
    await page.goto('/');
    await page.fill('#master-password', 'password123');
    await page.click('button[type="submit"]');

    await page.click('button:has-text("Dashboard")');
    await page.click('button:has-text("☀️ My Day")');

    await page.click('button:has-text("Plan Tomorrow")');
    await expect(page.locator('.modal-content h3')).toContainText("Plan Tomorrow's Carry-Over");
    await expect(page.locator('.modal-content')).toContainText('E2E Testing Implementation');

    // Uncheck and check carry over
    await page.uncheck('.modal-content input[type="checkbox"]');
    await page.check('.modal-content input[type="checkbox"]');

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
    expectedMessage = 'Failed to toggle carry-over';
    dialogAction = 'accept';
    const dialogPromise = page.waitForEvent('dialog');
    // Use page.click instead of page.uncheck since controlled state doesn't change on failure
    await page.click('.modal-content input[type="checkbox"]');
    await dialogPromise;

    await page.click('.modal-content button:has-text("Close")');

    // Plan Tomorrow empty carry-over state (delete uncompleted tasks to empty it)
    const inProgressColumn = page.locator('.column-card:has-text("In Progress")');
    await inProgressColumn
      .locator('.task-card:has-text("E2E Testing Implementation") button:has-text("🗑️")')
      .click();

    const todoColumn = page.locator('.column-card:has-text("On My Plate")');
    await todoColumn
      .locator('.task-card:has-text("Read book chapter") button:has-text("🗑️")')
      .click();

    await page.click('button:has-text("Plan Tomorrow")');
    await expect(page.locator('.modal-content')).toContainText(
      'No uncompleted priorities on your day to plan!',
    );
    await page.click('.modal-content button:has-text("Close")');
  });

  test('Task note status/percent synchronization and inline note CRUD', async ({ page }) => {
    await page.goto('/');
    await page.fill('#master-password', 'password123');
    await page.click('button[type="submit"]');

    const inProgressColumn = page.locator('.column-card:has-text("In Progress")');
    await inProgressColumn
      .locator('.task-card:has-text("E2E Testing Implementation") button:has-text("✏️")')
      .click();

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
    await page.click('.modal-content .glass-panel button:has-text("✏️")');
    const editNotePanel = page.locator(
      '.modal-content .glass-panel:has(select[id^="edit-note-status-"])',
    );
    await editNotePanel.locator('input[type="text"]').fill('Updated inline note text');

    // Status sync inside inline note edit
    await page.selectOption('select[id^="edit-note-status-"]', 'done');
    const editNoteRange = page.locator(
      '.glass-panel:not(.modal-content):has(select[id^="edit-note-status-"]) input[type="range"]',
    );
    await expect(editNoteRange).toHaveValue('100');

    await page.selectOption('select[id^="edit-note-status-"]', 'todo');
    await expect(editNoteRange).toHaveValue('0');

    // Move range slider to 100 using React-compatible value setter
    await page.evaluate(() => {
      const panel = document.querySelector(
        '.glass-panel:not(.modal-content):has(select[id^="edit-note-status-"])',
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
        '.glass-panel:not(.modal-content):has(select[id^="edit-note-status-"])',
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
    await page.click('.modal-content .glass-panel button:has-text("Save")');
    await expect(page.locator('.modal-content')).toContainText('Updated inline note text');

    // Cancel inline note edit
    await page.click('.modal-content .glass-panel button:has-text("✏️")');
    await page.click('.modal-content .glass-panel button:has-text("Cancel")');

    // Dismiss note deletion prompt
    expectedMessage = 'Are you sure you want to delete this note?';
    dialogAction = 'dismiss';
    await page.click('.modal-content .glass-panel button:has-text("🗑️")');
    await expect(page.locator('.modal-content')).toContainText('Updated inline note text');

    // Accept note deletion
    expectedMessage = 'Are you sure you want to delete this note?';
    dialogAction = 'accept';
    await page.click('.modal-content .glass-panel button:has-text("🗑️")');
    await expect(page.locator('.modal-content')).toContainText('No progress logs recorded.');

    await page.click('.modal-content button:has-text("Cancel")');
  });

  test('Task note actions - error alerts', async ({ page }) => {
    await page.goto('/');
    await page.fill('#master-password', 'password123');
    await page.click('button[type="submit"]');

    const inProgressColumn = page.locator('.column-card:has-text("In Progress")');
    await inProgressColumn
      .locator('.task-card:has-text("E2E Testing Implementation") button:has-text("✏️")')
      .click();

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
    expectedMessage = 'Failed to add note';
    dialogAction = 'accept';
    let dialogPromise = page.waitForEvent('dialog');
    await page.click('button:has-text("Log Note")');
    await dialogPromise;

    // 2. Edit note fail alert
    await page.click('.modal-content .glass-panel button:has-text("✏️")');
    await page.fill('.modal-content .glass-panel input[type="text"]', 'Fail note edit content');
    expectedMessage = 'Failed to update note';
    dialogAction = 'accept';
    dialogPromise = page.waitForEvent('dialog');
    await page.click('.modal-content .glass-panel button:has-text("Save")');
    await dialogPromise;

    // Cancel edit mode to return the list item to view mode, re-enabling the delete button
    await page.click('.modal-content .glass-panel button:has-text("Cancel")');

    // 3. Delete note fail alert
    dialogPromise = page.waitForEvent('dialog');
    await page.click('.modal-content .glass-panel button:has-text("🗑️")');
    await dialogPromise;

    await page.click('.modal-content button:has-text("Cancel")');
  });

  test('Project deletion options and Trash Bin restoration/purging', async ({ page }) => {
    await page.goto('/');
    await page.fill('#master-password', 'password123');
    await page.click('button[type="submit"]');

    // Select Personal project
    await page.click('button:has-text("Personal")');

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
    await page.click('button:has-text("Trash Bin")');
    await expect(page.locator('.modal-content')).toContainText('Personal');

    await page.click('.modal-content .glass-panel:has-text("Personal") button:has-text("Restore")');

    await page.click('.modal-content button:has-text("Close")');
    await expect(page.locator('.project-list')).toContainText('Personal');

    // 4. Trash Bin - Purge Project
    await page.click('button:has-text("Personal")');
    await page.click('button[title="Delete Project"]');
    await page.click('button:has-text("Yes, Delete Project and All Tasks")');

    await page.click('button:has-text("Trash Bin")');

    // Purge project - dismiss
    expectedMessage = 'WARNING: This will permanently delete this project';
    dialogAction = 'dismiss';
    await page.click('.modal-content .glass-panel:has-text("Personal") button:has-text("Purge")');
    await expect(page.locator('.modal-content')).toContainText('Personal');

    // Purge project - accept
    expectedMessage = 'WARNING: This will permanently delete this project';
    dialogAction = 'accept';
    await page.click('.modal-content .glass-panel:has-text("Personal") button:has-text("Purge")');
    await expect(page.locator('.modal-content')).not.toContainText('Personal');

    await page.click('.modal-content button:has-text("Close")');
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

    await page.click('button:has-text("Trash Bin")');
    await expect(page.locator('.modal-content')).toContainText('2 days left');
    await expect(page.locator('.modal-content')).toContainText('8 days left');
    await page.click('.modal-content button:has-text("Close")');
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
    await page.locator('.sidebar-header button').first().click();
    await page.fill('#p-name', 'Error Project');
    expectedMessage = 'Failed to create project';
    dialogAction = 'accept';
    let dialogPromise = page.waitForEvent('dialog');
    await page.click('button:has-text("Create Project")');
    await dialogPromise;
    await page.click('.modal-content button:has-text("Cancel")');

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
    await page.click('button:has-text("+ Add Task")');
    await page.fill('#t-title', 'Error Task');
    expectedMessage = 'Failed to save task';
    dialogAction = 'accept';
    dialogPromise = page.waitForEvent('dialog');
    await page.click('button[type="submit"]');
    await dialogPromise;
    await page.click('.modal-content button:has-text("Cancel")');

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
    await inProgressColumn
      .locator('.task-card:has-text("E2E Testing Implementation") button:has-text("✏️")')
      .click();
    expectedMessage = 'Failed to save task';
    dialogAction = 'accept';
    dialogPromise = page.waitForEvent('dialog');
    await page.click('button[type="submit"]');
    await dialogPromise;
    await page.click('.modal-content button:has-text("Cancel")');

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
    await page.click('button:has-text("Work")');
    expectedMessage = 'Failed to archive project';
    dialogAction = 'accept';
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
    expectedMessage = 'Failed to delete project';
    dialogAction = 'accept';
    dialogPromise = page.waitForEvent('dialog');
    await page.click('button:has-text("Yes, Delete Project and All Tasks")');
    await dialogPromise;

    // Close the delete project modal
    await page.click('.modal-content:has-text("delete all tasks") button:has-text("Cancel")');

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
    await inProgressColumn
      .locator('.task-card:has-text("E2E Testing Implementation") button:has-text("🗑️")')
      .click();

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
    await page.click('button:has-text("Archived Projects")');
    expectedMessage = 'Failed to unarchive project';
    dialogAction = 'accept';
    dialogPromise = page.waitForEvent('dialog');
    await page.click('.modal-content button:has-text("Restore Project")');
    await dialogPromise;

    await page.click('.modal-content button:has-text("Delete")');
    await page.click('.modal-content button:has-text("Close")');

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
    await page.click('button:has-text("Trash Bin")');

    await page.click(
      '.modal-content .glass-panel:has-text("Trash Proj") button:has-text("Restore")',
    );
    await page.click('.modal-content .glass-panel:has-text("Trash Proj") button:has-text("Purge")');
    await page.click(
      '.modal-content .glass-panel:has-text("Trash Task") button:has-text("Restore")',
    );
    await page.click('.modal-content .glass-panel:has-text("Trash Task") button:has-text("Purge")');

    await page.click('.modal-content button:has-text("Close")');
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
    expectedMessage = 'Failed to move task';
    dialogAction = 'accept';
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

    await page.click('button:has-text("📅 Weekly Focus")');
    await expect(page.locator('.view-title')).toContainText('Weekly Focus Priorities');

    await page.click('button:has-text("Work")');
    await expect(page.locator('.view-title')).toContainText('Work');

    await page.click('button[title="Previous Day"]');
    await page.click('button:has-text("Go to Today")');
  });

  test('Summary View re-click, date change and failures', async ({ page }) => {
    await page.goto('/');
    await page.fill('#master-password', 'password123');
    await page.click('button[type="submit"]');

    await page.click('button:has-text("Summaries")');
    await expect(page.locator('.view-title')).toContainText('Productivity Summaries');

    await page.click('button:has-text("Daily")');

    await page.fill('input[type="date"]', '2026-05-24');

    await page.evaluate(() => {
      const originalInvoke = (window as any).__TAURI_INTERNALS__.invoke;
      (window as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
        if (cmd === 'get_daily_summary' || cmd === 'get_weekly_summary') {
          throw new Error('Summary retrieval failed');
        }
        return originalInvoke(cmd, args);
      };
    });
    await page.click('button:has-text("Weekly")');
    await expect(page.locator('.lock-error')).toContainText('Summary retrieval failed');
  });

  test('Timeline View re-fetch on background event and errors', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__tasksChangedCallbacks = [];
      const originalInvoke = (window as any).__TAURI_INTERNALS__.invoke;
      (window as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
        if (cmd === 'plugin:event|listen' && args && args.event === 'tasks-changed') {
          (window as any).__tasksChangedCallbacks.push(args.handler);
        }
        return originalInvoke ? originalInvoke(cmd, args) : undefined;
      };

      (window as any).__rawCallbacks = (window as any).__rawCallbacks || {};
      const originalTransform = (window as any).__TAURI_INTERNALS__.transformCallback;
      (window as any).__TAURI_INTERNALS__.transformCallback = (callback: any, once = false) => {
        const id = originalTransform(callback, once);
        (window as any).__rawCallbacks[id] = callback;
        return id;
      };
    });

    await page.goto('/');
    await page.fill('#master-password', 'password123');
    await page.click('button[type="submit"]');

    await page.click('button:has-text("Activity")');
    await expect(page.locator('.view-title')).toContainText('Task Activity Timeline');

    // Trigger background event listener
    await page.evaluate(() => {
      const callbacks = (window as any).__tasksChangedCallbacks;
      const rawCbs = (window as any).__rawCallbacks;
      callbacks.forEach((handlerId: number) => {
        const cb = rawCbs[handlerId];
        if (cb) {
          cb({ event: 'tasks-changed', payload: null });
        }
      });
    });

    // Verify timeline view continues functioning
    await expect(page.locator('.view-title')).toContainText('Task Activity Timeline');
  });

  test('Timeline failures and invalid date fallbacks', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__TAURI_INTERNALS__ = (window as any).__TAURI_INTERNALS__ || {};
      const originalInvoke = (window as any).__TAURI_INTERNALS__.invoke;
      (window as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
        if (cmd === 'get_timeline') {
          return [
            {
              id: 999,
              task_id: 101,
              task_title: 'Fallback Date Task',
              date: 'not-a-valid-date-format',
              update_text: 'Logged progress with fallback date',
              completion_percentage: 45,
              status: 'unknown_status',
              created_at: '2026-05-31 12:00:00',
            },
          ];
        }
        return originalInvoke ? originalInvoke(cmd, args) : undefined;
      };
    });

    await page.goto('/');
    await page.fill('#master-password', 'password123');
    await page.click('button[type="submit"]');

    await page.click('button:has-text("Activity")');
    await expect(page.locator('.summary-container')).toContainText('not-a-valid-date-format');
    await expect(page.locator('.summary-container')).toContainText('Fallback Date Task');

    // Error state
    await page.evaluate(() => {
      const originalInvoke = (window as any).__TAURI_INTERNALS__.invoke;
      (window as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
        if (cmd === 'get_timeline') {
          throw new Error('Timeline fetch failed');
        }
        return originalInvoke(cmd, args);
      };
    });
    await page.click('button:has-text("Dashboard")');
    await page.click('button:has-text("Activity")');
    await expect(page.locator('.lock-error')).toContainText('Timeline fetch failed');
  });
});
