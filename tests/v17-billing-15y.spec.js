const { test, expect } = require('@playwright/test');
const { runtimeGuard, openApp, top, section } = require('./helpers');
const fs = require('fs');

const DB = 'mietverwaltung-v6';
const STATE = 'main';
const BASE_URL = process.env.E2E_BASE_URL || 'https://jendrik98.github.io/Doppelhausverwaltung/';

async function readState(page) {
  return page.evaluate(async ({ DB, STATE }) => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 2);
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
      const req = indexedDB.open(DB, 2);
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

function contextOptions() {
  return {
    baseURL: BASE_URL,
    viewport: { width: 390, height: 844 },
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'allow',
    acceptDownloads: true
  };
}

async function openBillingYear(page, year) {
  await page.clock.setFixedTime(new Date(`${year + 1}-06-15T12:00:00+02:00`));

  if (!page.url().endsWith('#rental/billing')) {
    await page.goto('./#rental/billing', {waitUntil:'domcontentloaded'});
  }
  await page.evaluate(y => sessionStorage.setItem('billingSelectedYear', String(y)), year);
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('#app')).not.toBeEmpty();
  await expect(page.locator('#billingYearSelect')).toHaveValue(String(year));
  await page.waitForTimeout(450);
}

function buildRealBillingHistory(base) {
  const s = structuredClone(base);
  const startYear = 2027;
  const years = 15;

  s.property = {
    ...(s.property || {}),
    name: 'V17 15-Jahre-Abrechnungshaus',
    address: 'Langzeitweg 15, 12345 Teststadt',
    totalArea: 200,
    year: '1965',
    billingTakeoverDate: `${startYear}-01-01`,
    predecessorBillingEnd: `${startYear - 1}-12-31`
  };
  s.correspondence = {
    ...(s.correspondence || {}),
    landlordName: 'V17 Test Vermieter',
    landlordAddress: 'Langzeitweg 15',
    iban: 'DE00123456780000000000',
    paymentReference: 'Betriebskosten',
    contact: ''
  };
  s.units = [
    {
      id: 'lt-owner-unit',
      name: 'Eigennutzung Langzeit',
      type: 'owner',
      area: 100,
      year: 1965,
      part: 'Doppelhaushälfte A',
      occupancy: [{ from: `${startYear}-01-01`, to: '', count: 2 }]
    },
    {
      id: 'lt-rental-unit',
      name: 'Mietwohnung Langzeit',
      type: 'rental',
      area: 100,
      year: 1965,
      part: 'Doppelhaushälfte B',
      occupancy: [{ from: `${startYear}-01-01`, to: '', count: 2 }]
    }
  ];
  s.leases = [{
    id: 'lt-lease',
    tenantName: 'Langzeit Testperson',
    tenantAddress: 'Langzeitweg 15',
    start: `${startYear}-01-01`,
    end: '',
    rent: 500,
    advance: 150,
    note: '15-Jahre-E2E'
  }];

  s.sources = [];
  s.costPositions = [];
  s.waterSettlements = [];
  s.containers = [];
  s.water = [];
  s.tasks = [];
  s.billingWorkflows = [];
  s.billingSnapshots = [];
  s.payments = [];
  s.audit = [];
  s.finance = { ...(s.finance || {}), repayment: 900, fixed: 0 };

  const main = {
    id: 'lt-main-meter',
    role: 'mainWater',
    name: 'Hauptwasserzähler Langzeit',
    number: 'LT-MAIN-001',
    unit: 'm³',
    readings: []
  };
  const owner = {
    id: 'lt-owner-meter',
    role: 'ownerWater',
    name: 'Zwischenzähler Eigennutzung Langzeit',
    number: 'LT-OWNER-001',
    unit: 'm³',
    readings: []
  };
  s.meters = [main, owner];

  let mainValue = 1000;
  let ownerValue = 400;
  const expected = [];

  for (let i = 0; i < years; i++) {
    const y = startYear + i;
    const periodStart = `${y}-01-01`;
    const periodEnd = `${y}-12-31`;
    const houseM3 = 100 + i * 3;
    const ownerM3 = 40 + i;
    const tenantM3 = houseM3 - ownerM3;
    const waterShare = tenantM3 / houseM3;
    const waterCost = +(520 + i * 18.75).toFixed(2);
    const insuranceCost = +(980 + i * 22.50).toFixed(2);

    const mainStartId = `lt-main-${y}-start`;
    const mainEndId = `lt-main-${y}-end`;
    const ownerStartId = `lt-owner-${y}-start`;
    const ownerEndId = `lt-owner-${y}-end`;

    main.readings.push(
      { id: mainStartId, date: periodStart, value: mainValue, origin: 'e2e', synthetic: false },
      { id: mainEndId, date: periodEnd, value: mainValue + houseM3, origin: 'e2e', synthetic: false }
    );
    owner.readings.push(
      { id: ownerStartId, date: periodStart, value: ownerValue, origin: 'e2e', synthetic: false },
      { id: ownerEndId, date: periodEnd, value: ownerValue + ownerM3, origin: 'e2e', synthetic: false }
    );

    const waterPositionId = `lt-water-cost-${y}`;
    const insurancePositionId = `lt-insurance-cost-${y}`;

    s.waterSettlements.push({
      id: `lt-water-settlement-${y}`,
      periodYear: y,
      mainMeterId: main.id,
      ownerMeterId: owner.id,
      mainStartReadingId: mainStartId,
      mainEndReadingId: mainEndId,
      ownerStartReadingId: ownerStartId,
      ownerEndReadingId: ownerEndId
    });

    s.costPositions.push(
      {
        id: waterPositionId,
        sourceId: '',
        documentId: '',
        label: `Kaltwasser / Kanal ${y}/${y + 1}`,
        category: 'water',
        amount: waterCost,
        interval: 'once',
        serviceStart: periodStart,
        serviceEnd: periodEnd,
        assignment: 'house',
        agreement: 'auto',
        confirmed: true,
        origin: 'manual',
        details: { quantity: houseM3, unit: 'm³', rate: waterCost / houseM3 },
        decisionHistory: []
      },
      {
        id: insurancePositionId,
        sourceId: '',
        documentId: '',
        label: `Gebäudeversicherung ${y}/${y + 1}`,
        category: 'insurance',
        amount: insuranceCost,
        interval: 'once',
        serviceStart: periodStart,
        serviceEnd: periodEnd,
        assignment: 'house',
        agreement: 'area',
        confirmed: true,
        origin: 'manual',
        details: {},
        decisionHistory: []
      }
    );

    // 12 reale monatliche Mietzahlungen je Kalenderjahr (Januar bis Dezember).
    for (let offset = 0; offset < 12; offset++) {
      const d = new Date(Date.UTC(y, offset, 3));
      const yy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      s.payments.push({
        id: `lt-rent-${y}-${offset + 1}`,
        date: `${yy}-${mm}-03`,
        direction: 'income',
        amount: 650,
        label: 'Miete Langzeit Testperson',
        note: `Abrechnungsperiode ${y}/${y + 1}`
      });
    }

    // Reale Ausgaben passend zu den beiden Kostenpositionen.
    s.payments.push(
      {
        id: `lt-water-payment-${y}`,
        date: `${y + 1}-03-15`,
        direction: 'outflow',
        amount: waterCost,
        label: `Wasser/Kanal ${y}/${y + 1}`,
        positionId: waterPositionId
      },
      {
        id: `lt-insurance-payment-${y}`,
        date: `${y}-07-15`,
        direction: 'outflow',
        amount: insuranceCost,
        label: `Gebäudeversicherung ${y}/${y + 1}`,
        positionId: insurancePositionId
      }
    );

    const waterTenant = waterCost * waterShare;
    const insuranceTenant = insuranceCost * 0.5;
    const tenantCosts = waterTenant + insuranceTenant;
    const advances = 12 * 150;

    expected.push({
      y,
      periodStart,
      periodEnd,
      houseM3,
      ownerM3,
      tenantM3,
      waterShare,
      waterCost,
      insuranceCost,
      waterPositionId,
      insurancePositionId,
      waterTenant,
      insuranceTenant,
      tenantCosts,
      advances,
      result: tenantCosts - advances
    });

    mainValue += houseM3;
    ownerValue += ownerM3;
  }

  s.meta ||= {};
  s.meta.v17 ||= {};
  s.meta.v17.billingLongTermStudy = {
    schema: 2,
    years,
    startYear,
    endYear: startYear + years - 1,
    expectedSnapshotCount: years,
    createdFor: 'Playwright E2E'
  };

  return { state: s, expected };
}

