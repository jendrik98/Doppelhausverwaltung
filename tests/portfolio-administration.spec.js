const { test, expect } = require('@playwright/test');
const { runtimeGuard, openApp } = require('./helpers');

test('E legt ein zweites Gebäude an, aktiviert es und hält das Primärgebäude stabil', async ({ page }) => {
  const guard = runtimeGuard(page);
  await openApp(page);

  const fixture = {
    schemaVersion: 15,
    meta: { primaryPortfolioId: 'portfolio-1', primaryBuildingId: 'building-a', revision: 3 },
    property: { name: 'Haus A', address: 'A-Straße 1', totalArea: 180, year: 1990 },
    finance: { repayment: 900, fixed: 20 },
    correspondence: { landlordName: 'Test' },
    portfolios: [{ id: 'portfolio-1', name: 'Privatbestand', kind: 'private' }],
    buildings: [{ id: 'building-a', portfolioId: 'portfolio-1', name: 'Haus A', address: 'A-Straße 1', totalArea: 180, year: 1990, finance: { repayment: 900, fixed: 20 } }],
    units: [{ id: 'unit-a', buildingId: 'building-a', type: 'rental', name: 'Wohnung A', area: 80, occupancy: [] }],
    leases: [{ id: 'lease-a', unitId: 'unit-a', buildingId: 'building-a', tenantName: 'Mieter A', rent: 700, advance: 100 }],
    sources: [], costPositions: [], meters: [], waterSettlements: [], tasks: [], payments: [], billingWorkflows: [], billingSnapshots: [], containers: [], water: [], audit: []
  };

  await page.evaluate(async (state) => {
    localStorage.removeItem('mietverwaltung-active-building-v1');
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('mietverwaltung-v6', 3);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('state', 'readwrite');
      tx.objectStore('state').put({ id: 'main', data: state });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  }, fixture);

  await page.reload();
  await expect(page.locator('#buildingSwitchWrap')).toBeHidden();
  await openApp(page, '#data/overview');
  await page.getByRole('button', { name: 'Gebäude verwalten' }).click();
  await expect(page.getByRole('heading', { name: 'Gebäude im Portfolio' })).toBeVisible();
  await page.getByRole('button', { name: 'Gebäude hinzufügen' }).click();
  await page.getByLabel('Gebäudename').fill('Haus B');
  await page.getByLabel('Adresse').fill('B-Straße 2');
  await page.getByLabel('Gesamtwohnfläche m²').fill('210');
  await page.getByLabel('Baujahr').fill('2001');
  await page.getByLabel('Abrechnung übernommen am').fill('2026-07-01');
  await page.getByLabel('Voreigentümer rechnet bis').fill('2026-06-30');
  await page.getByLabel('Hausrate € / Monat').fill('700');
  await page.getByLabel('Feste Hauskosten € / Monat').fill('12');
  await page.getByRole('button', { name: 'Gebäude anlegen' }).click();
  await expect(page.locator('#modal')).toHaveClass(/hidden/);

  await expect(page.locator('#buildingSwitchWrap')).toBeVisible();
  await expect(page.locator('#buildingSelect option')).toHaveCount(2);
  await expect(page.locator('#buildingSelect')).toHaveText(/Haus B/);
  await expect(page.locator('#buildingSelect option:checked')).toHaveText('Haus B');

  await openApp(page, '#data/units');
  await page.getByRole('button', { name: 'Einheit hinzufügen' }).click();
  await page.getByLabel('Bezeichnung').fill('Wohnung B');
  await page.getByLabel('Wohnfläche (m²)').fill('90');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.locator('#modal')).toHaveClass(/hidden/);
  await expect(page.locator('#workspaceBody')).toContainText('Wohnung B');
  await expect(page.locator('#workspaceBody')).not.toContainText('Wohnung A');

  const raw = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('mietverwaltung-v6', 3);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const record = await new Promise((resolve, reject) => {
      const request = db.transaction('state', 'readonly').objectStore('state').get('main');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return record.data;
  });

  const buildingB = raw.buildings.find((item) => item.name === 'Haus B');
  expect(buildingB).toBeTruthy();
  expect(raw.meta.primaryBuildingId).toBe('building-a');
  expect(raw.property.name).toBe('Haus A');
  expect(raw.buildings).toHaveLength(2);
  expect(raw.units.find((item) => item.name === 'Wohnung B').buildingId).toBe(buildingB.id);

  await page.locator('#buildingSelect').selectOption('building-a');
  await openApp(page, '#data/units');
  await expect(page.locator('#workspaceBody')).toContainText('Wohnung A');
  await expect(page.locator('#workspaceBody')).not.toContainText('Wohnung B');

  await openApp(page, '#data/overview');
  await page.getByRole('button', { name: 'Gebäude verwalten' }).click();
  const bCard = page.locator('.item').filter({ hasText: 'Haus B' });
  await bCard.getByRole('button', { name: 'Bearbeiten' }).click();
  await page.getByLabel('Gebäudename').fill('Haus B neu');
  await page.getByRole('button', { name: 'Gebäude speichern' }).click();
  await expect(page.locator('#modal')).toHaveClass(/hidden/);
  await expect(page.locator('#buildingSelect')).toContainText('Haus B neu');

  const rawAfter = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('mietverwaltung-v6', 3);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const record = await new Promise((resolve, reject) => {
      const request = db.transaction('state', 'readonly').objectStore('state').get('main');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return record.data;
  });
  expect(rawAfter.meta.primaryBuildingId).toBe('building-a');
  expect(rawAfter.property.name).toBe('Haus A');
  expect(rawAfter.buildings.find((item) => item.id === buildingB.id).name).toBe('Haus B neu');
  guard.assertClean();
});
