(async function(){
"use strict";
try{

/* ===== schema.js ===== */
const SCHEMA_VERSION=7;

function createEmptyState(){
  return {
    schemaVersion:SCHEMA_VERSION,
    meta:{appVersion:"7.999",createdAt:new Date().toISOString(),migratedFrom:null},
    property:{name:"",address:"",totalArea:0,year:""},
    units:[],
    leases:[],
    sources:[],
    water:[],
    tasks:[],
    finance:{repayment:900,fixed:0},
    billingWorkflows:[],
    billingSnapshots:[],
    payments:[],
    audit:[]
  }
}

function validateState(s){
  const errors=[];
  if(!s||typeof s!=="object")return{ok:false,errors:["State fehlt"]};
  if(!Number.isInteger(s.schemaVersion))errors.push("schemaVersion fehlt");
  if(!s.property||typeof s.property!=="object")errors.push("property fehlt");
  for(const k of ["units","leases","sources","water","tasks","billingWorkflows","billingSnapshots","payments","audit"]){
    if(!Array.isArray(s[k]))errors.push(`${k} ist kein Array`)
  }
  if(!s.finance||typeof s.finance!=="object")errors.push("finance fehlt");
  return {ok:!errors.length,errors}
}

function normalizeState(s){
  const base=createEmptyState(),out={...base,...s};
  out.property={...base.property,...(s?.property||{})};
  out.finance={...base.finance,...(s?.finance||{})};
  for(const k of ["units","leases","sources","water","tasks","billingWorkflows","billingSnapshots","payments","audit"])out[k]=Array.isArray(s?.[k])?s[k]:[];
  out.schemaVersion=SCHEMA_VERSION;
  out.meta={...base.meta,...(s?.meta||{}),appVersion:"7.999"};
  return out
}


/* ===== legal-rules.js ===== */
const LAW_DATE="2026-09-03";

const LEGAL_SOURCES=[
  {name:"§ 556 BGB",url:"https://www.gesetze-im-internet.de/bgb/__556.html",purpose:"Betriebskosten, Abrechnung, Frist, Belegeinsicht"},
  {name:"§ 556a BGB",url:"https://www.gesetze-im-internet.de/bgb/__556a.html",purpose:"Abrechnungsmaßstab"},
  {name:"§ 560 BGB",url:"https://www.gesetze-im-internet.de/bgb/__560.html",purpose:"Anpassung von Vorauszahlungen"},
  {name:"BetrKV",url:"https://www.gesetze-im-internet.de/betrkv/",purpose:"Umlagefähige Betriebskosten"}
];

const CATEGORIES={
  propertyTax:{label:"Grundsteuer B",billable:true,basis:"§ 2 Nr. 1 BetrKV",defaultRule:"area"},
  rainwater:{label:"Niederschlagswasser",billable:true,basis:"§ 2 Nr. 3 BetrKV",defaultRule:"area"},
  street:{label:"Straßenreinigung / Winterdienst",billable:true,basis:"§ 2 Nr. 8 BetrKV",defaultRule:"area"},
  waste:{label:"Abfall",billable:true,basis:"§ 2 Nr. 8 BetrKV",defaultRule:"area"},
  insurance:{label:"Gebäudeversicherung",billable:true,basis:"§ 2 BetrKV",defaultRule:"area"},
  chimney:{label:"Schornsteinfeger",billable:true,basis:"§ 2 BetrKV",defaultRule:"area"},
  water:{label:"Kaltwasser / Kanal",billable:true,basis:"§ 2 Nr. 2/3 BetrKV",defaultRule:"consumption"},
  garden:{label:"Gartenpflege",billable:true,basis:"§ 2 BetrKV",defaultRule:"area"},
  cleaning:{label:"Gebäudereinigung",billable:true,basis:"§ 2 BetrKV",defaultRule:"area"},
  other:{label:"Sonstige Betriebskosten",billable:"check",basis:"§ 2 Nr. 17 BetrKV",defaultRule:"area"},
  admin:{label:"Verwaltungskosten",billable:false,basis:"§ 1 Abs. 2 Nr. 1 BetrKV",defaultRule:"owner"},
  repair:{label:"Instandhaltung / Reparatur",billable:false,basis:"§ 1 Abs. 2 Nr. 2 BetrKV",defaultRule:"owner"},
  internet:{label:"Internet Eigennutzung",billable:false,basis:"private Kosten",defaultRule:"owner"},
  broadcasting:{label:"Rundfunkbeitrag",billable:false,basis:"private Kosten",defaultRule:"owner"},
  financing:{label:"Hausfinanzierung",billable:false,basis:"keine Betriebskosten",defaultRule:"owner"}
};

let ACTIVE_LEGAL_PACK=null;
function category(id){
  return ACTIVE_LEGAL_PACK?.categories?.[id]||CATEGORIES[id]||{label:id,billable:"check",basis:"manuell prüfen",defaultRule:"area"}
}
async function loadLegalPack(){
  try{
    const r=await fetch("./legal-rules.json?ts="+Date.now(),{cache:"no-store"});
    if(!r.ok)throw new Error("HTTP "+r.status);
    const p=await r.json();
    if(p?.schema!=="mietverwaltung-legal-pack-v1"||!p.categories)throw new Error("Ungültiges Regelpaket");
    ACTIVE_LEGAL_PACK=p;return p
  }catch(e){
    console.warn("Regelpaket-Fallback aktiv",e);return null
  }
}

function legalDecision(source,{hasConsumption=false,assignment="house",agreement="auto"}={}){
  const c=category(source.category);
  if(c.billable===false) return {status:"blocked",billable:false,rule:"owner",reason:"Diese Kostenart ist nicht auf die Mieterin umlagefähig.",basis:c.basis};
  if(assignment==="owner") return {status:"ok",billable:false,rule:"owner",reason:"Die Kostenquelle ist ausschließlich der Eigennutzung zugeordnet.",basis:"Objektzuordnung"};
  if(assignment==="rental") return {status:"ok",billable:true,rule:"rental",reason:"Die Kostenquelle betrifft ausschließlich die Mietwohnung.",basis:"Direktzuordnung"};
  if(c.billable==="check") return {status:"check",billable:true,rule:agreement==="persons"?"persons":"area",reason:"Sonstige Betriebskosten müssen im konkreten Vertrag ausreichend erfasst sein.",basis:c.basis};
  if(hasConsumption || c.defaultRule==="consumption") return {status:"ok",billable:true,rule:"consumption",reason:"Der Verbrauch wird erfasst; daher wird verbrauchsbezogen verteilt.",basis:`${c.basis}; § 556a Abs. 1 BGB`};
  if(agreement==="persons") return {status:"ok",billable:true,rule:"persons",reason:"Personenschlüssel wurde als Vertragsvorgabe hinterlegt.",basis:"vertragliche Vereinbarung / § 556a BGB"};
  if(agreement==="area" || agreement==="auto") return {status:"ok",billable:true,rule:"area",reason:"Wohnfläche ist der hinterlegte bzw. gesetzliche Standardmaßstab.",basis:`${c.basis}; § 556a BGB`};
  return {status:"check",billable:true,rule:"manual",reason:"Individuelle Verteilung muss geprüft werden.",basis:c.basis};
}


/* ===== domain.js ===== */

const euro=n=>new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(Number(n)||0);
const percent=n=>new Intl.NumberFormat("de-DE",{style:"percent",maximumFractionDigits:1}).format(Number(n)||0);
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random();

const periodStart=y=>`${y}-04-01`;
const periodEnd=y=>`${y+1}-03-31`;
const periodLabel=y=>`01.04.${y} – 31.03.${y+1}`;
const periodDeadline=y=>`31.03.${y+2}`;
function currentPeriodYear(){const d=new Date();return d.getMonth()>=3?d.getFullYear():d.getFullYear()-1}

function overlapDays(aStart,aEnd,bStart,bEnd){
  const a1=new Date(aStart+"T00:00:00"),a2=new Date(aEnd+"T23:59:59"),b1=new Date(bStart+"T00:00:00"),b2=new Date(bEnd+"T23:59:59");
  const s=a1>b1?a1:b1,e=a2<b2?a2:b2;if(s>e)return 0;return Math.floor((e-s)/86400000)+1
}
function daysInclusive(start,end){return Math.floor((new Date(end+"T23:59:59")-new Date(start+"T00:00:00"))/86400000)+1}

function unitByType(state,type){return state.units.find(u=>u.type===type)}
function currentPersons(unit,date=new Date().toISOString().slice(0,10)){
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

function sourceToEvents(source,periodYear){
  const ps=periodStart(periodYear),pe=periodEnd(periodYear),events=[];
  if(source.kind==="assessment"){
    for(const li of source.items||[]){
      const start=source.serviceStart||`${source.year}-01-01`,end=source.serviceEnd||`${source.year}-12-31`;
      const ov=overlapDays(start,end,ps,pe);if(!ov)continue;
      const factor=ov/daysInclusive(start,end);
      events.push({sourceId:source.id,category:li.category,label:li.label||category(li.category).label,amount:Number(li.amount||0)*factor,assignment:li.assignment||"house",agreement:li.agreement||"auto",serviceStart:start,serviceEnd:end});
    }
  } else {
    const start=source.serviceStart||ps,end=source.serviceEnd||pe;
    const ov=overlapDays(start,end,ps,pe);if(!ov)return [];
    const factor=ov/daysInclusive(start,end);
    if(source.interval==="monthly"){
      const monthly=Number(source.amount||0),months=Math.round(12*factor);
      events.push({sourceId:source.id,category:source.category,label:source.name,amount:monthly*months,assignment:source.assignment||"owner",agreement:source.agreement||"auto",serviceStart:start,serviceEnd:end});
    }else if(source.interval==="quarterly"){
      events.push({sourceId:source.id,category:source.category,label:source.name,amount:Number(source.amount||0)*4*factor,assignment:source.assignment||"owner",agreement:source.agreement||"auto",serviceStart:start,serviceEnd:end});
    }else if(source.interval==="yearly"){
      events.push({sourceId:source.id,category:source.category,label:source.name,amount:Number(source.amount||0)*factor,assignment:source.assignment||"owner",agreement:source.agreement||"auto",serviceStart:start,serviceEnd:end});
    }else{
      events.push({sourceId:source.id,category:source.category,label:source.name,amount:Number(source.amount||0)*factor,assignment:source.assignment||"house",agreement:source.agreement||"auto",serviceStart:start,serviceEnd:end});
    }
  }
  return events
}

function waterEvent(state,periodYear){
  const w=state.water.find(x=>Number(x.periodYear)===Number(periodYear));if(!w||!w.houseConsumption)return null;
  const owner=Number(w.ownerEnd)-Number(w.ownerStart),tenant=Number(w.houseConsumption)-owner;
  if(tenant<0)return {error:"Zwischenzählerverbrauch ist größer als der Gesamtverbrauch."};
  return {label:"Kaltwasser / Kanal",category:"water",amount:Number(w.totalCost||0),tenantConsumption:tenant,houseConsumption:Number(w.houseConsumption),share:tenant/Number(w.houseConsumption)};
}

function allocateEvent(state,event,periodYear){
  const s=shares(state,periodStart(periodYear));
  const decision=legalDecision(event,{hasConsumption:event.category==="water",assignment:event.assignment,agreement:event.agreement});
  let share=0;
  if(decision.rule==="area")share=s.area;
  else if(decision.rule==="persons")share=personShareForPeriod(state,periodStart(periodYear),periodEnd(periodYear));
  else if(decision.rule==="rental")share=1;
  else if(decision.rule==="owner")share=0;
  else if(decision.rule==="consumption"&&event.share!=null)share=event.share;
  else if(decision.rule==="consumption")share=0;
  return {...event,decision,tenantShare:share,tenantAmount:Number(event.amount||0)*share};
}

function monthlyAdvanceInPeriod(lease,periodYear){
  if(!lease)return 0;
  const ps=new Date(periodStart(periodYear)+"T00:00:00"),pe=new Date(periodEnd(periodYear)+"T00:00:00");
  const ls=lease.start?new Date(lease.start+"T00:00:00"):ps,le=lease.end?new Date(lease.end+"T00:00:00"):pe;
  let total=0;
  for(let d=new Date(ps.getFullYear(),ps.getMonth(),1);d<=pe;d=new Date(d.getFullYear(),d.getMonth()+1,1)){
    const ms=new Date(d.getFullYear(),d.getMonth(),1),me=new Date(d.getFullYear(),d.getMonth()+1,0);
    const start=ls>ms?ls:ms,end=le<me?le:me;
    if(start<=end){
      const active=Math.floor((end-start)/86400000)+1,days=me.getDate();
      total+=Number(lease.advance||0)*(active/days)
    }
  }
  return total
}
function billingAnalysis(state,periodYear){
  const events=state.sources.flatMap(s=>sourceToEvents(s,periodYear)).map(e=>allocateEvent(state,e,periodYear));
  const w=waterEvent(state,periodYear);if(w&&!w.error)events.push(allocateEvent(state,{...w,assignment:"house",agreement:"auto"},periodYear));
  const unresolved=events.filter(e=>e.decision.status==="check"||e.decision.rule==="manual");
  const tenantCosts=events.reduce((s,e)=>s+Number(e.tenantAmount||0),0);
  const lease=state.leases[0];
  const advances=monthlyAdvanceInPeriod(lease,periodYear);
  return {events,unresolved,tenantCosts,advances,result:tenantCosts-advances,lease};
}

function billingReadiness(state,periodYear){
  const analysis=billingAnalysis(state,periodYear),relevantSources=state.sources.some(s=>sourceToEvents(s,periodYear).length>0);
  return [
    {id:"objectName",ok:!!state.property.name,label:"Objektname fehlt",route:"data",sub:"property"},
    {id:"totalArea",ok:Number(state.property.totalArea)>0,label:"Gesamtwohnfläche fehlt",route:"data",sub:"property"},
    {id:"ownerUnit",ok:!!unitByType(state,"owner"),label:"Eigennutzungs-Einheit fehlt",route:"data",sub:"units"},
    {id:"rentalUnit",ok:!!unitByType(state,"rental"),label:"Mietwohnung fehlt",route:"data",sub:"units"},
    {id:"lease",ok:!!state.leases.length,label:"Mietvertrag fehlt",route:"data",sub:"lease"},
    {id:"sources",ok:relevantSources,label:"Keine Kostenquelle für diese Abrechnungsperiode",route:"data",sub:"sources"},
    {id:"water",ok:state.water.some(w=>Number(w.periodYear)===Number(periodYear)),label:"Kaltwasserperiode fehlt",route:"rental",sub:"water"},
    {id:"allocation",ok:analysis.unresolved.length===0,label:"Ungeklärte Umlageentscheidungen",route:"data",sub:"sources"}
  ]
}
function health(state){
  let score=100,issues=[];const p=(n,m)=>{score-=n;issues.push(m)},checks=billingReadiness(state,currentPeriodYear());
  const penalties={objectName:12,totalArea:14,ownerUnit:9,rentalUnit:9,lease:14,sources:12,water:8,allocation:12};
  for(const c of checks)if(!c.ok)p(penalties[c.id]||8,c.label);
  return {score:Math.max(0,score),issues}
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
  const analysis=billingAnalysis(state,periodYear);
  return {
    id:uid(),periodYear:Number(periodYear),createdAt:new Date().toISOString(),
    legalPackVersion:ACTIVE_LEGAL_PACK?.version||"Fallback",
    legalEffectiveDate:ACTIVE_LEGAL_PACK?.effectiveDate||LAW_DATE,
    property:structuredClone(state.property),units:structuredClone(state.units),
    lease:structuredClone(analysis.lease||null),events:structuredClone(analysis.events),
    unresolved:structuredClone(analysis.unresolved),tenantCosts:Number(analysis.tenantCosts||0),
    advances:Number(analysis.advances||0),result:Number(analysis.result||0),frozen:true
  }
}

function monthlyForecast(state){
  const rows=[],now=new Date(),rent=state.leases.reduce((s,l)=>s+Number(l.rent||0),0);
  for(let i=0;i<12;i++){
    const d=new Date(now.getFullYear(),now.getMonth()+i,1),label=d.toLocaleDateString("de-DE",{month:"short",year:"2-digit"});
    let out=Number(state.finance.repayment||0)+Number(state.finance.fixed||0);
    for(const s of state.sources){
      if(s.assignment==="rental")continue;
      const a=Number(s.amount||0);
      if(s.interval==="monthly")out+=a;
      else if(s.interval==="quarterly")out+=a/3;
      else if(s.interval==="yearly")out+=a/12;
    }
    rows.push({label,income:rent,outflow:out,net:rent-out});
  }
  return rows
}


/* ===== db.js ===== */

const DB_NAME="mietverwaltung-v6",DB_VERSION=2,STATE_ID="main";

function openDB(){
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open(DB_NAME,DB_VERSION);
    r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains("state"))db.createObjectStore("state",{keyPath:"id"});if(!db.objectStoreNames.contains("docs"))db.createObjectStore("docs",{keyPath:"id"})};
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)
  })
}
async function loadState(){
  const db=await openDB(),tx=db.transaction("state","readonly"),r=tx.objectStore("state").get(STATE_ID);
  const rec=await new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
  if(rec?.data)return normalizeState(rec.data);
  const migrated=migrateV5();await saveState(migrated);return migrated
}
async function saveState(state){
  const db=await openDB(),tx=db.transaction("state","readwrite");tx.objectStore("state").put({id:STATE_ID,data:state});
  return new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})
}
async function addDocument(doc){
  const db=await openDB(),tx=db.transaction("docs","readwrite");tx.objectStore("docs").put(doc);
  return new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})
}
async function listDocuments(){
  const db=await openDB(),tx=db.transaction("docs","readonly"),r=tx.objectStore("docs").getAll();
  return new Promise((res,rej)=>{r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})
}
async function deleteDocument(id){
  const db=await openDB(),tx=db.transaction("docs","readwrite");tx.objectStore("docs").delete(id);
  return new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})
}


