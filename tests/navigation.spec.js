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
  await section(page, 'object');
  await expect(page).toHaveURL(/#data\/object$/);
  await expect(page.getByText('Objekt- und Einheitendaten bilden gemeinsam')).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/#data\/overview$/);
  await page.goForward();
  await expect(page).toHaveURL(/#data\/object$/);

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
  await expect(page.getByRole('heading', { name: 'Zahlung erfassen' })).toBeVisible();
  await page.getByLabel('Bezeichnung').fill('Nicht speichern');

  page.once('dialog', async d => {
    expect(d.message()).toContain('Ungespeicherte Änderungen verwerfen');
    await d.dismiss();
  });
  await page.getByRole('button', { name: 'Schließen' }).click();
  await expect(page.getByRole('heading', { name: 'Zahlung erfassen' })).toBeVisible();

  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: 'Schließen' }).click();
  await expect(page.locator('#modal')).toHaveClass(/hidden/);
  await expect(quick).toBeFocused();
});
