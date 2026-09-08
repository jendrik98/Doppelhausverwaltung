type AnyRecord = Record<string, any>;
type UnitLike = AnyRecord & { occupancy?: any[] };
type BillingState = AnyRecord & {
  billingSnapshots: any[];
  waterSettlements: any[];
  costPositions: any[];
  leases: any[];
  units: UnitLike[];
  payments: any[];
  property: AnyRecord;
  finance: AnyRecord;
  correspondence?: AnyRecord;
};

declare let state: BillingState;
declare function dateOnlyAddDays(value: string, days: number): string;
declare function localDateISO(): string;
declare function normalizeLabelText(value: any): string;
declare function centralBillingAnalysis(state: BillingState, periodYear: number): any;
declare function positionToEvents(state: BillingState, position: AnyRecord, periodYear: number): any[];
declare function settlementByPeriod(state: BillingState, periodYear: number): any;
declare function settlementConsumption(state: BillingState, settlement: any): any;
declare const ACTIVE_LEGAL_PACK: any;
declare const LAW_DATE: string;
declare const DOMAIN_VERSION: number;
declare const SCHEMA_VERSION: number;

export const euro=(n: any)=>new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(Number(n)||0);

export const dateDE=(d: any)=>{if(!d)return"–";const x=new Date(String(d).slice(0,10)+"T00:00:00");return Number.isNaN(x.getTime())?String(d):x.toLocaleDateString("de-DE")};
export const intervalLabel=(v: any)=>(({once:"einmalig",monthly:"monatlich",quarterly:"vierteljährlich",yearly:"jährlich"} as Record<string,string>)[String(v)]||v||"–");
export const assignmentLabel=(v: any)=>(({house:"gesamtes Haus",owner:"nur Eigennutzung",rental:"nur Mietwohnung",review:"noch prüfen"} as Record<string,string>)[String(v)]||v||"–");
export const agreementLabel=(v: any)=>(({auto:"automatischer Standard",area:"Wohnfläche",persons:"Personen",manual:"individuell prüfen",consumption:"Verbrauch",rental:"direkt Mietwohnung",owner:"Eigennutzung"} as Record<string,string>)[String(v)]||v||"–");
export const confidencePercent=(v: any)=>{const n=Number(v||0);return Math.max(0,Math.min(100,n<=1?n*100:n))};

export const percent=(n: any)=>new Intl.NumberFormat("de-DE",{style:"percent",maximumFractionDigits:1}).format(Number(n)||0);
export const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random();

export const periodStart=(y: number)=>`${y}-01-01`;
export const periodEnd=(y: number)=>`${y}-12-31`;
export const periodLabel=(y: number)=>`01.01.${y} – 31.12.${y}`;
// Eigene Arbeitszielfrist: Endabrechnung des Kalenderjahres bis 31.03. des Folgejahres fertigstellen.
export const periodBillingTargetISO=(y: number)=>`${y+1}-03-31`;
export const periodBillingTarget=(y: number)=>dateDE(periodBillingTargetISO(y));
// Gesetzliche Abrechnungsfrist nach § 556 Abs. 3 BGB: grundsätzlich 12 Monate nach Periodenende.
export const periodDeadlineISO=(y: number)=>`${y+1}-12-31`;
export const periodDeadline=(y: number)=>dateDE(periodDeadlineISO(y));
export function currentPeriodYear(){return new Date().getFullYear()}
export function preferredBillingYear(){
  const d=new Date(),y=d.getFullYear();
  return d.getMonth()<=2?y-1:y
}
export function billingSelectableYears(s: BillingState = state){
  const years=new Set([preferredBillingYear(),currentPeriodYear()]);
  for(const snap of s.billingSnapshots||[])if(Number.isInteger(Number(snap.periodYear)))years.add(Number(snap.periodYear));
  for(const sett of s.waterSettlements||[])if(Number.isInteger(Number(sett.periodYear)))years.add(Number(sett.periodYear));
  for(const pos of s.costPositions||[]){
    const d=String(pos.serviceStart||pos.serviceEnd||"").slice(0,10);
    if(/^\d{4}-\d{2}-\d{2}$/.test(d)){
      const [yy]=d.split("-").map(Number);
      years.add(yy)
    }
  }
  const takeover=billingTakeoverDate(s);
  if(/^\d{4}-\d{2}-\d{2}$/.test(takeover)){
    const [yy]=takeover.split("-").map(Number),first=yy,last=currentPeriodYear();
    for(let y=first;y<=last&&y<first+60;y++)if(billingPeriodInfo(s,y).active)years.add(y)
  }else years.add(currentPeriodYear()-1);
  return [...years].filter(y=>Number.isInteger(y)&&y>1900&&billingPeriodInfo(s,y).active).sort((a,b)=>b-a)
}
export function selectedBillingYear(s: BillingState = state){
  const options=billingSelectableYears(s),saved=Number(sessionStorage.getItem("billingSelectedYear")),preferred=preferredBillingYear();
  if(options.includes(saved))return saved;
  if(options.includes(preferred))return preferred;
  return options[0]??currentPeriodYear()
}

