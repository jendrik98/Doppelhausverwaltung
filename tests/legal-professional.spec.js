const { test, expect } = require('@playwright/test');
const { runtimeGuard, openApp } = require('./helpers');
const fs = require('fs');
const { execFileSync } = require('child_process');

const DB = 'mietverwaltung-v6';
const STATE = 'main';
const BASE_URL = process.env.E2E_BASE_URL || 'https://jendrik98.github.io/Doppelhausverwaltung/';

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

function isoUtc(s) {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function daysInclusive(a, b) {
  return Math.round((isoUtc(b) - isoUtc(a)) / 86400000) + 1;
}

function normalizedText(s) {
  return String(s || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function expectedPeriodLabel(y) {
  return `1.1.${y} – 31.12.${y}`;
}

function addPeriodData(s, y, i, {
  missingAdvanceMonth = -1,
  waterCostOverride = null,
  insuranceCostOverride = null,
  includeOwnerOnlyCosts = true
} = {}) {
  const periodStart = `${y}-01-01`;
  const periodEnd = `${y}-12-31`;
  const finalizationDate = `${y + 1}-03-15`;
  const statutoryDeadline = `${y + 1}-12-31`;

  const houseM3 = 100 + i * 3;
  const ownerM3 = 40 + i;
  const tenantM3 = houseM3 - ownerM3;
  const waterShare = tenantM3 / houseM3;

  const waterCost = waterCostOverride ?? +(520 + i * 18.75).toFixed(2);
  const insuranceCost = insuranceCostOverride ?? +(980 + i * 22.50).toFixed(2);
  const adminCost = +(240 + i * 5).toFixed(2);
  const repairCost = +(600 + i * 12).toFixed(2);

  const main = s.meters.find(m => m.id === 'audit-main-meter');
  const owner = s.meters.find(m => m.id === 'audit-owner-meter');

  const mainStart = main.readings.at(-1)?.value ?? 1000;
  const ownerStart = owner.readings.at(-1)?.value ?? 400;

  const mainStartId = `audit-main-${y}-start`;
  const mainEndId = `audit-main-${y}-end`;
  const ownerStartId = `audit-owner-${y}-start`;
  const ownerEndId = `audit-owner-${y}-end`;

  main.readings.push(
    { id: mainStartId, date: periodStart, value: mainStart, origin: 'legal-e2e', synthetic: false },
    { id: mainEndId, date: periodEnd, value: mainStart + houseM3, origin: 'legal-e2e', synthetic: false }
  );
  owner.readings.push(
    { id: ownerStartId, date: periodStart, value: ownerStart, origin: 'legal-e2e', synthetic: false },
    { id: ownerEndId, date: periodEnd, value: ownerStart + ownerM3, origin: 'legal-e2e', synthetic: false }
  );

  s.waterSettlements.push({
    id: `audit-water-settlement-${y}`,
    periodYear: y,
    mainMeterId: main.id,
    ownerMeterId: owner.id,
    mainStartReadingId: mainStartId,
    mainEndReadingId: mainEndId,
    ownerStartReadingId: ownerStartId,
    ownerEndReadingId: ownerEndId
  });

  const waterPositionId = `audit-water-${y}`;
  const insurancePositionId = `audit-insurance-${y}`;
  const adminPositionId = `audit-admin-${y}`;
  const repairPositionId = `audit-repair-${y}`;

  s.costPositions.push(
    {
      id: waterPositionId,
      label: `Kaltwasser / Kanal ${y}/${y + 1}`,
      category: 'water',
      amount: waterCost,
      interval: 'once',
      serviceStart: periodStart,
      serviceEnd: periodEnd,
      assignment: 'house',
      agreement: 'auto',
      confirmed: true,
      origin: 'legal-e2e',
      sourceId: '',
      documentId: '',
      details: { quantity: houseM3, unit: 'm³', rate: waterCost / houseM3 },
      decisionHistory: []
    },
    {
      id: insurancePositionId,
      label: `Gebäude-Sachversicherung ${y}/${y + 1}`,
      category: 'insurance',
      amount: insuranceCost,
      interval: 'once',
      serviceStart: periodStart,
      serviceEnd: periodEnd,
      assignment: 'house',
      agreement: 'area',
      confirmed: true,
      origin: 'legal-e2e',
      sourceId: '',
      documentId: '',
      details: {},
      decisionHistory: []
    }
  );

  if (includeOwnerOnlyCosts) {
    s.costPositions.push(
      {
        id: adminPositionId,
        label: `Hausverwaltung ${y}/${y + 1}`,
        category: 'admin',
        amount: adminCost,
        interval: 'once',
        serviceStart: periodStart,
        serviceEnd: periodEnd,
        assignment: 'house',
        agreement: 'auto',
        confirmed: true,
        origin: 'legal-e2e',
        sourceId: '',
        documentId: '',
        details: {},
        decisionHistory: []
      },
      {
        id: repairPositionId,
        label: `Instandsetzung Test ${y}/${y + 1}`,
        category: 'repair',
        amount: repairCost,
        interval: 'once',
        serviceStart: periodStart,
        serviceEnd: periodEnd,
        assignment: 'house',
        agreement: 'auto',
        confirmed: true,
        origin: 'legal-e2e',
        sourceId: '',
        documentId: '',
        details: {},
        decisionHistory: []
      }
    );
  }

  let actualAdvances = 0;
  for (let offset = 0; offset < 12; offset++) {
    const d = new Date(Date.UTC(y, offset, 3));
    const yy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const advanceAmount = offset === missingAdvanceMonth ? 0 : 150;
    const rentAmount = 500;
    actualAdvances += advanceAmount;
    s.payments.push({
      id: `audit-rent-${y}-${offset + 1}`,
      date: `${yy}-${mm}-03`,
      direction: 'income',
      amount: rentAmount + advanceAmount,
      label: 'Miete Langzeit Testperson',
      rentAmount,
      advanceAmount,
      note: advanceAmount
        ? `Kaltmiete ${rentAmount} + BK-Vorauszahlung ${advanceAmount}`
        : `Kaltmiete ${rentAmount}; BK-Vorauszahlung in diesem Monat nicht geleistet`
    });
  }

  const outflow = (id, amount, label, positionId, date) => s.payments.push({
    id, date, direction: 'outflow', amount, label, positionId
  });
  outflow(`audit-water-pay-${y}`, waterCost, `Wasser/Kanal ${y}/${y + 1}`, waterPositionId, `${y + 1}-03-15`);
  outflow(`audit-insurance-pay-${y}`, insuranceCost, `Gebäudeversicherung ${y}/${y + 1}`, insurancePositionId, `${y}-07-15`);
  if (includeOwnerOnlyCosts) {
    outflow(`audit-admin-pay-${y}`, adminCost, `Hausverwaltung ${y}/${y + 1}`, adminPositionId, `${y}-09-15`);
    outflow(`audit-repair-pay-${y}`, repairCost, `Instandsetzung ${y}/${y + 1}`, repairPositionId, `${y + 1}-02-15`);
  }

  return {
    y,
    periodStart,
    periodEnd,
    finalizationDate,
    statutoryDeadline,
    houseM3,
    ownerM3,
    tenantM3,
    waterShare,
    waterCost,
    insuranceCost,
    adminCost,
    repairCost,
    waterPositionId,
    insurancePositionId,
    adminPositionId,
    repairPositionId,
    actualAdvances,
    expectedTenantCosts: waterCost * waterShare + insuranceCost * 0.5
  };
}

function buildAuditState(base, {
  startYear = 2027,
  years = 15,
  missingAdvanceYear = 2034,
  professionalPdf = false
} = {}) {
  const s = structuredClone(base);

  s.property = {
    ...(s.property || {}),
    name: 'Rechtsaudit Doppelhaus',
    address: 'Langzeitweg 15, 12345 Teststadt',
    totalArea: 200,
    year: '1965',
    billingTakeoverDate: `${startYear}-01-01`,
    predecessorBillingEnd: `${startYear - 1}-12-31`
  };

  s.correspondence = {
    ...(s.correspondence || {}),
    landlordName: 'Test Vermieter',
    landlordAddress: 'Vermieterweg 7, 12345 Teststadt',
    iban: 'DE00123456780000000000',
    paymentReference: 'Betriebskosten Langzeitweg 15',
    contact: 'vermieter@example.test'
  };

  s.units = [
    {
      id: 'audit-owner-unit',
      name: 'Eigennutzung',
      type: 'owner',
      area: 100,
      year: 1965,
      part: 'Doppelhaushälfte A',
      occupancy: [{ from: `${startYear}-01-01`, to: '', count: 2 }]
    },
    {
      id: 'audit-rental-unit',
      name: 'Mietwohnung',
      type: 'rental',
      area: 100,
      year: 1965,
      part: 'Doppelhaushälfte B',
      occupancy: [{ from: `${startYear}-01-01`, to: '', count: 2 }]
    }
  ];

  s.leases = [{
    id: 'audit-lease',
    tenantName: 'Langzeit Testperson',
    tenantAddress: 'Langzeitweg 15, 12345 Teststadt',
    start: `${startYear}-01-01`,
    end: '',
    rent: 500,
    advance: 150,

    // Dokumentiert die Rechtsannahme des Testfalls:
    // Betriebskosten-Vorauszahlungen wurden mietvertraglich vereinbart.
    operatingCostsAgreed: true,
    operatingCostsMode: 'advance',
    operatingCostsReference: 'Betriebskosten gemäß BetrKV',
    operatingCostCategories: ['water', 'insurance'],

    note: 'Rechts-/Plausibilitäts-E2E'
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
  s.meters = [
    {
      id: 'audit-main-meter',
      role: 'mainWater',
      name: 'Hauptwasserzähler',
      number: 'AUDIT-MAIN-001',
      unit: 'm³',
      readings: []
    },
    {
      id: 'audit-owner-meter',
      role: 'ownerWater',
      name: 'Zwischenzähler Eigennutzung',
      number: 'AUDIT-OWNER-001',
      unit: 'm³',
      readings: []
    }
  ];

  const expected = [];
  for (let i = 0; i < years; i++) {
    const y = startYear + i;
    expected.push(addPeriodData(s, y, i, {
      missingAdvanceMonth: y === missingAdvanceYear ? 5 : -1,
      waterCostOverride: professionalPdf && i === 0 ? 1600 : null,
      insuranceCostOverride: professionalPdf && i === 0 ? 1800 : null,
      includeOwnerOnlyCosts: !professionalPdf
    }));
  }

  return { state: s, expected };
}

async function seed(page, options = {}) {
  await openApp(page);
  await page.waitForTimeout(500);
  const base = await readState(page);
  expect(base).toBeTruthy();
  const built = buildAuditState(base, options);
  await writeState(page, built.state);
  return built;
}

async function openCurrentBilling(page) {
  await page.goto('./#rental/billing', { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(450);
  await expect(page.locator('#app')).not.toBeEmpty();
  return page.locator('#workspaceBody');
}

async function freezeVisibleBilling(page) {
  const body = page.locator('#workspaceBody');
  const freeze = page.getByRole('button', { name: 'Final prüfen & einfrieren' });
  await expect(freeze).toBeEnabled();
  await freeze.click();

  const modal = page.locator('#modal');
  await expect(modal.getByRole('heading', { name: 'Abrechnung finalisieren' })).toBeVisible();
  await modal.locator('#billingConfirm').check();
  await modal.getByRole('button', { name: 'Abrechnung einfrieren' }).click();
  await expect(body).toContainText('Abrechnung eingefroren');
}

test('Rechtsaudit 15 Jahre: Testdaten selbst sind zeitlich, rechnerisch und mietrechtlich plausibel', async () => {
  const legal = JSON.parse(fs.readFileSync('legal-rules.json', 'utf8'));

  expect(legal.jurisdiction).toMatch(/Deutschland/);
  expect(legal.sources.map(x => x.name)).toEqual(expect.arrayContaining(['§ 556 BGB', '§ 556a BGB', 'BetrKV']));
  expect(legal.categories.water.billable).toBe(true);
  expect(legal.categories.water.defaultRule).toBe('consumption');
  expect(legal.categories.insurance.billable).toBe(true);
  expect(legal.categories.admin.billable).toBe(false);
  expect(legal.categories.repair.billable).toBe(false);

  // Generator ohne Browser: beweist, dass der Langzeit-Test selbst keine
  // zeitlich unmöglichen oder rechnerisch absurden Testdaten erzeugt.
  const base = {
    property: {}, correspondence: {}, units: [], leases: [], sources: [],
    costPositions: [], waterSettlements: [], containers: [], water: [],
    tasks: [], billingWorkflows: [], billingSnapshots: [], payments: [],
    audit: [], meters: [], finance: {}
  };
  const built = buildAuditState(base);
  expect(built.expected).toHaveLength(15);

  const ids = new Set();
  let previousEnd = null;

  for (const e of built.expected) {
    const dayCount = daysInclusive(e.periodStart, e.periodEnd);
    expect([365, 366]).toContain(dayCount);

    if (previousEnd) {
      const nextDay = new Date(isoUtc(previousEnd) + 86400000).toISOString().slice(0, 10);
      expect(e.periodStart).toBe(nextDay);
    }
    previousEnd = e.periodEnd;

    expect(isoUtc(e.finalizationDate)).toBeGreaterThan(isoUtc(e.periodEnd));
    expect(isoUtc(e.finalizationDate)).toBeLessThanOrEqual(isoUtc(e.statutoryDeadline));

    expect(e.houseM3).toBeGreaterThan(0);
    expect(e.ownerM3).toBeGreaterThanOrEqual(0);
    expect(e.tenantM3).toBeGreaterThanOrEqual(0);
    expect(e.ownerM3 + e.tenantM3).toBeCloseTo(e.houseM3, 8);
    expect(e.waterShare).toBeGreaterThan(0);
    expect(e.waterShare).toBeLessThan(1);

    // Plausibilitätsband für diesen synthetischen Testfall, kein gesetzlicher Grenzwert.
    const tenantLitresPerPersonDay = (e.tenantM3 * 1000) / 2 / dayCount;
    expect(tenantLitresPerPersonDay).toBeGreaterThan(40);
    expect(tenantLitresPerPersonDay).toBeLessThan(250);

    expect(e.waterCost).toBeGreaterThan(0);
    expect(e.insuranceCost).toBeGreaterThan(0);
    expect(e.expectedTenantCosts).toBeGreaterThan(0);
    expect(e.actualAdvances).toBe(e.y === 2034 ? 1650 : 1800);
  }

  for (const collection of [
    built.state.costPositions,
    built.state.waterSettlements,
    built.state.payments,
    ...built.state.meters.map(m => m.readings)
  ]) {
    for (const row of collection) {
      expect(ids.has(row.id), `Doppelte ID: ${row.id}`).toBe(false);
      ids.add(row.id);
    }
  }

  for (const p of built.state.payments.filter(x => x.direction === 'income')) {
    expect(Number(p.rentAmount || 0) + Number(p.advanceAmount || 0)).toBeCloseTo(p.amount, 8);
  }
});

test('Rechtsschutz: laufende Periode nicht finalisieren, abgeschlossene Periode danach weiter abrechnen', async ({ browser }) => {
  const context = await browser.newContext(contextOptions());
  const page = await context.newPage();
  const guard = runtimeGuard(page);

  // Vollständige Daten 2027/28 sind absichtlich schon gespeichert.
  // Am 15.07.2027 ist die Periode aber noch nicht beendet.
  await page.clock.setFixedTime(new Date('2027-07-15T12:00:00+02:00'));
  await seed(page, { startYear: 2027, years: 1, missingAdvanceYear: -1 });
  let body = await openCurrentBilling(page);

  await expect(body).toContainText(/1\.1\.2027\s*–\s*31\.12\.2027/);

  const freezeBeforeEnd = page.getByRole('button', { name: 'Final prüfen & einfrieren' });
  await expect.soft(
    freezeBeforeEnd,
    'Eine Betriebskostenabrechnung darf nicht vor Ende des Abrechnungszeitraums endgültig eingefroren werden.'
  ).toBeDisabled();

  // Nach Periodenende muss gerade DIESE abgeschlossene Periode weiterhin
  // erreichbar und abrechenbar sein; eine automatische Umschaltung auf 2028/29
  // darf die Abschlussmöglichkeit für 2027/28 nicht verlieren.
  await page.clock.setFixedTime(new Date('2028-06-15T12:00:00+02:00'));
  await page.evaluate(() => sessionStorage.setItem('billingSelectedYear','2027'));
  body = await openCurrentBilling(page);

  await expect.soft(
    body,
    'Nach Periodenende muss 2027/28 weiterhin auswählbar/abrechenbar bleiben.'
  ).toContainText(/1\.1\.2027\s*–\s*31\.12\.2027/);

  guard.assertClean();
  await context.close();
});

test('Inhaltsrichtigkeit: tatsächlich geleistete BK-Vorauszahlungen bestimmen den Saldo', async ({ browser }) => {
  const context = await browser.newContext(contextOptions());
  const page = await context.newPage();
  const guard = runtimeGuard(page);

  await page.clock.setFixedTime(new Date('2028-06-15T12:00:00+02:00'));
  const built = await seed(page, { startYear: 2027, years: 1, missingAdvanceYear: 2027 });
  await page.evaluate(() => sessionStorage.setItem('billingSelectedYear','2027'));
  await openCurrentBilling(page);
  await freezeVisibleBilling(page);

  const state = await readState(page);
  const snap = state.billingSnapshots.find(x => Number(x.periodYear) === 2027);
  expect(snap).toBeTruthy();

  const expected = built.expected[0];
  expect(expected.actualAdvances).toBe(1650);

  // BGH: Grundsätzlich sind die tatsächlich geleisteten Vorauszahlungen
  // in Abzug zu bringen. Der Testmonat mit 500 € enthält nur die Kaltmiete.
  expect(
    snap.advances,
    `Erwartet Ist-Vorauszahlungen ${expected.actualAdvances.toFixed(2)} €, gespeichert wurden ${Number(snap.advances).toFixed(2)} €.`
  ).toBeCloseTo(expected.actualAdvances, 2);

  const admin = snap.events.find(x => x.positionId === expected.adminPositionId);
  const repair = snap.events.find(x => x.positionId === expected.repairPositionId);
  const water = snap.events.find(x => x.positionId === expected.waterPositionId);
  const insurance = snap.events.find(x => x.positionId === expected.insurancePositionId);

  expect(water.decision.rule).toBe('consumption');
  expect(water.tenantShare).toBeCloseTo(expected.waterShare, 8);
  expect(insurance.decision.rule).toBe('area');
  expect(insurance.tenantShare).toBeCloseTo(0.5, 8);

  expect(admin.tenantAmount).toBeCloseTo(0, 8);
  expect(admin.decision.billable).toBe(false);
  expect(repair.tenantAmount).toBeCloseTo(0, 8);
  expect(repair.decision.billable).toBe(false);

  expect(snap.tenantCosts).toBeCloseTo(expected.expectedTenantCosts, 6);
  expect(snap.result).toBeCloseTo(expected.expectedTenantCosts - expected.actualAdvances, 6);

  guard.assertClean();
  await context.close();
});

test('Dokumentstandard: finale PDF ist formell vollständig und professionell nachvollziehbar', async ({ browser }) => {
  test.setTimeout(60_000);
  fs.mkdirSync('test-results', { recursive: true });

  const context = await browser.newContext(contextOptions());
  const page = await context.newPage();
  const guard = runtimeGuard(page);

  await page.clock.setFixedTime(new Date('2042-03-15T12:00:00+01:00'));
  const built = await seed(page, {
    startYear: 2041,
    years: 1,
    missingAdvanceYear: -1,
    professionalPdf: true
  });

  await openCurrentBilling(page);
  await freezeVisibleBilling(page);

  const pdfPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF erstellen' }).click();
  const pdf = await pdfPromise;

  expect(pdf.suggestedFilename()).toBe('Betriebskostenabrechnung_2041.pdf');

  const pdfPath = 'test-results/v17-professional-billing-2041.pdf';
  await pdf.saveAs(pdfPath);

  const bytes = fs.readFileSync(pdfPath);
  expect(bytes.length).toBeGreaterThan(5000);
  expect(bytes.subarray(0, 4).toString('ascii')).toBe('%PDF');

  let pdfInfo;
  let pdfText;
  try {
    pdfInfo = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
    pdfText = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' });
  } catch (e) {
    throw new Error(`PDF-Qualitätswerkzeuge fehlen oder konnten die Datei nicht lesen: ${e.message}`);
  }

  const text = normalizedText(pdfText);
  const expected = built.expected[0];

  expect(pdfInfo).toMatch(/Pages:\s*1\b/i);
  expect(pdfInfo).toMatch(/Page size:.*(?:A4|595.*841)/i);

  // BGH-Mindestlogik: Gesamtkosten, Schlüssel, Mieteranteil, Vorauszahlungen.
  expect(text).toContain('Betriebskostenabrechnung');
  expect(text).toContain('Test Vermieter');
  expect(text).toContain('Vermieterweg 7');
  expect(text).toContain('Langzeit Testperson');
  expect(text).toContain('Langzeitweg 15');
  expect(text).toContain('Rechtsaudit Doppelhaus');
  expect(text).toMatch(/Abrechnungszeitraum/i);
  expect(text).toMatch(/1\.1\.2041|01\.01\.2041/);
  expect(text).toMatch(/31\.12\.2041/);

  expect(text).toContain('Kaltwasser / Kanal 2041/2042');
  expect(text).toContain('Gebäude-Sachversicherung 2041/2042');
  expect(text).toMatch(/Gesamt/i);
  expect(text).toMatch(/Verbrauch/i);
  expect(text).toMatch(/Wohnfläche/i);
  expect(text).toMatch(/Ihr Anteil|Mieteranteil/i);
  expect(text).toMatch(/Vorauszahlungen/i);
  expect(text).toMatch(/Nachzahlung/i);

  // Die gewählten Testkosten ergeben bewusst eine Nachzahlung,
  // damit Zahlungsinformationen geprüft werden können.
  expect(expected.expectedTenantCosts - expected.actualAdvances).toBeGreaterThan(0);
  expect(text).toContain('DE00123456780000000000');
  expect(text).toContain('Betriebskosten Langzeitweg 15');

  // Professioneller Transparenzstandard über die bloße Mindestform hinaus:
  // Der Mieter soll den Schlüssel ohne Rückrechnung verstehen können.
  expect(
    text,
    'Im PDF fehlen konkrete Verbrauchsmengen (m³); nur ein Prozentwert ist für einen professionellen Verbrauchsnachweis zu wenig.'
  ).toMatch(/m³|m3/);
  expect(
    text,
    'Im PDF fehlen konkrete Wohnflächen (m²); der Flächenschlüssel soll 100 m² von 200 m² nachvollziehbar ausweisen.'
  ).toMatch(/m²|m2/);

  // § 556 Abs. 4 BGB: Belegeinsicht auf Verlangen. Ein bloßer Hinweis,
  // dass Herkunftsnachweise "in der App" liegen, genügt unserem
  // professionellen Dokumentstandard nicht.
  expect(
    text,
    'Die Endabrechnung soll ausdrücklich auf Belegeinsicht auf Verlangen hinweisen.'
  ).toMatch(/Belegeinsicht|auf Verlangen/i);

  expect(
    text,
    'Der hinterlegte Kontakt für Rückfragen soll in der Endabrechnung erscheinen.'
  ).toContain('vermieter@example.test');

  expect(text).not.toMatch(/\bNaN\b|undefined|\[object Object\]/i);

  guard.assertClean();
  await context.close();
});
