const { test, expect } = require('@playwright/test');
const { runtimeGuard, openApp } = require('./helpers');

const DB='mietverwaltung-v6',STATE='main';

async function readState(page){
  return page.evaluate(async({DB,STATE})=>{
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(DB,3);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
    const tx=db.transaction('state','readonly'),r=tx.objectStore('state').get(STATE);
    return await new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result?.data||null);r.onerror=()=>reject(r.error)})
  },{DB,STATE})
}
async function writeState(page,state){
  await page.evaluate(async({DB,STATE,state})=>{
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(DB,3);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
    const tx=db.transaction('state','readwrite');tx.objectStore('state').put({id:STATE,data:state});
    await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})
  },{DB,STATE,state})
}

test('BK-Vertragsbasis wird gespeichert und begrenzt die abrechenbaren Kostenarten',async({page})=>{
  const guard=runtimeGuard(page);
  await openApp(page,'#home');
  const state=await readState(page),buildingId=state.meta.primaryBuildingId||state.buildings?.[0]?.id;
  state.units.push({id:'contract-test-unit',buildingId,type:'rental',name:'Vertragsbasis-Test',area:55,occupancy:[]});
  state.leases.push({id:'contract-test-lease',buildingId,unitId:'contract-test-unit',tenantName:'Vertragsbasis Test',tenantAddress:'',start:'2026-01-01',end:'',rent:600,advance:120,terms:[{id:'contract-term',effectiveFrom:'2026-01-01',rent:600,advance:120,reason:'Test'}],handover:{},operatingCostsMode:'unknown'});
  await writeState(page,state);
  await page.goto('./#rental/lifecycle',{waitUntil:'domcontentloaded'});
  await page.reload({waitUntil:'domcontentloaded'});

  const card=page.locator('[data-tenancy-card="contract-test-lease"]');
  await expect(card).toBeVisible();
  await expect(card).toContainText('BK-Vertragsbasis');
  await card.getByRole('button',{name:'BK-Grundlage'}).click();

  const modal=page.locator('#modal');
  await modal.locator('select[name="operatingCostsMode"]').selectOption('advance');
  await modal.locator('input[name="operatingCostsReference"]').fill('Betriebskosten gemäß BetrKV');
  await modal.locator('input[name="operatingCostCategories"][value="water"]').check();
  await modal.getByRole('button',{name:'Vertragsbasis speichern'}).click();

  await expect(card).toContainText('Vorauszahlung');
  const saved=await readState(page),lease=saved.leases.find(x=>x.id==='contract-test-lease');
  expect(lease.operatingCostsMode).toBe('advance');
  expect(lease.operatingCostsReference).toBe('Betriebskosten gemäß BetrKV');
  expect(lease.operatingCostCategories).toEqual(['water']);
  expect(lease.operatingCostsVerifiedAt).toBeTruthy();

  guard.assertClean()
});
