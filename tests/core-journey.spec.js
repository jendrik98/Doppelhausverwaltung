const { test, expect } = require('@playwright/test');
const { runtimeGuard, openApp, top, section, currentPeriodYear, addUnit } = require('./helpers');

async function buildCoreData(page) {
  const y = await currentPeriodYear(page);
  const takeover = `${y}-09-01`, predecessor = `${y}-08-31`, end = `${y}-12-31`;

  await top(page, 'Haus');
  await page.getByRole('button', { name: 'Objektdaten bearbeiten' }).click();
  await page.getByLabel('Objektname').fill('E2E Premium Testobjekt');
  await page.getByLabel('Adresse', { exact: true }).fill('Musterweg 10, 12345 Beispielstadt');
  await page.getByLabel('Gesamtwohnfläche m²').fill('200');
  await page.getByLabel('Baujahr Stammgebäude').fill('1965');
  await page.getByLabel('Abrechnung übernommen am').fill(takeover);
  await page.getByLabel('Voreigentümer rechnet bis').fill(predecessor);
  await page.getByLabel('Absender / Vermieter').fill('Test Vermieter');
  await page.getByLabel('Absenderadresse').fill('Musterweg 10');
  await page.getByRole('button', { name: 'Objektdaten speichern' }).click();
  await expect(page.locator('#billingPeriodPreview')).toContainText(new RegExp(`0?1\\.0?9\\.${y}`));
  await expect(page.locator('#billingPeriodPreview')).toContainText(new RegExp(`31\\.12\\.${y}`));

  await top(page, 'Haus');
  await page.getByRole('button', { name: 'Einheiten bearbeiten' }).click();
  await addUnit(page, { name: 'Eigennutzung Test', type: 'owner', area: 100, year: 1980, part: 'Anbau', persons: 3, from: takeover });
  await addUnit(page, { name: 'Mietwohnung Test', type: 'rental', area: 100, year: 1965, part: 'Stammgebäude', persons: 2, from: takeover });

  await top(page, 'Vermietung');
  await page.getByRole('button', { name: 'Mietvertrag anlegen' }).click();
  await page.getByLabel('Mieter/in – Name').fill('Testperson');
  await page.getByLabel('Korrespondenzadresse').fill('Musterweg 10');
  await page.getByLabel('Vertragsbeginn').fill(takeover);
  await page.getByLabel('Kaltmiete pro Monat (€)').fill('500');
  await page.getByLabel('Betriebskostenvorauszahlung pro Monat (€)').fill('150');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  const leaseOverview = page.locator('#workspaceBody .lease-overview-card');
  await expect(leaseOverview).toContainText('Testperson');
  await expect(leaseOverview).toContainText('500,00 € / Monat');
  await expect(leaseOverview).toContainText('150,00 € / Monat');

  await top(page, 'Haus');
  await section(page, 'costs');
  await page.getByRole('button', { name: 'Kostenquellen' }).click();
  await page.getByRole('button', { name: 'Kostenquelle / Vertrag hinzufügen' }).click();
  await page.getByLabel('Bezeichnung / Anbieter').fill('Kommunalabgaben Test');
  await page.getByLabel('Kategorie').selectOption('rainwater');
  await page.getByLabel('Betrag (€)').fill('90');
  await page.getByLabel('Intervall').selectOption('once');
  await page.getByLabel('Leistungszeitraum von').fill(takeover);
  await page.getByLabel('Leistungszeitraum bis').fill(`${y}-12-31`);
  await page.getByLabel('Zuordnung').selectOption('house');
  await page.getByLabel('Umlageregel').selectOption('area');
  await page.getByLabel('Fälligkeiten').fill(`${y}-11-15`);
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Kommunalabgaben Test' })).toBeVisible();

  await section(page, 'costs');
  await page.getByRole('button', { name: 'Kostenpositionen' }).click();
  await expect(page.getByRole('heading', { name: 'Kommunalabgaben Test' })).toBeVisible();
  await expect(page.getByText(/gesamtes Haus · Wohnfläche/)).toBeVisible();

  return { y, takeover, predecessor, end };
}

