import { test as base } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { injectTauriMock } from './tauri-mock';

export const test = base.extend({
  page: async ({ page }, use) => {
    // Inject our stateful Tauri mock
    await injectTauriMock(page);

    // Run the actual test
    await use(page);

    // Retrieve and save coverage after the test ends
    try {
      const coverage = await page.evaluate(() => (window as any).__coverage__);
      if (coverage) {
        const nycDir = path.join(process.cwd(), '.nyc_output');
        if (!fs.existsSync(nycDir)) {
          fs.mkdirSync(nycDir, { recursive: true });
        }
        const fileId = Math.random().toString(36).substring(2, 15);
        fs.writeFileSync(path.join(nycDir, `coverage-${fileId}.json`), JSON.stringify(coverage));
      }
    } catch (e) {
      // Ignore errors if the page crashed or navigated away permanently
      console.warn('Could not collect coverage:', e);
    }
  },
});

export { expect } from '@playwright/test';
