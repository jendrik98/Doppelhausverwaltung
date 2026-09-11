const { test, expect } = require('@playwright/test');
const { runtimeGuard, openApp } = require('./helpers');

function storedEntries(buffer){
  const entries=new Map(); let offset=0;
  while(offset+30<=buffer.length && buffer.readUInt32LE(offset)===0x04034b50){
    const size=buffer.readUInt32LE(offset+18);
    const nameLength=buffer.readUInt16LE(offset+26);
    const extraLength=buffer.readUInt16LE(offset+28);
    const nameStart=offset+30, dataStart=nameStart+nameLength+extraLength;
    const name=buffer.subarray(nameStart,nameStart+nameLength).toString('utf8');
    entries.set(name,buffer.subarray(dataStart,dataStart+size));
    offset=dataStart+size;
  }
  return entries;
}

test('H3 zeigt gebäudeisolierte Jahresarchive und exportiert Manifest plus echtes Abschlusspaket', async ({ page }) => {
  const guard=runtimeGuard(page); await openApp(page);
  const state={
    schemaVersion:15,meta:{primaryPortfolioId:'portfolio-1',primaryBuildingId:'building-a',revision:21},
    property:{name:'Haus A',address:'A-Straße 1',totalArea:180,year:1990},finance:{repayment:900,fixed:0},correspondence:{landlordName:'Test'},
    portfolios:[{id:'portfolio-1',name:'Privatbestand',kind:'private'}],
    buildings:[
      {id:'building-a',portfolioId:'portfolio-1',name:'Haus A',address:'A-Straße 1',totalArea:180,year:1990,finance:{repayment:900,fixed:0}},
      {id:'building-b',portfolioId:'portfolio-1',name:'Haus B',address:'B-Straße 2',totalArea:210,year:2001,finance:{repayment:700,fixed:0}}
    ],
    units:[{id:'unit-a',buildingId:'building-a',type:'rental',name:'Wohnung A',area:80},{id:'unit-b',buildingId:'building-b',type:'rental',name:'Wohnung B',area:90}],
    leases:[{id:'lease-a',unitId:'unit-a',buildingId:'building-a',tenantName:'Mieter A',start:'2024-01-01',rent:700,advance:100},{id:'lease-b',unitId:'unit-b',buildingId:'building-b',tenantName:'Mieter B',start:'2024-01-01',rent:800,advance:120}],
    sources:[{id:'source-a',buildingId:'building-a',name:'Versicherung A',sourceDocumentId:'doc-a'},{id:'source-b',buildingId:'building-b',name:'Versicherung B',sourceDocumentId:'doc-b'}],
    costPositions:[
      {id:'position-a',buildingId:'building-a',sourceId:'source-a',documentId:'doc-a',label:'Gebäudeversicherung A',category:'insurance',amount:1200,serviceStart:'2025-01-01',serviceEnd:'2025-12-31',confirmed:true},
      {id:'position-b',buildingId:'building-b',sourceId:'source-b',documentId:'doc-b',label:'Gebäudeversicherung B',category:'insurance',amount:1400,serviceStart:'2025-01-01',serviceEnd:'2025-12-31',confirmed:true}
    ],
    payments:[
      {id:'payment-a',buildingId:'building-a',positionId:'position-a',sourceId:'source-a',date:'2025-02-01',direction:'outflow',label:'Versicherung A bezahlt',amount:1200},
      {id:'payment-b-unlinked',buildingId:'building-b',sourceId:'source-b',date:'2025-02-01',direction:'outflow',label:'Versicherung B möglicher Kandidat',amount:1400}
    ],
    billingSnapshots:[{id:'snapshot-a',buildingId:'building-a',leaseId:'lease-a',periodYear:2025,version:1,createdAt:'2026-01-10T12:00:00Z',integrityHash:'hash-a',events:[{id:'event-a',positionId:'position-a',label:'Gebäudeversicherung A',amount:1200,tenantAmount:533.33}]}],
    billingWorkflows:[],meters:[],waterSettlements:[],tasks:[],containers:[],water:[],audit:[]
  };
  const documents=[
    {id:'doc-a',buildingId:'building-a',name:'Beleg A.pdf',label:'Beleg A',type:'application/pdf',size:5,created:'2025-02-01T10:00:00Z',fixtureText:'PDF-A',analysis:{status:'done',acceptedAt:'2025-02-02T10:00:00Z'}},
    {id:'doc-b',buildingId:'building-b',name:'Beleg B.pdf',label:'Beleg B',type:'application/pdf',size:5,created:'2025-02-01T10:00:00Z',fixtureText:'PDF-B',analysis:{status:'done',acceptedAt:'2025-02-02T10:00:00Z'}},
    {id:'doc-b-extra',buildingId:'building-b',name:'Extra B.pdf',label:'Nicht zugeordnet B',type:'application/pdf',size:7,created:'2025-05-01T10:00:00Z',fixtureText:'EXTRA-B',analysis:{status:'done'}}
  ];
  await page.evaluate(async ({state,documents})=>{
    localStorage.removeItem('mietverwaltung-active-building-v1');
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('mietverwaltung-v6',3);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(['state','docs'],'readwrite'); tx.objectStore('state').put({id:'main',data:state});
      const docs=tx.objectStore('docs'); docs.clear();
      for(const doc of documents){const persisted={...doc,blob:new Blob([doc.fixtureText],{type:doc.type})};delete persisted.fixtureText;docs.put(persisted)}
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    }); db.close();
  },{state,documents});

  await page.reload(); await openApp(page,'#more/archive');
  await expect(page.locator('#workspaceSelect')).toHaveValue('app');
  await expect(page.locator('#yearArchiveYearSelect')).toHaveValue('2025');
  await expect(page.locator('[data-archive-status]')).toHaveText('Abschlussbereit');
  await expect(page.locator('[data-package-status]')).toHaveText('Paket vollständig');
  await expect(page.locator('[data-archive-chain]')).toHaveCount(1);
  await expect(page.locator('#workspaceBody')).toContainText('Gebäudeversicherung A');
  await expect(page.locator('#workspaceBody')).not.toContainText('Gebäudeversicherung B');

  await page.locator('#buildingSelect').selectOption('building-b');
  await expect(page.locator('#buildingSelect')).toHaveValue('building-b');
  await expect(page.locator('[data-archive-status]')).toHaveText('Prüfen');
  await expect(page.locator('[data-package-status]')).toHaveText('Paket prüfen');
  await expect(page.locator('#workspaceBody')).toContainText('Gebäudeversicherung B');
  await expect(page.locator('#workspaceBody')).not.toContainText('Gebäudeversicherung A');
  await expect(page.locator('#workspaceBody')).toContainText('Zahlungskandidat');
  await expect(page.locator('#workspaceBody')).toContainText('Zahlung, Abrechnung');
  await expect(page.locator('#workspaceBody')).toContainText('Nicht zugeordnet B');

  const manifestPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Manifest (.json) exportieren'}).click();
  const manifestDownload=await manifestPromise;
  expect(manifestDownload.suggestedFilename()).toBe('jahresarchiv-haus-b-2025.json');
  const manifestStream=await manifestDownload.createReadStream();
  let text=''; for await (const chunk of manifestStream) text+=chunk.toString();
  const payload=JSON.parse(text);
  expect(payload.schema).toBe('doppelhaus-year-archive-v1');
  expect(payload.context.buildingId).toBe('building-b');
  expect(payload.archive.summary.gaps).toBe(1);
  expect(payload.archive.chains[0].candidatePayments).toHaveLength(1);
  expect(JSON.stringify(payload)).not.toContain('blob');

  const packagePromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Abschlusspaket (.zip) exportieren'}).click();
  const packageDownload=await packagePromise;
  expect(packageDownload.suggestedFilename()).toBe('jahresabschluss-haus-b-2025-pruefen.zip');
  const packageStream=await packageDownload.createReadStream();
  const chunks=[]; for await(const chunk of packageStream) chunks.push(chunk);
  const entries=storedEntries(Buffer.concat(chunks));
  for(const required of ['manifest.json','STATUS.txt','zahlungen.csv','abrechnungen.json']) expect(entries.has(required),required).toBeTruthy();
  const names=[...entries.keys()];
  expect(names.filter(name=>name.startsWith('dokumente/')).length).toBe(2);
  expect(names.some(name=>name.includes('beleg-b')&&name.endsWith('.pdf'))).toBeTruthy();
  expect(names.some(name=>name.includes('nicht-zugeordnet-b')&&name.endsWith('.pdf'))).toBeTruthy();
  const merged=Buffer.concat([...entries.values()]).toString('utf8');
  expect(merged).not.toContain('PDF-A'); expect(merged).toContain('PDF-B'); expect(merged).toContain('EXTRA-B');
  const packageManifest=JSON.parse(entries.get('manifest.json').toString('utf8'));
  expect(packageManifest.schema).toBe('doppelhaus-year-close-package-v1');
  expect(packageManifest.context.buildingId).toBe('building-b');
  expect(packageManifest.status).toBe('review');
  expect(packageManifest.package.missingBinaryDocuments).toHaveLength(0);
  expect(entries.get('STATUS.txt').toString('utf8')).toContain('PRÜFEN');
  expect(entries.get('zahlungen.csv').toString('utf8')).toContain('payment-b-unlinked');
  guard.assertClean();
});