export function billingTakeoverDate(s: BillingState = state){return String(s?.property?.billingTakeoverDate||s?.property?.ownershipEffective||"")}
export function billingPeriodInfo(s: BillingState,year: number){
  const nominalStart=periodStart(year),end=periodEnd(year),takeover=billingTakeoverDate(s);
  let start=nominalStart,active=true,isTakeoverPeriod=false;
  if(takeover){
    if(takeover>end)active=false;
    else if(takeover>nominalStart){start=takeover;isTakeoverPeriod=true}
  }
  const predecessorEnd=s?.property?.predecessorBillingEnd||(
    takeover?dateOnlyAddDays(takeover,-1):""
  );
  return {year,start,end,nominalStart,takeover,predecessorEnd,active,isTakeoverPeriod,
    days:active?daysInclusive(start,end):0,nominalDays:daysInclusive(nominalStart,end)}
}
export function billingPeriodStart(s: BillingState,year: number){return billingPeriodInfo(s,year).start}

export function billingPeriodLabel(s: BillingState,year: number){
  const p=billingPeriodInfo(s,year),f=(d: any)=>d?new Date(d+"T00:00:00").toLocaleDateString("de-DE"):"–";
  return `${f(p.start)} – ${f(p.end)}`
}
export function billingPeriodContext(s: BillingState,year: number){
  const p=billingPeriodInfo(s,year);
  if(!p.active)return {kind:"before-takeover",message:"Diese Periode liegt vollständig vor der Verwaltungsübernahme."};
  if(p.isTakeoverPeriod)return {kind:"takeover",message:`Erste eigene Abrechnungsperiode ab ${new Date(p.start+"T00:00:00").toLocaleDateString("de-DE")}. Der Voreigentümer rechnet bis ${new Date(p.predecessorEnd+"T00:00:00").toLocaleDateString("de-DE")} selbst ab.`};
  return {kind:"annual",message:"Reguläre jährliche Abrechnungsperiode 01.01.–31.12."}
}


export function dateOnlyUtcValue(v: any){
  const m=String(v||"").slice(0,10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m)return NaN;
  return Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]))
}
export function calendarDayDiff(start: string,end: string){
  const a=dateOnlyUtcValue(start),b=dateOnlyUtcValue(end);
  if(!Number.isFinite(a)||!Number.isFinite(b))return NaN;
  return Math.round((b-a)/86400000)
}
export function overlapDays(aStart: string,aEnd: string,bStart: string,bEnd: string){
  const s=aStart>bStart?aStart:bStart,e=aEnd<bEnd?aEnd:bEnd;
  if(!s||!e||s>e)return 0;
  return daysInclusive(s,e)
}
export function daysInclusive(start: string,end: string){
  const d=calendarDayDiff(start,end);
  return Number.isFinite(d)&&d>=0?d+1:0
}

