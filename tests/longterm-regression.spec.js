const { test, expect } = require('@playwright/test');
const { runtimeGuard, openApp } = require('./helpers');

const DB = 'mietverwaltung-v6';
const STATE = 'main';

async function readState(page) {
  return page.evaluate(async ({ DB, STATE }) => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 3);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const tx = db.transaction('state', 'readonly');
    const req = tx.objectStore('state').get(STATE);
    return await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result?.data || null);
      req.onerror = () => reject(req.error);
    });
  }, { DB, STATE });
}

async function writeState(page, state) {
  await page.evaluate(async ({ DB, STATE, state }) => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 3);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const tx = db.transaction('state', 'readwrite');
    tx.objectStore('state').put({ id: STATE, data: state });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }, { DB, STATE, state });
}

function build15YearData(base) {
  const s = structuredClone(base);
  const startYear = 2027;
  const years = 15;
  const payments = [];
  const water = [];
  let totalRent = 0;
  let totalWaterCost = 0;
  let totalTenantWater = 0;

  for (let i = 0; i < years; i++) {
    const y = startYear + i;
    const monthlyRent = 650 + i * 12;
    const houseM3 = 100 + i * 3;
    const ownerM3 = 40 + i;
    const tenantM3 = houseM3 - ownerM3;
    const waterCost = +(houseM3 * (4.15 + i * 0.07)).toFixed(2);
    const tenantShare = +(waterCost * tenantM3 / houseM3).toFixed(2);

    for (let m = 1; m <= 12; m++) {
      const amount = monthlyRent;
      payments.push({
        id: `long-rent-${y}-${String(m).padStart(2,'0')}`,
        date: `${y}-${String(m).padStart(2,'0')}-03`,
        direction: 'income',
        amount,
        label: 'Miete Langzeittest',
        note: `Simulationsjahr ${i + 1}`
      });
      totalRent += amount;
    }

    water.push({
      id: `long-water-${y}`,
      period: `${y}`,
      startDate: `${y}-01-01`,
      endDate: `${y}-12-31`,
      mainStart: 1000 + i * 100,
      mainEnd: 1000 + i * 100 + houseM3,
      ownerStart: 500 + i * 40,
      ownerEnd: 500 + i * 40 + ownerM3,
      houseM3,
      ownerM3,
      tenantM3,
      totalCost: waterCost,
      tenantShare,
      meterNumber: `LW-${y}`
    });
    totalWaterCost += waterCost;
    totalTenantWater += tenantShare;
  }

  s.payments = [...(s.payments || []), ...payments];
  s.meta ||= {};
  s.meta.v17 ||= {};
  s.meta.v17.longTermStudy = {
    schema: 1,
    years,
    startYear,
    endYear: startYear + years - 1,
    paymentCount: payments.length,
    waterPeriodCount: water.length,
    totalRent: +totalRent.toFixed(2),
    totalWaterCost: +totalWaterCost.toFixed(2),
    totalTenantWater: +totalTenantWater.toFixed(2),
    water
  };
  return s;
}

test('Langzeitstudie: 15 Jahre / 180 Mieten / 15 Wasserperioden bleiben stabil', async ({ page }) => {
  test.setTimeout(60_000);
  const guard = runtimeGuard(page);
  await openApp(page);

  const base = await readState(page);
  expect(base).toBeTruthy();

  const simulated = build15YearData(base);
  await writeState(page, simulated);

  let state = await readState(page);
  const study = state.meta.v17.longTermStudy;

  expect(study.years).toBe(15);
  expect(study.startYear).toBe(2027);
  expect(study.endYear).toBe(2041);
  expect(study.paymentCount).toBe(180);
  expect(study.waterPeriodCount).toBe(15);
  expect(study.water).toHaveLength(15);

  const inserted = state.payments.filter(p => String(p.id || '').startsWith('long-rent-'));
  expect(inserted).toHaveLength(180);
  expect(new Set(inserted.map(p => p.id)).size).toBe(180);
  expect(inserted.every(p => Number(p.amount) > 0)).toBe(true);

  for (const period of study.water) {
    expect(period.houseM3).toBeGreaterThan(0);
    expect(period.ownerM3).toBeGreaterThanOrEqual(0);
    expect(period.tenantM3).toBe(period.houseM3 - period.ownerM3);
    expect(period.tenantShare).toBeGreaterThan(0);
    expect(period.tenantShare).toBeLessThan(period.totalCost);
  }

  const expectedRent = inserted.reduce((sum, p) => sum + Number(p.amount), 0);
  const expectedWater = study.water.reduce((sum, p) => sum + Number(p.totalCost), 0);
  const expectedTenantWater = study.water.reduce((sum, p) => sum + Number(p.tenantShare), 0);

  expect(study.totalRent).toBeCloseTo(expectedRent, 2);
  expect(study.totalWaterCost).toBeCloseTo(expectedWater, 2);
  expect(study.totalTenantWater).toBeCloseTo(expectedTenantWater, 2);

  // Zehn echte Seiten-Neustarts: IndexedDB muss unverändert erhalten bleiben.
  for (let i = 0; i < 10; i++) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#app')).not.toBeEmpty();
  }

  state = await readState(page);
  const after = state.meta.v17.longTermStudy;
  const afterPayments = state.payments.filter(p => String(p.id || '').startsWith('long-rent-'));

  expect(after.years).toBe(15);
  expect(after.water).toHaveLength(15);
  expect(afterPayments).toHaveLength(180);
  expect(new Set(afterPayments.map(p => p.id)).size).toBe(180);
  expect(after.totalRent).toBeCloseTo(study.totalRent, 2);
  expect(after.totalWaterCost).toBeCloseTo(study.totalWaterCost, 2);
  expect(after.totalTenantWater).toBeCloseTo(study.totalTenantWater, 2);

  guard.assertClean();
});
