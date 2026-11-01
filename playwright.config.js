// Dev-only: headless checks of index.html. Uses the shared browser cache in
// ~/.cache/ms-playwright (chromium-1228 matches @playwright/test 1.61.1).
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  use: { browserName: 'chromium', viewport: { width: 1366, height: 768 } },
});
