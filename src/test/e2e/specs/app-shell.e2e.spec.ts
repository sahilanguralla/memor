import { test, expect } from '../fixtures';
import { installDialogHandler, resetMockSession } from '../helpers';

test.describe('App shell e2e', () => {
  test.beforeEach(async ({ page }) => {
    installDialogHandler(page);
    await resetMockSession(page);
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
});
