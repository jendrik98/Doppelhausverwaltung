// @ts-nocheck -- Phase 8: semantikerhaltende Modul-Extraktion; Browser-E2E ist das Verhaltensgate.
/* ===== smart-engine.js ===== */
export const SMART_ENGINE_VERSION=1;

export function smartToday(){return localDateISO()}
export function smartMonthKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`}
export function smartMonthOffset(offset){
  const d=new Date(),x=new Date(d.getFullYear(),d.getMonth()+offset,1);
  return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}`
}
export function smartMonthRange(key){
  const [y,m]=String(key).split("-").map(Number),start=`${y}-${String(m).padStart(2,"0")}-01`,end=new Date(y,m,0).toISOString().slice(0,10);
  return {start,end}
}
export function activeLeaseInMonth(lease,key){
  const {start,end}=smartMonthRange(key);return !!lease&&(!lease.start||lease.start<=end)&&(!lease.end||lease.end>=start)
}
export function rentMonthStatus(state,key=smartMonthKey()){
AppLifecycleLedger.ensureLifecycleState(state);const lease=(state.leases||[]).find(l=>activeLeaseInMonth(l,key));if(!lease)return {key,status:"none",expected:0,paid:0,confidence:0,payments:[]};
const row=AppLifecycleLedger.ledgerRow(state,lease,key),paymentIds=new Set((row.allocations||[]).map(a=>a.paymentId));
return {key,lease,expected:row.total,paid:row.paid,difference:row.difference,status:row.status==="overpaid"?"over":row.status,confidence:(row.allocations||[]).length?100:0,payments:(state.payments||[]).filter(p=>paymentIds.has(p.id))}
}
export function rentMonitor(state,months=8){return Array.from({length:months},(_,i)=>rentMonthStatus(state,smartMonthOffset(-i)))}
export function rentStatusLabel(s){return s.status==="paid"?"vollständig erkannt":s.status==="partial"?"teilweise erkannt":s.status==="over"?"über Soll erkannt":s.status==="missing"?"noch nicht erkannt":"kein aktiver Mietvertrag"}

export function latestBillingSnapshot(state){
  return (state.billingSnapshots||[]).slice().sort((a,b)=>Number(b.periodYear)-Number(a.periodYear)||Number(b.version||1)-Number(a.version||1)||String(b.createdAt||"").localeCompare(String(a.createdAt||"")))[0]||null
}
export function billingProjection(s,year=currentPeriodYear()){
  const current=billingAnalysis(s,year),cur=periodCategoryTotals(s,year),prior=periodCategoryTotals(s,year-1),pp=billingPeriodInfo(s,year-1),currentCats=new Set(cur.filter(x=>x.total>0).map(x=>x.category)),factor=pp.active&&pp.days>0?pp.nominalDays/pp.days:1;
  const missing=prior.filter(x=>x.total>0&&!currentCats.has(x.category)).map(x=>({...x,estimatedTenant:Number(x.tenant||0)*(pp.days<pp.nominalDays?factor:1),annualized:pp.days<pp.nominalDays}));
  const estimatedMissingTenant=missing.reduce((sum,x)=>sum+Number(x.estimatedTenant||0),0),projectedTenantCosts=Number(current.tenantCosts||0)+estimatedMissingTenant,projectedResult=projectedTenantCosts-Number(current.advances||0);
  const priorCats=prior.filter(x=>x.total>0).length,matched=prior.filter(x=>currentCats.has(x.category)).length;
  let confidence=priorCats?Math.round(55+40*(matched/priorCats)):Math.min(55,25+(current.events||[]).length*5);if(pp.days<pp.nominalDays&&missing.length)confidence=Math.max(35,confidence-15);
  return {year,knownTenantCosts:Number(current.tenantCosts||0),estimatedMissingTenant,projectedTenantCosts,advances:Number(current.advances||0),projectedResult,missingCategories:missing,confidence:Math.max(20,Math.min(95,confidence)),period:current.period}
}

