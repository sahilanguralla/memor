import { test, expect } from '../fixtures';
import { installDialogHandler, login, resetMockSession } from '../helpers';

test.describe('Summaries e2e', () => {
  test.beforeEach(async ({ page }) => {
    installDialogHandler(page);
    await resetMockSession(page);
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
    await page.fill('input[placeholder="Search activity..."]', 'eslint');
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
    await expect(page.locator('.ui.negative.message')).toContainText('Summary retrieval failed');
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

    await page.fill('input[placeholder="Search activity..."]', 'nothing');
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
});
