const { test, expect } = require('@playwright/test');
const { runtimeGuard, openApp } = require('./helpers');

test('D wechselt Gebäude ohne Datenvermischung und persistiert neue Zahlungen im aktiven Gebäude', async ({ page }) => {
  const guard = runtimeGuard(page);
  await openApp(page);

  const fixture = {
    schemaVersion: 15,
    meta: { primaryPortfolioId: 'portfolio-1', primaryBuildingId: 'building-a', revision: 12 },
    property: { name: 'Haus A', address: 'A-Straße 1', totalArea: 180, year: '1990' },
    finance: { repayment: 900, fixed: 0 },
    correspondence: { landlordName: 'Test' },
    portfolios: [{ id: 'portfolio-1', name: 'Privatbestand', kind: 'private' }],
    buildings: [
      { id: 'building-a', portfolioId: 'portfolio-1', name: 'Haus A', address: 'A-Straße 1', totalArea: 180, year: '1990' },
      { id: 'building-b', portfolioId: 'portfolio-1', name: 'Haus B', address: 'B-Straße 2', totalArea: 210, year: '2001', finance: { repayment: 700, fixed: 0 } }
    ],
    units: [
      { id: 'unit-a', buildingId: 'building-a', type: 'rental', name: 'Wohnung A', area: 80 },
      { id: 'unit-b', buildingId: 'building-b', type: 'rental', name: 'Wohnung B', area: 90 }
    ],
    leases: [
      { id: 'lease-a', unitId: 'unit-a', buildingId: 'building-a', tenantName: 'Mieter A', rent: 700, advance: 100 },
      { id: 'lease-b', unitId: 'unit-b', buildingId: 'building-b', tenantName: 'Mieter B', rent: 800, advance: 120 }
    ],
    sources: [
      { id: 'source-a', buildingId: 'building-a', name: 'Quelle A', dueDates: [] },
      { id: 'source-b', buildingId: 'building-b', name: 'Quelle B', dueDates: [] }
    ],
    costPositions: [],
    meters: [],
    waterSettlements: [],
    tasks: [],
    payments: [
      { id: 'payment-a', buildingId: 'building-a', date: '2026-09-01', direction: 'income', label: 'Nur A', amount: 700 },
      { id: 'payment-b', buildingId: 'building-b', date: '2026-09-01', direction: 'income', label: 'Nur B', amount: 800 }
    ],
    billingWorkflows: [],
    billingSnapshots: [],
    containers: [],
    water: [],
    audit: []
  };

  const documents = [
    { id: 'doc-a', buildingId: 'building-a', name: 'Dokument A', label: 'Dokument A', type: 'application/pdf', size: 100, created: '2026-09-01T10:00:00.000Z', pages: [], analysis: { status: 'done', acceptedAt: '2026-09-01T10:00:00.000Z', fields: {} } },
    { id: 'doc-b', buildingId: 'building-b', name: 'Dokument B', label: 'Dokument B', type: 'application/pdf', size: 100, created: '2026-09-01T10:00:00.000Z', pages: [], analysis: { status: 'done', acceptedAt: '2026-09-01T10:00:00.000Z', fields: {} } },
    { id: 'doc-legacy', name: 'Legacy Dokument', label: 'Legacy Dokument', type: 'application/pdf', size: 100, created: '2026-09-01T10:00:00.000Z', pages: [], analysis: { status: 'done', acceptedAt: '2026-09-01T10:00:00.000Z', fields: {} } }
  ];

  await page.evaluate(async ({ state, documents }) => {
    localStorage.removeItem('mietverwaltung-active-building-v1');
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('mietverwaltung-v6', 3);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['state', 'docs'], 'readwrite');
      tx.objectStore('state').put({ id: 'main', data: state });
      const docs = tx.objectStore('docs');
      docs.clear();
      for (const document of documents) docs.put(document);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  }, { state: fixture, documents });

  await page.reload();
  await expect(page.locator('#buildingSwitchWrap')).toBeVisible();
  await expect(page.locator('#buildingSelect')).toHaveValue('building-a');
  await expect(page.locator('#buildingSelect option')).toHaveCount(2);
  await expect(page.locator('.experience-hero .muted')).toContainText('Haus A');

  await openApp(page, '#data/documents');
  await expect(page.locator('#workspaceBody')).toContainText('Dokument A');
  await expect(page.locator('#workspaceBody')).toContainText('Legacy Dokument');
  await expect(page.locator('#workspaceBody')).not.toContainText('Dokument B');

  await page.locator('#buildingSelect').selectOption('building-b');
  await expect(page.locator('#buildingSelect')).toHaveValue('building-b');
  await expect(page.locator('#workspaceBody')).toContainText('Dokument B');
  await expect(page.locator('#workspaceBody')).not.toContainText('Dokument A');
  await expect(page.locator('#workspaceBody')).not.toContainText('Legacy Dokument');

  // Der Docs-Store bleibt vollständig; die Isolation ist eine UI-/Runtime-Projektion.
  const storedDocumentIds = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('mietverwaltung-v6', 3);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const rows = await new Promise((resolve, reject) => {
      const request = db.transaction('docs', 'readonly').objectStore('docs').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return rows.map((item) => item.id).sort();
  });
  expect(storedDocumentIds).toEqual(['doc-a', 'doc-b', 'doc-legacy']);

  // Auch der flüchtige Suchcache darf nach dem Gebäudewechsel nichts aus A preisgeben.
  await page.locator('#searchBtn').click();
  await page.locator('#searchInput').fill('Dokument A');
  await expect(page.locator('#searchResults')).not.toContainText('Dokument A');
  await page.locator('#searchInput').fill('Dokument B');
  await expect(page.locator('#searchResults')).toContainText('Dokument B');
  await page.locator('#searchClose').click();

  await openApp(page, '#home');
  await expect(page.locator('#buildingSelect')).toHaveValue('building-b');
  await expect(page.locator('.experience-hero .muted')).toContainText('Haus B');
  await expect(page.locator('.metric-card').filter({ hasText: 'Kaltmiete' }).locator('strong').first()).toContainText('800');

  await openApp(page, '#owner/payments');
  await expect(page.locator('#buildingSelect')).toHaveValue('building-b');
  await page.getByRole('button', { name: 'Schnell hinzufügen' }).click();
  await page.locator('#quickOverlay').getByRole('button', { name: /^Zahlung\b/ }).click();
  await page.getByLabel('Bezeichnung').fill('D Zahlung B');
  await page.getByLabel('Betrag €').fill('33');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.locator('#modal')).toHaveClass(/hidden/);

  const saved = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('mietverwaltung-v6', 3);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const record = await new Promise((resolve, reject) => {
      const tx = db.transaction('state', 'readonly');
      const request = tx.objectStore('state').get('main');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return record.data;
  });

  const created = saved.payments.find((item) => item.label === 'D Zahlung B');
  expect(created).toBeTruthy();
  expect(created.buildingId).toBe('building-b');
  expect(saved.payments.find((item) => item.id === 'payment-a').buildingId).toBe('building-a');
  expect(saved.meta.primaryBuildingId).toBe('building-a');
  expect(saved.property.name).toBe('Haus A');
  expect(saved.finance.repayment).toBe(900);
  expect(saved.buildings.find((item) => item.id === 'building-b').name).toBe('Haus B');
  expect(saved.buildings.find((item) => item.id === 'building-b').finance.repayment).toBe(700);

  await page.locator('#buildingSelect').selectOption('building-a');
  await openApp(page, '#home');
  await expect(page.locator('#buildingSelect')).toHaveValue('building-a');
  await expect(page.locator('.experience-hero .muted')).toContainText('Haus A');
  await expect(page.locator('.metric-card').filter({ hasText: 'Kaltmiete' }).locator('strong').first()).toContainText('700');
  guard.assertClean();
});

test('D verändert die Ein-Gebäude-UX nicht durch einen unnötigen Selector', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('#buildingSwitchWrap')).toBeHidden();
});