async function updateDocument(doc){
  const db=await openDB(),tx=db.transaction("docs","readwrite");tx.objectStore("docs").put(doc);
  return new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})
}
function migrateV5(){
  const state=createEmptyState();
  const keys=["mietverwaltung_v2_4","mietverwaltung_v2_3","mietverwaltung_v2_2","mietverwaltung_v2_1","mietverwaltung_v2"];
  let old=null,from=null;
  for(const k of keys){try{const raw=localStorage.getItem(k);if(raw){old=JSON.parse(raw);from=k;break}}catch{}}
  if(!old)return state;
  state.meta.migratedFrom=from;
  state.property={...state.property,...(old.property||{})};
  state.finance={...state.finance,...(old.finance||{})};
  state.units=(old.units||[]).map(u=>({id:u.id||crypto.randomUUID(),name:u.name,type:u.type,area:Number(u.area||0),note:u.note||"",occupancy:(u.occupancyHistory||u.occupancy||[{from:"2026-09-01",to:"",count:u.type==="owner"?3:3}])}));
  state.leases=(old.contracts||[]).map(c=>({id:c.id||crypto.randomUUID(),tenantId:c.tenantId,start:c.start,end:c.end||"",rent:Number(c.rent||0),advance:Number(c.advance??c.opAdvance??0),note:c.note||""}));
  // legacy operating costs -> manual sources
  for(const c of old.costs||[]){
    state.sources.push({id:c.id||crypto.randomUUID(),kind:"manual",name:c.note||c.category||c.categoryId||"Betriebskosten",category:c.categoryId||mapLegacyCategory(c.category),amount:Number(c.amount||0),interval:"once",serviceStart:c.start||"",serviceEnd:c.end||"",assignment:c.unitId||"house",agreement:c.agreement||c.key||"auto",legacy:true})
  }
  // own contracts
  for(const c of old.ownContracts||[]){
    state.sources.push({id:c.id||crypto.randomUUID(),kind:"contract",name:c.name||c.category||"Vertrag",category:mapPrivateCategory(c.category),amount:Number(c.cost||0),interval:c.interval||"yearly",serviceStart:c.start||"",serviceEnd:c.end||"",assignment:c.assignment||((c.note||"").includes("nur Eigennutzung")?"owner":"house"),agreement:"auto",review:c.review||"",noticeDays:Number(c.noticeDays||0),note:c.note||""})
  }
  // house costs
  for(const c of old.houseCosts||[]){
    state.sources.push({id:c.id||crypto.randomUUID(),kind:"manual",name:c.name||c.category||"Hauskosten",category:mapPrivateCategory(c.category),amount:Number(c.amount||0),interval:c.interval||"once",serviceStart:c.date||"",serviceEnd:c.date||"",assignment:c.assignment||"owner",agreement:"auto",note:c.note||""})
  }
  // assessments
  for(const a of old.assessments||[]){
    const items=[];
    if(a.tax)items.push({category:"propertyTax",label:"Grundsteuer B",amount:Number(a.tax),assignment:"house"});
    if(a.street)items.push({category:"street",label:"Straßenreinigung / Winterdienst",amount:Number(a.street),assignment:"house"});
    if(a.rain)items.push({category:"rainwater",label:"Niederschlagswasser",amount:Number(a.rain),assignment:"house"});
    if(a.bio)items.push({category:"waste",label:"Gemeinsame Biotonne",amount:Number(a.bio),assignment:"house"});
    if(a.residualShared)items.push({category:"waste",label:"Gemeinsame Restmülltonne",amount:Number(a.residualShared),assignment:"house"});
    if(a.residualPrivate)items.push({category:"waste",label:"Zusätzliche 120L Restmülltonne Eigennutzung",amount:Number(a.residualPrivate),assignment:"owner"});
    state.sources.push({id:a.id||crypto.randomUUID(),kind:"assessment",name:`Grundbesitzabgaben ${a.year}`,year:Number(a.year),serviceStart:`${a.year}-01-01`,serviceEnd:`${a.year}-12-31`,items,dueDates:a.dueDates||["02-15","05-15","08-15","11-15"],note:a.note||""})
  }
  state.water=(old.water||[]).map(w=>({id:w.id||crypto.randomUUID(),periodYear:Number(w.year??w.periodYear),houseConsumption:Number(w.houseConsumption||0),ownerStart:Number(w.ownerStart||0),ownerEnd:Number(w.ownerEnd||0),totalCost:Number(w.totalCost||0)}));
  state.tasks=(old.tasks||[]).map(t=>({...t,id:t.id||crypto.randomUUID()}));
  state.audit=[{id:crypto.randomUUID(),at:new Date().toISOString(),action:"Migration",detail:`Daten aus ${from} übernommen`}];
  state.schemaVersion=SCHEMA_VERSION;return normalizeState(state)
}
function mapLegacyCategory(x=""){const s=String(x).toLowerCase();if(s.includes("grundsteuer"))return"propertyTax";if(s.includes("niedersch"))return"rainwater";if(s.includes("straße")||s.includes("winter"))return"street";if(s.includes("müll")||s.includes("abfall"))return"waste";if(s.includes("versicher"))return"insurance";if(s.includes("schorn"))return"chimney";if(s.includes("wasser")||s.includes("kanal"))return"water";if(s.includes("repar"))return"repair";return"other"}
function mapPrivateCategory(x=""){const s=String(x).toLowerCase();if(s.includes("internet"))return"internet";if(s.includes("rundfunk")||s.includes("gez"))return"broadcasting";if(s.includes("repar"))return"repair";if(s.includes("versicher"))return"insurance";return"other"}
async function replaceDocuments(docs){
  const db=await openDB(),tx=db.transaction("docs","readwrite"),store=tx.objectStore("docs");
  store.clear();for(const d of docs)store.put(d);
  return new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})
}



/* ===== commands.js ===== */


async function execute(state,command){
  const draft=structuredClone(state);
  const result=await command.run(draft);
  const next=normalizeState(result?.state||draft);
  const v=validateState(next);
  if(!v.ok)throw new Error("Ungültiger Datenzustand: "+v.errors.join(", "));
  if(command.audit){
    next.audit.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),action:command.audit.action,detail:command.audit.detail||""});
    next.audit=next.audit.slice(0,500)
  }
  await saveState(next);
  return next
}

const Commands={
  updateProperty:data=>({
    audit:{action:"Objekt geändert",detail:data.name||""},
    run:s=>{s.property={...s.property,...data};return{state:s}}
  }),
  upsertUnit:unit=>({
    audit:{action:unit.id?"Einheit geändert":"Einheit angelegt",detail:unit.name||""},
    run:s=>{const i=s.units.findIndex(x=>x.id===unit.id);if(i>=0)s.units[i]=unit;else s.units.push(unit);return{state:s}}
  }),
  upsertLease:lease=>({
    audit:{action:lease.id?"Mietvertrag geändert":"Mietvertrag angelegt",detail:lease.start||""},
    run:s=>{const i=s.leases.findIndex(x=>x.id===lease.id);if(i>=0)s.leases[i]=lease;else s.leases.push(lease);return{state:s}}
  }),
  upsertSource:source=>({
    audit:{action:source.id?"Kostenquelle geändert":"Kostenquelle angelegt",detail:source.name||""},
    run:s=>{const i=s.sources.findIndex(x=>x.id===source.id);if(i>=0)s.sources[i]=source;else s.sources.push(source);return{state:s}}
  }),
  upsertWater:w=>({
    audit:{action:w.id?"Kaltwasser geändert":"Kaltwasser angelegt",detail:String(w.periodYear||"")},
    run:s=>{const i=s.water.findIndex(x=>x.id===w.id);if(i>=0)s.water[i]=w;else s.water.push(w);return{state:s}}
  }),
  updateFinance:f=>({
    audit:{action:"Finanzen geändert",detail:"Hausrückzahlung / fixe Kosten"},
    run:s=>{s.finance={...s.finance,...f};return{state:s}}
  }),
  addTask:t=>({
    audit:{action:"Erinnerung angelegt",detail:t.title||""},
    run:s=>{s.tasks.push(t);return{state:s}}
  }),
  setWorkflow:(id,patch)=>({
    audit:{action:"Abrechnungsstatus geändert",detail:patch.status||""},
    run:s=>{const w=s.billingWorkflows.find(x=>x.id===id);if(w)Object.assign(w,patch);return{state:s}}
  })
}


