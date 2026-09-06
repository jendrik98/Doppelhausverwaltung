const { test, expect } = require('@playwright/test');
const { runtimeGuard, openApp } = require('./helpers');

test('Live-Deployment, Version, Kernassets und Service Worker', async ({ page, request }) => {
  const expected = process.env.EXPECTED_APP_VERSION || '16.0.1';
  const guard = runtimeGuard(page);

  const app = await request.get('./app.js?v=1601');
  expect(app.ok()).toBeTruthy();
  expect(await app.text()).toContain(`APP_VERSION="${expected}"`);

  for (const path of ['./style.css', './manifest.webmanifest', './legal-rules.json', './service-worker.js', './icon-192.png', './icon-512.png']) {
    const r = await request.get(path);
    expect(r.ok(), `${path} muss erreichbar sein`).toBeTruthy();
  }

  await openApp(page);
  await expect(page.getByRole('heading', { name: 'Dein Haus auf einen Blick' })).toBeVisible();
  await expect(page.locator('nav.main-tabs')).toBeVisible();

  const sw = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { supported: false };
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error('SW timeout')), 15000))
    ]);
    return { supported: true, active: !!reg.active, scope: reg.scope };
  });
  expect(sw.supported).toBeTruthy();
  expect(sw.active).toBeTruthy();
  guard.assertClean();
});

test('PWA startet nach Erstladen offline', async ({ page, context }) => {
  await openApp(page);
  const ready = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise(resolve => setTimeout(() => resolve(null), 15000))
    ]);
    return !!reg?.active;
  });
  expect(ready).toBeTruthy();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 15000 }).toBeTruthy();
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Dein Haus auf einen Blick' })).toBeVisible();
  await context.setOffline(false);
});
