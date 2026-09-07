/* ===== smart-engine.js ===== */
const SMART_ENGINE_VERSION=1;

function smartToday(){return localDateISO()}
function smartMonthKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`}
function smartMonthOffset(offset){
  const d=new Date(),x=new Date(d.getFullYear(),d.getMonth()+offset,1);
  return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}`
}
function smartMonthRange(key){
  const [y,m]=String(key).split("-").map(Number),start=`${y}-${String(m).padStart(2,"0")}-01`,end=new Date(y,m,0).toISOString().slice(0,10);
  return {start,end}
}
function activeLeaseInMonth(lease,key){
  const {start,end}=smartMonthRange(key);return !!lease&&(!lease.start||lease.start<=end)&&(!lease.end||lease.end>=start)
}
function rentMonthStatus(state,key=smartMonthKey()){
  const lease=(state.leases||[]).find(l=>activeLeaseInMonth(l,key));if(!lease)return {key,status:"none",expected:0,paid:0,confidence:0,payments:[]};
  const expected=Number(lease.rent||0)+Number(lease.advance||0),tenant=normalizeLabelText(lease.tenantName||"");
  const pays=(state.payments||[]).filter(p=>p.direction==="income"&&paymentMonthKey(p.date)===key).filter(p=>{
    const label=normalizeLabelText(p.label),det=detectRentPayment(state,p);
    return det?.leaseId===lease.id || /\bmiete\b|betriebskosten|nebenkosten|\bbk\b/.test(label) || (tenant&&label.includes(tenant))
  });
  const paid=pays.reduce((s,p)=>s+Number(p.amount||0),0),ratio=expected?paid/expected:0;
  let status=paid<=0?"missing":ratio>=.995?"paid":"partial";
  if(ratio>1.08)status="over";
  let confidence=0;
  if(pays.length)confidence=Math.max(...pays.map(p=>Number(detectRentPayment(state,p)?.score||(/\bmiete\b/.test(normalizeLabelText(p.label))?70:45))));
  return {key,lease,expected,paid,difference:paid-expected,status,confidence,payments:pays}
}
function rentMonitor(state,months=8){return Array.from({length:months},(_,i)=>rentMonthStatus(state,smartMonthOffset(-i)))}
function rentStatusLabel(s){return s.status==="paid"?"vollständig erkannt":s.status==="partial"?"teilweise erkannt":s.status==="over"?"über Soll erkannt":s.status==="missing"?"noch nicht erkannt":"kein aktiver Mietvertrag"}

function latestBillingSnapshot(state){
  return (state.billingSnapshots||[]).slice().sort((a,b)=>Number(b.periodYear)-Number(a.periodYear))[0]||null
}
function billingProjection(s,year=currentPeriodYear()){
  const current=billingAnalysis(s,year),cur=periodCategoryTotals(s,year),prior=periodCategoryTotals(s,year-1),pp=billingPeriodInfo(s,year-1),currentCats=new Set(cur.filter(x=>x.total>0).map(x=>x.category)),factor=pp.active&&pp.days>0?pp.nominalDays/pp.days:1;
  const missing=prior.filter(x=>x.total>0&&!currentCats.has(x.category)).map(x=>({...x,estimatedTenant:Number(x.tenant||0)*(pp.days<pp.nominalDays?factor:1),annualized:pp.days<pp.nominalDays}));
  const estimatedMissingTenant=missing.reduce((sum,x)=>sum+Number(x.estimatedTenant||0),0),projectedTenantCosts=Number(current.tenantCosts||0)+estimatedMissingTenant,projectedResult=projectedTenantCosts-Number(current.advances||0);
  const priorCats=prior.filter(x=>x.total>0).length,matched=prior.filter(x=>currentCats.has(x.category)).length;
  let confidence=priorCats?Math.round(55+40*(matched/priorCats)):Math.min(55,25+(current.events||[]).length*5);if(pp.days<pp.nominalDays&&missing.length)confidence=Math.max(35,confidence-15);
  return {year,knownTenantCosts:Number(current.tenantCosts||0),estimatedMissingTenant,projectedTenantCosts,advances:Number(current.advances||0),projectedResult,missingCategories:missing,confidence:Math.max(20,Math.min(95,confidence)),period:current.period}
}

