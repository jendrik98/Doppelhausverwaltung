const { test, expect } = require('@playwright/test');

test('B2 migriert State atomar in gebäudeisolierte IndexedDB-Projektionen', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#app')).toBeVisible();

  const fixture = {
    schemaVersion: 14,
    meta: { primaryPortfolioId: 'portfolio-1', primaryBuildingId: 'building-a', revision: 11 },
    property: { name: 'Haus A', address: 'A-Straße 1', totalArea: 180, year: '1990' },
    portfolios: [{ id: 'portfolio-1', name: 'Privatbestand', kind: 'private' }],
    buildings: [
      { id: 'building-a', portfolioId: 'portfolio-1', name: 'Haus A' },
      { id: 'building-b', portfolioId: 'portfolio-1', name: 'Haus B' }
    ],
    units: [
      { id: 'unit-a', buildingId: 'building-a', type: 'rental', name: 'A 1' },
      { id: 'unit-b', buildingId: 'building-b', type: 'rental', name: 'B 1' }
    ],
    leases: [
      { id: 'lease-a', unitId: 'unit-a', buildingId: 'building-a', rent: 700, advance: 100 },
      { id: 'lease-b', unitId: 'unit-b', buildingId: 'building-b', rent: 800, advance: 120 }
    ]
  };

  await page.evaluate(async (state) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('mietverwaltung-v6', 3);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const stores = ['state', 'portfolios', 'buildings', 'units', 'tenancies', 'repositoryMeta'];
      const tx = db.transaction(stores, 'readwrite');
      tx.objectStore('state').put({ id: 'main', data: state });
      for (const name of stores.slice(1)) tx.objectStore(name).clear();
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  }, fixture);

  await page.reload();
  await expect(page.locator('#app')).toBeVisible();

  const result = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('mietverwaltung-v6', 3);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const read = (request) => new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction(['state', 'buildings', 'units', 'tenancies', 'repositoryMeta'], 'readonly');
    const requests = [
      tx.objectStore('state').get('main'),
      tx.objectStore('buildings').getAll(),
      tx.objectStore('units').index('buildingId').getAll('building-a'),
      tx.objectStore('units').index('buildingId').getAll('building-b'),
      tx.objectStore('tenancies').index('buildingId').getAll('building-a'),
      tx.objectStore('tenancies').index('buildingId').getAll('building-b'),
      tx.objectStore('repositoryMeta').get('portfolio-projection')
    ];
    const [snapshot, buildings, unitsA, unitsB, leasesA, leasesB, meta] = await Promise.all(requests.map(read));
    db.close();
    return {
      schemaVersion: snapshot?.data?.schemaVersion,
      portfolioModelVersion: snapshot?.data?.meta?.portfolioModelVersion,
      buildings: buildings.map((item) => item.id).sort(),
      unitsA: unitsA.map((item) => item.id).sort(),
      unitsB: unitsB.map((item) => item.id).sort(),
      leasesA: leasesA.map((item) => item.id).sort(),
      leasesB: leasesB.map((item) => item.id).sort(),
      meta
    };
  });

  expect(result.schemaVersion).toBe(15);
  expect(result.portfolioModelVersion).toBe(2);
  expect(result.buildings).toEqual(['building-a', 'building-b']);
  expect(result.unitsA).toEqual(['unit-a']);
  expect(result.unitsB).toEqual(['unit-b']);
  expect(result.leasesA).toEqual(['lease-a']);
  expect(result.leasesB).toEqual(['lease-b']);
  expect(result.meta?.repositoryVersion).toBe(1);
  expect(result.meta?.counts).toEqual({ portfolios: 1, buildings: 2, units: 2, tenancies: 2 });
});