/* ===== security.js ===== */
const SEC_KEY="mietverwaltung_v75_webauthn";

function toB64(bytes){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function fromB64(s){s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}

function authEnabled(){return !!localStorage.getItem(SEC_KEY)}
async function registerDevice(){
  if(!window.PublicKeyCredential||!navigator.credentials)throw new Error("Geräteauthentifizierung nicht unterstützt");
  const cred=await navigator.credentials.create({publicKey:{
    challenge:crypto.getRandomValues(new Uint8Array(32)),
    rp:{name:"Mietverwaltung"},
    user:{id:crypto.getRandomValues(new Uint8Array(16)),name:"private-user",displayName:"Mietverwaltung"},
    pubKeyCredParams:[{type:"public-key",alg:-7},{type:"public-key",alg:-257}],
    authenticatorSelection:{authenticatorAttachment:"platform",userVerification:"required"},
    timeout:60000,attestation:"none"
  }});
  localStorage.setItem(SEC_KEY,toB64(new Uint8Array(cred.rawId)));
}
async function authenticate(){
  const id=localStorage.getItem(SEC_KEY);if(!id)return true;
  try{
    await navigator.credentials.get({publicKey:{
      challenge:crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials:[{id:fromB64(id),type:"public-key"}],
      userVerification:"required",timeout:60000
    }});
    return true
  }catch{return false}
}
function disableAuth(){localStorage.removeItem(SEC_KEY)}

function bytesToB64(a){let s="";const chunk=0x8000;for(let i=0;i<a.length;i+=chunk)s+=String.fromCharCode(...a.subarray(i,i+chunk));return btoa(s)}
function b64ToBytes(s){const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
async function derive(password,salt){const mat=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveKey"]);return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:250000,hash:"SHA-256"},mat,{name:"AES-GCM",length:256},false,["encrypt","decrypt"])}
async function encryptJSON(obj,password){
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),key=await derive(password,salt),plain=new TextEncoder().encode(JSON.stringify(obj)),cipher=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,plain));
  return {schema:"mietverwaltung-v75-encrypted",salt:bytesToB64(salt),iv:bytesToB64(iv),data:bytesToB64(cipher)}
}
async function decryptJSON(wrapper,password){
  const salt=b64ToBytes(wrapper.salt),iv=b64ToBytes(wrapper.iv),key=await derive(password,salt),plain=await crypto.subtle.decrypt({name:"AES-GCM",iv},key,b64ToBytes(wrapper.data));
  return JSON.parse(new TextDecoder().decode(plain))
}


/* ===== backup.js ===== */



async function createFullBackup(state,password){
  const docs=await listDocuments(),encoded=[];
  for(const d of docs){
    const bytes=new Uint8Array(await d.blob.arrayBuffer());
    encoded.push({...d,blob:undefined,blobData:{type:d.blob.type,base64:bytesToB64(bytes)}})
  }
  return encryptJSON({schema:"mietverwaltung-v75-full-backup",state,documents:encoded},password)
}
async function restoreFullBackup(wrapper,password){
  const payload=await decryptJSON(wrapper,password);
  if(payload.schema!=="mietverwaltung-v75-full-backup")throw new Error("Falsches Backup-Format");
  const docs=(payload.documents||[]).map(d=>({...d,blobData:undefined,blob:new Blob([b64ToBytes(d.blobData.base64)],{type:d.blobData.type})}));
  await replaceDocuments(docs);
  return payload.state
}


/* ===== tests.js ===== */

function assert(name,cond){return{name,ok:!!cond}}
function runSelfTests(){
  const results=[];
  results.push(assert("Abrechnungsperiode Start",periodStart(2026)==="2026-04-01"));
  results.push(assert("Abrechnungsperiode Ende",periodEnd(2026)==="2027-03-31"));
  results.push(assert("Tagesüberschneidung",overlapDays("2026-01-01","2026-12-31","2026-04-01","2027-03-31")===275));
  results.push(assert("Kalenderjahr 2026 hat 365 Tage",daysInclusive("2026-01-01","2026-12-31")===365));
  const s={
    property:{totalArea:200},
    units:[
      {type:"owner",area:100,occupancy:[{from:"2026-01-01",to:"",count:3}]},
      {type:"rental",area:100,occupancy:[{from:"2026-01-01",to:"",count:3}]}
    ],
    leases:[{rent:400,advance:125}],
    sources:[],
    water:[{periodYear:2026,houseConsumption:150,ownerStart:100,ownerEnd:160,totalCost:600}],
    finance:{repayment:900,fixed:0},
    billingWorkflows:[],tasks:[],audit:[]
  };
  const sh=shares(s,"2026-04-01");
  results.push(assert("Wohnfläche 50/50",Math.abs(sh.area-.5)<1e-9));
  results.push(assert("Personen 50/50",Math.abs(sh.persons-.5)<1e-9));
  const w=waterEvent(s,2026);
  results.push(assert("Kaltwasser Mieterin 90m³",Math.abs(w.tenantConsumption-90)<1e-9));
  results.push(assert("Kaltwasser Anteil 60%",Math.abs(w.share-.6)<1e-9));
  results.push(assert("Schaltjahr 2028 hat 366 Tage",daysInclusive("2028-01-01","2028-12-31")===366));
  results.push(assert("April–Dezember 2026 = 275 Tage",overlapDays("2026-01-01","2026-12-31","2026-04-01","2027-03-31")===275));
  const lease={start:"2026-09-01",end:"",advance:150};
  results.push(assert("BK-Vorauszahlung Sep–Mär = 7 Monate",Math.abs(monthlyAdvanceInPeriod(lease,2026)-1050)<0.01));
  const occState={...s,units:[
    {type:"owner",area:100,occupancy:[{from:"2026-04-01",to:"",count:3}]},
    {type:"rental",area:100,occupancy:[{from:"2026-04-01",to:"2026-09-30",count:3},{from:"2026-10-01",to:"",count:2}]}
  ]};
  const ps=personShareForPeriod(occState,"2026-04-01","2027-03-31");
  results.push(assert("Personenwechsel wird zeitanteilig berücksichtigt",ps>0.39&&ps<0.50));
  return results
}


