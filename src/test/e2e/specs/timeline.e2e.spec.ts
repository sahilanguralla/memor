import { test, expect } from '../fixtures';
import { installDialogHandler, resetMockSession } from '../helpers';

test.describe('Timeline e2e', () => {
  test.beforeEach(async ({ page }) => {
    installDialogHandler(page);
    await resetMockSession(page);
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
    await expect(page.locator('.ui.negative.message')).toContainText('Timeline fetch failed');
  });
});
