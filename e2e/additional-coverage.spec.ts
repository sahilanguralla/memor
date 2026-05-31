import { test, expect } from './fixtures';

const login = async (page: import('@playwright/test').Page) => {
  await page.goto('/');
  await page.evaluate(() => {
    sessionStorage.clear();
  });
  await page.goto('/');
  await page.fill('#master-password', 'password123');
  await page.click('button[type="submit"]');
  await expect(page.locator('.brand h1')).toHaveText('Memor');
};

const setRangeValue = async (
  page: import('@playwright/test').Page,
  selector: string,
  value: string,
) => {
  await page.evaluate(
    ({ selector: rangeSelector, value: rangeValue }) => {
      const slider = document.querySelector(rangeSelector) as HTMLInputElement | null;
      if (!slider) throw new Error(`Range input not found: ${rangeSelector}`);

      const tracker = (slider as any)._valueTracker;
      if (tracker) tracker.setValue('');

      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      nativeSetter?.call(slider, rangeValue);
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    },
    { selector, value },
  );
};

test.describe('Memor additional E2E coverage', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });
  });

  test('empty dashboard forms stay open and priority checkboxes remain coupled', async ({
    page,
  }) => {
    await login(page);

    await page.locator('.sidebar-header button').first().click();
    await page.click('button:has-text("Create Project")');
    await expect(page.locator('.modal-content h3')).toHaveText('Create New Project');
    await page.click('.modal-content button:has-text("Cancel")');

    await page.click('button:has-text("+ Add Task")');
    await page.click('button:has-text("Create Task")');
    await expect(page.locator('.modal-content h3')).toHaveText('Add New Task');

    const dailyCheckbox = page.locator('#task-daily-priority-checkbox');
    const weeklyCheckbox = page.locator('#task-weekly-priority-checkbox');
    await weeklyCheckbox.check();
    await weeklyCheckbox.uncheck();
    await expect(dailyCheckbox).not.toBeChecked();

    await dailyCheckbox.check();
    await expect(weeklyCheckbox).toBeChecked();

    await weeklyCheckbox.uncheck();
    await expect(dailyCheckbox).not.toBeChecked();
    await expect(weeklyCheckbox).not.toBeChecked();

    await page.click('.modal-content button:has-text("Cancel")');
  });

  test('past date banner allows dated task creation and returns to today', async ({ page }) => {
    await login(page);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    await page.fill('.dashboard-view input[type="date"]', yesterdayStr);
    await expect(page.locator('.dashboard-view')).toContainText(`Viewing past date: ${yesterdayStr}`);

    await page.click('button:has-text("+ Add Task")');
    await page.fill('#t-title', 'Backfill yesterday retro');
    await page.check('#task-daily-priority-checkbox');
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

    await page.click('button:has-text("📅 Weekly Focus")');
    const todoColumn = page.locator('.column-card:has-text("On My Plate")');
    await todoColumn.locator('.task-card:has-text("Buy groceries") button:has-text("✏️")').click();

    await page.selectOption('#t-status', 'done');
    await expect(page.locator('#t-percent')).toHaveValue('100');

    await setRangeValue(page, '#t-percent', '50');
    await expect(page.locator('#t-status')).toHaveValue('in_progress');

    await page.click('button:has-text("Save Core Details")');

    const inProgressColumn = page.locator('.column-card:has-text("In Progress")');
    await expect(inProgressColumn).toContainText('Buy groceries');
    await expect(inProgressColumn.locator('.task-card:has-text("Buy groceries")')).toContainText(
      '50%',
    );
  });

  test('summary and timeline empty states render clearly', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__TAURI_INTERNALS__ = (window as any).__TAURI_INTERNALS__ || {};
      const originalInvoke = (window as any).__TAURI_INTERNALS__.invoke;
      (window as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
        if (cmd === 'get_timeline') return [];
        if (cmd === 'get_daily_summary') {
          return {
            summary_type: 'daily',
            start_date: args.date,
            end_date: args.date,
            projects: [],
          };
        }
        if (cmd === 'get_weekly_summary') {
          return {
            summary_type: 'weekly',
            start_date: args.startDate,
            end_date: args.startDate,
            projects: [],
          };
        }
        return originalInvoke ? originalInvoke(cmd, args) : undefined;
      };
    });

    await login(page);

    await page.click('button:has-text("Activity")');
    await expect(page.locator('.summary-container')).toContainText(
      'No task updates logged yet. Progress updates will appear here.',
    );

    await page.fill('input[placeholder="🔍 Search activity..."]', 'nothing');
    await expect(page.locator('.summary-container')).toContainText('No matching activity found.');

    await page.click('button:has-text("Summaries")');
    await expect(page.locator('.summary-container')).toContainText(
      'No active tasks found in this period. Start working on your plate!',
    );

    await page.click('button:has-text("Weekly")');
    await expect(page.locator('.summary-container')).toContainText(
      'No active tasks found in this period. Start working on your plate!',
    );
  });

  test('settings save confirmation appears for successful changes', async ({ page }) => {
    await login(page);

    await page.click('button:has-text("Settings")');
    await page.selectOption('#trash-retention', '90');

    await expect(page.locator('.settings-view')).toContainText('Settings saved successfully.');
    await expect(page.locator('#trash-retention')).toHaveValue('90');
  });
});