/* ===== ui.js ===== */
const $=id=>document.getElementById(id);
function viewBody(preferred){return $(preferred)||$("workspaceBody")}
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
function modal(title,html,onReady){
  $("modalTitle").textContent=title;$("modalBody").innerHTML=html;$("modal").classList.remove("hidden");$("modalClose").onclick=()=>$("modal").classList.add("hidden");onReady?.()
}
function formField({name,label,type="text",value="",options=[],full=false,step,min,placeholder=""}){
  if(type==="select")return `<label class="${full?"full":""}">${esc(label)}<select name="${name}">${options.map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(value)?"selected":""}>${esc(o.label)}</option>`).join("")}</select></label>`;
  return `<label class="${full?"full":""}">${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${step?`step="${step}"`:""} ${min!==undefined?`min="${min}"`:""} placeholder="${esc(placeholder)}"></label>`
}
function sectionTabs(items,active){
  return `<div class="section-tabs">${items.map(i=>`<button data-sub="${i.id}" class="${i.id===active?"active":""}">${esc(i.label)}</button>`).join("")}</div>`
}


/* ===== app.js ===== */








let storageError=null;
let state;
try{
  state=await loadState();
}catch(e){
  storageError=e;
  console.error("IndexedDB-Startfehler:",e);
  state=createEmptyState();
  state.meta.storageWarning=String(e?.message||e);
}
let route=location.hash.slice(1)||"home";
let sub={data:"property",rental:"overview",owner:"overview",more:"overview"};

function audit(action,detail){state.audit.unshift({id:uid(),at:new Date().toISOString(),action,detail});state.audit=state.audit.slice(0,300)}
async function persist(action,detail){
  if(action)audit(action,detail);
  try{
    await saveState(state);
  }catch(e){
    storageError=e;
    console.error("Speicherfehler:",e);
    alert("Die App läuft, aber die Änderung konnte nicht dauerhaft gespeichert werden. Bitte unter Mehr → Diagnose prüfen.");
  }
}
async function runCommand(command){state=await execute(state,command);return state}
function nav(){document.querySelectorAll(".main-tabs button").forEach(b=>b.classList.toggle("active",b.dataset.route===route))}
function go(r){route=r;location.hash=r;render()}
window.addEventListener("hashchange",()=>{route=location.hash.slice(1)||"home";render()});

function taskList(){
  const y=new Date().getFullYear(),base=[
    {id:"municipal1",title:"1. Rate Grundbesitzabgaben",due:`${y}-02-15`,lead:14},
    {id:"municipal2",title:"2. Rate Grundbesitzabgaben",due:`${y}-05-15`,lead:14},
    {id:"municipal3",title:"3. Rate Grundbesitzabgaben",due:`${y}-08-15`,lead:14},
    {id:"municipal4",title:"4. Rate Grundbesitzabgaben",due:`${y}-11-15`,lead:14},
    {id:"billing",title:`Nebenkostenabrechnung ${periodLabel(currentPeriodYear()-1)}`,due:`${currentPeriodYear()+1}-03-01`,lead:30}
  ];
  return [...base,...state.tasks].sort((a,b)=>(a.due||"").localeCompare(b.due||""))
}
function daysUntil(d){return Math.ceil((new Date(d+"T00:00:00")-new Date(new Date().toDateString()))/86400000)}
function taskHTML(t){const d=daysUntil(t.due),cls=d<0?"bad":d<=Number(t.lead||30)?"warn":"good";return `<div class="task"><h4>${esc(t.title)}</h4><span class="pill ${cls}">${d<0?`${Math.abs(d)} Tage überfällig`:d===0?"heute":`in ${d} Tagen`}</span><small>${esc(t.due||"")}</small></div>`}

function render(){
  nav();
  if(route==="home")home();
  else if(route==="data")dataWorkspace();
  else if(route==="rental")rentalWorkspace();
  else if(route==="owner")ownerWorkspace();
  else more();
}

function workspaceHeader(eyebrow,title,description,tabs,active){
  return `<section><div class="section-head"><p class="eyebrow">${esc(eyebrow)}</p><h2>${esc(title)}</h2><p class="muted">${esc(description)}</p></div>${sectionTabs(tabs,active)}<div id="workspaceBody"></div></section>`
}
function bindWorkspaceTabs(group,renderer){
  document.querySelectorAll("[data-sub]").forEach(b=>b.onclick=()=>{sub[group]=b.dataset.sub;renderer()})
}


const CHECK_INPUT_MAP={
  "Objektname fehlt":{route:"data",sub:"property",label:"Objektname"},
  "Gesamtwohnfläche fehlt":{route:"data",sub:"property",label:"Gesamtwohnfläche"},
  "Eigennutzungs-Einheit fehlt":{route:"data",sub:"units",label:"Eigennutzung"},
  "Mietwohnung fehlt":{route:"data",sub:"units",label:"Mietwohnung"},
  "Mietvertrag fehlt":{route:"data",sub:"lease",label:"Mietvertrag"},
  "Keine Kostenquelle für diese Abrechnungsperiode":{route:"data",sub:"sources",label:"Kostenquellen"},
  "Kaltwasserperiode fehlt":{route:"rental",sub:"water",label:"Kaltwasser"},
  "Ungeklärte Umlageentscheidungen":{route:"data",sub:"sources",label:"Verteilung / Umlageregel"}
};
function goToCheckInput(issue){
  const m=CHECK_INPUT_MAP[issue];if(!m)return;
  sub[m.route]=m.sub;go(m.route)
}
function checkInputCoverage(){
  const checks=Object.keys(CHECK_INPUT_MAP),missing=[];
  const routeTabs={
    data:["property","units","lease","sources","assessment","documents"],
    rental:["overview","water","calculation","workflow"],
    owner:["overview","finance","cashflow","tasks"],
    more:["overview","audit","legal","security","diagnostics","backup"]
  };
  for(const issue of checks){
    const m=CHECK_INPUT_MAP[issue];
    if(!routeTabs[m.route]?.includes(m.sub))missing.push(`${issue} → ${m.route}/${m.sub}`)
  }
  for(const c of billingReadiness(state,currentPeriodYear())){
    if(!CHECK_INPUT_MAP[c.label])missing.push(`${c.label} → keine Eingabezuordnung`)
  }
  return [...new Set(missing)]
}

function home(){
  const h=health(state),forecast=monthlyForecast(state),rent=state.leases.reduce((s,l)=>s+Number(l.rent||0),0),repay=Number(state.finance.repayment||0),burden=Math.max(0,repay-rent),a=billingAnalysis(state,currentPeriodYear()),sh=shares(state,periodStart(currentPeriodYear()));
  $("app").innerHTML=`<section>${storageError?`<div class="legal-warn"><strong>Lokaler Speicher eingeschränkt</strong><br>${esc(storageError.message||storageError)}</div>`:""}
  <div class="hero"><div><p class="eyebrow">ÜBERSICHT</p><h2>Dein Haus auf einen Blick</h2><p class="muted">Eine Datenbasis – daraus entstehen Analyse, Fristen und Nebenkostenabrechnung.</p></div><div class="health ${h.score>=85?"good":h.score>=65?"mid":"low"}">${h.score}%</div></div>
  <div class="grid cards"><article class="card"><span>Hausrate</span><strong>${euro(repay)}</strong><small>monatlich</small></article><article class="card"><span>Kaltmiete</span><strong>${euro(rent)}</strong><small>monatlich</small></article><article class="card"><span>Grundbelastung</span><strong>${euro(burden)}</strong><small>vor sonstigen Hauskosten</small></article><article class="card"><span>Mieter-BK aktuell</span><strong>${euro(a.tenantCosts)}</strong><small>${periodLabel(currentPeriodYear())}</small></article></div>
  ${!window.matchMedia("(display-mode: standalone)").matches?`<div class="info"><strong>Als App installieren</strong><br>Safari → Teilen → „Zum Home-Bildschirm“. Dadurch stehen Offline-Modus und App-Badge komfortabler zur Verfügung.</div>`:""}<div class="card"><div class="row between"><h3>Jetzt wichtig</h3><button class="secondary" id="toAssistant">Assistent</button></div>${h.issues.length?h.issues.slice(0,4).map(x=>`<button class="priority-item legal-warn" onclick="goToCheckInput(\'${String(x).replace(/\'/g,"\\\'")}\')">⚠ ${esc(x)}<small> → Eingabe öffnen</small></button>`).join(""):`<p class="legal-ok">✓ Stammdaten sind plausibel.</p>`}</div>
  <div class="card"><h3>Verteilungsbild</h3><div class="analysis-grid"><div><small>Wohnfläche Mieterin</small><strong>${percent(sh.area)}</strong></div><div><small>Personen Mieterin</small><strong>${percent(sh.persons)}</strong></div><div><small>Umlagefähige Kosten</small><strong>${euro(a.tenantCosts)}</strong></div></div></div>
  <div class="card"><h3>12‑Monats-Prognose</h3><div class="tablewrap"><table class="costtable"><thead><tr><th>Monat</th><th>Einnahmen</th><th>Ausgaben</th><th>Saldo</th></tr></thead><tbody>${forecast.slice(0,4).map(x=>`<tr><td>${x.label}</td><td>${euro(x.income)}</td><td>${euro(x.outflow)}</td><td class="${x.net<0?"negative":"positive"}">${euro(x.net)}</td></tr>`).join("")}</tbody></table></div></div>
  <div class="card"><h3>Nächste Termine</h3>${taskList().slice(0,5).map(taskHTML).join("")}</div></section>`;
  $("toAssistant").onclick=()=>go("data")
}
function assistant(){
  const y=currentPeriodYear(),a=billingAnalysis(state,y),h=health(state);
  $("app").innerHTML=`<section><div class="hero"><div><p class="eyebrow">HAUSASSISTENT</p><h2>Was möchtest du erledigen?</h2><p class="muted">Die App führt dich zum passenden Datensatz statt durch Menüs.</p></div></div>
  <div class="action-grid">
    <button data-a="bill"><strong>Nebenkostenabrechnung erstellen</strong><small>Vollständigkeit und Ergebnis prüfen</small></button>
    <button data-a="assessment"><strong>Neuen Bescheid erfassen</strong><small>Grundbesitzabgaben einmal zentral speichern</small></button>
    <button data-a="source"><strong>Neue Rechnung / Kostenquelle</strong><small>Vertrag, Rechnung oder laufende Kosten</small></button>
    <button data-a="water"><strong>Kaltwasser eintragen</strong><small>Gesamtverbrauch minus dein Zwischenzähler</small></button>
  </div><div class="card" id="assistantResult"><h3>Datenqualität ${h.score}%</h3>${h.issues.map(x=>`<p>⚠ ${esc(x)}</p>`).join("")||"<p>✓ Keine offensichtlichen Lücken.</p>"}</div></section>`;
  document.querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>{const k=b.dataset.a;if(k==="bill")go("rental");else if(k==="assessment"){go("data");setTimeout(()=>{sub.data="assessment";house()},0)}else if(k==="source"){go("data");setTimeout(()=>openSourceEditor(),0)}else openWaterEditor()})
}


function dataWorkspace(){
  const tabs=[
    {id:"property",label:"Objekt"},
    {id:"units",label:"Einheiten"},
    {id:"lease",label:"Mietvertrag"},
    {id:"sources",label:"Verträge & Kostenquellen"},
    {id:"assessment",label:"Grundbesitzabgaben"},
    {id:"documents",label:"Dokumente"}
  ];
  const active=sub.data||"property";
  $("app").innerHTML=workspaceHeader("DATEN","Grunddaten & Verträge","Hier werden alle Stammdaten, Verträge, Bescheide und Dokumente erfasst.",tabs,active);
  bindWorkspaceTabs("data",dataWorkspace);
  if(active==="property")propertyView();
  else if(active==="units")unitsDataView();
  else if(active==="lease")leaseDataView();
  else if(active==="sources")sourcesDataView();
  else if(active==="assessment")assessmentDataView();
  else documentsDataView()
}
function propertyView(){
  $("workspaceBody").innerHTML=`<form id="propertyForm" class="card form-grid">
    ${formField({name:"name",label:"Objektname",value:state.property.name||"",placeholder:"z. B. Doppelhaus Hauptstraße"})}
    ${formField({name:"address",label:"Adresse",value:state.property.address||"",placeholder:"Straße, Hausnummer, Ort"})}
    ${formField({name:"totalArea",label:"Gesamtwohnfläche m²",type:"number",step:"0.01",min:0,value:state.property.totalArea||""})}
    ${formField({name:"year",label:"Baujahr",type:"number",min:1800,value:state.property.year||""})}
    <div class="full"><button class="primary">Objektdaten speichern</button></div>
  </form>
  <div class="card"><h3>Warum diese Daten gebraucht werden</h3><p>Objektname und Adresse werden für Dokumentzuordnung und PDF-Ausgaben genutzt. Die Gesamtwohnfläche wird für wohnflächenbasierte Umlagen benötigt.</p></div>`;
  $("propertyForm").onsubmit=async e=>{
    e.preventDefault();const v=Object.fromEntries(new FormData(e.target));
    state.property={...state.property,name:v.name.trim(),address:v.address.trim(),totalArea:Number(v.totalArea)||0,year:v.year};
    await persist("Objektdaten geändert",state.property.name||"Objekt");
    propertyView()
  }
}
function unitsDataView(){
  const owner=unitByType(state,"owner"),rental=unitByType(state,"rental");
  $("workspaceBody").innerHTML=`<div class="card"><button id="addUnit" class="primary">Einheit hinzufügen</button></div>
  ${state.units.map(u=>`<div class="item"><div class="row between"><div><h3>${esc(u.name)}</h3><p>${u.type==="owner"?"Eigennutzung":"Mietwohnung"} · ${u.area} m²</p><p>${esc(u.note||"")}</p></div><button class="secondary" data-edit-unit="${u.id}">Bearbeiten</button></div></div>`).join("")||"<div class='legal-warn'>Noch keine Einheiten angelegt.</div>"}
  <div class="card"><h3>Aktuelle Zuordnung</h3><p>Eigennutzung: <strong>${owner?esc(owner.name):"fehlt"}</strong></p><p>Mietwohnung: <strong>${rental?esc(rental.name):"fehlt"}</strong></p></div>`;
  $("addUnit").onclick=()=>openUnitEditor();
  document.querySelectorAll("[data-edit-unit]").forEach(b=>b.onclick=()=>openUnitEditor(state.units.find(x=>x.id===b.dataset.editUnit)))
}
function leaseDataView(){
  const l=state.leases[0];
  $("workspaceBody").innerHTML=`<div class="card"><button id="editLease" class="primary">${l?"Mietvertrag bearbeiten":"Mietvertrag anlegen"}</button></div>
  ${l?`<div class="item"><h3>Mietvertrag</h3><p>Beginn ${esc(l.start)} · Kaltmiete ${euro(l.rent)} · BK-Vorauszahlung ${euro(l.advance)}</p><p>${esc(l.note||"")}</p></div>`:"<div class='legal-warn'>Noch kein Mietvertrag hinterlegt.</div>"}`;
  $("editLease").onclick=()=>openLeaseEditor(l)
}
function sourcesDataView(){
  $("workspaceBody").innerHTML=`<div class="card"><button id="addSource" class="primary">Kostenquelle / Vertrag hinzufügen</button></div>
  ${state.sources.filter(s=>s.kind!=="assessment").map(s=>`<div class="item"><div class="row between"><div><h3>${esc(s.name)}</h3><p>${esc(category(s.category).label)} · ${euro(s.amount)} · ${esc(s.interval||"einmalig")}</p><p><span class="pill">${s.assignment==="owner"?"nur Eigennutzung":s.assignment==="rental"?"nur Mietwohnung":"gesamtes Haus"}</span></p></div><button class="secondary" data-source="${s.id}">Bearbeiten</button></div></div>`).join("")||"<div class='muted card'>Noch keine Kostenquellen oder Verträge erfasst.</div>"}`;
  $("addSource").onclick=()=>openSourceEditor();
  document.querySelectorAll("[data-source]").forEach(b=>b.onclick=()=>openSourceEditor(state.sources.find(x=>x.id===b.dataset.source)))
}
function assessmentDataView(){
  const assessments=state.sources.filter(s=>s.kind==="assessment");
  $("workspaceBody").innerHTML=`<div class="card"><button id="addAssessment" class="primary">Grundbesitzabgaben erfassen</button><p class="muted">Fälligkeiten: 15.02., 15.05., 15.08., 15.11.</p></div>
  ${assessments.map(a=>`<div class="item"><div class="row between"><div><h3>${esc(a.name)}</h3><p>${(a.items||[]).map(i=>`${esc(i.label)} ${euro(i.amount)}`).join(" · ")}</p>${a.waterCanalReference?`<p>Wasser/Kanal Referenz: ${euro(a.waterCanalReference)} <small>(nicht doppelt in BK; im Kaltwasserbereich verwenden)</small></p>`:""}</div><button class="secondary" data-assess="${a.id}">Bearbeiten</button></div></div>`).join("")||"<div class='muted card'>Noch kein Bescheid erfasst.</div>"}`;
  $("addAssessment").onclick=()=>openAssessmentEditor();
  document.querySelectorAll("[data-assess]").forEach(b=>b.onclick=()=>openAssessmentEditor(assessments.find(x=>x.id===b.dataset.assess)))
}
async function documentsDataView(){
  // Reuse the enhanced document view, but render into workspaceBody.
  await documentsView();
}

function house(){
  const tabs=[{id:"overview",label:"Übersicht"},{id:"units",label:"Einheiten"},{id:"sources",label:"Verträge & Kosten"},{id:"assessment",label:"Grundbesitzabgaben"},{id:"documents",label:"Dokumente"}];
  $("app").innerHTML=`<section><div class="section-head"><p class="eyebrow">HAUS</p><h2>Zentrale Hausverwaltung</h2></div>${sectionTabs(tabs,sub.house)}<div id="houseBody"></div></section>`;
  document.querySelectorAll("[data-sub]").forEach(b=>b.onclick=()=>{sub.house=b.dataset.sub;house()});
  if(sub.house==="overview")houseOverview();else if(sub.house==="units")unitsView();else if(sub.house==="sources")sourcesView();else if(sub.house==="assessment")assessmentView();else documentsView()
}
function houseOverview(){
  const s=state.sources,contracts=s.filter(x=>x.kind==="contract").length,assess=s.filter(x=>x.kind==="assessment").length;
  viewBody("houseBody").innerHTML=`<div class="grid cards"><article class="card"><span>Einheiten</span><strong>${state.units.length}</strong></article><article class="card"><span>Kostenquellen</span><strong>${s.length}</strong></article><article class="card"><span>Verträge</span><strong>${contracts}</strong></article><article class="card"><span>Bescheide</span><strong>${assess}</strong></article></div><div class="card"><h3>Prinzip V6</h3><p>Jeder reale Sachverhalt wird nur einmal gespeichert. Aus Vertrag oder Bescheid werden Kosten, Fristen und Abrechnungsanteile automatisch abgeleitet.</p></div>`
}
function unitsView(){
  viewBody("houseBody").innerHTML=`<div class="card"><button id="addUnit" class="primary">Einheit hinzufügen</button></div>${state.units.map(u=>`<div class="item"><div class="row between"><div><h3>${esc(u.name)}</h3><p>${u.type==="owner"?"Eigennutzung":"Mietwohnung"} · ${u.area} m²</p><p>${esc(u.note||"")}</p></div><button class="secondary" data-edit-unit="${u.id}">Bearbeiten</button></div></div>`).join("")}`;
  $("addUnit").onclick=()=>openUnitEditor();document.querySelectorAll("[data-edit-unit]").forEach(b=>b.onclick=()=>openUnitEditor(state.units.find(x=>x.id===b.dataset.editUnit)))
}
function openUnitEditor(x=null){
  const opts=[{value:"owner",label:"Eigennutzung"},{value:"rental",label:"Mietwohnung"}];
  modal(x?"Einheit bearbeiten":"Einheit hinzufügen",`<form id="f" class="form-grid">${formField({name:"name",label:"Bezeichnung",value:x?.name||""})}${formField({name:"type",label:"Typ",type:"select",value:x?.type||"owner",options:opts})}${formField({name:"area",label:"Wohnfläche m²",type:"number",step:"0.01",min:0,value:x?.area||""})}${formField({name:"persons",label:"Aktuelle Personen",type:"number",min:0,value:x?.occupancy?.[x.occupancy.length-1]?.count??3})}${formField({name:"note",label:"Notiz",value:x?.note||"",full:true})}<div class="full"><button class="primary">Speichern</button></div></form>`,()=>{$("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));const obj=x||{id:uid(),occupancy:[]};obj.name=v.name.trim();obj.type=v.type;obj.area=Number(v.area)||0;obj.note=v.note.trim();obj.occupancy=[...(obj.occupancy||[]).filter(o=>o.to),{id:uid(),from:new Date().toISOString().slice(0,10),to:"",count:Number(v.persons)||0}];if(!x)state.units.push(obj);await persist(x?"Einheit geändert":"Einheit angelegt",obj.name);$("modal").classList.add("hidden");route==="data"?unitsDataView():unitsView()}})
}

function sourcesView(){
  viewBody("houseBody").innerHTML=`<div class="card"><button id="addSource" class="primary">Kostenquelle hinzufügen</button></div>${state.sources.filter(s=>s.kind!=="assessment").map(s=>`<div class="item"><div class="row between"><div><h3>${esc(s.name)}</h3><p>${esc(category(s.category).label)} · ${euro(s.amount)} · ${esc(s.interval||"einmalig")}</p><p><span class="pill">${s.assignment==="owner"?"nur Eigennutzung":s.assignment==="rental"?"nur Mietwohnung":"gesamtes Haus"}</span></p></div><button class="secondary" data-source="${s.id}">Bearbeiten</button></div></div>`).join("")}`;
  $("addSource").onclick=()=>openSourceEditor();document.querySelectorAll("[data-source]").forEach(b=>b.onclick=()=>openSourceEditor(state.sources.find(x=>x.id===b.dataset.source)))
}
function openSourceEditor(x=null){
  const cats=Object.entries(CATEGORIES).map(([value,c])=>({value,label:c.label})),assign=[{value:"owner",label:"nur Eigennutzung"},{value:"house",label:"gesamtes Haus"},{value:"rental",label:"nur Mietwohnung"}],ints=[{value:"once",label:"einmalig"},{value:"monthly",label:"monatlich"},{value:"quarterly",label:"vierteljährlich"},{value:"yearly",label:"jährlich"}];
  modal(x?"Kostenquelle bearbeiten":"Kostenquelle hinzufügen",`<form id="f" class="form-grid">${formField({name:"name",label:"Bezeichnung / Anbieter",value:x?.name||""})}${formField({name:"category",label:"Kategorie",type:"select",value:x?.category||"other",options:cats})}${formField({name:"amount",label:"Betrag €",type:"number",step:"0.01",min:0,value:x?.amount||""})}${formField({name:"interval",label:"Intervall",type:"select",value:x?.interval||"yearly",options:ints})}${formField({name:"assignment",label:"Zuordnung",type:"select",value:x?.assignment||"house",options:assign})}${formField({name:"agreement",label:"Verteilung",type:"select",value:x?.agreement||"auto",options:[{value:"auto",label:"automatisch / Standard"},{value:"area",label:"Wohnfläche vereinbart"},{value:"persons",label:"Personen vereinbart"},{value:"manual",label:"individuell prüfen"}]})}${formField({name:"serviceStart",label:"Leistungsbeginn",type:"date",value:x?.serviceStart||periodStart(currentPeriodYear())})}${formField({name:"serviceEnd",label:"Leistungsende",type:"date",value:x?.serviceEnd||periodEnd(currentPeriodYear())})}${formField({name:"note",label:"Notiz",value:x?.note||"",full:true})}<div class="full" id="legalPreview"></div><div class="full"><button class="primary">Speichern</button></div></form>`,()=>{
    const preview=()=>{const v=Object.fromEntries(new FormData($("f")));const d=legalDecision({category:v.category},{assignment:v.assignment,agreement:v.agreement});$("legalPreview").innerHTML=`<div class="${d.status==="blocked"?"legal-bad":d.status==="check"?"legal-warn":"info"}"><strong>${esc(category(v.category).label)}</strong><br>${esc(d.reason)}<br><small>${esc(d.basis)}</small></div>`};$("f").onchange=preview;preview();
    $("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target)),obj=x||{id:uid(),kind:"contract"};Object.assign(obj,{name:v.name.trim(),category:v.category,amount:Number(v.amount)||0,interval:v.interval,assignment:v.assignment,agreement:v.agreement,serviceStart:v.serviceStart,serviceEnd:v.serviceEnd,note:v.note.trim()});if(!x)state.sources.push(obj);await persist(x?"Kostenquelle geändert":"Kostenquelle angelegt",obj.name);$("modal").classList.add("hidden");route==="data"?sourcesDataView():sourcesView()}
  })
}

function assessmentView(){
  const assessments=state.sources.filter(s=>s.kind==="assessment");
  viewBody("houseBody").innerHTML=`<div class="card"><button id="addAssessment" class="primary">Jahresbescheid erfassen</button><p class="muted">Fälligkeiten: 15.02., 15.05., 15.08., 15.11.</p></div>${assessments.map(a=>`<div class="item"><div class="row between"><div><h3>${esc(a.name)}</h3><p>${(a.items||[]).map(i=>`${esc(i.label)} ${euro(i.amount)}`).join(" · ")}</p>${a.waterCanalReference?`<p>Wasser/Kanal Referenz: ${euro(a.waterCanalReference)} <small>(nicht doppelt in BK; im Kaltwasserbereich verwenden)</small></p>`:""}</div><button class="secondary" data-assess="${a.id}">Bearbeiten</button></div></div>`).join("")}`;
  $("addAssessment").onclick=()=>openAssessmentEditor();document.querySelectorAll("[data-assess]").forEach(b=>b.onclick=()=>openAssessmentEditor(assessments.find(x=>x.id===b.dataset.assess)))
}
function openAssessmentEditor(x=null){
  const find=c=>x?.items?.find(i=>i.category===c)?.amount||"";
  modal(x?"Bescheid bearbeiten":"Grundbesitzabgaben erfassen",`<form id="f" class="form-grid">${formField({name:"year",label:"Veranlagungsjahr",type:"number",value:x?.year||new Date().getFullYear()})}${formField({name:"tax",label:"Grundsteuer B €",type:"number",step:"0.01",value:find("propertyTax")})}${formField({name:"street",label:"Straßenreinigung/Winterdienst €",type:"number",step:"0.01",value:find("street")})}${formField({name:"rain",label:"Niederschlagswasser €",type:"number",step:"0.01",value:find("rainwater")})}${formField({name:"waterRef",label:"Wasser/Kanal € (Referenz)",type:"number",step:"0.01",value:x?.waterCanalReference||""})}${formField({name:"bio",label:"Gemeinsame Biotonne €",type:"number",step:"0.01",value:x?.items?.find(i=>i.label==="Gemeinsame Biotonne")?.amount||""})}${formField({name:"rest",label:"Gemeinsame Restmülltonne €",type:"number",step:"0.01",value:x?.items?.find(i=>i.label==="Gemeinsame Restmülltonne")?.amount||""})}${formField({name:"private",label:"Zusätzliche 120L Restmülltonne nur Eigennutzung €",type:"number",step:"0.01",value:x?.items?.find(i=>i.assignment==="owner"&&i.category==="waste")?.amount||""})}<div class="full"><button class="primary">Speichern</button></div></form>`,()=>{$("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target)),year=Number(v.year),items=[];const push=(category,label,amount,assignment="house")=>{if(Number(amount)>0)items.push({category,label,amount:Number(amount),assignment,agreement:"auto"})};push("propertyTax","Grundsteuer B",v.tax);push("street","Straßenreinigung / Winterdienst",v.street);push("rainwater","Niederschlagswasser",v.rain);push("waste","Gemeinsame Biotonne",v.bio);push("waste","Gemeinsame Restmülltonne",v.rest);push("waste","Zusätzliche 120L Restmülltonne Eigennutzung",v.private,"owner");const obj=x||{id:uid(),kind:"assessment"};Object.assign(obj,{name:`Grundbesitzabgaben ${year}`,year,serviceStart:`${year}-01-01`,serviceEnd:`${year}-12-31`,dueDates:["02-15","05-15","08-15","11-15"],waterCanalReference:Number(v.waterRef)||0,items});if(!x)state.sources.push(obj);await persist(x?"Bescheid geändert":"Bescheid angelegt",obj.name);$("modal").classList.add("hidden");route==="data"?assessmentDataView():assessmentView()}})
}


let OCR_SCRIPT_PROMISE=null;
function loadOCRLibrary(){
  if(window.Tesseract)return Promise.resolve(window.Tesseract);
  if(OCR_SCRIPT_PROMISE)return OCR_SCRIPT_PROMISE;
  OCR_SCRIPT_PROMISE=new Promise((resolve,reject)=>{
    const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";s.async=true;
    s.onload=()=>resolve(window.Tesseract);s.onerror=()=>reject(new Error("OCR-Bibliothek konnte nicht geladen werden."));document.head.appendChild(s)
  });return OCR_SCRIPT_PROMISE
}
function parseMoney(v){return Number(String(v||"").replace(/\./g,"").replace(",",".").replace(/[^\d.-]/g,""))||0}
function ocrAmount(lines,keys){const l=lines.find(x=>keys.some(k=>x.toLowerCase().includes(k)));if(!l)return 0;const ms=[...l.matchAll(/(\d{1,4}(?:\.\d{3})*,\d{2})/g)].map(x=>x[1]);return ms.length?parseMoney(ms[ms.length-1]):0}
function analyzeOCRText(text){
  const lines=String(text||"").split(/\r?\n/).map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean),low=text.toLowerCase(),ym=text.match(/\b(20\d{2})\b/);
  let kind="Sonstiges";if(/grundbesitz|grundsteuer|niederschlagswasser|straßenreinigung|strassenreinigung/.test(low))kind="Grundbesitzabgaben";else if(/versicherung/.test(low))kind="Versicherung";else if(/schornstein|kehrgebühr|kehrgebuehr/.test(low))kind="Schornsteinfeger";else if(/wasser|kanal|abwasser/.test(low))kind="Wasser/Kanal";
  return {kind,year:ym?Number(ym[1]):new Date().getFullYear(),tax:ocrAmount(lines,["grundsteuer b","grundsteuer"]),street:ocrAmount(lines,["straßenreinigung","strassenreinigung","winterdienst"]),rain:ocrAmount(lines,["niederschlagswasser"]),bio:ocrAmount(lines,["biotonne","bio-tonne"]),rest:ocrAmount(lines,["restmüll","restmuell"])}
}
async function runLocalImageOCR(file,progress){
  const T=await loadOCRLibrary(),worker=await T.createWorker("deu",1,{logger:m=>{if(progress&&m.status)progress.textContent=`${m.status}${m.progress!=null?" · "+Math.round(m.progress*100)+" %":""}`}});
  try{return (await worker.recognize(file)).data.text||""}finally{await worker.terminate()}
}


let PDFJS_PROMISE=null;
function loadPDFJS(){
  if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);
  if(PDFJS_PROMISE)return PDFJS_PROMISE;
  PDFJS_PROMISE=new Promise((resolve,reject)=>{
    const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload=()=>resolve(window.pdfjsLib);s.onerror=()=>reject(new Error("PDF.js konnte nicht geladen werden."));document.head.appendChild(s)
  });return PDFJS_PROMISE
}
async function extractPDFText(file,progress){
  const lib=await loadPDFJS();if(!lib)throw new Error("PDF.js nicht verfügbar.");
  lib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const pdf=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise,parts=[],max=Math.min(pdf.numPages,8);
  for(let i=1;i<=max;i++){if(progress)progress.textContent=`PDF Seite ${i}/${max}`;const page=await pdf.getPage(i),content=await page.getTextContent();parts.push(content.items.map(x=>x.str).join(" "))}
  return parts.join("\n")
}
async function documentsView(){
  const docs=await listDocuments(),sourceOptions=[{value:"",label:"keine Verknüpfung"},...(state.sources||[]).map(s=>({value:s.id,label:s.name}))];
  viewBody("houseBody").innerHTML=`<div class="card"><label class="primary" style="display:inline-block">Datei auswählen<input id="docInput" type="file" accept="image/*,.pdf" multiple hidden></label><label class="secondary" style="display:inline-block">Foto aufnehmen<input id="camInput" type="file" accept="image/*" capture="environment" hidden></label></div>
  <div class="card"><h3>Dokument analysieren</h3><p class="muted">Bilder: OCR-Beta. Digitale PDFs: lokale Textextraktion. Gescannten PDFs ohne Textebene bitte als Bild scannen/exportieren.</p><input id="analyzeInput" type="file" accept="image/*,.pdf"><div id="ocrProgress"></div><div id="ocrResult"></div></div>
  ${docs.map(d=>`<div class="item"><div class="row between"><div><h3>${esc(d.label||d.name)}</h3><p>${esc(d.type||"Dokument")} · ${Math.round((d.size||0)/1024)} KB${d.sourceId?` · <span class="pill good">verknüpft</span>`:""}</p>${d.sourceId?`<small>${esc(state.sources.find(s=>s.id===d.sourceId)?.name||"Kostenquelle")}</small>`:""}</div><div><button class="secondary" data-link-doc="${d.id}">Zuordnen</button><button class="danger" data-del-doc="${d.id}">Löschen</button></div></div></div>`).join("")}`;
  const handle=async files=>{for(const f of files)await addDocument({id:uid(),name:f.name,label:f.name,type:f.type,size:f.size,created:new Date().toISOString(),sourceId:"",blob:f});await persist("Dokument hinzugefügt",`${files.length} Datei(en)`);documentsView()};
  $("docInput").onchange=e=>handle(e.target.files);$("camInput").onchange=e=>handle(e.target.files);
  document.querySelectorAll("[data-del-doc]").forEach(b=>b.onclick=async()=>{await deleteDocument(b.dataset.delDoc);documentsView()});
  document.querySelectorAll("[data-link-doc]").forEach(b=>b.onclick=async()=>{const doc=docs.find(d=>d.id===b.dataset.linkDoc);if(!doc)return;modal("Dokument zuordnen",`<form id="f" class="form-grid">${formField({name:"sourceId",label:"Kostenquelle",type:"select",value:doc.sourceId||"",options:sourceOptions})}${formField({name:"label",label:"Bezeichnung",value:doc.label||doc.name})}<div class="full"><button class="primary">Speichern</button></div></form>`,()=>{$("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));doc.sourceId=v.sourceId;doc.label=v.label.trim();await updateDocument(doc);$("modal").classList.add("hidden");documentsView()}})});
  $("analyzeInput").onchange=async e=>{const f=e.target.files?.[0];if(!f)return;const p=$("ocrProgress"),r=$("ocrResult");p.innerHTML=`<div class="info">Analyse startet …</div>`;r.innerHTML="";try{const text=f.type==="application/pdf"||f.name.toLowerCase().endsWith(".pdf")?await extractPDFText(f,p):await runLocalImageOCR(f,p),a=analyzeOCRText(text),vals=[["Grundsteuer B",a.tax],["Straßen/Winterdienst",a.street],["Niederschlagswasser",a.rain],["Biotonne",a.bio],["Restmüll",a.rest]].filter(x=>x[1]>0);r.innerHTML=`<div class="legal-ok"><strong>Analyse abgeschlossen</strong><br>Vorschlag: ${esc(a.kind)} · Jahr ${a.year}</div>${vals.length?`<div class="info">${vals.map(x=>`${esc(x[0])}: <strong>${euro(x[1])}</strong>`).join("<br>")}</div>`:""}<details><summary>Erkannten Text anzeigen</summary><textarea class="big-input" rows="12" readonly>${esc(text)}</textarea></details><p class="muted">Erkannte Werte immer mit dem Originaldokument vergleichen.</p>`}catch(err){r.innerHTML=`<div class="legal-bad"><strong>Analyse fehlgeschlagen</strong><br>${esc(err.message||err)}</div>`}}
}

function rentalWorkspace(){
  const tabs=[
    {id:"overview",label:"Übersicht"},
    {id:"water",label:"Kaltwasser"},
    {id:"calculation",label:"Nebenkostenabrechnung"},
    {id:"workflow",label:"Abschluss"}
  ];
  const active=sub.rental||"overview";
  $("app").innerHTML=workspaceHeader("VERMIETUNG","Vermietung","Alles, was direkt die Mietwohnung und die Nebenkostenabrechnung betrifft.",tabs,active);
  bindWorkspaceTabs("rental",rentalWorkspace);
  if(active==="overview")rentalOverview();
  else if(active==="water")waterRentalView();
  else if(active==="calculation")rentalCalculationView();
  else rentalWorkflowView()
}
function rentalOverview(){
  const y=currentPeriodYear(),a=billingAnalysis(state,y);
  $("workspaceBody").innerHTML=`<div class="grid cards">
    <article class="card"><span>Kostenanteil Mieterin</span><strong>${euro(a.tenantCosts)}</strong></article>
    <article class="card"><span>Vorauszahlungen</span><strong>${euro(a.advances)}</strong></article>
    <article class="card"><span>${a.result>=0?"Nachzahlung":"Guthaben"}</span><strong>${euro(Math.abs(a.result))}</strong></article>
    <article class="card"><span>Ungeklärte Positionen</span><strong>${a.unresolved.length}</strong></article>
  </div>
  <div class="card"><h3>${periodLabel(y)}</h3><p>Abrechnungsfrist grundsätzlich bis ${periodDeadline(y)}.</p></div>
  <div class="card"><button id="toLeaseData" class="secondary">Mietvertragsdaten öffnen</button><button id="toSourceData" class="secondary">Kostenquellen öffnen</button></div>`;
  $("toLeaseData").onclick=()=>{sub.data="lease";go("data")};
  $("toSourceData").onclick=()=>{sub.data="sources";go("data")}
}
function waterRentalView(){
  // Reuse water view into workspaceBody
  waterView()
}
function rentalCalculationView(){
  calculationView()
}
function rentalWorkflowView(){
  workflowView()
}

function billing(){
  const tabs=[{id:"overview",label:"Übersicht"},{id:"lease",label:"Mietvertrag"},{id:"water",label:"Kaltwasser"},{id:"calculation",label:"Abrechnung"},{id:"workflow",label:"Workflow"}];
  $("app").innerHTML=`<section><div class="section-head"><p class="eyebrow">ABRECHNUNG</p><h2>Vermietung & Nebenkosten</h2></div>${sectionTabs(tabs,sub.billing)}<div id="billingBody"></div></section>`;
  document.querySelectorAll("[data-sub]").forEach(b=>b.onclick=()=>{sub.billing=b.dataset.sub;billing()});
  if(sub.billing==="overview")billingOverview();else if(sub.billing==="lease")leaseView();else if(sub.billing==="water")waterView();else if(sub.billing==="calculation")calculationView();else workflowView()
}
function billingOverview(){
  const y=currentPeriodYear(),a=billingAnalysis(state,y);
  viewBody("billingBody").innerHTML=`<div class="grid cards"><article class="card"><span>Mieteranteil Kosten</span><strong>${euro(a.tenantCosts)}</strong></article><article class="card"><span>Vorauszahlungen</span><strong>${euro(a.advances)}</strong></article><article class="card"><span>Ergebnis</span><strong>${euro(Math.abs(a.result))}</strong><small>${a.result>=0?"Nachzahlung":"Guthaben"}</small></article><article class="card"><span>Ungeklärt</span><strong>${a.unresolved.length}</strong></article></div><div class="card"><h3>${periodLabel(y)}</h3><p>Abrechnungsfrist grundsätzlich bis ${periodDeadline(y)}.</p></div>`
}
function leaseView(){
  const l=state.leases[0];viewBody("billingBody").innerHTML=`<div class="card"><button id="editLease" class="primary">${l?"Mietvertrag bearbeiten":"Mietvertrag anlegen"}</button></div>${l?`<div class="item"><h3>Mietvertrag</h3><p>Beginn ${esc(l.start)} · Kaltmiete ${euro(l.rent)} · BK-Vorauszahlung ${euro(l.advance)}</p><p>${esc(l.note||"")}</p></div>`:""}`;$("editLease").onclick=()=>openLeaseEditor(l)
}
function openLeaseEditor(x=null){
  modal(x?"Mietvertrag bearbeiten":"Mietvertrag anlegen",`<form id="f" class="form-grid">${formField({name:"start",label:"Beginn",type:"date",value:x?.start||"2026-09-01"})}${formField({name:"end",label:"Ende",type:"date",value:x?.end||""})}${formField({name:"rent",label:"Kaltmiete / Monat €",type:"number",step:"0.01",value:x?.rent||400})}${formField({name:"advance",label:"BK-Vorauszahlung / Monat €",type:"number",step:"0.01",value:x?.advance||125})}${formField({name:"note",label:"Notiz",value:x?.note||"",full:true})}<div class="full"><button class="primary">Speichern</button></div></form>`,()=>{$("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target)),obj=x||{id:uid()};Object.assign(obj,{start:v.start,end:v.end,rent:Number(v.rent)||0,advance:Number(v.advance)||0,note:v.note.trim()});if(!x)state.leases.push(obj);await persist(x?"Mietvertrag geändert":"Mietvertrag angelegt","Mietvertrag");$("modal").classList.add("hidden");route==="data"?leaseDataView():leaseView()}})
}
function waterView(){
  const y=currentPeriodYear(),w=state.water.find(x=>Number(x.periodYear)===y);viewBody("billingBody").innerHTML=`<div class="card"><button id="editWater" class="primary">${w?"Kaltwasser bearbeiten":"Kaltwasser erfassen"}</button></div>${w?`<div class="item"><h3>${periodLabel(y)}</h3><p>Gesamt ${w.houseConsumption} m³ · eigener Zwischenzähler ${Number(w.ownerEnd)-Number(w.ownerStart)} m³ · Mieterin ${Number(w.houseConsumption)-(Number(w.ownerEnd)-Number(w.ownerStart))} m³</p><p>Gesamtkosten ${euro(w.totalCost)}</p></div>`:""}`;$("editWater").onclick=()=>openWaterEditor(w)
}
function openWaterEditor(x=null){
  const py=x?.periodYear||currentPeriodYear();
  const refAssessment=state.sources.filter(s=>s.kind==="assessment"&&s.waterCanalReference).sort((a,b)=>Math.abs(Number(a.year)-py)-Math.abs(Number(b.year)-py))[0];
  const suggestedCost=x?.totalCost||refAssessment?.waterCanalReference||"";
  modal(x?"Kaltwasser bearbeiten":"Kaltwasser erfassen",`<form id="f" class="form-grid">${formField({name:"periodYear",label:"Abrechnungsperiode ab",type:"number",value:x?.periodYear||currentPeriodYear()})}${formField({name:"houseConsumption",label:"Gesamtverbrauch Haus m³",type:"number",step:"0.001",value:x?.houseConsumption||""})}${formField({name:"ownerStart",label:"Eigener Zwischenzähler Anfang",type:"number",step:"0.001",value:x?.ownerStart||""})}${formField({name:"ownerEnd",label:"Eigener Zwischenzähler Ende",type:"number",step:"0.001",value:x?.ownerEnd||""})}${formField({name:"totalCost",label:"Wasser/Kanal Gesamtkosten €",type:"number",step:"0.01",value:suggestedCost})}<div class="full" id="calc"></div><div class="full"><button class="primary">Speichern</button></div></form>`,()=>{const calc=()=>{const v=Object.fromEntries(new FormData($("f"))),own=Number(v.ownerEnd)-Number(v.ownerStart),tenant=Number(v.houseConsumption)-own;$("calc").innerHTML=tenant>=0?`<div class="info">Mieterin: <strong>${tenant.toFixed(3)} m³</strong> = Gesamtverbrauch − dein Zwischenzählerverbrauch.</div>`:`<div class="legal-bad">Zwischenzählerverbrauch ist größer als Gesamtverbrauch.</div>`};$("f").oninput=calc;calc();$("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target)),own=Number(v.ownerEnd)-Number(v.ownerStart),tenant=Number(v.houseConsumption)-own;if(tenant<0)return alert("Zählerstände prüfen.");const obj=x||{id:uid()};Object.assign(obj,{periodYear:Number(v.periodYear),houseConsumption:Number(v.houseConsumption),ownerStart:Number(v.ownerStart),ownerEnd:Number(v.ownerEnd),totalCost:Number(v.totalCost)});if(!x)state.water.push(obj);await persist(x?"Kaltwasser geändert":"Kaltwasser angelegt",periodLabel(obj.periodYear));$("modal").classList.add("hidden");route==="rental"?waterRentalView():waterView()}})
}
function calculationView(){
  const y=currentPeriodYear(),snap=snapshotFor(state,y),live=billingAnalysis(state,y),a=snap?{events:snap.events,unresolved:snap.unresolved,tenantCosts:snap.tenantCosts,advances:snap.advances,result:snap.result,lease:snap.lease}:live;
  const recommended=Math.round(Number(a.tenantCosts||0)/12),change=recommended-Number(a.lease?.advance||0);
  viewBody("billingBody").innerHTML=`${snap?`<div class="legal-ok"><strong>Abrechnung eingefroren</strong><br>Snapshot vom ${new Date(snap.createdAt).toLocaleString("de-DE")} · Regelpaket ${esc(snap.legalPackVersion)} / Rechtsstand ${esc(snap.legalEffectiveDate)}. Spätere Änderungen verändern diese Abrechnung nicht.</div>`:`<div class="legal-warn"><strong>Live-Berechnung</strong><br>Noch nicht eingefroren. Änderungen an Kosten, Wohnfläche oder Regelpaket können das Ergebnis verändern.</div>`}
  <div class="card"><div class="row between"><h3>${periodLabel(y)}</h3><div><button id="printBill" class="secondary">PDF / Drucken</button>${!snap?`<button id="freezeBill" class="primary">Abrechnung einfrieren</button>`:""}</div></div><p>Frist grundsätzlich bis ${periodDeadline(y)}.</p></div>
  <div class="grid cards"><article class="card"><span>Kostenanteil Mieterin</span><strong>${euro(a.tenantCosts)}</strong></article><article class="card"><span>Vorauszahlungen</span><strong>${euro(a.advances)}</strong></article><article class="card"><span>${a.result>=0?"Nachzahlung":"Guthaben"}</span><strong>${euro(Math.abs(a.result))}</strong></article><article class="card"><span>Empfohlene Vorauszahlung</span><strong>${euro(recommended)}</strong><small>${change>0?`+${euro(change)}`:euro(change)}</small></article></div>
  ${a.unresolved.length?`<div class="legal-warn"><strong>${a.unresolved.length} Position(en) benötigen Prüfung.</strong></div>`:`<div class="legal-ok">✓ Keine ungeklärten Verteilungsregeln.</div>`}
  <div class="card"><div class="tablewrap"><table class="costtable"><thead><tr><th>Kosten</th><th>Gesamt</th><th>Regel</th><th>Mieterin</th></tr></thead><tbody>${a.events.map(e=>`<tr><td>${esc(e.label)}</td><td>${euro(e.amount)}</td><td>${esc(e.decision?.rule||"–")}</td><td>${euro(e.tenantAmount)}</td></tr>`).join("")}</tbody></table></div></div>`;
  $("printBill").onclick=()=>printBilling(a,y,snap);
  if($("freezeBill"))$("freezeBill").onclick=async()=>{if(live.unresolved.length)return alert("Abrechnung kann mit ungeklärten Verteilungsregeln nicht eingefroren werden.");state.billingSnapshots.push(createBillingSnapshot(state,y));await persist("Abrechnung eingefroren",periodLabel(y));calculationView()}
}
function printBilling(a,y,snapshot=null){
  const w=window.open("","_blank");if(!w)return alert("Druckfenster blockiert.");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Nebenkostenabrechnung</title><style>body{font-family:Arial,sans-serif;padding:30px}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}</style></head><body><h1>Nebenkostenabrechnung</h1><p>${periodLabel(y)}</p><table><thead><tr><th>Kostenart</th><th>Gesamt</th><th>Mieteranteil</th></tr></thead><tbody>${a.events.map(e=>`<tr><td>${esc(e.label)}</td><td>${euro(e.amount)}</td><td>${euro(e.tenantAmount)}</td></tr>`).join("")}</tbody></table><h2>${a.result>=0?"Nachzahlung":"Guthaben"}: ${euro(Math.abs(a.result))}</h2><p>Vorauszahlungen: ${euro(a.advances)}</p><p>Erstellt mit Mietverwaltung V8.0.19.</p></body></html>`);w.document.close();setTimeout(()=>w.print(),200)
}
function workflowView(){
  const y=currentPeriodYear(),a=billingAnalysis(state,y),readiness=billingReadiness(state,y),ready=readiness.every(c=>c.ok);
  let wf=state.billingWorkflows.find(x=>x.periodYear===y);if(!wf){wf={id:uid(),periodYear:y,status:"draft"};state.billingWorkflows.push(wf);saveState(state)}
  viewBody("billingBody").innerHTML=`<div class="card"><h3>${periodLabel(y)}</h3><p>Status: <strong>${wf.status==="draft"?"Entwurf":wf.status==="checked"?"Geprüft":"Abgeschlossen"}</strong></p>${ready?`<p class="legal-ok">✓ App-Prüfung vollständig.</p>`:`<div class="legal-warn"><strong>Es fehlen:</strong>${readiness.filter(c=>!c.ok).map(c=>`<p>⚠ ${esc(c.label)}</p>`).join("")}</div>`}${wf.status==="draft"?`<button id="wfCheck" class="primary" ${ready?"":"disabled"}>Als geprüft markieren</button>`:""}${wf.status==="checked"?`<button id="wfFinal" class="primary">Abschließen</button>`:""}${wf.status==="final"?`<p class="legal-ok">✓ Abrechnung abgeschlossen.</p>`:""}</div>`;
  if($("wfCheck"))$("wfCheck").onclick=async()=>{wf.status="checked";await persist("Abrechnung geprüft",periodLabel(y));workflowView()};if($("wfFinal"))$("wfFinal").onclick=async()=>{if(!snapshotFor(state,y)){const snap=createBillingSnapshot(state,y);if(snap.unresolved.length)return alert("Abrechnung enthält ungeklärte Positionen.");state.billingSnapshots.push(snap)}wf.status="final";await persist("Abrechnung abgeschlossen und eingefroren",periodLabel(y));workflowView()}
}


