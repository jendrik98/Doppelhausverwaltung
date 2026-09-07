/* ===== domain.js ===== */

const euro=n=>new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(Number(n)||0);

const dateDE=d=>{if(!d)return"–";const x=new Date(String(d).slice(0,10)+"T00:00:00");return Number.isNaN(x.getTime())?String(d):x.toLocaleDateString("de-DE")};
const intervalLabel=v=>({once:"einmalig",monthly:"monatlich",quarterly:"vierteljährlich",yearly:"jährlich"}[v]||v||"–");
const assignmentLabel=v=>({house:"gesamtes Haus",owner:"nur Eigennutzung",rental:"nur Mietwohnung",review:"noch prüfen"}[v]||v||"–");
const agreementLabel=v=>({auto:"automatischer Standard",area:"Wohnfläche",persons:"Personen",manual:"individuell prüfen",consumption:"Verbrauch",rental:"direkt Mietwohnung",owner:"Eigennutzung"}[v]||v||"–");
const confidencePercent=v=>{const n=Number(v||0);return Math.max(0,Math.min(100,n<=1?n*100:n))};

const percent=n=>new Intl.NumberFormat("de-DE",{style:"percent",maximumFractionDigits:1}).format(Number(n)||0);
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random();

const periodStart=y=>`${y}-04-01`;
const periodEnd=y=>`${y+1}-03-31`;
const periodLabel=y=>`01.04.${y} – 31.03.${y+1}`;
const periodDeadlineISO=y=>`${y+2}-03-31`;
const periodDeadline=y=>dateDE(periodDeadlineISO(y));
function currentPeriodYear(){const d=new Date();return d.getMonth()>=3?d.getFullYear():d.getFullYear()-1}
function preferredBillingYear(){
  const d=new Date(),m=d.getMonth();
  return m>=3&&m<=5?d.getFullYear()-1:currentPeriodYear()
}
function billingSelectableYears(s=state){
  const years=new Set([preferredBillingYear(),currentPeriodYear()]);
  for(const snap of s.billingSnapshots||[])if(Number.isInteger(Number(snap.periodYear)))years.add(Number(snap.periodYear));
  for(const sett of s.waterSettlements||[])if(Number.isInteger(Number(sett.periodYear)))years.add(Number(sett.periodYear));
  for(const pos of s.costPositions||[]){
    const d=String(pos.serviceStart||pos.serviceEnd||"").slice(0,10);
    if(/^\d{4}-\d{2}-\d{2}$/.test(d)){
      const [yy,mm]=d.split("-").map(Number);
      years.add(mm>=4?yy:yy-1)
    }
  }
  const takeover=billingTakeoverDate(s);
  if(/^\d{4}-\d{2}-\d{2}$/.test(takeover)){
    const [yy,mm]=takeover.split("-").map(Number),first=mm>=4?yy:yy-1,last=currentPeriodYear();
    for(let y=first;y<=last&&y<first+60;y++)if(billingPeriodInfo(s,y).active)years.add(y)
  }else years.add(currentPeriodYear()-1);
  return [...years].filter(y=>Number.isInteger(y)&&y>1900&&billingPeriodInfo(s,y).active).sort((a,b)=>b-a)
}
function selectedBillingYear(s=state){
  const options=billingSelectableYears(s),saved=Number(sessionStorage.getItem("billingSelectedYear")),preferred=preferredBillingYear();
  if(options.includes(saved))return saved;
  if(options.includes(preferred))return preferred;
  return options[0]??currentPeriodYear()
}

function billingTakeoverDate(s=state){return String(s?.property?.billingTakeoverDate||s?.property?.ownershipEffective||"")}
function billingPeriodInfo(s,year){
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
function billingPeriodStart(s,year){return billingPeriodInfo(s,year).start}

function billingPeriodLabel(s,year){
  const p=billingPeriodInfo(s,year),f=d=>d?new Date(d+"T00:00:00").toLocaleDateString("de-DE"):"–";
  return `${f(p.start)} – ${f(p.end)}`
}
function billingPeriodContext(s,year){
  const p=billingPeriodInfo(s,year);
  if(!p.active)return {kind:"before-takeover",message:"Diese Periode liegt vollständig vor der Verwaltungsübernahme."};
  if(p.isTakeoverPeriod)return {kind:"takeover",message:`Erste eigene Abrechnungsperiode ab ${new Date(p.start+"T00:00:00").toLocaleDateString("de-DE")}. Der Voreigentümer rechnet bis ${new Date(p.predecessorEnd+"T00:00:00").toLocaleDateString("de-DE")} selbst ab.`};
  return {kind:"annual",message:"Reguläre jährliche Abrechnungsperiode 01.04.–31.03."}
}


function dateOnlyUtcValue(v){
  const m=String(v||"").slice(0,10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m)return NaN;
  return Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]))
}
function calendarDayDiff(start,end){
  const a=dateOnlyUtcValue(start),b=dateOnlyUtcValue(end);
  if(!Number.isFinite(a)||!Number.isFinite(b))return NaN;
  return Math.round((b-a)/86400000)
}
function overlapDays(aStart,aEnd,bStart,bEnd){
  const s=aStart>bStart?aStart:bStart,e=aEnd<bEnd?aEnd:bEnd;
  if(!s||!e||s>e)return 0;
  return daysInclusive(s,e)
}
function daysInclusive(start,end){
  const d=calendarDayDiff(start,end);
  return Number.isFinite(d)&&d>=0?d+1:0
}

