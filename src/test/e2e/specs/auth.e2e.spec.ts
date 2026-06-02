import { test, expect } from '../fixtures';
import { installDialogHandler, resetMockSession } from '../helpers';

test.describe('Auth e2e', () => {
  test.beforeEach(async ({ page }) => {
    installDialogHandler(page);
    await resetMockSession(page);
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
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();
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
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();

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
    await expect(page.locator('.lock-error')).toContainText('Please enter a master password.');
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
    await expect(page.locator('.lock-error')).toContainText('Passwords do not match.');

    // Correct passwords matching
    await page.fill('#master-password', 'password123');
    await page.fill('#confirm-password', 'password123');
    await page.locator('.ui.checkbox:has(#keyring-checkbox)').click();
    await page.click('button[type="submit"]');

    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();
  });
});