function ownerWorkspace(){
  const tabs=[
    {id:"overview",label:"Übersicht"},
    {id:"finance",label:"Finanzen"},
    {id:"cashflow",label:"Zahlungsfluss"},
    {id:"tasks",label:"Pflichten & Erinnerungen"}
  ];
  const active=sub.owner||"overview";
  $("app").innerHTML=workspaceHeader("EIGENER BEREICH","Eigener Bereich","Private Hauskosten, Finanzierung und eigene Pflichten – klar getrennt von der Vermietung.",tabs,active);
  bindWorkspaceTabs("owner",ownerWorkspace);
  if(active==="overview")ownerOverview();
  else if(active==="finance")ownerFinanceView();
  else if(active==="cashflow")ownerCashflowView();
  else ownerTasksView()
}
function ownerOverview(){
  const f=monthlyForecast(state),sum=f.reduce((s,x)=>s+x.net,0),rent=state.leases.reduce((s,l)=>s+Number(l.rent||0),0),repay=Number(state.finance.repayment||0);
  $("workspaceBody").innerHTML=`<div class="grid cards">
    <article class="card"><span>Hausrate</span><strong>${euro(repay)}</strong></article>
    <article class="card"><span>Kaltmiete</span><strong>${euro(rent)}</strong></article>
    <article class="card"><span>Grundbelastung</span><strong>${euro(Math.max(0,repay-rent))}</strong></article>
    <article class="card"><span>12M-Prognose</span><strong class="${sum<0?"negative":"positive"}">${euro(sum)}</strong></article>
  </div><div class="card"><p>Eigene Kosten und Finanzierung werden hier analysiert, aber nicht mit der Nebenkostenabrechnung vermischt.</p></div>`
}
function ownerFinanceView(){
  financeView()
}
function ownerCashflowView(){
  cashflowView()
}
function ownerTasksView(){
  tasksView()
}

