import { expect, type Locator, type Page } from '@playwright/test';

export type DialogAction = 'accept' | 'dismiss' | 'default';

export type DialogState = {
  action: DialogAction;
  expectedMessage: string | null;
};

export const createDialogState = (): DialogState => ({
  action: 'default',
  expectedMessage: null,
});

export const resetDialogState = (dialog: DialogState) => {
  dialog.action = 'default';
  dialog.expectedMessage = null;
};

export const installDialogHandler = (page: Page, dialog = createDialogState()) => {
  page.on('dialog', async (browserDialog) => {
    const message = browserDialog.message();

    if (dialog.expectedMessage && message.includes(dialog.expectedMessage)) {
      if (dialog.action === 'dismiss') {
        await browserDialog.dismiss();
      } else {
        await browserDialog.accept();
      }

      resetDialogState(dialog);
      return;
    }

    await browserDialog.accept();
  });
};

export const resetMockSession = async (page: Page) => {
  await page.goto('/');
  await page.evaluate(() => {
    sessionStorage.clear();
  });
  await page.goto('/');
};

export const unlock = async (page: Page) => {
  await page.fill('#master-password', 'password123');
  await page.click('button[type="submit"]');
  await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();
};

export const login = async (page: Page) => {
  await resetMockSession(page);
  await unlock(page);
};

export const visibleModal = (page: Page) => page.locator('.ui.modal:visible');

export const sidebarItem = (page: Page, text: string) =>
  page.locator('.app-sidebar .item').filter({ hasText: text }).first();

export const selectInPrimaryModalFormByOption = (page: Page, optionText: string) =>
  visibleModal(page)
    .locator('form')
    .first()
    .locator('select')
    .filter({ hasText: optionText })
    .first();

export const selectInSettingsSection = (page: Page, title: string) =>
  page.locator(`.settings-section:has-text("${title}") select`).first();

export const changeSelectValue = async (select: Locator, value: string) => {
  await select.evaluate((element, nextValue) => {
    const selectElement = element as HTMLSelectElement;
    selectElement.value = nextValue;
    selectElement.dispatchEvent(new Event('input', { bubbles: true }));
    selectElement.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
};

export const taskCompletionRange = (page: Page) =>
  visibleModal(page).locator('input[aria-labelledby="t-percent-label"]');

export const taskDeleteModal = (page: Page) =>
  visibleModal(page).filter({ hasText: 'Delete Task' });

export const confirmTaskDelete = async (page: Page) => {
  await taskDeleteModal(page).getByRole('button', { name: 'Delete' }).click();
};

export const taskAction = (parent: Locator, taskTitle: string, action: 'edit' | 'delete') =>
  parent.locator(`.task-card:has-text("${taskTitle}") button`).nth(action === 'edit' ? 0 : 1);

export const setRangeValue = async (page: Page, selector: string, value: string) => {
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
