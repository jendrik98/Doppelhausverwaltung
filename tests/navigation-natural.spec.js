const { test, expect } = require('@playwright/test');
const { runtimeGuard, openApp, top } = require('./helpers');

test('mobile Bereichsnavigation ist direkt sichtbar und merkt den letzten Ort', async ({ page }) => {
  const guard = runtimeGuard(page);
  await openApp(page, '#home');

  await top(page, 'Haus');
  const houseTabs = page.locator('.workspace-mobile-tabs');
  await expect(houseTabs).toBeVisible();
  await expect(page.locator('#workspaceSelect')).toBeHidden();
  for (const label of ['Überblick', 'Kosten', 'Zähler', 'Dokumente']) {
    await expect(houseTabs.getByRole('button', { name: label, exact: true })).toBeVisible();
  }

  await houseTabs.getByRole('button', { name: 'Dokumente', exact: true }).click();
  await expect(page).toHaveURL(/#data\/documents$/);
  await expect(page.locator('.workspace-trail')).toContainText('Haus');
  await expect(page.locator('.workspace-trail')).toContainText('Dokumente');
  await expect(page.locator('.workspace-mobile-tabs button[data-workspace-sub="documents"]')).toHaveAttribute('aria-current', 'page');

  await top(page, 'Finanzen');
  await page.locator('.workspace-mobile-tabs button[data-workspace-sub="planning"]').click();
  await expect(page).toHaveURL(/#owner\/planning$/);

  await top(page, 'Haus');
  await expect(page).toHaveURL(/#data\/documents$/);
  await expect(page.locator('.workspace-mobile-tabs button[data-workspace-sub="documents"]')).toHaveAttribute('aria-current', 'page');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/#data\/documents$/);
  await top(page, 'Finanzen');
  await expect(page).toHaveURL(/#owner\/planning$/);
  guard.assertClean();
});

test('tiefe Unterseiten zeigen einen verständlichen Pfad', async ({ page }) => {
  await openApp(page, '#owner/reconciliation');
  const trail = page.locator('.workspace-trail');
  await expect(trail).toBeVisible();
  await expect(trail).toContainText('Finanzen');
  await expect(trail).toContainText('Zahlungen');
  await expect(trail).toContainText('Zahlungen zuordnen');
  await expect(page.locator('.workspace-mobile-tabs button[data-workspace-sub="payments"]')).toHaveAttribute('aria-current', 'page');
});
