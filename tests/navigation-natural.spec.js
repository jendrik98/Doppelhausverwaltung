const { test, expect } = require('@playwright/test');
const { runtimeGuard, openApp, top } = require('./helpers');

test('mobile Navigation zeigt nur die wenigen echten Arbeitsbereiche', async ({ page }) => {
  const guard = runtimeGuard(page);
  await openApp(page, '#home');

  await top(page, 'Haus');
  const houseTabs = page.locator('.workspace-mobile-tabs');
  for (const label of ['Objekt', 'Kosten', 'Dokumente']) {
    await expect(houseTabs.getByRole('button', { name: label, exact: true })).toBeVisible();
  }
  await expect(houseTabs.getByRole('button', { name: 'Zähler', exact: true })).toHaveCount(0);

  await houseTabs.getByRole('button', { name: 'Dokumente', exact: true }).click();
  await expect(page).toHaveURL(/#data\/documents$/);

  await top(page, 'Finanzen');
  await expect(page.locator('.workspace-mobile-tabs button')).toHaveCount(2);
  await page.getByRole('button', { name: 'Planung', exact: true }).click();
  await expect(page).toHaveURL(/#owner\/planning$/);

  await top(page, 'Haus');
  await expect(page).toHaveURL(/#data\/documents$/);
  guard.assertClean();
});

test('tiefe Detailseiten bleiben erreichbar, bestimmen aber nicht den nächsten Bereichseinstieg', async ({ page }) => {
  await openApp(page, '#data/infrastructure');
  await expect(page.locator('.workspace-mobile-tabs button[data-workspace-sub="overview"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.workspace-trail')).toContainText('Zähler & Behälter');

  await top(page, 'Finanzen');
  await top(page, 'Haus');
  await expect(page).toHaveURL(/#data\/overview$/);

  await openApp(page, '#rental/water');
  await expect(page.locator('.workspace-mobile-tabs button[data-workspace-sub="billing"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.workspace-trail')).toContainText('Kaltwasser');
  await top(page, 'Haus');
  await top(page, 'Vermietung');
  await expect(page).toHaveURL(/#rental\/billing$/);

  await openApp(page, '#more/smart');
  await expect(page.locator('.workspace-mobile-tabs button[data-workspace-sub="app"]')).toHaveAttribute('aria-current', 'page');
  await top(page, 'Haus');
  await top(page, 'Mehr');
  await expect(page).toHaveURL(/#more\/app$/);
});

test('tiefe Finanz-Unterseiten zeigen weiterhin einen verständlichen Pfad', async ({ page }) => {
  await openApp(page, '#owner/reconciliation');
  const trail = page.locator('.workspace-trail');
  await expect(trail).toBeVisible();
  await expect(trail).toContainText('Finanzen');
  await expect(trail).toContainText('Zahlungen');
  await expect(trail).toContainText('Zahlungen zuordnen');
  await expect(page.locator('.workspace-mobile-tabs button[data-workspace-sub="payments"]')).toHaveAttribute('aria-current', 'page');
});