test('V17 Langzeit-Abrechnungsreise: 15 echte Jahre → Wasser → Umlage → Abschluss → PDF → Backup', async ({ browser }) => {
  test.setTimeout(120_000);
  fs.mkdirSync('test-results', { recursive: true });

  const context = await browser.newContext(contextOptions());
  const page = await context.newPage();
  const guard = runtimeGuard(page);

  // Nur Datum/Uhrzeit einfrieren; normale Timer der Anwendung laufen weiter.
  await page.clock.setFixedTime(new Date('2028-06-15T12:00:00+02:00'));
  await openApp(page);
  // V17-Migration/Hotfix vollständig auslaufen lassen, damit kein paralleler DB-Write die Seed-Daten überschreibt.
  await page.waitForTimeout(500);

  const base = await readState(page);
  expect(base).toBeTruthy();

  const built = buildRealBillingHistory(base);
  await writeState(page, built.state);

  // Beweise zunächst, dass der komplette Seed wirklich persistent gespeichert wurde.
  const persistedSeed = await readState(page);
  expect(persistedSeed.property.name).toBe('V17 15-Jahre-Abrechnungshaus');
  expect(persistedSeed.waterSettlements).toHaveLength(15);
  expect(persistedSeed.costPositions).toHaveLength(30);
  expect(persistedSeed.payments).toHaveLength(210);

  // 15 Perioden werden nacheinander durch den echten UI-Abschlussweg eingefroren.
  // Jeder Durchlauf lädt den gespeicherten IndexedDB-State neu in die Anwendung.
  for (const e of built.expected) {
    await openBillingYear(page, e.y);

    const body = page.locator('#workspaceBody');
    await expect(body).toContainText('Abschlussprüfung');

    const freeze = page.getByRole('button', { name: 'Final prüfen & einfrieren' });
    if (await freeze.isDisabled()) {
      const ui = (await body.innerText()).replace(/\s+/g, ' ').slice(0, 1800);
      throw new Error(`Periode ${e.y}/${e.y + 1} ist nicht abschließbar. Sichtbare Abschlussprüfung: ${ui}`);
    }
    await expect(freeze).toBeEnabled();

    await freeze.click();
    const modal = page.locator('#modal');
    await expect(modal.getByRole('heading', { name: 'Abrechnung finalisieren' })).toBeVisible();
    await modal.locator('#billingConfirm').check();
    await modal.getByRole('button', { name: 'Abrechnung einfrieren' }).click();
    await expect(body).toContainText('Abrechnung eingefroren');

    const saved = await readState(page);
    const snap = saved.billingSnapshots.find(x => Number(x.periodYear) === e.y);
    expect(snap, `Snapshot ${e.y}/${e.y + 1} fehlt`).toBeTruthy();
    expect(snap.frozen).toBe(true);
    expect(snap.period.start).toBe(e.periodStart);
    expect(snap.period.end).toBe(e.periodEnd);
    expect(snap.integrityHash).toMatch(/^[a-f0-9]{64}$/);

    const waterEvent = snap.events.find(x => x.positionId === e.waterPositionId);
    const insuranceEvent = snap.events.find(x => x.positionId === e.insurancePositionId);
    expect(waterEvent).toBeTruthy();
    expect(insuranceEvent).toBeTruthy();

    // Beweist, dass die echte App den Wasserverbrauch für die Umlage benutzt.
    expect(waterEvent.decision.rule).toBe('consumption');
    expect(waterEvent.tenantShare).toBeCloseTo(e.waterShare, 8);
    expect(waterEvent.tenantAmount).toBeCloseTo(e.waterTenant, 6);

    // Parallel wird ein zweiter Umlageschlüssel (Wohnfläche 50/50) geprüft.
    expect(insuranceEvent.decision.rule).toBe('area');
    expect(insuranceEvent.tenantShare).toBeCloseTo(0.5, 8);
    expect(insuranceEvent.tenantAmount).toBeCloseTo(e.insuranceTenant, 6);

    expect(snap.tenantCosts).toBeCloseTo(e.tenantCosts, 6);
    expect(snap.advances).toBeCloseTo(e.advances, 6);
    expect(snap.result).toBeCloseTo(e.result, 6);
    expect(snap.unresolved).toHaveLength(0);
  }

  let finalState = await readState(page);
  expect(finalState.billingSnapshots).toHaveLength(15);
  expect(new Set(finalState.billingSnapshots.map(x => x.periodYear)).size).toBe(15);
  expect(new Set(finalState.billingSnapshots.map(x => x.integrityHash)).size).toBe(15);

  // Der letzte eingefrorene Stand muss als echtes PDF exportierbar sein.
  await openBillingYear(page, 2041);
  await expect(page.getByText('Abrechnung eingefroren')).toBeVisible();

  const pdfPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF erstellen' }).click();
  const pdf = await pdfPromise;
  expect(pdf.suggestedFilename()).toBe('Betriebskostenabrechnung_2041.pdf');
  const pdfPath = 'test-results/v17-15y-billing-2041.pdf';
  await pdf.saveAs(pdfPath);
  const pdfBytes = fs.readFileSync(pdfPath);
  expect(pdfBytes.length).toBeGreaterThan(5000);
  expect(pdfBytes.subarray(0, 4).toString('ascii')).toBe('%PDF');

  // Den kompletten 15-Jahre-Datenbestand verschlüsselt sichern.
  await top(page, 'Mehr');
  await section(page, 'protection');
  await page.getByRole('button', { name: 'Datensicherung' }).click();
  await page.locator('#backupPw').fill('V17-Langzeit-Backup-2041!');
  const backupPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Sicherung erstellen' }).click();
  const backup = await backupPromise;
  const backupPath = 'test-results/v17-15y-full-backup.json';
  await backup.saveAs(backupPath);
  const wrapper = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  expect(wrapper.schema).toBe('mietverwaltung-encrypted-v1');

  guard.assertClean();
  await context.close();

  // Wiederherstellung in einem komplett frischen Browserkontext.
  const restored = await browser.newContext(contextOptions());
  const page2 = await restored.newPage();
  await page2.clock.setFixedTime(new Date('2042-06-15T12:00:00+02:00'));
  await openApp(page2);
  await page2.waitForTimeout(500);

  await top(page2, 'Mehr');
  await section(page2, 'protection');
  await page2.getByRole('button', { name: 'Datensicherung' }).click();
  await page2.locator('#backupPw').fill('V17-Langzeit-Backup-2041!');
  await page2.locator('#fullImportFile').setInputFiles(backupPath);
  page2.on('dialog', d => d.accept());
  await page2.getByRole('button', { name: 'Wiederherstellen' }).click();
  await page2.waitForTimeout(1000);

  finalState = await readState(page2);
  expect(finalState.billingSnapshots).toHaveLength(15);
  expect(finalState.costPositions.filter(x => /^lt-/.test(String(x.id))).length).toBe(30);
  expect(finalState.waterSettlements.filter(x => /^lt-/.test(String(x.id))).length).toBe(15);
  expect(finalState.payments.filter(x => /^lt-rent-/.test(String(x.id))).length).toBe(180);

  const restored2041 = finalState.billingSnapshots.find(x => Number(x.periodYear) === 2041);
  expect(restored2041).toBeTruthy();
  expect(restored2041.integrityHash).toMatch(/^[a-f0-9]{64}$/);
  expect(restored2041.events.some(x => x.category === 'water' && x.decision?.rule === 'consumption')).toBe(true);

  await page2.evaluate(() => sessionStorage.setItem('billingSelectedYear', '2041'));
  await page2.goto('./#rental/billing', { waitUntil: 'domcontentloaded' });
  await page2.waitForTimeout(350);
  await expect(page2.getByText('Abrechnung eingefroren')).toBeVisible();
  await expect(page2.getByRole('button', { name: 'PDF erstellen' })).toBeVisible();

  await restored.close();
});
