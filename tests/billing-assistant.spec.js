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

function cost(id, category, amount, start, end, agreement='area') {
  return {
    id, label: `${category} ${id}`, category, amount, interval:'once',
    serviceStart:start, serviceEnd:end, assignment:'house', agreement,
    confirmed:true, origin:'v18-e2e', details:{}, decisionHistory:[]
  };
}

async function seedBase(page, {
  year=2026,
  takeover=`${year}-09-01`,
  rent=400,
  advance=125,
  includeCurrentInsurance=false,
  includePriorInsurance=false,
  validWater=false,
  fullPayments=false,
  backupAt=null
}={}) {
  await openApp(page);
  const s = await readState(page);
  s.property = {...s.property, name:'Assistent-Testhaus', address:'Testweg 18', totalArea:200, billingTakeoverDate:takeover, predecessorBillingEnd:''};
  s.correspondence = {landlordName:'Test Vermieter', landlordAddress:'Testweg 18', iban:'DE001234', paymentReference:'BK-Test', contact:'test@example.test'};
  s.units = [
    {id:'owner',name:'Eigennutzung',type:'owner',area:100,occupancy:[{from:takeover,to:'',count:2}]},
    {id:'rental',name:'Mietwohnung',type:'rental',area:100,occupancy:[{from:takeover,to:'',count:2}]}
  ];
  s.leases = [{id:'lease',tenantName:'Testmieter',tenantAddress:'Testweg 18',start:takeover,end:'',rent,advance,operatingCostsMode:'advance',operatingCostsAgreed:true,operatingCostsReference:'Betriebskosten gemäß BetrKV',operatingCostCategories:[],operatingCostOtherLabels:[],note:''}];
  s.sources=[]; s.costPositions=[]; s.waterSettlements=[]; s.payments=[]; s.billingWorkflows=[]; s.billingSnapshots=[]; s.tasks=[];
  s.meta = {...s.meta, lastBackupAt:backupAt};

  const start = takeover > `${year}-01-01` ? takeover : `${year}-01-01`;
  const end = `${year}-12-31`;
  s.costPositions.push(
    cost(`tax-${year}`,'propertyTax',200,start,end),
    cost(`rain-${year}`,'rainwater',80,start,end),
    cost(`street-${year}`,'street',20,start,end),
    cost(`waste-${year}`,'waste',160,start,end),
    cost(`water-${year}`,'water',600,start,end,'auto')
  );
  if(includeCurrentInsurance) s.costPositions.push(cost(`insurance-${year}`,'insurance',1000,start,end));
  if(includePriorInsurance) {
    const py=year-1;
    s.costPositions.push(cost(`insurance-${py}`,'insurance',1000,`${py}-01-01`,`${py}-12-31`));
  }

  if(validWater) {
    s.meters = [
      {id:'main',role:'mainWater',name:'Hauptwasserzähler',number:'M1',unit:'m³',readings:[
        {id:'ms',date:start,value:1000,origin:'v18-e2e',synthetic:false},
        {id:'me',date:end,value:1100,origin:'v18-e2e',synthetic:false}
      ]},
      {id:'owner-meter',role:'ownerWater',name:'Zwischenzähler Eigennutzung',number:'O1',unit:'m³',readings:[
        {id:'os',date:start,value:400,origin:'v18-e2e',synthetic:false},
        {id:'oe',date:end,value:440,origin:'v18-e2e',synthetic:false}
      ]}
    ];
    s.waterSettlements=[{id:`sett-${year}`,periodYear:year,mainMeterId:'main',ownerMeterId:'owner-meter',mainStartReadingId:'ms',mainEndReadingId:'me',ownerStartReadingId:'os',ownerEndReadingId:'oe'}];
  } else {
    s.meters=[];
  }

  const monthCount = fullPayments ? 12 : 1;
  for(let i=0;i<monthCount;i++) {
    const d = new Date(Date.UTC(year, i, 3));
    const iso=d.toISOString().slice(0,10);
    if(iso < takeover) continue;
    s.payments.push({
      id:`rent-${i}`,date:iso,direction:'income',amount:rent+advance,label:'Miete Testmieter',
      rentAmount:rent,advanceAmount:advance
    });
  }
  if(!fullPayments && takeover.endsWith('-09-01')) {
    s.payments=[{id:'rent-sep',date:`${year}-09-03`,direction:'income',amount:rent+advance,label:'Miete Testmieter',rentAmount:rent,advanceAmount:advance}];
  }

  await writeState(page,s);
  return s;
}