function unitByType(state,type){return state.units.find(u=>u.type===type)}
function currentPersons(unit,date=localDateISO()){
  const h=(unit?.occupancy||[]).filter(x=>(!x.from||x.from<=date)&&(!x.to||x.to>=date)).sort((a,b)=>(b.from||"").localeCompare(a.from||""));
  return h.length?Number(h[0].count)||0:0
}
function shares(state,date){
  const owner=unitByType(state,"owner"),rental=unitByType(state,"rental");
  const totalArea=Number(state.property.totalArea)||state.units.reduce((s,u)=>s+Number(u.area||0),0);
  const area=totalArea?Number(rental?.area||0)/totalArea:0;
  const op=currentPersons(owner,date),rp=currentPersons(rental,date),pt=op+rp;
  return {area,persons:pt?rp/pt:0,ownerPersons:op,rentalPersons:rp}
}
function personDays(unit,start,end){
  return (unit?.occupancy||[]).reduce((sum,o)=>{
    const os=o.from||start,oe=o.to||end,days=overlapDays(os,oe,start,end);
    return sum+days*Number(o.count||0)
  },0)
}
function personShareForPeriod(state,start,end){
  const owner=unitByType(state,"owner"),rental=unitByType(state,"rental"),op=personDays(owner,start,end),rp=personDays(rental,start,end),total=op+rp;
  return total?rp/total:0
}







function monthlyAdvanceInPeriod(s,lease,periodYear){
  if(!lease)return 0;const bp=billingPeriodInfo(s,periodYear);if(!bp.active)return 0;
  const ps=bp.start,pe=bp.end,ls=lease.start||ps,le=lease.end||pe;
  let total=0,[y,m]=ps.slice(0,7).split("-").map(Number);
  const endMonth=pe.slice(0,7),pad=n=>String(n).padStart(2,"0");
  while(`${y}-${pad(m)}`<=endMonth){
    const days=new Date(Date.UTC(y,m,0)).getUTCDate();
    const ms=`${y}-${pad(m)}-01`,me=`${y}-${pad(m)}-${pad(days)}`,start=ls>ms?ls:ms,end=le<me?le:me;
    if(start<=end){const active=daysInclusive(start,end);total+=Number(lease.advance||0)*(active/days)}
    m++;if(m===13){m=1;y++}
  }
  return total
}

function paymentAdvanceForLease(payment,lease){
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
function actualAdvanceEvidenceInPeriod(s,lease,periodYear){
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
function actualAdvanceInPeriod(s,lease,periodYear){return actualAdvanceEvidenceInPeriod(s,lease,periodYear).amount}

function billingAnalysis(state,periodYear){return centralBillingAnalysis(state,periodYear)}

function billingReadiness(s,periodYear){
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



function paymentMonthKey(date){return String(date||"").slice(0,7)}
function actualCashflowByMonth(state,months=12){
  const rows=[],now=new Date();
  for(let i=0;i<months;i++){
    const d=new Date(now.getFullYear(),now.getMonth()+i,1),key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const income=(state.payments||[]).filter(p=>p.direction==="income"&&paymentMonthKey(p.date)===key).reduce((s,p)=>s+Number(p.amount||0),0);
    const outflow=(state.payments||[]).filter(p=>p.direction==="outflow"&&paymentMonthKey(p.date)===key).reduce((s,p)=>s+Number(p.amount||0),0);
    rows.push({key,label:d.toLocaleDateString("de-DE",{month:"short",year:"2-digit"}),income,outflow,net:income-outflow})
  }
  return rows
}
function snapshotFor(state,periodYear){return (state.billingSnapshots||[]).find(s=>Number(s.periodYear)===Number(periodYear))}
function createBillingSnapshot(state,periodYear){
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




