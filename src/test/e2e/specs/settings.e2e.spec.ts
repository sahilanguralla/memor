import { test, expect } from '../fixtures';
import {
  changeSelectValue,
  createDialogState,
  installDialogHandler,
  login,
  resetDialogState,
  resetMockSession,
  selectInSettingsSection,
} from '../helpers';

test.describe('Settings e2e', () => {
  const dialog = createDialogState();

  test.beforeEach(async ({ page }) => {
    resetDialogState(dialog);
    installDialogHandler(page, dialog);
    await resetMockSession(page);
  });

  test('Settings Updates & Lock Session', async ({ page }) => {
    // Log in
    await page.fill('#master-password', 'password123');
    await page.click('button[type="submit"]');

    // Navigate to Settings
    await page.click('button:has-text("Settings")');

    // 1. Toggle Secure Auto-Unlock
    const keyringCheckbox = page.locator('#keyring-toggle-checkbox');
    await page.locator('.ui.checkbox:has(#keyring-toggle-checkbox)').click();
    await expect(keyringCheckbox).toBeChecked();

    // 2. Change Lock Timeout dropdown
    const timeoutSelect = selectInSettingsSection(page, 'Session Lock Timeout');
    await changeSelectValue(timeoutSelect, '30'); // 30 minutes
    await expect(timeoutSelect).toHaveValue('30');

    // 3. Change Trash Retention dropdown
    const trashRetentionSelect = selectInSettingsSection(page, 'Trash Retention');
    await changeSelectValue(trashRetentionSelect, '14'); // 14 days
    await expect(trashRetentionSelect).toHaveValue('14');

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

  test('Settings & Idle Timer Coverage', async ({ page }) => {
    await page.goto('/');
    await page.fill('#master-password', 'password123');
    await page.click('button[type="submit"]');

    // Go to settings
    await page.click('button:has-text("Settings")');

    // Never auto lock timeout configuration (timeout <= 0)
    const timeoutSelect = selectInSettingsSection(page, 'Session Lock Timeout');
    await changeSelectValue(timeoutSelect, '0');
    await expect(timeoutSelect).toHaveValue('0');

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
    dialog.expectedMessage = 'Failed to save settings';
    dialog.action = 'accept';
    const dialogPromise = page.waitForEvent('dialog');
    await changeSelectValue(timeoutSelect, '60');
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

  test('settings save confirmation appears for successful changes', async ({ page }) => {
    await login(page);

    await page.click('button:has-text("Settings")');
    const trashRetentionSelect = selectInSettingsSection(page, 'Trash Retention');
    await changeSelectValue(trashRetentionSelect, '90');

    await expect(page.locator('.settings-view')).toContainText('Settings saved successfully.');
    await expect(trashRetentionSelect).toHaveValue('90');
  });
});
