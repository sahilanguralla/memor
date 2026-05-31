import { test, expect } from './fixtures';

test.describe('Memor E2E Test Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Automatically accept all dialog alerts and confirmations (e.g. task deletions)
    page.on('dialog', async (dialog) => {
      console.log(`[Playwright Dialog] Auto-accepting: ${dialog.message()}`);
      await dialog.accept();
    });

    // Clear session storage to ensure a clean mock database state for each test
    await page.goto('/');
    await page.evaluate(() => {
      sessionStorage.clear();
    });
    // Reload the page to apply the fresh state
    await page.goto('/');
  });

  test('Lock Screen - Authentication flows', async ({ page }) => {
    // 1. Verify Lock Screen header
    await expect(page.locator('.lock-card h2')).toHaveText('Memor Decryption');

    // 2. Try submitting incorrect password
    await page.fill('#master-password', 'wrong_password');
    await page.click('button[type="submit"]');

    // Verify error message
    await expect(page.locator('.lock-error')).toBeVisible();
    await expect(page.locator('.lock-error')).toContainText('Invalid password or decryption error');

    // 3. Try submitting correct password
    await page.fill('#master-password', 'password123');
    await page.click('button[type="submit"]');

    // Verify redirect to Dashboard
    await expect(page.locator('.brand h1')).toHaveText('Memor');
    await expect(page.getByRole('button', { name: '📋 Dashboard' })).toBeVisible();
  });

  test('Tab Navigation', async ({ page }) => {
    // Log in
    await page.fill('#master-password', 'password123');
    await page.click('button[type="submit"]');

    // Navigate to Activity Timeline
    await page.click('button:has-text("Activity")');
    await expect(page.locator('.view-title')).toContainText('Task Activity Timeline');

    // Navigate to Productivity Summaries
    await page.click('button:has-text("Summaries")');
    await expect(page.locator('.view-title')).toContainText('Productivity Summaries');

    // Navigate to Settings
    await page.click('button:has-text("Settings")');
    await expect(page.locator('.view-title')).toContainText('Application Settings');

    // Go back to Dashboard
    await page.click('button:has-text("Dashboard")');
    await expect(page.locator('.column-title').first()).toBeVisible();
  });

  test('Project Management - CRUD & Archiving', async ({ page }) => {
    // Log in
    await page.fill('#master-password', 'password123');
    await page.click('button[type="submit"]');

    // 1. Create a Project
    await page.locator('.sidebar-header button').click(); // Click '+'
    await page.fill('#p-name', 'Vacation Planning');
    await page.selectOption('#p-priority', '2'); // High Priority
    await page.click('button:has-text("Create Project")');

    // Verify project appears in sidebar container
    await expect(page.locator('.project-list')).toContainText('Vacation Planning');

    // 2. Archive the Project
    await page.click('button:has-text("Vacation Planning")');
    await page.click('button[title="Archive Project"]'); // Click Archive button in project header

    // Verify project disappears from sidebar
    await expect(page.locator('.project-list')).not.toContainText('Vacation Planning');

    // Verify project is in Archived list
    await page.click('button:has-text("Archived Projects")');
    await expect(page.locator('.modal-content h3')).toHaveText('📁 Archived Projects');
    await expect(page.locator('.modal-content')).toContainText('Vacation Planning');

    // 3. Restore the Project
    await page.click('.modal-content button:has-text("Restore Project")');
    await page.click('.modal-content button:has-text("Close")');

    // Verify project is back in sidebar
    await expect(page.locator('.project-list')).toContainText('Vacation Planning');

    // 4. Delete the Project
    await page.click('button:has-text("Vacation Planning")');
    await page.click('button[title="Delete Project"]'); // Click Delete button in project header

    // Confirm delete in modal
    await page.click('button:has-text("Yes, Delete Project and All Tasks")');

    // Verify project is permanently gone from sidebar
    await expect(page.locator('.project-list')).not.toContainText('Vacation Planning');
  });

  test('Task Management - CRUD & History notes & Trash', async ({ page }) => {
    // Log in
    await page.fill('#master-password', 'password123');
    await page.click('button[type="submit"]');

    // Select "Work" project
    await page.click('button:has-text("Work")');

    // 1. Add Task
    await page.click('button:has-text("+ Add Task")');
    await page.fill('#t-title', 'Verify Mocked IPC');
    await page.selectOption('#t-priority', '2'); // High
    await page.check('#task-daily-priority-checkbox'); // Add to My Day
    await page.click('button[type="submit"]'); // Create Task

    // Verify task is in "On My Plate" column (needs_to_do)
    const todoColumn = page.locator('.column-card:has-text("On My Plate")');
    await expect(todoColumn).toContainText('Verify Mocked IPC');

    // 2. Edit Task & Log quick comment
    await todoColumn
      .locator('.task-card:has-text("Verify Mocked IPC") button:has-text("✏️")')
      .click();
    await page.selectOption('#t-status', 'in_progress'); // Move to In Progress
    await page.fill('#t-percent', '60'); // 60% progress
    await page.fill('#t-comment', 'First draft of test specs'); // Add Quick Note
    await page.click('button[type="submit"]'); // Save Core Details

    // Verify task moves to "In Progress" column (on_my_plate) and shows 60%
    const inProgressColumn = page.locator('.column-card:has-text("In Progress")');
    await expect(inProgressColumn).toContainText('Verify Mocked IPC');
    await expect(
      inProgressColumn.locator('.task-card:has-text("Verify Mocked IPC")'),
    ).toContainText('60%');

    // 3. Add date-associated history note
    await inProgressColumn
      .locator('.task-card:has-text("Verify Mocked IPC") button:has-text("✏️")')
      .click();
    await page.fill('#new-note-text-input', 'Mocking Tauri listen / event channels');
    await page.fill('#new-note-percent-range', '90'); // Set note progress to 90%
    await page.click('button:has-text("Log Note")');

    // Verify note is added to notes list
    await expect(page.locator('.modal-content')).toContainText(
      'Mocking Tauri listen / event channels',
    );
    await page.click('button:has-text("Cancel")');

    // 4. Delete task
    await inProgressColumn
      .locator('.task-card:has-text("Verify Mocked IPC") button:has-text("🗑️")')
      .click();
    await expect(inProgressColumn).not.toContainText('Verify Mocked IPC');

    // 5. Restore task from Trash Bin
    await page.click('button:has-text("Trash Bin")');
    await expect(page.locator('.modal-content')).toContainText('Verify Mocked IPC');
    await page.click('.modal-content button:has-text("Restore")');
    await page.click('.modal-content button:has-text("Close")');

    // Verify task is back in Dashboard under In Progress column (since it was restored to its last state)
    await expect(inProgressColumn).toContainText('Verify Mocked IPC');

    // 6. Purge task permanently
    await inProgressColumn
      .locator('.task-card:has-text("Verify Mocked IPC") button:has-text("🗑️")')
      .click();
    await page.click('button:has-text("Trash Bin")');
    await page.click('.modal-content button:has-text("Purge")');
    await expect(page.locator('.modal-content')).not.toContainText('Verify Mocked IPC');
    await page.click('.modal-content button:has-text("Close")');
  });

  test('Settings Updates & Lock Session', async ({ page }) => {
    // Log in
    await page.fill('#master-password', 'password123');
    await page.click('button[type="submit"]');

    // Navigate to Settings
    await page.click('button:has-text("Settings")');

    // 1. Toggle Secure Auto-Unlock
    const keyringCheckbox = page.locator('#keyring-toggle-checkbox');
    await keyringCheckbox.check();
    await expect(keyringCheckbox).toBeChecked();

    // 2. Change Lock Timeout dropdown
    await page.selectOption('#lock-timeout', '30'); // 30 minutes
    await expect(page.locator('#lock-timeout')).toHaveValue('30');

    // 3. Change Trash Retention dropdown
    await page.selectOption('#trash-retention', '14'); // 14 days
    await expect(page.locator('#trash-retention')).toHaveValue('14');

    // Verify configuration was saved successfully in sessionStorage (persisted config check)
    const storedConfig = await page.evaluate(() => sessionStorage.getItem('memor_db_config'));
    expect(storedConfig).toContain('"keyring_enabled":true');
    expect(storedConfig).toContain('"auto_lock_timeout_mins":30');
    expect(storedConfig).toContain('"trash_retention_days":14');

    // 4. Lock database manually
    await page.click('button:has-text("Lock Database Now")');

    // Verify returned to lock screen
    await expect(page.locator('.lock-card h2')).toHaveText('Memor Decryption');
    await expect(page.locator('#master-password')).toBeVisible();
  });

  test('Productivity Summaries & Activity Timeline', async ({ page }) => {
    // Log in
    await page.fill('#master-password', 'password123');
    await page.click('button[type="submit"]');

    // 1. Verify Activity Timeline
    await page.click('button:has-text("Activity")');
    await expect(page.locator('.summary-container')).toContainText('Task Activity Timeline');
    await expect(page.locator('.summary-container')).toContainText('E2E Testing Implementation');
    await expect(page.locator('.summary-container')).toContainText('Lint & Format Configuration');

    // Test search filter on activity timeline
    await page.fill('input[placeholder="🔍 Search activity..."]', 'eslint');
    await expect(page.locator('.summary-container')).toContainText('Lint & Format Configuration');
    await expect(page.locator('.summary-container')).not.toContainText(
      'E2E Testing Implementation',
    );

    // 2. Verify Productivity Summaries
    await page.click('button:has-text("Summaries")');
    await expect(page.locator('.summary-container')).toContainText('Productivity Summaries');
    await expect(page.locator('.summary-container')).toContainText('Completed');
    await expect(page.locator('.summary-container')).toContainText('In Progress');
    await expect(page.locator('.summary-container')).toContainText('On My Plate');

    // Verify weekly summary works
    await page.click('button:has-text("Weekly")');
    await expect(page.locator('.summary-container')).toContainText('Productivity Summaries');
  });
});
