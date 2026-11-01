const { test, expect } = require('@playwright/test');
const path = require('path');

const url = 'file://' + path.resolve(__dirname, '../index.html');

test('loads with no console errors and no external requests', async ({ page }) => {
  const errors = [];
  const external = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  page.on('request', r => !r.url().startsWith('file://') && !r.url().startsWith('data:') && external.push(r.url()));
  await page.goto(url);
  await expect(page.locator('h1')).toBeVisible();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
