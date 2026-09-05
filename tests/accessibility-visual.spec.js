const { test, expect } = require('@playwright/test');
const { openApp, top, section } = require('./helpers');
const { fixtureFile } = require('./fixtures');

test('Touch-Ziele, sichtbarer Fokus und Dark Mode', async ({ page }) => {
  await openApp(page);
  const bad = await page.locator('button:visible').evaluateAll(btns => btns.map(b => {
    const r = b.getBoundingClientRect();
    return { label: b.getAttribute('aria-label') || b.innerText.trim(), w: r.width, h: r.height };
  }).filter(x => x.w < 44 || x.h < 44));
  expect(bad, `Touch-Ziele unter 44×44 px: ${JSON.stringify(bad)}`).toEqual([]);

  await page.keyboard.press('Tab');
  const focused = page.locator(':focus');
  const outline = await focused.evaluate(el => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).not.toBe('rgb(245, 247, 250)');
  await page.screenshot({ path: 'test-results/v16-dark-iphone.png', fullPage: true });
});

test('Zählerfoto-Zuschnitt ist auch ohne Dragging bedienbar', async ({ page }) => {
  await openApp(page);
  await top(page, 'Haus');
  await section(page, 'infrastructure');
  await page.getByRole('button', { name: 'Foto auswählen' }).click();
  await page.locator('#meterFileInput').setInputFiles(fixtureFile('meter'));
  await expect(page.locator('#meterCropStage')).toBeVisible();
  for (const name of ['Rahmen nach links', 'Rahmen nach oben', 'Rahmen nach unten', 'Rahmen nach rechts']) {
    await expect(page.getByRole('button', { name })).toBeVisible();
  }
  for (const name of ['Enger', 'Größer', 'Auto']) await expect(page.getByRole('button', { name })).toBeVisible();
  await page.getByRole('button', { name: 'Enger' }).click();
  await page.getByRole('button', { name: 'Rahmen nach rechts' }).click();
});

test('Desktop besitzt Sidebar statt mobiler Unterbereichsauswahl', async ({ browser }) => {
  const c = await browser.newContext({ baseURL: process.env.E2E_BASE_URL || 'https://jendrik98.github.io/Doppelhausverwaltung/', viewport: { width: 1440, height: 900 }, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const p = await c.newPage();
  await openApp(p);
  await top(p, 'Haus');
  await expect(p.locator('.workspace-sidebar')).toBeVisible();
  await expect(p.locator('.workspace-mobile-picker')).toBeHidden();
  await p.screenshot({ path: 'test-results/v16-desktop.png', fullPage: true });
  await c.close();
});
