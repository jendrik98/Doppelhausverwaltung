type AnyRecord = Record<string, any>;

type LifecycleState = AnyRecord & {
  leases: AnyRecord[];
  payments: AnyRecord[];
  meters: AnyRecord[];
  rentAllocations: AnyRecord[];
  meterReplacements: AnyRecord[];
  billingSnapshots: AnyRecord[];
  units: AnyRecord[];
  meta: AnyRecord;
};

export const LIFECYCLE_LEDGER_VERSION = 1;

const arr = (v: any): AnyRecord[] => Array.isArray(v) ? v : [];
const num = (v: any): number => Number.isFinite(Number(v)) ? Number(v) : 0;
const id = (prefix="id"): string => globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const dateOk = (v: any): boolean => /^\d{4}-\d{2}-\d{2}$/.test(String(v||""));
const monthOk = (v: any): boolean => /^\d{4}-\d{2}$/.test(String(v||""));
const dayValue = (v: string): number => {
  const m=String(v||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?Date.UTC(+m[1],+m[2]-1,+m[3]):NaN
};
export const daysInclusive = (a: string,b: string): number => {
  const x=dayValue(a),y=dayValue(b);return Number.isFinite(x)&&Number.isFinite(y)&&y>=x?Math.round((y-x)/86400000)+1:0
};
export const maxDate=(a:string,b:string)=>!a?b:!b?a:(a>b?a:b);
export const minDate=(a:string,b:string)=>!a?b:!b?a:(a<b?a:b);
export const monthStart=(month:string)=>`${month}-01`;
export function monthEnd(month:string){const [y,m]=month.split("-").map(Number);return `${month}-${String(new Date(Date.UTC(y,m,0)).getUTCDate()).padStart(2,"0")}`}
export function monthRange(startMonth:string,endMonth:string){
  if(!monthOk(startMonth)||!monthOk(endMonth)||endMonth<startMonth)return [];
  const out:string[]=[];let [y,m]=startMonth.split("-").map(Number);
  while(`${y}-${String(m).padStart(2,"0")}`<=endMonth&&out.length<600){out.push(`${y}-${String(m).padStart(2,"0")}`);m++;if(m===13){m=1;y++}}
  return out
}
export function periodOverlap(start:string,end:string,otherStart:string,otherEnd:string){const s=maxDate(start,otherStart),e=minDate(end,otherEnd);return s&&e&&s<=e?{start:s,end:e,days:daysInclusive(s,e)}:null}

export function ensureLeaseTerms(lease:AnyRecord){
  lease.terms=arr(lease.terms);
  if(!lease.terms.length&&dateOk(lease.start))lease.terms.push({id:id("term"),effectiveFrom:lease.start,rent:num(lease.rent),advance:num(lease.advance),reason:"Migration aus Vertragsstammdaten"});
  lease.terms=lease.terms.filter((t:AnyRecord)=>dateOk(t.effectiveFrom)).map((t:AnyRecord)=>({id:t.id||id("term"),effectiveFrom:t.effectiveFrom,rent:Math.max(0,num(t.rent)),advance:Math.max(0,num(t.advance)),reason:String(t.reason||"")})).sort((a:AnyRecord,b:AnyRecord)=>a.effectiveFrom.localeCompare(b.effectiveFrom));
  const latest=lease.terms.at(-1);if(latest){lease.rent=latest.rent;lease.advance=latest.advance}
  lease.handover=lease.handover&&typeof lease.handover==="object"?lease.handover:{};
  return lease
}

export type OperatingCostMode = "unknown"|"advance"|"flat"|"included"|"none";

const OPERATING_COST_MODES=new Set<OperatingCostMode>(["unknown","advance","flat","included","none"]);
const standardOperatingCostCategories=new Set(["propertyTax","rainwater","street","waste","insurance","chimney","water","garden","cleaning"]);

export function operatingCostAgreement(lease:AnyRecord|null|undefined){
  const configured=!!lease&&["operatingCostsMode","operatingCostsAgreed","operatingCostsReference","operatingCostCategories","operatingCostOtherLabels"].some(key=>Object.prototype.hasOwnProperty.call(lease,key));
  const raw=String(lease?.operatingCostsMode||"").trim() as OperatingCostMode;
  const mode:OperatingCostMode=OPERATING_COST_MODES.has(raw)?raw:"unknown";
  const categories=[...new Set(arr(lease?.operatingCostCategories).map(x=>String(x||"").trim()).filter(Boolean))];
  const otherLabels=[...new Set(arr(lease?.operatingCostOtherLabels).map(x=>String(x||"").trim()).filter(Boolean))];
  const reference=String(lease?.operatingCostsReference||"").trim();
  const agreed=mode==="advance"||mode==="flat"?true:mode==="included"||mode==="none"?false:lease?.operatingCostsAgreed===true?true:lease?.operatingCostsAgreed===false?false:null;
  return {mode,agreed,reference,categories,otherLabels,verifiedAt:String(lease?.operatingCostsVerifiedAt||""),legacy:!configured}
}

export function updateOperatingCostAgreement(state:LifecycleState,leaseId:string,payload:AnyRecord){
  ensureLifecycleState(state);const lease=state.leases.find(l=>String(l.id||"")===String(leaseId||""));if(!lease)throw new Error("Mietverhältnis fehlt.");
  const raw=String(payload.mode||payload.operatingCostsMode||"unknown").trim() as OperatingCostMode;if(!OPERATING_COST_MODES.has(raw))throw new Error("Betriebskosten-Modus ist ungültig.");
  const reference=String(payload.reference??payload.operatingCostsReference??"").trim();
  const categories=[...new Set(arr(payload.categories??payload.operatingCostCategories).map(x=>String(x||"").trim()).filter(Boolean))];
  const rawOther=payload.otherLabels??payload.operatingCostOtherLabels??[];
  const otherLabels=[...new Set((Array.isArray(rawOther)?rawOther:String(rawOther||"").split(/[,;\n]+/)).map(x=>String(x||"").trim()).filter(Boolean))];
  if(raw==="advance"&&!reference&&!categories.length)throw new Error("Für eine Betriebskostenabrechnung bitte Vertragsverweis oder vereinbarte Kostenarten dokumentieren.");
  if(raw==="advance"&&categories.includes("other")&&!otherLabels.length)throw new Error("Sonstige Betriebskosten müssen mit ihrer konkreten Vertragsbezeichnung dokumentiert werden.");
  lease.operatingCostsMode=raw;
  lease.operatingCostsAgreed=raw==="advance"||raw==="flat"?true:raw==="included"||raw==="none"?false:null;
  lease.operatingCostsReference=reference;
  lease.operatingCostCategories=categories;
  lease.operatingCostOtherLabels=otherLabels;
  lease.operatingCostsVerifiedAt=new Date().toISOString();
  return operatingCostAgreement(lease)
}

export function operatingCostContractDecision(lease:AnyRecord|null|undefined,event:AnyRecord){
  const agreement=operatingCostAgreement(lease),category=String(event?.category||"").trim(),label=String(event?.label||"").trim();
  if(event?.decision?.rule==="owner"||event?.decision?.billable===false)return {status:"not-applicable",allowed:true,blocking:false,reason:"Diese Position ist bereits der Vermieterseite zugeordnet.",agreement};
  if(agreement.mode==="unknown"){
    const reason=agreement.legacy?"Bestandsvertrag: Betriebskosten-Umlagegrundlage ist noch nicht bestätigt; vor einer Jahresabrechnung muss die Vertragsbasis geprüft werden.":"Betriebskosten-Umlagegrundlage dieses Mietverhältnisses ist noch nicht geprüft.";
    return {status:agreement.legacy?"legacy-unverified":"check",allowed:false,blocking:true,reason,agreement}
  }
  if(agreement.mode==="flat")return {status:"blocked",allowed:false,blocking:true,reason:"Für dieses Mietverhältnis ist eine Betriebskostenpauschale hinterlegt; eine verbrauchs-/kostenbezogene Jahresabrechnung darf daraus nicht erzeugt werden.",agreement};
  if(agreement.mode==="included")return {status:"blocked",allowed:false,blocking:true,reason:"Betriebskosten sind als in der Miete enthalten hinterlegt; eine gesonderte Jahresabrechnung ist nicht freigegeben.",agreement};
  if(agreement.mode==="none")return {status:"blocked",allowed:false,blocking:true,reason:"Für dieses Mietverhältnis ist keine Betriebskostenumlage hinterlegt.",agreement};

  const broadReference=/\bbetrkv\b|betriebskostenverordnung/i.test(agreement.reference);
  const explicit=agreement.categories;
  if(category==="other"){
    if(explicit.length&&!explicit.includes("other"))return {status:"excluded",allowed:false,blocking:false,reason:"Diese Kostenart ist im hinterlegten Vertrag nicht ausgewählt.",agreement};
    const normalizedLabel=normalize(label);
    const named=agreement.otherLabels.some(x=>{const n=normalize(x);return !!n&&(normalizedLabel===n||normalizedLabel.includes(n)||n.includes(normalizedLabel))});
    if(!named)return {status:"check",allowed:false,blocking:true,reason:"Sonstige Betriebskosten müssen im Vertrag konkret bezeichnet sein; für diese Position fehlt eine passende Bezeichnung.",agreement};
    return {status:"ok",allowed:true,blocking:false,reason:"Die sonstige Betriebskostenart ist im Vertrag konkret hinterlegt.",agreement}
  }
  if(explicit.length){
    if(explicit.includes(category))return {status:"ok",allowed:true,blocking:false,reason:"Kostenart ist für dieses Mietverhältnis ausdrücklich hinterlegt.",agreement};
    return {status:"excluded",allowed:false,blocking:false,reason:"Kostenart ist in der hinterlegten Vertragsauswahl nicht enthalten.",agreement}
  }
  if(broadReference&&standardOperatingCostCategories.has(category))return {status:"ok",allowed:true,blocking:false,reason:"Vertragsverweis auf die BetrKV deckt diese Standard-Betriebskostenart ab.",agreement};
  return {status:"check",allowed:false,blocking:true,reason:"Für diese Kostenart ist keine belastbare Umlagegrundlage im Mietverhältnis dokumentiert.",agreement}
}

export function applyOperatingCostAgreementToAnalysis(base:AnyRecord,lease:AnyRecord|null|undefined){
  if(!lease)return base;
  const agreement=operatingCostAgreement(lease),events=arr(base?.events).map((e:AnyRecord)=>{const contractDecision=operatingCostContractDecision(lease,e);return contractDecision.allowed?{...e,contractDecision}:{...e,tenantAmount:0,contractDecision}}) as AnyRecord[];
  const unresolved=arr(base?.unresolved).slice(),known=new Set(unresolved.map(x=>String(x?.id||"")));
  for(const e of events){if(!e.contractDecision?.blocking)continue;const key=`contract-${e.positionId||e.id||e.category||"cost"}`;if(known.has(key))continue;known.add(key);unresolved.push({id:key,reason:e.contractDecision.reason,category:e.category,label:e.label,contract:true})}
  const tenantCosts=events.reduce((sum,e)=>sum+num(e.tenantAmount),0),advances=num(base?.advances);
  const warnings=agreement.mode==="unknown"&&agreement.legacy?[{id:`contract-legacy-${lease.id||"lease"}`,reason:"Bestandsvertrag: Betriebskosten-Umlagegrundlage noch nicht bestätigt."}]:[];
  return {...base,events,unresolved,tenantCosts,result:tenantCosts-advances,contractAgreement:agreement,contractWarnings:warnings}
}


export function ensureLifecycleState<T extends LifecycleState>(state:T):T{
  state.meta=state.meta&&typeof state.meta==="object"?state.meta:{};
  const previousVersion=Number(state.meta.lifecycleLedgerVersion||0);
  state.leases=arr(state.leases);state.payments=arr(state.payments);state.meters=arr(state.meters);state.billingSnapshots=arr(state.billingSnapshots);
  state.rentAllocations=arr(state.rentAllocations);state.meterReplacements=arr(state.meterReplacements);state.units=arr(state.units);
  for(const lease of state.leases)ensureLeaseTerms(lease);
  for(const a of state.rentAllocations){a.id=a.id||id("alloc");a.total=num(a.total||num(a.rentAmount)+num(a.advanceAmount));a.rentAmount=num(a.rentAmount);a.advanceAmount=num(a.advanceAmount);a.sign=a.sign===-1?-1:1}
  if(previousVersion<LIFECYCLE_LEDGER_VERSION){migrateLegacyRentAllocations(state);state.meta.lifecycleLedgerMigratedAt=new Date().toISOString()}
  state.meta.lifecycleLedgerVersion=LIFECYCLE_LEDGER_VERSION;return state
}

function legacyPaymentMatchesLease(payment:AnyRecord,lease:AnyRecord){
  if(String(payment.leaseId||"")===String(lease.id||""))return true;
  const label=normalize(String(payment.label||"")),tenant=normalize(String(lease.tenantName||""));
  return /\bmiete\b|mietzahlung|monatsmiete|betriebskosten|nebenkosten|\bbk\b/.test(label)||!!(tenant&&label.includes(tenant))
}
function migrateLegacyRentAllocations(state:LifecycleState){
  if(state.rentAllocations.length)return;
  for(const payment of state.payments.filter(p=>p.direction==="income"&&num(p.amount)>0).sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")))){
    const date=String(payment.date||"").slice(0,10);if(!dateOk(date))continue;
    const explicit=payment.leaseId?state.leases.find(l=>String(l.id||"")===String(payment.leaseId)):null;
    const active=state.leases.filter(l=>(!l.start||l.start<=date)&&(!l.end||l.end>=date));
    const lease=explicit||(active.length===1?active[0]:active.find(l=>legacyPaymentMatchesLease(payment,l)));
    if(!lease||!legacyPaymentMatchesLease(payment,lease))continue;
    const month=date.slice(0,7),charge=leaseChargeForMonth(lease,month),applied=Math.min(num(payment.amount),num(charge.total));if(applied<=.005)continue;
    const split=splitAllocation(applied,charge);state.rentAllocations.push({id:id("alloc"),buildingId:lease.buildingId||payment.buildingId||"",leaseId:lease.id,paymentId:payment.id,month,rentAmount:split.rentAmount,advanceAmount:split.advanceAmount,total:split.total,sign:1,kind:"payment",origin:"legacy-payment-migration",confidence:legacyPaymentMatchesLease(payment,lease)?90:70,createdAt:new Date().toISOString()});payment.leaseId=payment.leaseId||lease.id
  }
}

export function leaseTermAt(lease:AnyRecord,date:string){
  ensureLeaseTerms(lease);return lease.terms.filter((t:AnyRecord)=>t.effectiveFrom<=date).at(-1)||lease.terms[0]||{rent:num(lease.rent),advance:num(lease.advance),effectiveFrom:lease.start||date}
}
export function leasesForUnit(state:LifecycleState,unitId:string){return arr(state.leases).filter(l=>String(l.unitId||"")===String(unitId||"")).sort((a,b)=>String(a.start||"").localeCompare(String(b.start||"")))}
export function activeLeaseAt(state:LifecycleState,date:string,unitId=""){
  return arr(state.leases).find(l=>(!unitId||String(l.unitId||"")===unitId)&&(!l.start||l.start<=date)&&(!l.end||l.end>=date))||null
}
export function leaseOverlapsYear(lease:AnyRecord,year:number){const ps=`${year}-01-01`,pe=`${year}-12-31`;return !!periodOverlap(lease.start||ps,lease.end||pe,ps,pe)}
export function leasesForBillingYear(state:LifecycleState,year:number,buildingId=""){
  return arr(state.leases).filter(l=>(!buildingId||String(l.buildingId||"")===buildingId)&&leaseOverlapsYear(l,year)).sort((a,b)=>String(a.start||"").localeCompare(String(b.start||"")))
}

export function leaseChargeForMonth(lease:AnyRecord,month:string){
  if(!monthOk(month))return {month,leaseId:lease.id,rent:0,advance:0,total:0,activeDays:0,monthDays:0};
  ensureLeaseTerms(lease);const ms=monthStart(month),me=monthEnd(month),active=periodOverlap(lease.start||ms,lease.end||me,ms,me),monthDays=daysInclusive(ms,me);
  if(!active)return {month,leaseId:lease.id,rent:0,advance:0,total:0,activeDays:0,monthDays};
  const boundaries=new Set<string>([active.start]);
  for(const term of lease.terms)if(term.effectiveFrom>active.start&&term.effectiveFrom<=active.end)boundaries.add(term.effectiveFrom);
  const starts=[...boundaries].sort(),parts=[] as AnyRecord[];let rent=0,advance=0;
  for(let i=0;i<starts.length;i++){
    const start=starts[i],next=starts[i+1],end=next?new Date(dayValue(next)-86400000).toISOString().slice(0,10):active.end,days=daysInclusive(start,end),term=leaseTermAt(lease,start),factor=days/monthDays;
    rent+=num(term.rent)*factor;advance+=num(term.advance)*factor;parts.push({start,end,days,rent:num(term.rent)*factor,advance:num(term.advance)*factor,termId:term.id})
  }
  return {month,leaseId:lease.id,rent,advance,total:rent+advance,activeDays:active.days,monthDays,parts}
}

function allocationSigned(a:AnyRecord){return (a.sign===-1?-1:1)*num(a.total||num(a.rentAmount)+num(a.advanceAmount))}
export function allocationsForLeaseMonth(state:LifecycleState,leaseId:string,month:string){return arr(state.rentAllocations).filter(a=>String(a.leaseId||"")===leaseId&&a.month===month)}
export function ledgerRow(state:LifecycleState,lease:AnyRecord,month:string){
  const charge=leaseChargeForMonth(lease,month),allocations=allocationsForLeaseMonth(state,String(lease.id),month),paid=allocations.reduce((s,a)=>s+allocationSigned(a),0),advancePaid=allocations.reduce((s,a)=>s+(a.sign===-1?-1:1)*num(a.advanceAmount),0),difference=paid-charge.total;
  return {...charge,tenantName:lease.tenantName||"",allocations,paid,advancePaid,difference,status:charge.total<=.005?"none":difference>=-.01?difference>.01?"overpaid":"paid":paid>.01?"partial":"missing"}
}
export function rentLedger(state:LifecycleState,{buildingId="",leaseId="",startMonth="",endMonth=""}:{buildingId?:string;leaseId?:string;startMonth?:string;endMonth?:string}={}){
  ensureLifecycleState(state);const now=new Date(),end=endMonth||`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`,start=startMonth||(()=>{const d=new Date(now.getFullYear(),now.getMonth()-11,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`})(),months=monthRange(start,end),leases=state.leases.filter(l=>(!buildingId||String(l.buildingId||"")===buildingId)&&(!leaseId||String(l.id||"")===leaseId)),rows=[] as AnyRecord[];
  for(const lease of leases)for(const month of months){const row=ledgerRow(state,lease,month);if(row.status!=="none")rows.push(row)}
  const open=rows.reduce((s,r)=>s+Math.max(0,-r.difference),0),credit=rows.reduce((s,r)=>s+Math.max(0,r.difference),0),expected=rows.reduce((s,r)=>s+r.total,0),paid=rows.reduce((s,r)=>s+r.paid,0);
  return {rows,expected,paid,open,credit,startMonth:start,endMonth:end}
}

export function splitAllocation(total:number,charge:AnyRecord){
  const signed=Math.max(0,num(total)),rent=Math.min(signed,Math.max(0,num(charge.rent))),advance=Math.min(Math.max(0,signed-rent),Math.max(0,num(charge.advance)));return {rentAmount:rent,advanceAmount:advance,total:rent+advance,unapplied:Math.max(0,signed-rent-advance)}
}
export function paymentAllocations(state:LifecycleState,paymentId:string){return arr(state.rentAllocations).filter(a=>String(a.paymentId||"")===String(paymentId||""))}
export function replacePaymentAllocations(state:LifecycleState,paymentId:string,items:AnyRecord[]){
  ensureLifecycleState(state);const payment=state.payments.find(p=>String(p.id||"")===String(paymentId||""));if(!payment)throw new Error("Zahlung fehlt.");
  const sign=payment.kind==="rent-reversal"||payment.rentReversal===true?-1:1,amount=Math.max(0,num(payment.amount));let sum=0;const out=[] as AnyRecord[];
  for(const raw of items||[]){const lease=state.leases.find(l=>String(l.id||"")===String(raw.leaseId||payment.leaseId||""));if(!lease)throw new Error("Mietverhältnis für Zahlungszuordnung fehlt.");if(!monthOk(raw.month))throw new Error("Monat der Zahlungszuordnung ist ungültig.");const charge=leaseChargeForMonth(lease,raw.month),requested=Math.max(0,num(raw.total));const split=raw.rentAmount!=null||raw.advanceAmount!=null?{rentAmount:Math.max(0,num(raw.rentAmount)),advanceAmount:Math.max(0,num(raw.advanceAmount)),total:Math.max(0,num(raw.rentAmount))+Math.max(0,num(raw.advanceAmount)),unapplied:0}:splitAllocation(requested,charge);sum+=split.total;out.push({id:id("alloc"),buildingId:lease.buildingId||payment.buildingId||"",leaseId:lease.id,paymentId:payment.id,month:raw.month,rentAmount:split.rentAmount,advanceAmount:split.advanceAmount,total:split.total,sign,kind:sign<0?"reversal":"payment",createdAt:new Date().toISOString()})}
  if(sum>amount+.01)throw new Error("Zugeordneter Betrag ist höher als die Buchung.");state.rentAllocations=state.rentAllocations.filter(a=>String(a.paymentId||"")!==String(payment.id)).concat(out);payment.leaseId=out[0]?.leaseId||payment.leaseId||"";payment.kind=sign<0?"rent-reversal":"rent";return {allocations:out,allocated:sum,unallocated:Math.max(0,amount-sum)}
}
export function autoAllocationProposal(state:LifecycleState,paymentId:string){
  ensureLifecycleState(state);const p=state.payments.find(x=>String(x.id||"")===String(paymentId||""));if(!p||p.direction!=="income")return [];
  const date=String(p.date||"").slice(0,10),lease=state.leases.find(l=>String(l.id||"")===String(p.leaseId||""))||activeLeaseAt(state,date)||state.leases.find(l=>normalize(String(p.label||"")).includes(normalize(String(l.tenantName||""))));if(!lease)return [];
  const targetMonth=date.slice(0,7),months=monthRange(lease.start?.slice(0,7)||targetMonth,targetMonth),rows=months.map(m=>ledgerRow(state,lease,m)).filter(r=>r.difference<-.01),out=[] as AnyRecord[];let remaining=Math.max(0,num(p.amount));
  for(const row of rows){if(remaining<=.005)break;const need=Math.min(remaining,-row.difference),split=splitAllocation(need,{rent:Math.max(0,row.rent-Math.max(0,row.paid)),advance:row.advance});out.push({leaseId:lease.id,month:row.month,...split,total:need});remaining-=need}
  if(!out.length&&remaining>.005)out.push({leaseId:lease.id,month:targetMonth,...splitAllocation(remaining,leaseChargeForMonth(lease,targetMonth)),total:remaining});return out
}
function normalize(v:string){return String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim()}

export function actualAdvanceFromLedger(state:LifecycleState,lease:AnyRecord,periodStart:string,periodEnd:string){
  ensureLifecycleState(state);const rows=arr(state.rentAllocations).filter(a=>String(a.leaseId||"")===String(lease?.id||"")&&monthOk(a.month)&&periodOverlap(monthStart(a.month),monthEnd(a.month),periodStart,periodEnd)),recognizedPayments=new Set(rows.map(a=>a.paymentId).filter(Boolean));return {amount:rows.reduce((s,a)=>s+(a.sign===-1?-1:1)*num(a.advanceAmount),0),recognizedPayments:recognizedPayments.size,source:"ledger",allocationCount:rows.length}
}

export function createTenancy(state:LifecycleState,payload:AnyRecord){
  ensureLifecycleState(state);if(!dateOk(payload.start))throw new Error("Vertragsbeginn fehlt.");const unit=state.units.find(u=>String(u.id||"")===String(payload.unitId||""));if(!unit)throw new Error("Mietwohnung fehlt.");const end=payload.end||"9999-12-31";
  for(const other of state.leases){if(String(other.unitId||"")!==String(unit.id)||String(other.id||"")===String(payload.id||""))continue;const overlap=periodOverlap(payload.start,end,other.start||"0001-01-01",other.end||"9999-12-31");if(overlap)throw new Error(`Mietverhältnisse überschneiden sich ab ${overlap.start}.`)}
  const lease={id:payload.id||id("lease"),buildingId:unit.buildingId,unitId:unit.id,tenantName:String(payload.tenantName||"").trim(),tenantAddress:String(payload.tenantAddress||"").trim(),start:payload.start,end:payload.end||"",rent:Math.max(0,num(payload.rent)),advance:Math.max(0,num(payload.advance)),note:String(payload.note||"").trim(),operatingCostsMode:String(payload.operatingCostsMode||"unknown"),operatingCostsAgreed:payload.operatingCostsAgreed??null,operatingCostsReference:String(payload.operatingCostsReference||"").trim(),operatingCostCategories:arr(payload.operatingCostCategories),operatingCostOtherLabels:arr(payload.operatingCostOtherLabels),terms:[],handover:{}};ensureLeaseTerms(lease);state.leases.push(lease);return lease
}
export function updateTenancyEnd(state:LifecycleState,leaseId:string,end:string,note=""){
  ensureLifecycleState(state);const lease=state.leases.find(l=>String(l.id||"")===String(leaseId));if(!lease)throw new Error("Mietverhältnis fehlt.");if(end&&(!dateOk(end)||end<lease.start))throw new Error("Vertragsende ist ungültig.");lease.end=end||"";if(note)lease.note=[lease.note,note].filter(Boolean).join(" · ");return lease
}
export function addLeaseTerm(state:LifecycleState,leaseId:string,payload:AnyRecord){
  ensureLifecycleState(state);const lease=state.leases.find(l=>String(l.id||"")===String(leaseId));if(!lease)throw new Error("Mietverhältnis fehlt.");const effectiveFrom=String(payload.effectiveFrom||"");if(!dateOk(effectiveFrom)||effectiveFrom<lease.start||(lease.end&&effectiveFrom>lease.end))throw new Error("Stichtag der Vertragsänderung liegt außerhalb des Mietverhältnisses.");ensureLeaseTerms(lease);const existing=lease.terms.find((t:AnyRecord)=>t.effectiveFrom===effectiveFrom),term={id:existing?.id||id("term"),effectiveFrom,rent:Math.max(0,num(payload.rent)),advance:Math.max(0,num(payload.advance)),reason:String(payload.reason||"Vertragsänderung").trim()};if(existing)Object.assign(existing,term);else lease.terms.push(term);ensureLeaseTerms(lease);return term
}

function meterForRoleAt(state:LifecycleState,role:string,date:string,buildingId=""){return state.meters.filter(m=>m.role===role&&(!buildingId||String(m.buildingId||"")===buildingId)&&(!m.installedAt||m.installedAt<=date)&&(!m.removedAt||m.removedAt>=date)).sort((a,b)=>String(b.installedAt||"").localeCompare(String(a.installedAt||"")))[0]||null}
function exactReading(meter:AnyRecord,date:string){return arr(meter?.readings).find(r=>r.date===date)||null}
function addReading(meter:AnyRecord,date:string,value:number,origin:string){meter.readings=arr(meter.readings);const existing=exactReading(meter,date);if(existing){existing.value=value;existing.origin=origin;return existing}const r={id:id("reading"),date,value:num(value),origin,synthetic:false,createdAt:new Date().toISOString()};meter.readings.push(r);meter.readings.sort((a:any,b:any)=>String(a.date).localeCompare(String(b.date)));return r}
export function recordHandover(state:LifecycleState,leaseId:string,payload:AnyRecord){
  ensureLifecycleState(state);const lease=state.leases.find(l=>String(l.id||"")===String(leaseId));if(!lease)throw new Error("Mietverhältnis fehlt.");const kind=payload.kind==="move-out"?"moveOut":"moveIn",date=String(payload.date||"");if(!dateOk(date))throw new Error("Übergabedatum fehlt.");if(kind==="moveIn"&&lease.start&&date!==lease.start)throw new Error("Einzugsübergabe muss am Vertragsbeginn liegen.");if(kind==="moveOut"&&lease.end&&date!==lease.end)throw new Error("Auszugsübergabe muss am Vertragsende liegen.");const readings=[] as AnyRecord[];for(const x of arr(payload.readings)){if(x.value==null||x.value==="")continue;const meter=x.meterId?state.meters.find(m=>String(m.id)===String(x.meterId)):meterForRoleAt(state,String(x.role||""),date,String(lease.buildingId||""));if(!meter)continue;const reading=addReading(meter,date,num(x.value),"handover");readings.push({meterId:meter.id,role:meter.role,readingId:reading.id,value:reading.value})}
  const persons=Math.max(0,num(payload.persons)),unit=state.units.find(u=>String(u.id||"")===String(lease.unitId||""));if(unit&&payload.persons!==undefined&&payload.persons!==null&&payload.persons!==""){unit.occupancy=arr(unit.occupancy);if(kind==="moveIn"){for(const o of unit.occupancy as AnyRecord[])if(!o.to&&o.from&&o.from<date)o.to=new Date(dayValue(date)-86400000).toISOString().slice(0,10);const existing=unit.occupancy.find((o:AnyRecord)=>o.from===date);if(existing)existing.count=persons;else unit.occupancy.push({from:date,to:"",count:persons})}else{const active=unit.occupancy.filter((o:AnyRecord)=>(!o.from||o.from<=date)&&(!o.to||o.to>=date)).sort((a:AnyRecord,b:AnyRecord)=>String(b.from||"").localeCompare(String(a.from||"")))[0];if(active)active.to=date}unit.occupancy.sort((a:AnyRecord,b:AnyRecord)=>String(a.from||"").localeCompare(String(b.from||"")))}
  lease.handover=lease.handover||{};lease.handover[kind]={date,persons,readings,note:String(payload.note||""),createdAt:new Date().toISOString()};return lease.handover[kind]
}

export function recordMeterReplacement(state:LifecycleState,payload:AnyRecord){
  ensureLifecycleState(state);const old=state.meters.find(m=>String(m.id||"")===String(payload.oldMeterId||""));if(!old)throw new Error("Ausgebauter Zähler fehlt.");const date=String(payload.date||"");if(!dateOk(date))throw new Error("Wechseldatum fehlt.");if(old.removedAt&&old.removedAt<date)throw new Error("Zähler war zu diesem Datum bereits ausgebaut.");const closing=addReading(old,date,num(payload.oldValue),"meter-replacement-close");old.removedAt=date;
  const fresh={id:id("meter"),buildingId:old.buildingId,unitId:old.unitId||"",role:old.role,name:String(payload.name||old.name||"Zähler"),number:String(payload.newNumber||"").trim(),unit:old.unit||"m³",installedAt:date,removedAt:"",predecessorMeterId:old.id,readings:[]};const opening=addReading(fresh,date,num(payload.newValue),"meter-replacement-open");old.successorMeterId=fresh.id;state.meters.push(fresh);const event={id:id("replacement"),buildingId:old.buildingId,role:old.role,date,oldMeterId:old.id,newMeterId:fresh.id,oldReadingId:closing.id,newReadingId:opening.id,reason:String(payload.reason||"Zählerwechsel"),createdAt:new Date().toISOString()};state.meterReplacements.push(event);return {event,oldMeter:old,newMeter:fresh}
}
export function meterChain(state:LifecycleState,role:string,buildingId=""){return state.meters.filter(m=>m.role===role&&(!buildingId||String(m.buildingId||"")===buildingId)).sort((a,b)=>String(a.installedAt||"0001-01-01").localeCompare(String(b.installedAt||"0001-01-01")))}
export function roleConsumptionBetween(state:LifecycleState,role:string,start:string,end:string,buildingId=""){
  ensureLifecycleState(state);if(!dateOk(start)||!dateOk(end)||end<start)return {valid:false,total:0,segments:[],missing:[start,end]};const segments=[] as AnyRecord[],missing:string[]=[];
  for(const meter of meterChain(state,role,buildingId)){const seg=periodOverlap(start,end,meter.installedAt||start,meter.removedAt||end);if(!seg)continue;const sr=exactReading(meter,seg.start),er=exactReading(meter,seg.end);if(!sr)missing.push(`${meter.id}:${seg.start}`);if(!er)missing.push(`${meter.id}:${seg.end}`);if(sr&&er){const delta=num(er.value)-num(sr.value);segments.push({meterId:meter.id,start:seg.start,end:seg.end,startReadingId:sr.id,endReadingId:er.id,startValue:num(sr.value),endValue:num(er.value),delta})}}
  const total=segments.reduce((s,x)=>s+x.delta,0),valid=segments.length>0&&!missing.length&&segments.every(x=>x.delta>=0);return {valid,total,segments,missing:[...new Set(missing)]}
}
export function waterConsumptionBetween(state:LifecycleState,start:string,end:string,buildingId=""){
  const main=roleConsumptionBetween(state,"mainWater",start,end,buildingId),owner=roleConsumptionBetween(state,"ownerWater",start,end,buildingId),tenant=main.total-owner.total;return {house:main.total,owner:owner.total,tenant,share:main.total>0?tenant/main.total:0,mainSegments:main.segments,ownerSegments:owner.segments,missing:[...main.missing,...owner.missing],valid:main.valid&&owner.valid&&tenant>=0}
}
export function replacementsInPeriod(state:LifecycleState,start:string,end:string,buildingId=""){return arr(state.meterReplacements).filter(r=>(!buildingId||String(r.buildingId||"")===buildingId)&&r.date>=start&&r.date<=end)}

export function leaseWaterConsumption(state:LifecycleState,lease:AnyRecord,year:number){const ps=`${year}-01-01`,pe=`${year}-12-31`,ov=periodOverlap(lease.start||ps,lease.end||pe,ps,pe);return ov?waterConsumptionBetween(state,ov.start,ov.end,String(lease.buildingId||"")):{valid:false,house:0,owner:0,tenant:0,share:0,missing:[]}}
export function leaseBillingAnalysis(state:LifecycleState,base:AnyRecord,year:number,leaseId:string){
  ensureLifecycleState(state);const lease=state.leases.find(l=>String(l.id||"")===String(leaseId||""));if(!lease)throw new Error("Mietverhältnis für Abrechnung fehlt.");const ps=base?.period?.start||`${year}-01-01`,pe=base?.period?.end||`${year}-12-31`,leasePeriod=periodOverlap(lease.start||ps,lease.end||pe,ps,pe);if(!leasePeriod)return {...base,lease,leaseId:lease.id,events:[],tenantCosts:0,advances:0,result:0,unresolved:[{id:"lease-period",reason:"Mietverhältnis liegt außerhalb der Periode."}]};const fullDays=daysInclusive(ps,pe),leaseDays=leasePeriod.days,water=waterConsumptionBetween(state,leasePeriod.start,leasePeriod.end,String(lease.buildingId||"")),wholeWater=waterConsumptionBetween(state,ps,pe,String(lease.buildingId||""));
  const yearLeases=leasesForBillingYear(state,year,String(lease.buildingId||""));
  const leasePersons=(l:AnyRecord)=>Math.max(0,num(l.handover?.moveIn?.persons||1));
  const events=arr(base?.events).map(e=>{const eventPeriod=periodOverlap(maxDate(ps,e.serviceStart||ps),minDate(pe,e.serviceEnd||pe),ps,pe),leaseEvent=eventPeriod?periodOverlap(eventPeriod.start,eventPeriod.end,leasePeriod.start,leasePeriod.end):null;let factor=eventPeriod?.days?num(leaseEvent?.days)/eventPeriod.days:(fullDays?leaseDays/fullDays:0);if(e.decision?.rule==="persons"&&eventPeriod){const weighted=yearLeases.map((l:AnyRecord)=>{const ov=periodOverlap(l.start||eventPeriod.start,l.end||eventPeriod.end,eventPeriod.start,eventPeriod.end);return {id:l.id,value:num(ov?.days)*leasePersons(l)}}),den=weighted.reduce((sum:any,x:any)=>sum+x.value,0),mine=weighted.find((x:any)=>String(x.id)===String(lease.id))?.value||0;factor=den>0?mine/den:factor}if(e.decision?.rule==="consumption"){factor=wholeWater.valid&&wholeWater.tenant>0&&water.valid?water.tenant/wholeWater.tenant:0}const tenantAmount=num(e.tenantAmount)*factor;return {...e,tenantAmount,lifecycleFactor:factor,leaseId:lease.id,leasePeriod:{...leasePeriod},lifecycleWater:e.decision?.rule==="consumption"?water:null}});
  const unresolved=arr(base?.unresolved).slice();if(arr(base?.events).some(e=>e.decision?.rule==="consumption")&&!water.valid)unresolved.push({id:"lease-water",reason:"Übergabe-/Zählerstände für den Mietzeitraum sind nicht vollständig.",missing:water.missing});const ledger=actualAdvanceFromLedger(state,lease,leasePeriod.start,leasePeriod.end),legacyFallback=!ledger.allocationCount&&yearLeases.length===1?num(base?.advances):0,advances=ledger.allocationCount?ledger.amount:legacyFallback;if(!ledger.allocationCount&&yearLeases.length>1)unresolved.push({id:"lease-ledger",reason:"Bei mehreren Mietverhältnissen müssen die Vorauszahlungen im Mietkonto zugeordnet sein."});const tenantCosts=events.reduce((s,e)=>s+num(e.tenantAmount),0),analysis={...base,lease,leaseId:lease.id,leasePeriod,events,unresolved,tenantCosts,advances,advanceEvidence:ledger,result:tenantCosts-advances,waterConsumption:water};return applyOperatingCostAgreementToAnalysis(analysis,lease)
}

export function latestSnapshotFor(state:LifecycleState,periodYear:number,leaseId=""){
  return arr(state.billingSnapshots).filter(s=>Number(s.periodYear)===Number(periodYear)&&(!leaseId||String(s.leaseId||s.lease?.id||"")===String(leaseId))).sort((a,b)=>Number(b.version||1)-Number(a.version||1)||String(b.createdAt||"").localeCompare(String(a.createdAt||"")))[0]||null
}
export function nextSnapshotVersion(state:LifecycleState,periodYear:number,leaseId=""){return Number(latestSnapshotFor(state,periodYear,leaseId)?.version||0)+1}
export function decorateSnapshotRevision(state:LifecycleState,snapshot:AnyRecord,{leaseId="",correctionReason="",supersedesSnapshotId=""}:AnyRecord={}){
  const actualLeaseId=leaseId||snapshot.leaseId||snapshot.lease?.id||"",prior=supersedesSnapshotId?state.billingSnapshots.find(s=>String(s.id)===String(supersedesSnapshotId)):latestSnapshotFor(state,Number(snapshot.periodYear),actualLeaseId),version=prior?Number(prior.version||1)+1:1;return {...snapshot,leaseId:actualLeaseId,statementId:snapshot.statementId||`${snapshot.buildingId||"building"}:${snapshot.periodYear}:${actualLeaseId||"lease"}`,version,supersedesSnapshotId:prior?.id||"",correctionReason:version>1?String(correctionReason||"").trim():"",revisionCreatedAt:new Date().toISOString()}
}
export function billingRevisionHistory(state:LifecycleState,periodYear:number,leaseId=""){return arr(state.billingSnapshots).filter(s=>Number(s.periodYear)===Number(periodYear)&&(!leaseId||String(s.leaseId||s.lease?.id||"")===String(leaseId))).sort((a,b)=>Number(a.version||1)-Number(b.version||1))}

export function lifecycleAlerts(state:LifecycleState,buildingId="",today=new Date().toISOString().slice(0,10)){
  ensureLifecycleState(state);const out=[] as AnyRecord[],leases=state.leases.filter(l=>!buildingId||String(l.buildingId||"")===buildingId);
  for(const lease of leases){if(lease.start<=today&&(!lease.end||lease.end>=today)&&!lease.handover?.moveIn)out.push({id:`handover-in-${lease.id}`,severity:"warn",title:"Einzugsübergabe fehlt",detail:`${lease.tenantName||"Mietverhältnis"}: Übergabestand zum ${lease.start} erfassen.`,route:"rental",sub:"lifecycle",leaseId:lease.id});if(lease.end&&lease.end<=today&&!lease.handover?.moveOut)out.push({id:`handover-out-${lease.id}`,severity:"warn",title:"Auszugsübergabe fehlt",detail:`${lease.tenantName||"Mietverhältnis"}: Schlussablesung zum ${lease.end} erfassen.`,route:"rental",sub:"lifecycle",leaseId:lease.id})}
  for(const lease of leases){const agreement=operatingCostAgreement(lease);if(agreement.mode==="unknown")out.push({id:`contract-${lease.id}`,severity:"warn",title:"BK-Umlagegrundlage prüfen",detail:`${lease.tenantName||"Mietverhältnis"}: Vertragsbasis für Betriebskosten dokumentieren.`,route:"rental",sub:"lifecycle",leaseId:lease.id})}
  const ledger=rentLedger(state,{buildingId});for(const row of ledger.rows.filter(r=>["missing","partial"].includes(r.status)&&monthEnd(r.month)<today).slice(-6))out.push({id:`rent-${row.leaseId}-${row.month}`,severity:"warn",title:`Mietkonto ${row.month} offen`,detail:`${row.tenantName||"Mietverhältnis"}: ${Math.abs(row.difference).toFixed(2)} € offen.`,route:"rental",sub:"lifecycle",leaseId:row.leaseId});return out
}

export function validateLifecycleState(state:LifecycleState){
  ensureLifecycleState(state);const errors:string[]=[],warnings:string[]=[];
  const leaseIds=new Set(state.leases.map(l=>String(l.id||""))),paymentIds=new Set(state.payments.map(p=>String(p.id||""))),meterIds=new Set(state.meters.map(m=>String(m.id||"")));
  for(const unit of state.units){const leases=leasesForUnit(state,String(unit.id||""));for(let i=1;i<leases.length;i++){const a=leases[i-1],b=leases[i],ov=periodOverlap(a.start||"0001-01-01",a.end||"9999-12-31",b.start||"0001-01-01",b.end||"9999-12-31");if(ov)errors.push(`Mietverhältnisse ${a.id}/${b.id} überschneiden sich ab ${ov.start}`)}}
  for(const lease of state.leases){if(!dateOk(lease.start))warnings.push(`Mietverhältnis ${lease.id}: historischer Vertragsbeginn fehlt`);ensureLeaseTerms(lease);const seen=new Set<string>();for(const term of lease.terms){if(seen.has(term.effectiveFrom))errors.push(`Mietverhältnis ${lease.id}: doppelter Vertragsstichtag ${term.effectiveFrom}`);seen.add(term.effectiveFrom)}}
  for(const a of state.rentAllocations){if(!leaseIds.has(String(a.leaseId||"")))errors.push(`Mietzuordnung ${a.id}: Mietverhältnis fehlt`);if(!paymentIds.has(String(a.paymentId||"")))errors.push(`Mietzuordnung ${a.id}: Zahlung fehlt`);if(!monthOk(a.month))errors.push(`Mietzuordnung ${a.id}: Monat ungültig`);if(num(a.rentAmount)<0||num(a.advanceAmount)<0)errors.push(`Mietzuordnung ${a.id}: negativer Teilbetrag`)}
  for(const r of state.meterReplacements){if(!meterIds.has(String(r.oldMeterId||""))||!meterIds.has(String(r.newMeterId||"")))errors.push(`Zählerwechsel ${r.id}: Zählerreferenz fehlt`);if(!dateOk(r.date))errors.push(`Zählerwechsel ${r.id}: Datum ungültig`)}
  for(const s of state.billingSnapshots){if(Number(s.version||1)>1&&!String(s.correctionReason||"").trim())warnings.push(`Abrechnung ${s.id}: Korrekturgrund fehlt`)}
  return {errors,warnings}
}
