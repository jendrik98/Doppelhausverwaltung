import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root=process.cwd();
const entry=path.join(root,'src/domain/lifecycle-ledger.ts');
assert.ok(fs.existsSync(entry),'src/domain/lifecycle-ledger.ts fehlt');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'g-ledger-'));
const outfile=path.join(dir,'ledger.mjs');
await build({entryPoints:[entry],bundle:true,format:'esm',platform:'node',target:'node22',outfile,logLevel:'silent'});
const G=await import(pathToFileURL(outfile).href+'?'+Date.now());

const state={
  meta:{primaryBuildingId:'building-1'},
  units:[{id:'rental-1',buildingId:'building-1',type:'rental',name:'Mietwohnung',occupancy:[]}],
  leases:[],payments:[],rentAllocations:[],meters:[],meterReplacements:[],billingSnapshots:[]
};

const l1=G.createTenancy(state,{unitId:'rental-1',tenantName:'Alt',start:'2026-01-01',end:'2026-06-30',rent:500,advance:100});
assert.equal(l1.terms.length,1);
assert.throws(()=>G.createTenancy(state,{unitId:'rental-1',tenantName:'Overlap',start:'2026-06-15',rent:400,advance:90}),/überschneiden/);
const l2=G.createTenancy(state,{unitId:'rental-1',tenantName:'Neu',start:'2026-07-01',end:'2026-12-31',rent:550,advance:110});
G.addLeaseTerm(state,l2.id,{effectiveFrom:'2026-10-01',rent:575,advance:115,reason:'Anpassung'});
assert.equal(G.leaseTermAt(l2,'2026-09-01').rent,550);
assert.equal(G.leaseTermAt(l2,'2026-10-01').rent,575);
assert.equal(Math.round(G.leaseChargeForMonth(l2,'2026-10').total),690);

state.payments.push({id:'p-old',buildingId:'building-1',direction:'income',date:'2026-01-03',amount:600,label:'Miete Alt'});
state.meta.lifecycleLedgerVersion=0;state.rentAllocations=[];
G.ensureLifecycleState(state);
assert.equal(G.paymentAllocations(state,'p-old').length,1,'Legacy-Mietzahlung wird konservativ ins explizite Ledger migriert');
assert.equal(G.ledgerRow(state,l1,'2026-01').status,'paid');

state.payments.push({id:'p-jul',buildingId:'building-1',direction:'income',date:'2026-07-03',amount:400,label:'Teilzahlung Neu'});
G.replacePaymentAllocations(state,'p-jul',[{leaseId:l2.id,month:'2026-07',total:400}]);
assert.equal(G.ledgerRow(state,l2,'2026-07').status,'partial');
state.payments.push({id:'p-rest',buildingId:'building-1',direction:'income',date:'2026-07-12',amount:260,label:'Rest Miete Neu'});
G.replacePaymentAllocations(state,'p-rest',[{leaseId:l2.id,month:'2026-07',total:260}]);
assert.equal(G.ledgerRow(state,l2,'2026-07').status,'paid');

state.meters.push(
  {id:'main-old',buildingId:'building-1',role:'mainWater',name:'Haupt',number:'M1',unit:'m³',installedAt:'2026-01-01',readings:[]},
  {id:'owner-old',buildingId:'building-1',role:'ownerWater',name:'Eigennutzung',number:'O1',unit:'m³',installedAt:'2026-01-01',readings:[]}
);
G.recordHandover(state,l1.id,{kind:'move-in',date:'2026-01-01',persons:2,readings:[{role:'mainWater',value:100},{role:'ownerWater',value:20}]});
const mainSwap=G.recordMeterReplacement(state,{oldMeterId:'main-old',date:'2026-06-30',oldValue:160,newNumber:'M2',newValue:0,reason:'Eichwechsel'});
G.recordHandover(state,l1.id,{kind:'move-out',date:'2026-06-30',persons:2,readings:[{meterId:mainSwap.newMeter.id,value:0},{role:'ownerWater',value:30}]});
G.recordHandover(state,l2.id,{kind:'move-in',date:'2026-07-01',persons:3,readings:[{meterId:mainSwap.newMeter.id,value:0},{role:'ownerWater',value:30}]});
const ownerSwap=G.recordMeterReplacement(state,{oldMeterId:'owner-old',date:'2026-08-31',oldValue:40,newNumber:'O2',newValue:0});
G.recordHandover(state,l2.id,{kind:'move-out',date:'2026-12-31',persons:3,readings:[{role:'mainWater',value:70},{meterId:ownerSwap.newMeter.id,value:15}]});
const water=G.waterConsumptionBetween(state,'2026-01-01','2026-12-31','building-1');
assert.equal(water.valid,true,JSON.stringify(water));
assert.equal(water.house,130);
assert.equal(water.owner,35);
assert.equal(water.tenant,95);
assert.equal(water.mainSegments.length,2);
assert.equal(water.ownerSegments.length,2);