function more(){
  const tabs=[
    {id:"overview",label:"Übersicht"},
    {id:"audit",label:"Verlauf"},
    {id:"legal",label:"Rechtsstand"},
    {id:"security",label:"Sicherheit"},
    {id:"diagnostics",label:"Diagnose"},
    {id:"backup",label:"Backup"}
  ];
  const active=sub.more||"overview";
  $("app").innerHTML=workspaceHeader("MEHR","Mehr","Technik, Sicherheit, Rechtsstand und Backups.",tabs,active);
  bindWorkspaceTabs("more",more);
  if(active==="audit")auditMoreView();
  else if(active==="legal")legalMoreView();
  else if(active==="security")securityMoreView();
  else if(active==="diagnostics")diagnosticsMoreView();
  else if(active==="backup")backupMoreView();
  else moreOverview()
}

function auditMoreView(){auditView()}
function legalMoreView(){legalView()}
function securityMoreView(){securityView()}
function diagnosticsMoreView(){diagnosticsView()}
function backupMoreView(){backupView()}

function moreOverview(){
  $("workspaceBody").innerHTML=`<div class="card"><h3>Datenmodell</h3><p>Private Stammdaten und Dokumente liegen gemeinsam in IndexedDB. Alte V5-Daten werden beim ersten Start automatisch migriert.</p></div><div class="card"><h3>Datenschutz</h3><p>Persönliche Daten werden nicht in die GitHub-Dateien geschrieben.</p></div>`
}
function financeView(){
  const f=monthlyForecast(state),sum=f.reduce((s,x)=>s+x.net,0);
  $("workspaceBody").innerHTML=`<form id="financeForm" class="card form-grid">${formField({name:"repayment",label:"Hausrückzahlung / Monat €",type:"number",step:"0.01",value:state.finance.repayment})}${formField({name:"fixed",label:"Sonstige feste Hauskosten / Monat €",type:"number",step:"0.01",value:state.finance.fixed})}<div class="full"><button class="primary">Speichern</button></div></form><div class="card"><h3>12M-Saldo</h3><strong class="${sum<0?"negative":"positive"}">${euro(sum)}</strong></div>`;
  $("financeForm").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));state.finance={repayment:Number(v.repayment)||0,fixed:Number(v.fixed)||0};await persist("Finanzen geändert","Hausrückzahlung / feste Kosten");financeView()}
}