async function addPayment(page, { date, direction, label, amount }) {
  await page.getByRole('button', { name: 'Buchung hinzufügen' }).click();

  const modal = page.locator('#modal');
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('heading', { name: 'Zahlung erfassen' })).toBeVisible();

  const dateInput = modal.locator('input[name="date"]');
  const directionSelect = modal.locator('select[name="direction"]');
  const labelInput = modal.locator('input[name="label"]');
  const amountInput = modal.locator('input[name="amount"]');

  // modal() setzt den Fokus absichtlich leicht verzögert auf das erste Feld.
  // Erst danach mit dem Ausfüllen beginnen, damit kein Fokuswechsel mitten
  // in einer Playwright-fill()-Aktion liegt.
  await expect(dateInput).toBeFocused();

  await dateInput.fill(date);
  await expect(dateInput).toHaveValue(date);

  await directionSelect.selectOption(direction);
  await expect(directionSelect).toHaveValue(direction);

  await labelInput.fill(label);
  await expect(labelInput).toHaveValue(label);

  await amountInput.fill(String(amount));
  await expect(amountInput).toHaveValue(String(amount));

  await modal.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(modal).toHaveClass(/hidden/);
}

test('vollständige Kernreise: Stammdaten → Kosten → Zahlung → Abrechnung → Persistenz', async ({ page }) => {
  const guard = runtimeGuard(page);
  await openApp(page);
  const dates = await buildCoreData(page);

  await top(page, 'Finanzen');
  await section(page, 'payments');
  await page.getByRole('button', { name: 'Zahlungen & Kontoimport' }).click();

  await addPayment(page, {
    date: `${dates.y}-11-15`,
    direction: 'outflow',
    label: 'Kommunalabgaben Test',
    amount: 90
  });

  const outflowBooking = page.locator('#workspaceBody .item').filter({ hasText: 'Kommunalabgaben Test' }).first();
  await expect(outflowBooking).toBeVisible();
  await expect(outflowBooking).toContainText('90,00 €');

  await addPayment(page, {
    date: `${dates.y}-11-15`,
    direction: 'income',
    label: 'Miete Testperson',
    amount: 650
  });

  const rentBooking = page.locator('#workspaceBody .item').filter({ hasText: 'Miete Testperson' }).first();
  await expect(rentBooking).toBeVisible();
  await expect(rentBooking).toContainText('650,00 €');
  await expect(rentBooking).toContainText('Mietzahlung wahrscheinlich');

  const rentCountCard = page.locator('#workspaceBody article.card').filter({ hasText: 'erkannte Mietzahlungen' });
  await expect(rentCountCard).toContainText('1');

  await section(page, 'payments');
  await page.getByRole('button', { name: 'Zahlungen zuordnen' }).click();
  await expect(page.getByText('Plausible Vorschläge')).toBeVisible();

  await top(page, 'Vermietung');
  await section(page, 'billing');
  await expect(page.getByRole('heading', { name: new RegExp(`0?1\\.0?9\\.${dates.y}.*31\\.12\\.${dates.y}`) })).toBeVisible();
  await expect(page.getByText('Abschlussprüfung')).toBeVisible();
  const waterStep = page.getByRole('button').filter({ hasText: 'Verbrauchsdaten vollständig' });
  if (await waterStep.count()) {
    await waterStep.click();
    await expect(page).toHaveURL(/#rental\/water$/);
  }

  await page.reload({ waitUntil: 'domcontentloaded' });
  await top(page, 'Haus');
  await page.getByRole('button', { name: 'Objektdaten bearbeiten' }).click();
  await expect(page.getByLabel('Objektname')).toHaveValue('E2E Premium Testobjekt');
  await expect(page.getByLabel('Gesamtwohnfläche m²')).toHaveValue('200');

  guard.assertClean();
});

test('Erinnerung + ICS-Export nutzt echte gespeicherte Fälligkeiten', async ({ page }) => {
  await openApp(page);
  const dates = await buildCoreData(page);

  await top(page, 'Finanzen');
  await expect(page.getByText('Fälligkeit: Kommunalabgaben Test')).toBeVisible();
  await expect(page.getByText(`15.11.${dates.y}`)).toBeVisible();

  const remindersOverview = page.locator('#workspaceBody .embedded-overview-card').filter({ hasText: 'Erinnerungen' });
  await remindersOverview.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await page.getByLabel('Titel').fill('E2E eigener Termin');
  await page.getByLabel('Fällig am').fill(`${dates.y + 1}-02-10`);
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByText('E2E eigener Termin')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Kalender exportieren' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Mietverwaltung_Erinnerungen.ics');
  const text = require('fs').readFileSync(await download.path(), 'utf8');
  expect(text).toContain('Fälligkeit: Kommunalabgaben Test');
  expect(text).toContain('E2E eigener Termin');
});
