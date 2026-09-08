const { test, expect } = require('@playwright/test');
const { runtimeGuard, openApp, top } = require('./helpers');

test('Phase 2: Kalenderjahr, 31.03-Zielfrist, zentrale Validierung und Toast-Feedback', async ({ page }) => {
  const guard = runtimeGuard(page);
  await page.clock.setFixedTime(new Date('2026-10-15T12:00:00+02:00'));
  await openApp(page);

  await top(page, 'Haus');
  await page.getByRole('button', { name: 'Objektdaten bearbeiten' }).click();

  const form = page.locator('#propertyForm');
  await form.getByLabel('Objektname').fill('Phase-2-Testhaus');
  await form.getByLabel('Adresse', { exact: true }).fill('Kalenderweg 1');
  await form.getByLabel('Gesamtwohnfläche m²').fill('200');
  await form.getByLabel('Baujahr Stammgebäude').fill('1976');
  await form.getByLabel('Abrechnung übernommen am').fill('2026-09-01');
  await form.getByLabel('Voreigentümer rechnet bis').fill('2026-08-31');

  await expect(page.locator('#billingPeriodPreview')).toContainText(/1\.9\.2026\s*–\s*31\.12\.2026/);
  await expect(page.locator('#billingPeriodPreview')).toContainText(/Endabrechnung intern bis 31\.0?3\.2027/);
  await expect(page.locator('#billingPeriodPreview')).toContainText(/gesetzliche Abrechnungsfrist 31\.12\.2027/);

  // Harte Validierung: keine beliebige IBAN mehr speicherbar.
  await form.getByLabel('IBAN für Nachzahlungen').fill('test');
  await form.getByRole('button', { name: 'Objektdaten speichern' }).click();
  await expect(form.getByLabel('IBAN für Nachzahlungen')).toHaveAttribute('aria-invalid', 'true');
  await expect(form.locator('.field-error')).toContainText(/IBAN/i);
  await expect(page.locator('#app-feedback-region')).toContainText('Bitte markierte Eingaben prüfen');

  // Ungewöhnlich, aber möglich: bewusste Bestätigung statt stilles Speichern.
  await form.getByLabel('IBAN für Nachzahlungen').fill('DE89370400440532013000');
  await form.getByLabel('Gesamtwohnfläche m²').fill('1500');
  const warning = page.waitForEvent('dialog');
  const warningClick = form.getByRole('button', { name: 'Objektdaten speichern' }).click();
  const dialog = await warning;
  expect(dialog.message()).toContain('Ungewöhnliche Eingabe erkannt');
  await dialog.dismiss();
  await warningClick;
  await expect(form).toBeVisible();

  // Gültige Daten werden gespeichert und sichtbar bestätigt.
  await form.getByLabel('Gesamtwohnfläche m²').fill('200');
  await form.getByRole('button', { name: 'Objektdaten speichern' }).click();
  await expect(page.locator('#app-feedback-region')).toContainText('Objektdaten geändert');
  await expect(page.locator('#workspaceBody')).toContainText(/0?1\.0?9\.2026/);
  await expect(page.locator('#workspaceBody')).toContainText('31.12.2026');

  guard.assertClean();
});