function cashflowView(){
  const rows=actualCashflowByMonth(state,12),sumIn=rows.reduce((s,r)=>s+r.income,0),sumOut=rows.reduce((s,r)=>s+r.outflow,0);
  viewBody("moreBody").innerHTML=`<div class="card"><div class="row between"><h3>Tatsächlicher Zahlungsfluss</h3><button id="addPayment" class="primary">Buchung hinzufügen</button></div><p class="muted">Echte Kontobewegungen – getrennt von wirtschaftlichen Monatskosten und Nebenkostenperiodisierung.</p></div>
  <div class="analysis-grid"><div><small>12M Einnahmen</small><strong>${euro(sumIn)}</strong></div><div><small>12M Ausgaben</small><strong>${euro(sumOut)}</strong></div><div><small>Saldo</small><strong class="${sumIn-sumOut<0?"negative":"positive"}">${euro(sumIn-sumOut)}</strong></div></div>
  <div class="card"><div class="tablewrap"><table class="costtable"><thead><tr><th>Monat</th><th>Einnahmen</th><th>Ausgaben</th><th>Saldo</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.label}</td><td>${euro(r.income)}</td><td>${euro(r.outflow)}</td><td class="${r.net<0?"negative":"positive"}">${euro(r.net)}</td></tr>`).join("")}</tbody></table></div></div>
  <div class="card"><h3>Einzelbuchungen</h3>${(state.payments||[]).slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map(p=>`<div class="task"><div class="row between"><div><h4>${esc(p.label)}</h4><small>${esc(p.date)} · ${p.direction==="income"?"Einnahme":"Ausgabe"}${p.sourceId?" · verknüpft":""}</small></div><strong class="${p.direction==="income"?"positive":"negative"}">${p.direction==="income"?"+":"−"}${euro(p.amount)}</strong></div></div>`).join("")||"<p class='muted'>Noch keine tatsächlichen Zahlungen erfasst.</p>"}</div>`;
  $("addPayment").onclick=()=>openPaymentEditor()
}
function openPaymentEditor(){
  const sources=(state.sources||[]).map(s=>({value:s.id,label:s.name}));
  modal("Zahlung erfassen",`<form id="f" class="form-grid">${formField({name:"date",label:"Datum",type:"date",value:new Date().toISOString().slice(0,10)})}${formField({name:"direction",label:"Art",type:"select",value:"outflow",options:[{value:"outflow",label:"Ausgabe"},{value:"income",label:"Einnahme"}]})}${formField({name:"label",label:"Bezeichnung"})}${formField({name:"amount",label:"Betrag €",type:"number",step:"0.01",min:0})}${formField({name:"sourceId",label:"Kostenquelle",type:"select",value:"",options:[{value:"",label:"keine Verknüpfung"},...sources]})}<div class="full"><button class="primary">Speichern</button></div></form>`,()=>{
    $("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));state.payments.push({id:uid(),date:v.date,direction:v.direction,label:v.label.trim(),amount:Number(v.amount)||0,sourceId:v.sourceId||""});await persist("Zahlung erfasst",v.label);$("modal").classList.add("hidden");route==="owner"?ownerCashflowView():cashflowView()}
  })
}

function tasksView(){
  viewBody("moreBody").innerHTML=`<div class="card"><button id="addTask" class="primary">Eigene Erinnerung</button><button id="ics" class="secondary">Kalender exportieren</button></div>${taskList().map(taskHTML).join("")}`;$("addTask").onclick=openTaskEditor;$("ics").onclick=exportICS
}
function openTaskEditor(){
  modal("Erinnerung hinzufügen",`<form id="f" class="form-grid">${formField({name:"title",label:"Titel"})}${formField({name:"due",label:"Fällig am",type:"date"})}${formField({name:"lead",label:"Vorwarnung Tage",type:"number",value:14})}<div class="full"><button class="primary">Speichern</button></div></form>`,()=>{$("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));state.tasks.push({id:uid(),title:v.title,due:v.due,lead:Number(v.lead)||14});await persist("Erinnerung angelegt",v.title);$("modal").classList.add("hidden");route==="owner"?ownerTasksView():tasksView()}})
}
function exportICS(){
  let out="BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Mietverwaltung V6//DE\r\n";
  for(const t of taskList()){if(!t.due)continue;out+=`BEGIN:VEVENT\r\nUID:${t.id}@mietverwaltung\r\nDTSTART;VALUE=DATE:${t.due.replaceAll("-","")}\r\nSUMMARY:${String(t.title).replace(/,/g,"\\,")}\r\nBEGIN:VALARM\r\nTRIGGER:-P${Number(t.lead||14)}D\r\nACTION:DISPLAY\r\nDESCRIPTION:${String(t.title).replace(/,/g,"\\,")}\r\nEND:VALARM\r\nEND:VEVENT\r\n`}
  out+="END:VCALENDAR\r\n";const blob=new Blob([out],{type:"text/calendar"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="Mietverwaltung_Erinnerungen.ics";a.click();URL.revokeObjectURL(a.href)
}
function auditView(){
  viewBody("moreBody").innerHTML=state.audit.length?state.audit.map(x=>`<div class="item"><h3>${esc(x.action)}</h3><p>${esc(x.detail)}</p><small>${new Date(x.at).toLocaleString("de-DE")}</small></div>`).join(""):`<div class="card muted">Noch keine Änderungen protokolliert.</div>`
}
function legalView(){
  const effective=ACTIVE_LEGAL_PACK?.effectiveDate||LAW_DATE,age=Math.floor((new Date()-new Date(effective+"T00:00:00"))/86400000),sources=ACTIVE_LEGAL_PACK?.sources||LEGAL_SOURCES;
  viewBody("moreBody").innerHTML=`<div class="${age<=90?"legal-ok":"legal-warn"}"><strong>Regelpaket ${esc(ACTIVE_LEGAL_PACK?.version||"Fallback")}</strong><br>Rechtsstand ${esc(effective)} · ${age} Tage alt.</div><div class="card"><h3>Amtliche Quellen</h3>${sources.map(s=>`<p><a href="${s.url}" target="_blank" rel="noopener">${esc(s.name)}</a>${s.purpose?`<br><small>${esc(s.purpose)}</small>`:""}</p>`).join("")}<button id="reloadRules" class="secondary">Regelpaket neu laden</button><p class="muted">Das Regelpaket liegt getrennt von deinen privaten Daten auf derselben GitHub-Pages-Seite. Dadurch kann die Rechtsregelbasis separat aktualisiert werden.</p></div>`;
  $("reloadRules").onclick=async()=>{await loadLegalPack();legalView()}
}

async function storageStatus(){
  let persisted=false,usage=0,quota=0;
  try{if(navigator.storage?.persisted) persisted=await navigator.storage.persisted()}catch(e){console.warn(e)}
  try{
    if(navigator.storage?.estimate){
      const x=await navigator.storage.estimate();
      usage=Number(x.usage||0); quota=Number(x.quota||0);
    }
  }catch(e){console.warn(e)}
  return {persisted,usage,quota};
}


async function requestPersistentStorage(){
  try{return navigator.storage?.persist ? await navigator.storage.persist() : false}
  catch(e){console.warn(e);return false}
}


function humanBytes(n){
  n=Number(n||0); if(!n)return "0 MB";
  const units=["B","KB","MB","GB"],i=Math.min(3,Math.floor(Math.log(n)/Math.log(1024)));
  return `${(n/Math.pow(1024,i)).toFixed(i<2?0:1)} ${units[i]}`;
}


async function updateBadge(){
  try{
    const now=new Date(new Date().toDateString());
    const tasks=typeof taskList==="function" ? taskList() : [];
    const count=tasks.filter(t=>{
      if(!t?.due)return false;
      const diff=Math.ceil((new Date(t.due+"T00:00:00")-now)/86400000);
      return diff<=Number(t.lead||30);
    }).length;
    if(count>0 && navigator.setAppBadge) await navigator.setAppBadge(count);
    else if(navigator.clearAppBadge) await navigator.clearAppBadge();
  }catch(e){console.warn("App-Badge nicht verfügbar:",e)}
}


let SW_UPDATE_WAITING=false;
function setupServiceWorkerUpdates(){
  if(!("serviceWorker" in navigator))return;
  navigator.serviceWorker.ready.then(reg=>{
    reg.addEventListener("updatefound",()=>{
      const worker=reg.installing;
      if(!worker)return;
      worker.addEventListener("statechange",()=>{
        if(worker.state==="installed" && navigator.serviceWorker.controller){
          SW_UPDATE_WAITING=true;
        }
      });
    });
  }).catch(e=>console.warn("Service-Worker-Updateprüfung nicht verfügbar:",e));
}

function securityView(){
  viewBody("moreBody").innerHTML=`<div class="card"><h3>Face ID / Geräteauthentifizierung</h3><div id="authStatus"></div><button id="authEnable" class="primary">Aktivieren</button><button id="authTest" class="secondary">Testen</button><button id="authDisable" class="danger">Deaktivieren</button></div><div class="info">Auf unterstützten iPhones verwendet die PWA WebAuthn mit Plattform-Authenticator. iOS kann dafür Face ID, Touch ID oder Gerätecode verwenden.</div>`;
  const refresh=()=>$("authStatus").innerHTML=authEnabled()?`<p class="legal-ok">✓ Schutz aktiviert</p>`:`<p class="legal-warn">○ Schutz nicht aktiviert</p>`;refresh();
  $("authEnable").onclick=async()=>{try{await registerDevice();refresh()}catch(e){alert(e.message)}};
  $("authTest").onclick=async()=>alert(await authenticate()?"Authentifizierung erfolgreich.":"Authentifizierung fehlgeschlagen.");
  $("authDisable").onclick=async()=>{if(authEnabled()&&!(await authenticate()))return alert("Authentifizierung erforderlich.");disableAuth();refresh()}
}
async function diagnosticsView(){
  const tests=runSelfTests(),coverageMissing=checkInputCoverage(),ok=tests.filter(t=>t.ok).length,st=await storageStatus(),pct=st.quota?Math.round(st.usage/st.quota*100):0;
  viewBody("moreBody").innerHTML=`<div class="card"><h3>Automatische Selbsttests</h3><p><strong>${ok}/${tests.length}</strong> bestanden.</p>${tests.map(t=>`<p class="${t.ok?"legal-ok":"legal-bad"}">${t.ok?"✓":"✕"} ${esc(t.name)}</p>`).join("")}</div>${coverageMissing.length?`<div class="legal-bad"><strong>Prüfungen ohne Eingabeweg:</strong><br>${coverageMissing.map(esc).join("<br>")}</div>`:`<div class="legal-ok">✓ Zu jeder Datenqualitätsprüfung existiert ein Eingabeweg.</div>`}<div class="card"><h3>Lokaler Speicher</h3><p>Modus: <strong>${st.persisted?"persistent":"best effort"}</strong></p><p>Nutzung: ${humanBytes(st.usage)} von ca. ${humanBytes(st.quota)} (${pct} %)</p><div class="storage-meter"><span style="width:${Math.min(100,pct)}%"></span></div><p><button id="persistBtn" class="primary">${st.persisted?"Persistenter Speicher aktiv":"Persistenten Speicher anfordern"}</button></p><p class="muted">Persistenter Speicher verringert das Risiko automatischer Browser-Bereinigung.</p></div><div class="card"><h3>Fähigkeiten</h3><p>WebAuthn: ${window.PublicKeyCredential?"✓":"–"} · Badging: ${navigator.setAppBadge?"✓":"–"} · Service Worker: ${"serviceWorker" in navigator?"✓":"–"}</p><p>Regelpaket: ${esc(ACTIVE_LEGAL_PACK?.version||"Fallback")} · ${esc(ACTIVE_LEGAL_PACK?.effectiveDate||LAW_DATE)}</p>${SW_UPDATE_WAITING?`<p class="legal-warn">Neue App-Version wartet – App schließen und neu öffnen.</p>`:""}</div>`;
  $("persistBtn").onclick=async()=>{if(st.persisted)return;const ok=await requestPersistentStorage();alert(ok?"Persistenter Speicher aktiviert.":"Safari hat den persistenten Speicher derzeit nicht gewährt.");diagnosticsView()}
}
function backupView(){
  viewBody("moreBody").innerHTML=`<div class="card"><h3>Vollständiges verschlüsseltes Backup</h3><label>Backup-Passwort<input id="backupPw" type="password" class="big-input" placeholder="mindestens 8 Zeichen"></label><button id="fullExport" class="primary">Backup inkl. Dokumente exportieren</button><input id="fullImportFile" type="file" accept=".json,application/json"><button id="fullImport" class="secondary">Vollbackup importieren</button><p class="muted">Das Backup enthält Stammdaten und Dokumente und wird mit AES-GCM verschlüsselt.</p></div><div class="card"><h3>Unverschlüsselter Datenexport</h3><button id="exportState" class="secondary">Nur Daten exportieren</button></div>`;
  $("exportState").onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="Mietverwaltung_V7999_Daten.json";a.click();URL.revokeObjectURL(a.href)};
  $("fullExport").onclick=async()=>{const pw=$("backupPw").value;if(pw.length<8)return alert("Mindestens 8 Zeichen.");const wrapper=await createFullBackup(state,pw),blob=new Blob([JSON.stringify(wrapper)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="Mietverwaltung_V7999_Vollbackup_verschluesselt.json";a.click();URL.revokeObjectURL(a.href)};
  $("fullImport").onclick=async()=>{const f=$("fullImportFile").files[0],pw=$("backupPw").value;if(!f)return alert("Datei auswählen.");try{const wrapper=JSON.parse(await f.text());state=await restoreFullBackup(wrapper,pw);await saveState(state);alert("Vollbackup importiert.");more()}catch(e){alert("Import fehlgeschlagen: "+e.message)}}
}
function setupGlobal(){
  document.querySelectorAll(".main-tabs button").forEach(b=>b.onclick=()=>go(b.dataset.route));
  $("modalClose").onclick=()=>$("modal").classList.add("hidden");
  $("searchBtn").onclick=()=>{$("searchOverlay").classList.remove("hidden");$("searchInput").focus();search("")};$("searchClose").onclick=()=>$("searchOverlay").classList.add("hidden");$("searchInput").oninput=e=>search(e.target.value);
  $("quickBtn").onclick=()=>$("quickOverlay").classList.remove("hidden");$("quickClose").onclick=()=>$("quickOverlay").classList.add("hidden");
  document.querySelectorAll("[data-quick]").forEach(b=>b.onclick=()=>{const q=b.dataset.quick;$("quickOverlay").classList.add("hidden");if(q==="source"){go("data");setTimeout(openSourceEditor,0)}else if(q==="assessment"){go("data");sub.data="assessment";setTimeout(dataWorkspace,0)}else if(q==="water"){go("rental");sub.rental="water";setTimeout(rentalWorkspace,0)}else if(q==="task"){go("owner");sub.owner="tasks";setTimeout(()=>{ownerWorkspace();openTaskEditor()},0)}else if(q==="document"){go("data");sub.data="documents";setTimeout(dataWorkspace,0)}else{go("data");sub.data="lease";setTimeout(dataWorkspace,0)}})
}
function search(q){
  const z=(q||"").toLowerCase().trim(),rows=[];
  state.sources.forEach(s=>rows.push({title:s.name,detail:category(s.category||"other").label,route:"data",sub:"sources"}));
  state.tasks.forEach(t=>rows.push({title:t.title,detail:t.due||"",route:"owner",sub:"tasks"}));
  state.leases.forEach(l=>rows.push({title:"Mietvertrag",detail:`ab ${l.start}`,route:"data",sub:"lease"}));
  const f=rows.filter(r=>!z||`${r.title} ${r.detail}`.toLowerCase().includes(z)).slice(0,30);
  $("searchResults").innerHTML=f.length?f.map((r,i)=>`<button class="search-result" data-search="${i}"><strong>${esc(r.title)}</strong><small>${esc(r.detail)}</small></button>`).join(""):`<p class="muted">Keine Treffer.</p>`;
  document.querySelectorAll("[data-search]").forEach(b=>b.onclick=()=>{const r=f[Number(b.dataset.search)];$("searchOverlay").classList.add("hidden");go(r.route);sub[r.route]=r.sub;setTimeout(()=>r.route==="data"?dataWorkspace():r.route==="rental"?rentalWorkspace():r.route==="owner"?ownerWorkspace():more(),0)})
}
async function startApp(){
  setupGlobal();
  await loadLegalPack();
  try{if(navigator.storage?.persist)await navigator.storage.persist()}catch{}
  try{setupServiceWorkerUpdates()}catch(e){console.warn("Updateprüfung übersprungen:",e)}
  if(authEnabled()){
    const ok=await authenticate();
    if(!ok){document.body.innerHTML=`<div style="padding:40px;font-family:-apple-system"><h1>Mietverwaltung gesperrt</h1><p>Geräteauthentifizierung fehlgeschlagen.</p><button onclick="location.reload()">Erneut versuchen</button></div>`;return}
  }
  render();try{await updateBadge()}catch(e){console.warn("Badge übersprungen:",e)}
}
startApp();
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));

}catch(error){
  console.error("Mietverwaltung Startfehler:",error);
  const host=document.getElementById("app");
  if(host){
    host.innerHTML=`<section>
      <div class="legal-bad">
        <h2>Die App konnte nicht gestartet werden</h2>
        <p>${String(error?.message||error)}</p>
        <p>Diese Fehlermeldung ist absichtlich sichtbar, damit ein Startproblem nicht mehr nur als leere Seite erscheint.</p>
      </div>
    </section>`;
  }
}
})();


/* Professional PWA hardening */
(async()=>{try{if(navigator.storage&&navigator.storage.persist){await navigator.storage.persist();}}catch(e){console.warn('Persistent storage request failed',e)}})();