export function unitByType(state: BillingState,type: string){return state.units.find(u=>u.type===type)}
export function currentPersons(unit: UnitLike | null | undefined,date=localDateISO()){
  const h=(unit?.occupancy||[]).filter(x=>(!x.from||x.from<=date)&&(!x.to||x.to>=date)).sort((a,b)=>(b.from||"").localeCompare(a.from||""));
  return h.length?Number(h[0].count)||0:0
}
export function shares(state: BillingState,date: string){
  const owner=unitByType(state,"owner"),rental=unitByType(state,"rental");
  const totalArea=Number(state.property.totalArea)||state.units.reduce((s,u)=>s+Number(u.area||0),0);
  const area=totalArea?Number(rental?.area||0)/totalArea:0;
  const op=currentPersons(owner,date),rp=currentPersons(rental,date),pt=op+rp;
  return {area,persons:pt?rp/pt:0,ownerPersons:op,rentalPersons:rp}
}
export function personDays(unit: UnitLike | null | undefined,start: string,end: string){
  return (unit?.occupancy||[]).reduce((sum,o)=>{
    const os=o.from||start,oe=o.to||end,days=overlapDays(os,oe,start,end);
    return sum+days*Number(o.count||0)
  },0)
}
export function personShareForPeriod(state: BillingState,start: string,end: string){
  const owner=unitByType(state,"owner"),rental=unitByType(state,"rental"),op=personDays(owner,start,end),rp=personDays(rental,start,end),total=op+rp;
  return total?rp/total:0
}







export function monthlyAdvanceInPeriod(s: BillingState,lease: AnyRecord | null | undefined,periodYear: number){
  if(!lease)return 0;const bp=billingPeriodInfo(s,periodYear);if(!bp.active)return 0;
  const ps=bp.start,pe=bp.end,ls=lease.start||ps,le=lease.end||pe;
  let total=0,[y,m]=ps.slice(0,7).split("-").map(Number);
  const endMonth=pe.slice(0,7),pad=(n: number)=>String(n).padStart(2,"0");
  while(`${y}-${pad(m)}`<=endMonth){
    const days=new Date(Date.UTC(y,m,0)).getUTCDate();
    const ms=`${y}-${pad(m)}-01`,me=`${y}-${pad(m)}-${pad(days)}`,start=ls>ms?ls:ms,end=le<me?le:me;
    if(start<=end){const active=daysInclusive(start,end);total+=Number(lease.advance||0)*(active/days)}
    m++;if(m===13){m=1;y++}
  }
  return total
}

export function paymentAdvanceForLease(payment: AnyRecord | null | undefined,lease: AnyRecord | null | undefined){
  if(!payment||payment.direction!=="income"||!lease)return{recognized:false,amount:0};
  if(payment.leaseId&&lease.id&&payment.leaseId!==lease.id)return{recognized:false,amount:0};
  const amount=Number(payment.amount||0),rent=Number(lease.rent||0),advance=Number(lease.advance||0);
  if(!Number.isFinite(amount)||amount<0)return{recognized:false,amount:0};
  const label=normalizeLabelText(payment.label||""),tenant=normalizeLabelText(lease.tenantName||"");
  const looksRent=/\bmiete\b|mietzahlung|monatsmiete/.test(label)||(tenant&&label.includes(tenant));
  const looksAdvance=/betriebskosten|nebenkosten|vorauszahlung|\bbk\b|abschlag/.test(label);
  if(payment.advanceAmount!==undefined&&payment.advanceAmount!==null&&payment.advanceAmount!==""){
    const explicit=Number(payment.advanceAmount);
    return {recognized:looksRent||looksAdvance||!!payment.leaseId,amount:Number.isFinite(explicit)?Math.max(0,explicit):0}
  }
  if(looksAdvance&&!looksRent&&advance>0&&amount<=advance*1.5+0.01)return{recognized:true,amount:Math.max(0,amount)};
  if(!looksRent)return{recognized:false,amount:0};
  return {recognized:true,amount:Math.max(0,Math.min(advance,amount-rent))}
}
export function actualAdvanceEvidenceInPeriod(s: BillingState,lease: AnyRecord | null | undefined,periodYear: number){
  if(!lease)return{amount:0,recognizedPayments:0};
  const bp=billingPeriodInfo(s,periodYear);if(!bp.active)return{amount:0,recognizedPayments:0};
  const start=lease.start&&lease.start>bp.start?lease.start:bp.start,end=lease.end&&lease.end<bp.end?lease.end:bp.end;
  let amount=0,recognizedPayments=0;
  for(const payment of s.payments||[]){
    const date=String(payment.date||"").slice(0,10);
    if(!date||date<start||date>end)continue;
    const part=paymentAdvanceForLease(payment,lease);
    if(!part.recognized)continue;
    recognizedPayments++;
    amount+=Number(part.amount||0)
  }
  return {amount,recognizedPayments}
}
export function actualAdvanceInPeriod(s: BillingState,lease: AnyRecord | null | undefined,periodYear: number){return actualAdvanceEvidenceInPeriod(s,lease,periodYear).amount}

