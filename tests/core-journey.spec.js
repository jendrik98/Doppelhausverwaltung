const { test, expect } = require('@playwright/test');
const { runtimeGuard, openApp, top, section, currentPeriodYear, addUnit } = require('./helpers');

async function buildCoreData(page) {
  const y = await currentPeriodYear(page);
  const takeover = `${y}-09-01`, predecessor = `${y}-08-31`, end = `${y + 1}-03-31`;

  await top(page, 'Haus');
  await section(page, 'object');
  await page.getByRole('button', { name: 'Objektdaten bearbeiten' }).click();
  await page.getByLabel('Objektname').fill('E2E Premium Testobjekt');
  await page.getByLabel('Adresse').fill('Musterweg 10, 12345 Beispielstadt');
  await page.getByLabel('Gesamtwohnfläche m²').fill('200');
  await page.getByLabel('Baujahr Stammgebäude').fill('1965');
  await page.getByLabel('Abrechnung übernommen am').fill(takeover);
  await page.getByLabel('Voreigentümer rechnet bis').fill(predecessor);
  await page.getByLabel('Absender / Vermieter').fill('Test Vermieter');
  await page.getByLabel('Absenderadresse').fill('Musterweg 10');
  await page.getByRole('button', { name: 'Objektdaten speichern' }).click();
  await expect(page.locator('#billingPeriodPreview')).toContainText(`01.09.${y}`);
  await expect(page.locator('#billingPeriodPreview')).toContainText(`31.03.${y + 1}`);

  await section(page, 'object');
  await page.getByRole('button', { name: 'Einheiten verwalten' }).click();
  await addUnit(page, { name: 'Eigennutzung Test', type: 'owner', area: 100, year: 1980, part: 'Anbau', persons: 3, from: takeover });
  await addUnit(page, { name: 'Mietwohnung Test', type: 'rental', area: 100, year: 1965, part: 'Stammgebäude', persons: 2, from: takeover });

  await top(page, 'Vermietung');
  await section(page, 'lease');
  await page.getByRole('button', { name: 'Mietvertrag anlegen' }).click();
  await page.getByLabel('Mieter/in – Name').fill('Testperson');
  await page.getByLabel('Korrespondenzadresse').fill('Musterweg 10');
  await page.getByLabel('Vertragsbeginn').fill(takeover);
  await page.getByLabel('Kaltmiete pro Monat (€)').fill('500');
  await page.getByLabel('Betriebskostenvorauszahlung pro Monat (€)').fill('150');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByText('Kaltmiete 500,00')).toBeVisible();

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
  await expect(page.getByText('gesamtes Haus')).toBeVisible();
  await expect(page.getByText('Wohnfläche')).toBeVisible();

  return { y, takeover, predecessor, end };
}

test('vollständige Kernreise: Stammdaten → Kosten → Zahlung → Abrechnung → Persistenz', async ({ page }) => {
  const guard = runtimeGuard(page);
  await openApp(page);
  const dates = await buildCoreData(page);

  await top(page, 'Finanzen');
  await section(page, 'payments');
  await page.getByRole('button', { name: 'Zahlungen & Kontoimport' }).click();
  await page.getByRole('button', { name: 'Buchung hinzufügen' }).click();
  await page.getByLabel('Datum').fill(`${dates.y}-11-15`);
  await page.getByLabel('Art').selectOption('outflow');
  await page.getByLabel('Bezeichnung').fill('Kommunalabgaben Test');
  await page.getByLabel('Betrag €').fill('90');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByText('Kommunalabgaben Test')).toBeVisible();

  await page.getByRole('button', { name: 'Buchung hinzufügen' }).click();
  await page.getByLabel('Art').selectOption('income');
  await page.getByLabel('Bezeichnung').fill('Miete Testperson');
  await page.getByLabel('Betrag €').fill('650');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByText(/Mietzahlung wahrscheinlich/)).toBeVisible();

  await section(page, 'payments');
  await page.getByRole('button', { name: 'Zahlungen zuordnen' }).click();
  await expect(page.getByText('Plausible Vorschläge')).toBeVisible();

  await top(page, 'Vermietung');
  await section(page, 'billing');
  await expect(page.getByRole('heading', { name: new RegExp(`01\\.09\\.${dates.y}.*31\\.03\\.${dates.y + 1}`) })).toBeVisible();
  await expect(page.getByText('Abschlussprüfung')).toBeVisible();
  const waterStep = page.getByRole('button').filter({ hasText: 'Verbrauchsdaten vollständig' });
  if (await waterStep.count()) {
    await waterStep.click();
    await expect(page).toHaveURL(/#rental\/water$/);
  }

  await page.reload({ waitUntil: 'domcontentloaded' });
  await top(page, 'Haus');
  await section(page, 'object');
  await page.getByRole('button', { name: 'Objektdaten bearbeiten' }).click();
  await expect(page.getByLabel('Objektname')).toHaveValue('E2E Premium Testobjekt');
  await expect(page.getByLabel('Gesamtwohnfläche m²')).toHaveValue('200');
  await page.getByRole('button', { name: 'Schließen' }).click();

  guard.assertClean();
});

test('Erinnerung + ICS-Export nutzt echte gespeicherte Fälligkeiten', async ({ page }) => {
  await openApp(page);
  const dates = await buildCoreData(page);

  await top(page, 'Finanzen');
  await section(page, 'tasks');
  await expect(page.getByText('Fälligkeit: Kommunalabgaben Test')).toBeVisible();
  await expect(page.getByText(`15.11.${dates.y}`)).toBeVisible();

  await page.getByRole('button', { name: 'Erinnerung hinzufügen' }).click();
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
