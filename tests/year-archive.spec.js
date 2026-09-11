const { test, expect } = require('@playwright/test');
const { runtimeGuard, openApp } = require('./helpers');

test('H2 zeigt gebäudeisolierte Jahresarchive, Lücken und exportiert das Manifest', async ({ page }) => {
  const guard=runtimeGuard(page);
  await openApp(page);

  const state={
    schemaVersion:15,
    meta:{primaryPortfolioId:'portfolio-1',primaryBuildingId:'building-a',revision:21},
    property:{name:'Haus A',address:'A-Straße 1',totalArea:180,year:1990},
    finance:{repayment:900,fixed:0},
    correspondence:{landlordName:'Test'},
    portfolios:[{id:'portfolio-1',name:'Privatbestand',kind:'private'}],
    buildings:[
      {id:'building-a',portfolioId:'portfolio-1',name:'Haus A',address:'A-Straße 1',totalArea:180,year:1990,finance:{repayment:900,fixed:0}},
      {id:'building-b',portfolioId:'portfolio-1',name:'Haus B',address:'B-Straße 2',totalArea:210,year:2001,finance:{repayment:700,fixed:0}}
    ],
    units:[
      {id:'unit-a',buildingId:'building-a',type:'rental',name:'Wohnung A',area:80},
      {id:'unit-b',buildingId:'building-b',type:'rental',name:'Wohnung B',area:90}
    ],
    leases:[
      {id:'lease-a',unitId:'unit-a',buildingId:'building-a',tenantName:'Mieter A',start:'2024-01-01',rent:700,advance:100},
      {id:'lease-b',unitId:'unit-b',buildingId:'building-b',tenantName:'Mieter B',start:'2024-01-01',rent:800,advance:120}
    ],
    sources:[
      {id:'source-a',buildingId:'building-a',name:'Versicherung A',sourceDocumentId:'doc-a'},
      {id:'source-b',buildingId:'building-b',name:'Versicherung B',sourceDocumentId:'doc-b'}
    ],
    costPositions:[
      {id:'position-a',buildingId:'building-a',sourceId:'source-a',documentId:'doc-a',label:'Gebäudeversicherung A',category:'insurance',amount:1200,serviceStart:'2025-01-01',serviceEnd:'2025-12-31',confirmed:true},
      {id:'position-b',buildingId:'building-b',sourceId:'source-b',documentId:'doc-b',label:'Gebäudeversicherung B',category:'insurance',amount:1400,serviceStart:'2025-01-01',serviceEnd:'2025-12-31',confirmed:true}
    ],
    payments:[
      {id:'payment-a',buildingId:'building-a',positionId:'position-a',sourceId:'source-a',date:'2025-02-01',direction:'outflow',label:'Versicherung A bezahlt',amount:1200},
      {id:'payment-b-unlinked',buildingId:'building-b',sourceId:'source-b',date:'2025-02-01',direction:'outflow',label:'Versicherung B möglicher Kandidat',amount:1400}
    ],
    billingSnapshots:[
      {id:'snapshot-a',buildingId:'building-a',leaseId:'lease-a',periodYear:2025,version:1,createdAt:'2026-01-10T12:00:00Z',integrityHash:'hash-a',events:[{id:'event-a',positionId:'position-a',label:'Gebäudeversicherung A',amount:1200,tenantAmount:533.33}]}
    ],
    billingWorkflows:[],meters:[],waterSettlements:[],tasks:[],containers:[],water:[],audit:[]
  };
  const documents=[
    {id:'doc-a',buildingId:'building-a',name:'Beleg A.pdf',label:'Beleg A',type:'application/pdf',size:100,created:'2025-02-01T10:00:00Z',pages:[],analysis:{status:'done',acceptedAt:'2025-02-02T10:00:00Z'}},
    {id:'doc-b',buildingId:'building-b',name:'Beleg B.pdf',label:'Beleg B',type:'application/pdf',size:100,created:'2025-02-01T10:00:00Z',pages:[],analysis:{status:'done',acceptedAt:'2025-02-02T10:00:00Z'}},
    {id:'doc-b-extra',buildingId:'building-b',name:'Extra B.pdf',label:'Nicht zugeordnet B',type:'application/pdf',size:100,created:'2025-05-01T10:00:00Z',pages:[],analysis:{status:'done'}}
  ];

  await page.evaluate(async ({state,documents})=>{
    localStorage.removeItem('mietverwaltung-active-building-v1');
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('mietverwaltung-v6',3);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(['state','docs'],'readwrite');
      tx.objectStore('state').put({id:'main',data:state});
      const docs=tx.objectStore('docs');docs.clear();for(const doc of documents)docs.put(doc);
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });db.close();
  },{state,documents});

  await page.reload();
  await openApp(page,'#more/archive');
  await expect(page.locator('#workspaceSelect')).toHaveValue('archive');
  await expect(page.locator('#yearArchiveYearSelect')).toHaveValue('2025');
  await expect(page.locator('[data-archive-status]')).toHaveText('Abschlussbereit');
  await expect(page.locator('[data-archive-chain]')).toHaveCount(1);
  await expect(page.locator('#workspaceBody')).toContainText('Gebäudeversicherung A');
  await expect(page.locator('#workspaceBody')).not.toContainText('Gebäudeversicherung B');

  await page.locator('#buildingSelect').selectOption('building-b');
  await expect(page.locator('#buildingSelect')).toHaveValue('building-b');
  await expect(page.locator('#yearArchiveYearSelect')).toHaveValue('2025');
  await expect(page.locator('[data-archive-status]')).toHaveText('Prüfen');
  await expect(page.locator('#workspaceBody')).toContainText('Gebäudeversicherung B');
  await expect(page.locator('#workspaceBody')).not.toContainText('Gebäudeversicherung A');
  await expect(page.locator('#workspaceBody')).toContainText('Zahlungskandidat');
  await expect(page.locator('#workspaceBody')).toContainText('Zahlung, Abrechnung');
  await expect(page.locator('#workspaceBody')).toContainText('Nicht zugeordnet B');

  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Archiv-Manifest exportieren'}).click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('jahresarchiv-haus-b-2025.json');
  const stream=await download.createReadStream();
  let text='';for await (const chunk of stream)text+=chunk.toString();
  const payload=JSON.parse(text);
  expect(payload.schema).toBe('doppelhaus-year-archive-v1');
  expect(payload.context.buildingId).toBe('building-b');
  expect(payload.context.buildingLabel).toBe('Haus B');
  expect(payload.archive.year).toBe(2025);
  expect(payload.archive.summary.chains).toBe(1);
  expect(payload.archive.summary.gaps).toBe(1);
  expect(payload.archive.chains[0].candidatePayments).toHaveLength(1);
  expect(JSON.stringify(payload)).not.toContain('pages');
  expect(JSON.stringify(payload)).not.toContain('blob');
  guard.assertClean();
});