// Zuordnungen für die zweite Jahreshälfte machen die BK-Vorauszahlungen je Mietverhältnis beweisbar.
for(const [month,total] of [['2026-08',660],['2026-09',660],['2026-10',690],['2026-11',690],['2026-12',690]]){
  const pid='p-'+month;state.payments.push({id:pid,buildingId:'building-1',direction:'income',date:month+'-03',amount:total,label:'Miete Neu',leaseId:l2.id});G.replacePaymentAllocations(state,pid,[{leaseId:l2.id,month,total}]);
}
const base={period:{start:'2026-01-01',end:'2026-12-31'},events:[{id:'area',tenantAmount:1200,serviceStart:'2026-01-01',serviceEnd:'2026-12-31',decision:{rule:'area'}},{id:'water',tenantAmount:950,serviceStart:'2026-01-01',serviceEnd:'2026-12-31',decision:{rule:'consumption'}}],unresolved:[],tenantCosts:2150,advances:0};
const a1=G.leaseBillingAnalysis(state,base,2026,l1.id),a2=G.leaseBillingAnalysis(state,base,2026,l2.id);
assert.equal(a1.leaseId,l1.id);assert.equal(a2.leaseId,l2.id);
assert.ok(a1.tenantCosts>0&&a2.tenantCosts>0);
assert.ok(Math.abs((a1.events[0].tenantAmount+a2.events[0].tenantAmount)-1200)<0.01,'Flächenkosten werden nach Mietzeitraum vollständig auf beide Mietverhältnisse gesplittet');
assert.ok(a2.advances>0,'Explizite BK-Anteile aus dem Mietkonto fließen in die Mieterabrechnung');

const s1=G.decorateSnapshotRevision(state,{id:'s1',buildingId:'building-1',periodYear:2026,lease:l2},{leaseId:l2.id});state.billingSnapshots.push(s1);
const s2=G.decorateSnapshotRevision(state,{id:'s2',buildingId:'building-1',periodYear:2026,lease:l2},{leaseId:l2.id,correctionReason:'Nachgereichter Beleg',supersedesSnapshotId:s1.id});state.billingSnapshots.push(s2);
assert.equal(s1.version,1);assert.equal(s2.version,2);assert.equal(s2.supersedesSnapshotId,'s1');assert.equal(s2.correctionReason,'Nachgereichter Beleg');
assert.deepEqual(G.billingRevisionHistory(state,2026,l2.id).map(x=>x.version),[1,2]);

const validation=G.validateLifecycleState(state);assert.deepEqual(validation.errors,[],validation.errors.join('\n'));
assert.ok(G.lifecycleAlerts(state,'building-1','2027-01-15').some(x=>x.sub==='lifecycle'));
console.log(`Architecture G Lifecycle-Ledger bestanden: ${state.leases.length} Mietverhältnisse, ${state.rentAllocations.length} Zuordnungen, ${state.meterReplacements.length} Zählerwechsel, Revision ${s1.version}→${s2.version}.`);

const runtime=fs.readFileSync(path.join(root,'src/ui/app-runtime.ts'),'utf8');
const context=fs.readFileSync(path.join(root,'src/application/context.ts'),'utf8');
const billing=fs.readFileSync(path.join(root,'src/domain/billing-domain.ts'),'utf8');
assert.ok(runtime.includes('AppRentalLifecycleUi.renderRentalLifecycle'),'Runtime verdrahtet das modulare G-UI nicht');
assert.ok(runtime.includes('correctBillingBtn'),'Korrekturpfad ist nicht erreichbar');
assert.ok(context.includes('rentAllocations')&&context.includes('meterReplacements'),'G-Sammlungen sind nicht gebäudeisoliert');
assert.ok(billing.includes('decorateSnapshotRevision'),'Snapshots sind nicht versioniert');
assert.ok(fs.readFileSync(path.join(root,'index.html'),'utf8').includes('app.js?v=1807'));
