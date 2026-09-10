const { test, expect } = require('@playwright/test');
const { runtimeGuard, openApp, top, section } = require('./helpers');

test('iPhone-Navigation, Unterseiten, Zurück/Vorwärts, Suche und Schnellaktionen', async ({ page }) => {
  const guard = runtimeGuard(page);
  await openApp(page);

  for (const name of ['Start', 'Vermietung', 'Haus', 'Finanzen', 'Mehr']) {
    await expect(page.locator(`.main-tabs button[aria-label="${name}"]`)).toBeVisible();
  }

  await top(page, 'Haus');
  await expect(page).toHaveURL(/#data\/overview$/);
  await expect(page.getByRole('heading', { name: 'Objekt & Einheiten' })).toBeVisible();
  await expect(page.locator('#workspaceSelect option[value="object"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Objektdaten bearbeiten' }).click();
  await expect(page).toHaveURL(/#data\/property$/);

  await page.goBack();
  await expect(page).toHaveURL(/#data\/overview$/);
  await page.goForward();
  await expect(page).toHaveURL(/#data\/property$/);

  await page.getByRole('button', { name: 'Suchen' }).click();
  await expect(page.getByText('Häufig gebraucht')).toBeVisible();
  await page.locator('#searchInput').fill('wasser');
  await expect(page.getByText('Kaltwasser', { exact: true })).toBeVisible();
  await page.getByText('Kaltwasser', { exact: true }).click();
  await expect(page).toHaveURL(/#rental\/water$/);

  await page.getByRole('button', { name: 'Schnell hinzufügen' }).click();
  const quickDialog = page.locator('#quickOverlay');
  for (const label of ['Dokument', 'Zählerstand', 'Zahlung', 'Mietvertrag', 'Kostenquelle', 'Erinnerung']) {
    await expect(quickDialog.getByRole('button', { name: new RegExp(`^${label}\\b`) })).toBeVisible();
  }
  await quickDialog.getByRole('button', { name: 'Schließen' }).click();
  guard.assertClean();
});

test('Dialog warnt bei ungespeicherten Änderungen und stellt Fokus wieder her', async ({ page }) => {
  await openApp(page);
  const quick = page.getByRole('button', { name: 'Schnell hinzufügen' });
  await quick.click();
  await page.locator('#quickOverlay').getByRole('button', { name: /^Zahlung\b/ }).click();
  const modal = page.locator('#modal');
  await expect(modal.getByRole('heading', { name: 'Zahlung erfassen' })).toBeVisible();
  await modal.getByLabel('Bezeichnung').fill('Nicht speichern');

  const closeButton = modal.getByRole('button', { name: 'Schließen' });

  const dismissDialog = page.waitForEvent('dialog');
  const dismissClick = closeButton.click();
  const firstDialog = await dismissDialog;
  expect(firstDialog.message()).toContain('Ungespeicherte Änderungen verwerfen');
  await firstDialog.dismiss();
  await dismissClick;
  await expect(modal.getByRole('heading', { name: 'Zahlung erfassen' })).toBeVisible();

  const acceptDialog = page.waitForEvent('dialog');
  const acceptClick = closeButton.click();
  const secondDialog = await acceptDialog;
  expect(secondDialog.message()).toContain('Ungespeicherte Änderungen verwerfen');
  await secondDialog.accept();
  await acceptClick;
  await expect(modal).toHaveClass(/hidden/);
  await expect(quick).toBeFocused();
});
