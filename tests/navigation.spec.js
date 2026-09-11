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
  await expect(page).toHaveURL(/#owner\/cashflow$/);

  const modal = page.locator('#modal');
  await expect(modal.getByRole('heading', { name: 'Zahlung erfassen' })).toBeVisible();
  await expect(modal.locator('input[name="date"]')).toBeFocused();
  await modal.getByLabel('Bezeichnung').fill('Nicht speichern');
  await expect(modal.getByLabel('Bezeichnung')).toHaveValue('Nicht speichern');

  const closeButton = modal.locator('#modalClose');

  // Native confirm-Events sind auf Remote-/Live-Runnern timing-empfindlich. Wir prüfen
  // hier deterministisch denselben closeModal-Vertrag: Meldung, Abbruch und Bestätigung.
  await page.evaluate(() => {
    window.__testConfirmMessages = [];
    window.confirm = (message) => {
      window.__testConfirmMessages.push(String(message));
      return false;
    };
  });

  await closeButton.click();
  await expect(modal).not.toHaveClass(/hidden/);
  const dismissMessage = await page.evaluate(() => window.__testConfirmMessages.at(-1) || '');
  expect(dismissMessage).toContain('Ungespeicherte Änderungen verwerfen');
  await expect(modal.getByRole('heading', { name: 'Zahlung erfassen' })).toBeVisible();

  await page.evaluate(() => {
    window.confirm = (message) => {
      window.__testConfirmMessages.push(String(message));
      return true;
    };
  });

  await closeButton.click();
  await expect(modal).toHaveClass(/hidden/);
  const confirmMessages = await page.evaluate(() => window.__testConfirmMessages);
  expect(confirmMessages).toHaveLength(2);
  expect(confirmMessages[1]).toContain('Ungespeicherte Änderungen verwerfen');
  await expect(quick).toBeFocused();
});