async function reload(page, hash='./') {
  await page.goto(hash, {waitUntil:'domcontentloaded'});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForTimeout(350);
}

test('Abrechnungsassistent: erste Teilperiode zeigt 4 geplante Vorauszahlungen, offene Daten und Backup-Status', async ({ page }) => {
  const guard=runtimeGuard(page);
  await page.clock.setFixedTime(new Date('2026-10-15T12:00:00+02:00'));
  await seedBase(page);
  await reload(page,'./#home');

  const card=page.locator('#v18BillingAssistant');
  await expect(card).toBeVisible();
  await expect(card).toContainText('ABRECHNUNGSASSISTENT');
  await expect(card).toContainText('Noch kein Backup');
  await card.getByRole('button',{name:'Abrechnung vorbereiten'}).click();

  const full=page.locator('#v18BillingAssistantFull');
  await expect(full).toBeVisible();
  await expect(full).toContainText('500,00');
  await expect(full.locator('[data-v18-category="insurance"]')).toContainText('Offen');
  await expect(full.locator('[data-v18-category="water"]')).toContainText('Offen');
  guard.assertClean();
});

test('Abrechnungsassistent: historische Gebäudeversicherung wird transparent geschätzt statt erfunden', async ({ page }) => {
  const guard=runtimeGuard(page);
  await page.clock.setFixedTime(new Date('2027-10-15T12:00:00+02:00'));
  await seedBase(page,{year:2027,takeover:'2026-01-01',includePriorInsurance:true,validWater:true});
  await reload(page,'./#rental/billing');

  const row=page.locator('#v18BillingAssistantFull [data-v18-category="insurance"]');
  await expect(row).toContainText('Geschätzt');
  await expect(row).toContainText('500,00');
  await expect(page.locator('#v18BillingAssistantFull')).toContainText('nur Prognose');
  guard.assertClean();
});

test('Abrechnungsassistent: aktueller Beleg ersetzt die Schätzung automatisch', async ({ page }) => {
  const guard=runtimeGuard(page);
  await page.clock.setFixedTime(new Date('2027-10-15T12:00:00+02:00'));
  await seedBase(page,{year:2027,takeover:'2026-01-01',includePriorInsurance:true,includeCurrentInsurance:true,validWater:true});
  await reload(page,'./#rental/billing');

  const row=page.locator('#v18BillingAssistantFull [data-v18-category="insurance"]');
  await expect(row).toContainText('Bekannt');
  await expect(row).not.toContainText('Geschätzt');
  guard.assertClean();
});

test('Abrechnungssicherheit: Schätzwerte gelangen niemals in Snapshot oder finale Abrechnung', async ({ page }) => {
  test.setTimeout(60_000);
  const guard=runtimeGuard(page);
  await page.clock.setFixedTime(new Date('2028-06-15T12:00:00+02:00'));
  await seedBase(page,{year:2027,takeover:'2026-01-01',rent:500,advance:150,includePriorInsurance:true,validWater:true,fullPayments:true,backupAt:'2028-06-01T12:00:00.000Z'});
  await page.evaluate(() => sessionStorage.setItem('billingSelectedYear','2027'));
  await reload(page,'./#rental/billing');

  const assistant=page.locator('#v18BillingAssistantFull');
  await expect(assistant.locator('[data-v18-category="insurance"]')).toContainText('Geschätzt');

  const freeze=page.getByRole('button',{name:'Final prüfen & einfrieren'});
  await expect(freeze).toBeEnabled();
  await freeze.click();
  const modal=page.locator('#modal');
  await modal.locator('#billingConfirm').check();
  await modal.getByRole('button',{name:'Abrechnung einfrieren'}).click();

  const s=await readState(page);
  const snap=s.billingSnapshots.find(x=>Number(x.periodYear)===2027);
  expect(snap).toBeTruthy();

  // Tatsächliche Mieteranteile:
  // Grundsteuer 100 + Regen 40 + Straße 10 + Abfall 80 + Wasser 360 = 590.
  // Die geschätzten 500 € Versicherung dürfen NICHT im Snapshot landen.
  expect(snap.tenantCosts).toBeCloseTo(590,6);
  expect(snap.tenantCosts).not.toBeCloseTo(1090,6);
  guard.assertClean();
});