export function billingAnalysis(state: BillingState,periodYear: number){return centralBillingAnalysis(state,periodYear)}

export function billingReadiness(s: BillingState,periodYear: number){
  const analysis=billingAnalysis(s,periodYear),bp=billingPeriodInfo(s,periodYear);
  const relevant=(s.costPositions||[]).some(p=>p.confirmed&&positionToEvents(s,p,periodYear).length>0);
  const waterPositions=(s.costPositions||[]).some(p=>p.confirmed&&p.category==="water"&&positionToEvents(s,p,periodYear).length>0);
  const settlement=settlementByPeriod(s,periodYear),cons=settlementConsumption(s,settlement);
  return [
    {id:"period",ok:bp.active,label:"Abrechnungsperiode liegt vor der Verwaltungsübernahme",route:"data",sub:"property"},
    {id:"objectName",ok:!!s.property.name,label:"Objektname fehlt",route:"data",sub:"property"},
    {id:"totalArea",ok:Number(s.property.totalArea)>0,label:"Gesamtwohnfläche fehlt",route:"data",sub:"property"},
    {id:"ownerUnit",ok:!!unitByType(s,"owner"),label:"Eigennutzungs-Einheit fehlt",route:"data",sub:"units"},
    {id:"rentalUnit",ok:!!unitByType(s,"rental"),label:"Mietwohnung fehlt",route:"data",sub:"units"},
    {id:"lease",ok:!!s.leases.length,label:"Mietvertrag fehlt",route:"rental",sub:"overview"},
    {id:"positions",ok:relevant,label:"Keine bestätigte Kostenposition für diese Abrechnungsperiode",route:"data",sub:"positions"},
    {id:"water",ok:!waterPositions||!!cons?.valid,label:"Wasserzähler / Verbrauchsdaten fehlen",route:"rental",sub:"water"},
    {id:"allocation",ok:analysis.unresolved.length===0,label:"Ungeklärte Umlageentscheidungen",route:"data",sub:"positions"}
  ]
}



export function paymentMonthKey(date: any){return String(date||"").slice(0,7)}
export function actualCashflowByMonth(state: BillingState,months=12){
  const rows=[],now=new Date();
  for(let i=0;i<months;i++){
    const d=new Date(now.getFullYear(),now.getMonth()+i,1),key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const income=(state.payments||[]).filter(p=>p.direction==="income"&&paymentMonthKey(p.date)===key).reduce((s,p)=>s+Number(p.amount||0),0);
    const outflow=(state.payments||[]).filter(p=>p.direction==="outflow"&&paymentMonthKey(p.date)===key).reduce((s,p)=>s+Number(p.amount||0),0);
    rows.push({key,label:d.toLocaleDateString("de-DE",{month:"short",year:"2-digit"}),income,outflow,net:income-outflow})
  }
  return rows
}
export function snapshotFor(state: BillingState,periodYear: number){return (state.billingSnapshots||[]).find(s=>Number(s.periodYear)===Number(periodYear))}
export function createBillingSnapshot(state: BillingState,periodYear: number){
  const analysis=billingAnalysis(state,periodYear),waterConsumption=settlementConsumption(state,settlementByPeriod(state,periodYear));
  return {
    id:uid(),periodYear:Number(periodYear),period:structuredClone(analysis.period),createdAt:new Date().toISOString(),
    legalPackVersion:ACTIVE_LEGAL_PACK?.version||"Fallback",
    legalEffectiveDate:ACTIVE_LEGAL_PACK?.effectiveDate||LAW_DATE,domainVersion:DOMAIN_VERSION,schemaVersion:SCHEMA_VERSION,
    property:structuredClone(state.property),correspondence:structuredClone(state.correspondence||{}),units:structuredClone(state.units),
    lease:structuredClone(analysis.lease||null),events:structuredClone(analysis.events),
    waterConsumption:structuredClone(waterConsumption||null),allocationBases:{totalArea:Number(state.property?.totalArea||0),rentalArea:Number(unitByType(state,"rental")?.area||0)},
    unresolved:structuredClone(analysis.unresolved),tenantCosts:Number(analysis.tenantCosts||0),
    advances:Number(analysis.advances||0),result:Number(analysis.result||0),frozen:true
  }
}




