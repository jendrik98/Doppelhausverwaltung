(async function(){
"use strict";
try{

/* ===== schema.js ===== */
const SCHEMA_VERSION=12;

function createEmptyState(){
  return {
    schemaVersion:SCHEMA_VERSION,
    meta:{appVersion:"13.0.0",createdAt:new Date().toISOString(),migratedFrom:null,revision:0,lastSavedAt:null,lastBackupAt:null,lastIntegrityCheckAt:null,errorLog:[]},
    property:{name:"",address:"",totalArea:0,year:""},
    correspondence:{landlordName:"",landlordAddress:"",iban:"",paymentReference:"",contact:""},
    units:[],
    leases:[],
    sources:[],
    costPositions:[],
    meters:[],
    waterSettlements:[],
    containers:[],
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
  for(const k of ["units","leases","sources","costPositions","meters","waterSettlements","containers","water","tasks","billingWorkflows","billingSnapshots","payments","audit"]){
    if(!Array.isArray(s[k]))errors.push(`${k} ist kein Array`)
  }
  if(!s.finance||typeof s.finance!=="object")errors.push("finance fehlt");
  return {ok:!errors.length,errors}
}

function normalizeState(s){
  const base=createEmptyState(),out={...base,...s};
  out.property={...base.property,...(s?.property||{})};
  out.correspondence={...base.correspondence,...(s?.correspondence||{})};
  out.finance={...base.finance,...(s?.finance||{})};
  for(const k of ["units","leases","sources","costPositions","meters","waterSettlements","containers","water","tasks","billingWorkflows","billingSnapshots","payments","audit"])out[k]=Array.isArray(s?.[k])?s[k]:[];
  out.schemaVersion=SCHEMA_VERSION;
  out.meta={...base.meta,...(s?.meta||{}),appVersion:"13.0.0"};
  out.meta.revision=Number(out.meta.revision||0);
  out.meta.errorLog=Array.isArray(out.meta.errorLog)?out.meta.errorLog:[];
  return out
}



/* ===== domain.js ===== */
const DOMAIN_VERSION=1;

function positionDefaults(p={}){
  return {
    id:p.id||uid(), sourceId:p.sourceId||"", documentId:p.documentId||"",
    label:p.label||"Kostenposition", category:p.category||"other",
    amount:Number(p.amount||0), interval:p.interval||"once",
    serviceStart:p.serviceStart||"", serviceEnd:p.serviceEnd||"",
    assignment:p.assignment||"house", agreement:p.agreement||"auto",
    confirmed:p.confirmed!==false, origin:p.origin||"manual",
    details:{quantity:null,unit:"",rate:null,vatRate:null,net:null,gross:null,...(p.details||{})},
    decisionHistory:Array.isArray(p.decisionHistory)?p.decisionHistory:[],
    createdAt:p.createdAt||new Date().toISOString(),
    provenance:p.provenance||{origin:p.origin||"manual",documentId:p.documentId||"",sourceId:p.sourceId||"",evidence:"",confidence:null,confirmedAt:p.confirmed!==false?new Date().toISOString():null,confirmedBy:"local-user"}
  }
}
function sourcePositions(state,sourceId){return (state.costPositions||[]).filter(p=>p.sourceId===sourceId)}
function positionById(state,id){return (state.costPositions||[]).find(p=>p.id===id)}

function migrateDomainState(state){
  state.costPositions=Array.isArray(state.costPositions)?state.costPositions.map(positionDefaults):[];
  state.meters=Array.isArray(state.meters)?state.meters:[];
  state.waterSettlements=Array.isArray(state.waterSettlements)?state.waterSettlements:[];
  state.containers=Array.isArray(state.containers)?state.containers:[];
  state.meta=state.meta||{};
  if(Number(state.meta.domainVersion||0)>=DOMAIN_VERSION)return state;

  // Legacy source/assessment -> central cost positions exactly once.
  const existingKeys=new Set(state.costPositions.map(p=>`${p.sourceId}|${p.label}|${p.serviceStart}|${p.serviceEnd}`));
  for(const s of state.sources||[]){
    if(s.kind==="assessment"){
      for(const li of s.items||[]){
        const p=positionDefaults({
          sourceId:s.id, documentId:s.sourceDocumentId||"",
          label:li.label||category(li.category).label, category:li.category,
          amount:li.amount, interval:"once",
          serviceStart:s.serviceStart||`${s.year}-01-01`,
          serviceEnd:s.serviceEnd||`${s.year}-12-31`,
          assignment:li.assignment||"house", agreement:li.agreement||"auto",
          origin:"migration"
        });
        const k=`${p.sourceId}|${p.label}|${p.serviceStart}|${p.serviceEnd}`;
        if(!existingKeys.has(k)){state.costPositions.push(p);existingKeys.add(k)}
      }
      if(Number(s.waterCanalReference||0)>0){
        const p=positionDefaults({
          sourceId:s.id, documentId:s.sourceDocumentId||"",
          label:"Wasser/Kanal", category:"water",
          amount:Number(s.waterCanalReference), interval:"once",
          serviceStart:s.serviceStart||`${s.year}-01-01`,
          serviceEnd:s.serviceEnd||`${s.year}-12-31`,
          assignment:"house", agreement:"auto", origin:"migration",
          details:{note:"Aus früheren Daten übernommen"}
        });
        const k=`${p.sourceId}|${p.label}|${p.serviceStart}|${p.serviceEnd}`;
        if(!existingKeys.has(k)){state.costPositions.push(p);existingKeys.add(k)}
      }
    }else{
      const p=positionDefaults({
        sourceId:s.id, documentId:s.sourceDocumentId||"",
        label:s.name||category(s.category).label, category:s.category||"other",
        amount:s.amount, interval:s.interval||"once",
        serviceStart:s.serviceStart||"", serviceEnd:s.serviceEnd||"",
        assignment:s.assignment||"house", agreement:s.agreement||"auto",
        origin:"migration", details:{note:s.note||""}
      });
      const k=`${p.sourceId}|${p.label}|${p.serviceStart}|${p.serviceEnd}`;
      if(!existingKeys.has(k)){state.costPositions.push(p);existingKeys.add(k)}
    }
  }

  // Legacy water settlements -> meter registry + new settlement references.
  ensureDefaultMeters(state);
  if(!state.waterSettlements.length && Array.isArray(state.water)){
    for(const w of state.water){
      const py=Number(w.periodYear??w.year);
      if(!py)continue;
      const main=state.meters.find(m=>m.role==="mainWater"),owner=state.meters.find(m=>m.role==="ownerWater");
      const ps=periodStart(py),pe=periodEnd(py);
      // Old data may only contain total consumption, so represent it as synthetic readings.
      const mainStart=addMeterReading(main,ps,0,"migration",true);
      const mainEnd=addMeterReading(main,pe,Number(w.houseConsumption||0),"migration",true);
      const ownerStart=addMeterReading(owner,ps,Number(w.ownerStart||0),"migration",true);
      const ownerEnd=addMeterReading(owner,pe,Number(w.ownerEnd||0),"migration",true);
      state.waterSettlements.push({
        id:w.id||uid(),periodYear:py,mainMeterId:main.id,ownerMeterId:owner.id,
        mainStartReadingId:mainStart.id,mainEndReadingId:mainEnd.id,
        ownerStartReadingId:ownerStart.id,ownerEndReadingId:ownerEnd.id,
        migrated:true
      });
      // If old totalCost existed and no water cost position covers period, preserve it.
      if(Number(w.totalCost||0)>0 && !state.costPositions.some(p=>p.category==="water"&&p.serviceStart===ps&&p.serviceEnd===pe)){
        state.costPositions.push(positionDefaults({
          sourceId:"legacy-water-"+py,label:"Kaltwasser / Kanal",
          category:"water",amount:Number(w.totalCost),serviceStart:ps,serviceEnd:pe,
          assignment:"house",agreement:"auto",origin:"migration"
        }))
      }
    }
  }
  state.meta.domainVersion=DOMAIN_VERSION;
  state.meta.domainMigratedAt=new Date().toISOString();
  return state
}

function ensureDefaultMeters(state){
  state.meters=Array.isArray(state.meters)?state.meters:[];
  let main=state.meters.find(m=>m.role==="mainWater");
  let owner=state.meters.find(m=>m.role==="ownerWater");
  if(!main){main={id:uid(),role:"mainWater",name:"Hauptwasserzähler",number:"",unit:"m³",readings:[]};state.meters.push(main)}
  if(!owner){owner={id:uid(),role:"ownerWater",name:"Zwischenzähler Eigennutzung",number:"",unit:"m³",readings:[]};state.meters.push(owner)}
  main.readings=Array.isArray(main.readings)?main.readings:[];
  owner.readings=Array.isArray(owner.readings)?owner.readings:[];
  return {main,owner}
}
function meterById(state,id){return (state.meters||[]).find(m=>m.id===id)}
function readingById(meter,id){return (meter?.readings||[]).find(r=>r.id===id)}
function addMeterReading(meter,date,value,origin="manual",synthetic=false){
  const same=(meter.readings||[]).find(r=>r.date===date&&Number(r.value)===Number(value));
  if(same)return same;
  const r={id:uid(),date,value:Number(value),origin,synthetic,createdAt:new Date().toISOString()};
  meter.readings.push(r);meter.readings.sort((a,b)=>a.date.localeCompare(b.date));return r
}

function normalizeMeterNumber(v){return String(v||"").toUpperCase().replace(/[^A-Z0-9]/g,"")}
function parseMeterReadingValue(v){
  let s=String(v||"").trim().replace(/\s/g,"");
  if(!s)return null;
  if(s.includes(",")&&s.includes(".")){
    if(s.lastIndexOf(",")>s.lastIndexOf("."))s=s.replace(/\./g,"").replace(",",".");
    else s=s.replace(/,/g,"")
  }else if(s.includes(","))s=s.replace(",",".");
  s=s.replace(/[^\d.]/g,"");
  if(!/^\d+(?:\.\d{1,4})?$/.test(s))return null;
  const n=Number(s);return Number.isFinite(n)?n:null
}
function meterReadingCandidates(text){
  const lines=String(text||"").split(/\r?\n/).map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean),out=[];
  const add=(raw,line,score)=>{
    const value=parseMeterReadingValue(raw);
    if(value==null||value<0||value>1000000)return;
    const digits=String(raw).replace(/\D/g,"");
    if(digits.length>8)return; // likely serial number, not the reading
    out.push({raw,value,line,score})
  };
  for(const line of lines){
    const low=line.toLowerCase(),context=/zählerstand|zaehlerstand|stand|m³|m3|kubik|verbrauch/.test(low);
    const rx=/\b\d{1,7}(?:[.,]\d{1,4})?\b/g;
    for(const m of line.matchAll(rx)){
      let score=context?0.82:0.38;
      if(/[.,]\d{1,4}$/.test(m[0]))score+=0.12;
      if(/m³|m3/.test(low))score+=0.05;
      add(m[0],line,Math.min(.99,score))
    }
  }
  const seen=new Set();
  return out.filter(c=>{const k=`${c.raw}|${c.line}`;if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>b.score-a.score)
}
function detectedMeterSerialCandidates(text){
  const lines=String(text||"").split(/\r?\n/).map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean),out=[];
  for(const line of lines){
    const low=line.toLowerCase(),context=/zähler|zaehler|nummer|nr\.|serial|serien/.test(low);
    for(const m of line.matchAll(/\b[A-Z0-9][A-Z0-9\-\/]{5,17}\b/gi)){
      const norm=normalizeMeterNumber(m[0]);
      if(norm.length<6||/^\d{1,6}$/.test(norm))continue;
      out.push({raw:m[0],normalized:norm,line,score:context?.9:.45})
    }
  }
  return out.sort((a,b)=>b.score-a.score)
}
function matchMeterFromOCR(state,text,preferredMeterId=""){
  const meters=state.meters||[];
  if(preferredMeterId){
    const preferred=meters.find(m=>m.id===preferredMeterId);
    if(preferred)return {meter:preferred,confidence:1,reason:"Aufnahme direkt an diesem Zähler gestartet"}
  }
  const normalizedText=normalizeMeterNumber(text),matches=[];
  for(const m of meters){
    const n=normalizeMeterNumber(m.number);
    if(n&&normalizedText.includes(n))matches.push({meter:m,confidence:.99,reason:"gespeicherte Zählernummer im Foto erkannt"})
  }
  if(matches.length===1)return matches[0];
  if(matches.length>1)return {meter:null,confidence:0,reason:"mehrere Zählernummern erkannt"};
  return {meter:null,confidence:0,reason:"keine gespeicherte Zählernummer eindeutig erkannt"}
}
function analyzeMeterOCRText(state,text,preferredMeterId=""){
  const assignment=matchMeterFromOCR(state,text,preferredMeterId),readings=meterReadingCandidates(text),serials=detectedMeterSerialCandidates(text);
  const chosen=readings[0]||null;
  return {
    meterId:assignment.meter?.id||"",
    meterName:assignment.meter?.name||"",
    assignmentConfidence:assignment.confidence,
    assignmentReason:assignment.reason,
    reading:chosen?.value??null,
    readingRaw:chosen?.raw||"",
    readingConfidence:chosen?.score||0,
    readingEvidence:chosen?.line||"",
    serialCandidate:serials[0]?.raw||"",
    serialConfidence:serials[0]?.score||0,
    candidates:readings.slice(0,8),
    text:String(text||"")
  }
}
function latestMeterReading(meter){return (meter?.readings||[]).slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0]||null}
function meterReadingPlausibility(meter,date,value){
  const all=(meter?.readings||[]).filter(r=>r.date<=date).sort((a,b)=>(b.date||"").localeCompare(a.date||"")),prev=all[0];
  if(!prev)return {ok:true,message:"Keine frühere Ablesung zum Vergleich vorhanden."};
  if(Number(value)<Number(prev.value))return {ok:false,message:`Der neue Stand ${value} liegt unter der letzten Ablesung ${prev.value} vom ${prev.date}. Zählerwechsel oder OCR-Fehler prüfen.`};
  return {ok:true,message:`Letzte Ablesung ${prev.value} am ${prev.date}; Differenz ${(Number(value)-Number(prev.value)).toFixed(3)} ${meter.unit||""}.`}
}

function settlementByPeriod(state,year){return (state.waterSettlements||[]).find(w=>Number(w.periodYear)===Number(year))}
function settlementConsumption(state,settlement){
  if(!settlement)return null;
  const main=meterById(state,settlement.mainMeterId),owner=meterById(state,settlement.ownerMeterId);
  const ms=readingById(main,settlement.mainStartReadingId),me=readingById(main,settlement.mainEndReadingId);
  const os=readingById(owner,settlement.ownerStartReadingId),oe=readingById(owner,settlement.ownerEndReadingId);
  if(!ms||!me||!os||!oe)return null;
  const house=Number(me.value)-Number(ms.value),own=Number(oe.value)-Number(os.value),tenant=house-own;
  return {house,owner:own,tenant,share:house>0?tenant/house:0,valid:house>=0&&own>=0&&tenant>=0}
}

function positionToEvents(position,periodYear){
  const p=positionDefaults(position);
  if(!p.confirmed)return [];
  const ps=periodStart(periodYear),pe=periodEnd(periodYear);
  const start=p.serviceStart||ps,end=p.serviceEnd||pe;
  const ov=overlapDays(start,end,ps,pe);if(!ov)return [];
  const factor=ov/daysInclusive(start,end);
  let amount=Number(p.amount||0);
  if(p.interval==="monthly")amount=amount*12*factor;
  else if(p.interval==="quarterly")amount=amount*4*factor;
  else if(p.interval==="yearly")amount=amount*factor;
  else amount=amount*factor;
  return [{positionId:p.id,sourceId:p.sourceId,documentId:p.documentId,label:p.label,category:p.category,amount,
    assignment:p.assignment,agreement:p.agreement,serviceStart:start,serviceEnd:end,details:p.details}]
}
function allocateCostPosition(state,event,periodYear){
  const settlement=settlementByPeriod(state,periodYear),cons=settlementConsumption(state,settlement);
  const hasConsumption=event.category==="water"&&!!cons?.valid;
  let decision;
  if(event.assignment==="review"){
    decision={status:"check",billable:true,rule:"manual",reason:"Zuordnung muss bestätigt werden.",basis:"Dokument-/Objektzuordnung"}
  }else{
    decision=legalDecision(event,{hasConsumption,assignment:event.assignment,agreement:event.agreement})
  }
  let share=0;
  const area=shares(state,periodStart(periodYear)).area;
  if(decision.rule==="area")share=area;
  else if(decision.rule==="persons")share=personShareForPeriod(state,periodStart(periodYear),periodEnd(periodYear));
  else if(decision.rule==="rental")share=1;
  else if(decision.rule==="owner")share=0;
  else if(decision.rule==="consumption"&&cons?.valid)share=cons.share;
  return {...event,decision,tenantShare:share,tenantAmount:Number(event.amount||0)*share}
}
function centralBillingAnalysis(state,periodYear){
  const events=(state.costPositions||[]).flatMap(p=>positionToEvents(p,periodYear)).map(e=>allocateCostPosition(state,e,periodYear));
  const unresolved=events.filter(e=>e.decision.status==="check"||e.decision.rule==="manual");
  const tenantCosts=events.reduce((s,e)=>s+Number(e.tenantAmount||0),0);
  const lease=state.leases[0],advances=monthlyAdvanceInPeriod(lease,periodYear);
  return {events,unresolved,tenantCosts,advances,result:tenantCosts-advances,lease}
}
function syncSimpleSourcePosition(state,source){
  if(!source||source.kind==="assessment")return;
  let p=(state.costPositions||[]).find(x=>x.sourceId===source.id&&x.origin!=="document");
  const data=positionDefaults({
    ...(p||{}),sourceId:source.id,label:source.name||"Kostenquelle",category:source.category||"other",
    amount:Number(source.amount||0),interval:source.interval||"once",
    serviceStart:source.serviceStart||"",serviceEnd:source.serviceEnd||"",
    assignment:source.assignment||"house",agreement:source.agreement||"auto",
    confirmed:true,origin:p?.origin||"manual",details:{...(p?.details||{}),note:source.note||""}
  });
  if(p)Object.assign(p,data);else state.costPositions.push(data)
}
function replaceAssessmentPositions(state,source,positions){
  const keep=(state.costPositions||[]).filter(p=>p.sourceId!==source.id);
  state.costPositions=keep.concat((positions||[]).map(p=>positionDefaults({
    ...p,sourceId:source.id,documentId:source.sourceDocumentId||p.documentId||"",
    serviceStart:p.serviceStart||source.serviceStart,serviceEnd:p.serviceEnd||source.serviceEnd,
    confirmed:true
  })))
}


/* ===== integrity.js ===== */
const APP_VERSION="13.0.0";
const MAX_ERROR_LOG=100;
let LAST_STABLE_STATE=null;

function cloneState(s){return typeof structuredClone==="function"?structuredClone(s):JSON.parse(JSON.stringify(s))}
function uniqueIds(items,label,issues){
  const seen=new Set();
  for(const x of items||[]){
    if(!x?.id){issues.errors.push(`${label}: Datensatz ohne ID`);continue}
    if(seen.has(x.id))issues.errors.push(`${label}: doppelte ID ${x.id}`);
    seen.add(x.id)
  }
}
function validateDomainState(s){
  const issues={errors:[],warnings:[]},base=validateState(s);issues.errors.push(...base.errors);
  if(!s||typeof s!=="object")return issues;
  for(const [key,label] of [["units","Einheiten"],["leases","Mietverträge"],["sources","Quellen"],["costPositions","Kostenpositionen"],["meters","Zähler"],["waterSettlements","Wasserperioden"],["containers","Behälter"],["tasks","Aufgaben"],["payments","Zahlungen"],["billingSnapshots","Snapshots"]])uniqueIds(s[key],label,issues);
  const sourceIds=new Set((s.sources||[]).map(x=>x.id)),meterIds=new Set((s.meters||[]).map(x=>x.id));
  for(const p of s.costPositions||[]){
    if(!p.label)issues.errors.push(`Kostenposition ${p.id}: Bezeichnung fehlt`);
    if(Number(p.amount)<0)issues.errors.push(`Kostenposition ${p.label}: negativer Betrag`);
    if(p.serviceStart&&p.serviceEnd&&p.serviceEnd<p.serviceStart)issues.errors.push(`Kostenposition ${p.label}: Leistungszeitraum ungültig`);
    if(p.sourceId&&!sourceIds.has(p.sourceId)&&!String(p.sourceId).startsWith("legacy-"))issues.warnings.push(`Kostenposition ${p.label}: Quelle nicht mehr vorhanden`);
    if(!["house","owner","rental","review"].includes(p.assignment))issues.errors.push(`Kostenposition ${p.label}: ungültige Zuordnung`)
  }
  for(const w of s.waterSettlements||[]){
    if(!meterIds.has(w.mainMeterId)||!meterIds.has(w.ownerMeterId))issues.errors.push(`Wasserperiode ${w.periodYear}: Zählerreferenz fehlt`);
    const c=settlementConsumption(s,w);if(c&&!c.valid)issues.errors.push(`Wasserperiode ${w.periodYear}: unplausible Verbräuche`)
  }
  for(const l of s.leases||[]){
    if(l.start&&l.end&&l.end<l.start)issues.errors.push("Mietvertrag: Enddatum liegt vor Beginn");
    if(Number(l.rent||0)<0||Number(l.advance||0)<0)issues.errors.push("Mietvertrag: negativer Betrag")
  }
  const ownerUnits=(s.units||[]).filter(u=>u.type==="owner").length,rentalUnits=(s.units||[]).filter(u=>u.type==="rental").length;
  if(ownerUnits>1)issues.warnings.push("Mehr als eine Eigennutzungs-Einheit hinterlegt");
  if(rentalUnits>1)issues.warnings.push("Mehr als eine Mietwohnung hinterlegt");
  return issues
}
function repairDomainState(s){
  s=normalizeState(s);s=migrateDomainState(s);ensureDefaultMeters(s);
  for(const m of s.meters||[]){
    m.readings=Array.isArray(m.readings)?m.readings:[];
    const seen=new Set();
    m.readings=m.readings.filter(r=>{const k=`${r.date}|${Number(r.value)}`;if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>(a.date||"").localeCompare(b.date||""))
  }
  s.schemaVersion=SCHEMA_VERSION;s.meta.appVersion=APP_VERSION;s.meta.revision=Number(s.meta.revision||0);s.meta.errorLog=Array.isArray(s.meta.errorLog)?s.meta.errorLog:[];
  return typeof ensureTraceShape==="function"?ensureTraceShape(s):s
}
function recordClientError(context,error){
  try{
    const entry={id:uid(),at:new Date().toISOString(),context,message:String(error?.message||error),stack:String(error?.stack||"").slice(0,3000)};
    state.meta.errorLog=Array.isArray(state.meta.errorLog)?state.meta.errorLog:[];
    state.meta.errorLog.unshift(entry);state.meta.errorLog=state.meta.errorLog.slice(0,MAX_ERROR_LOG)
  }catch{}
}
function integritySummary(s){const v=validateDomainState(s);return{ok:v.errors.length===0,errors:v.errors,warnings:v.warnings,revision:Number(s.meta?.revision||0)}}
function attentionItems(state){
  const out=[],y=currentPeriodYear(),checks=billingReadiness(state,y);
  checks.filter(c=>!c.ok).forEach(c=>out.push({severity:"warn",title:c.label,route:c.route,sub:c.sub}));
  const drafts=(state.costPositions||[]).filter(p=>!p.confirmed).length;if(drafts)out.push({severity:"warn",title:`${drafts} Kostenposition(en) noch nicht bestätigt`,route:"data",sub:"positions"});
  const review=(state.costPositions||[]).filter(p=>p.confirmed&&p.assignment==="review").length;if(review)out.push({severity:"bad",title:`${review} bestätigte Position(en) ohne endgültige Zuordnung`,route:"data",sub:"positions"});
  const age=state.meta?.lastBackupAt?Math.floor((Date.now()-new Date(state.meta.lastBackupAt))/86400000):9999;if(age>30)out.push({severity:"warn",title:state.meta?.lastBackupAt?"Backup älter als 30 Tage":"Noch kein Vollbackup dokumentiert",route:"more",sub:"backup"});
  const lawDate=ACTIVE_LEGAL_PACK?.effectiveDate||LAW_DATE,lawAge=Math.floor((Date.now()-new Date(lawDate+"T00:00:00"))/86400000);if(lawAge>90)out.push({severity:"warn",title:"Rechtsregelpaket älter als 90 Tage",route:"more",sub:"legal"});
  return out
}
async function sha256Text(text){
  if(!crypto?.subtle)return "";
  const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
  return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,"0")).join("")
}
function stableJSON(value){
  const sort=v=>Array.isArray(v)?v.map(sort):(v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v);
  return JSON.stringify(sort(value))
}
async function finalizeSnapshotIntegrity(snapshot){snapshot.integrityHash=await sha256Text(stableJSON({...snapshot,integrityHash:undefined}));return snapshot}
async function blobSha256(blob){
  if(!crypto?.subtle)return "";
  const h=await crypto.subtle.digest("SHA-256",await blob.arrayBuffer());
  return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,"0")).join("")
}
async function documentFingerprint(pages){const hashes=[];for(const p of pages||[])hashes.push(await blobSha256(p.blob));return sha256Text(hashes.join("|"))}
function reconciliationSummary(state){
  const positionPaid=new Map();
  for(const p of state.payments||[]){if(!p.positionId)continue;positionPaid.set(p.positionId,(positionPaid.get(p.positionId)||0)+(p.direction==="outflow"?Number(p.amount||0):-Number(p.amount||0)))}
  const rows=(state.costPositions||[]).filter(p=>p.confirmed).map(p=>({position:p,paid:positionPaid.get(p.id)||0,difference:Number(p.amount||0)-(positionPaid.get(p.id)||0)}));
  return {rows,unmatchedPayments:(state.payments||[]).filter(p=>!p.positionId&&!p.sourceId)}
}


/* ===== traceability.js ===== */
const TRACE_VERSION=1;
const COMMAND_VERSION=1;

function ensureTraceShape(s){
  s.meta=s.meta||{};
  s.meta.traceVersion=TRACE_VERSION;s.meta.importHistory=Array.isArray(s.meta.importHistory)?s.meta.importHistory:[];
  s.meta.commandVersion=COMMAND_VERSION;
  s.meta.commandLog=Array.isArray(s.meta.commandLog)?s.meta.commandLog:[];
  s.meta.restorePoints=Array.isArray(s.meta.restorePoints)?s.meta.restorePoints:[];
  for(const p of s.costPositions||[]){
    p.provenance=p.provenance||{
      origin:p.origin||"manual",
      documentId:p.documentId||"",
      sourceId:p.sourceId||"",
      evidence:"",
      confidence:null,
      confirmedAt:p.confirmed?new Date().toISOString():null,
      confirmedBy:"local-user"
    };
  }
  return s
}

function provenanceLabel(p){
  const o=p?.provenance?.origin||p?.origin||"manual";
  return o==="document"?"aus Dokument":o==="migration"?"übernommen":o==="photo"?"aus Foto":o==="assessment"?"aus Bescheid":"manuell";
}

function createRestorePoint(label){
  const snapshot=cloneState(state);
  delete snapshot.meta.restorePoints;
  const point={id:uid(),at:new Date().toISOString(),label,schemaVersion:SCHEMA_VERSION,appVersion:APP_VERSION,state:snapshot};
  state.meta.restorePoints.unshift(point);
  state.meta.restorePoints=state.meta.restorePoints.slice(0,5);
  return point;
}

async function restoreFromPoint(id){
  const point=(state.meta?.restorePoints||[]).find(x=>x.id===id);if(!point)throw new Error("Sicherungspunkt nicht gefunden.");
  const current=cloneState(state),currentSnapshot=cloneState(state);delete currentSnapshot.meta.restorePoints;
  const undo={id:uid(),at:new Date().toISOString(),label:"Vor Wiederherstellung",schemaVersion:SCHEMA_VERSION,appVersion:APP_VERSION,state:currentSnapshot};
  const restored=ensureTraceShape(repairDomainState(cloneState(point.state)));
  restored.meta.restorePoints=[undo,...(restored.meta.restorePoints||[])].slice(0,5);
  try{state=restored;LAST_STABLE_STATE=cloneState(state);await saveState(state);return true}
  catch(e){state=current;LAST_STABLE_STATE=cloneState(current);throw e}
}

function commandResult(ok,message="",data=null){return {ok,message,data}}

async function executeCommand(type,payload,handler,{auditText=null,restorePoint=false}={}){
  if(restorePoint)createRestorePoint(`Vor ${type}`);
  const before=cloneState(state);
  try{
    const result=await handler(payload);
    state=ensureTraceShape(repairDomainState(state));
    const check=validateDomainState(state);
    if(check.errors.length)throw new Error(check.errors.join(" · "));
    state.meta.commandLog.unshift({
      id:uid(),at:new Date().toISOString(),type,payloadSummary:safeCommandSummary(payload),
      revisionBefore:Number(before.meta?.revision||0),revisionAfter:Number(before.meta?.revision||0)+1
    });
    state.meta.commandLog=state.meta.commandLog.slice(0,250);
    const saved=await persist(auditText||type,safeCommandSummary(payload));
    if(!saved)throw new Error("Speichern fehlgeschlagen.");
    return commandResult(true,"Gespeichert",result)
  }catch(e){
    state=before;LAST_STABLE_STATE=cloneState(before);
    recordClientError(`command:${type}`,e);
    return commandResult(false,String(e.message||e))
  }
}
function safeCommandSummary(payload){
  if(payload==null)return "";
  if(typeof payload==="string")return payload.slice(0,180);
  const out={};
  for(const k of Object.keys(payload)){
    if(/blob|pages|text|image/i.test(k))continue;
    const v=payload[k];
    out[k]=typeof v==="string"?v.slice(0,120):v;
  }
  try{return JSON.stringify(out)}catch{return "Command"}
}

function documentWorkflowState(doc){
  const a=doc.analysis||{},f=a.fields||{};
  if(a.status==="error")return "review";
  if(a.status!=="done")return "new";
  const proposals=f.positionProposals||[];
  if(proposals.length&&!a.acceptedAt)return "review";
  if(doc.sourceId||a.acceptedAt)return "done";
  return "review";
}
function documentWorkflowLabel(doc){
  const s=documentWorkflowState(doc);
  return s==="new"?"Neu":s==="review"?"Prüfen":"Erledigt";
}
function documentsByWorkflow(docs){
  return {
    new:docs.filter(d=>documentWorkflowState(d)==="new"),
    review:docs.filter(d=>documentWorkflowState(d)==="review"),
    done:docs.filter(d=>documentWorkflowState(d)==="done")
  }
}

function traceForPosition(state,position){
  const source=(state.sources||[]).find(s=>s.id===position.sourceId)||null;
  const docId=position.provenance?.documentId||position.documentId||source?.sourceDocumentId||"";
  return {
    position,
    source,
    documentId:docId,
    origin:provenanceLabel(position),
    evidence:position.provenance?.evidence||"",
    confidence:position.provenance?.confidence,
    confirmedAt:position.provenance?.confirmedAt||null
  }
}

function billingClosureChecklist(state,year){
  const readiness=billingReadiness(state,year),analysis=billingAnalysis(state,year),lease=state.leases?.[0]||null;
  const relevant=analysis.events||[];
  const docs=(state.documentsCache||[]);
  const waterNeeded=relevant.some(e=>e.category==="water");
  const waterOK=!waterNeeded||!!settlementConsumption(state,settlementByPeriod(state,year))?.valid;
  const allConfirmed=(state.costPositions||[]).filter(p=>positionToEvents(p,year).length).every(p=>p.confirmed);
  const allAssigned=analysis.unresolved.length===0;
  const advanceOK=lease?Number(analysis.advances)>=0:false;
  const noErrors=readiness.every(x=>x.ok);
  const points=[
    {id:"period",label:"Abrechnungsperiode und Mietvertrag vorhanden",ok:!!lease},
    {id:"costs",label:"Alle relevanten Kostenpositionen bestätigt",ok:allConfirmed&&relevant.length>0},
    {id:"assignment",label:"Alle Umlageentscheidungen geklärt",ok:allAssigned},
    {id:"water",label:"Verbrauchsdaten vollständig",ok:waterOK},
    {id:"advance",label:"Vorauszahlungen ermittelt",ok:advanceOK},
    {id:"readiness",label:"Datenqualitätsprüfung ohne offene Pflichtpunkte",ok:noErrors}
  ];
  return {points,ok:points.every(x=>x.ok),analysis}
}

function snapshotVerification(snapshot){
  if(!snapshot?.integrityHash)return {status:"unknown",label:"Keine Prüfsumme"};
  return {status:"stored",label:`SHA-256 ${String(snapshot.integrityHash).slice(0,12)}…`}
}


/* ===== intelligence.js ===== */
const INTELLIGENCE_VERSION=1;

function normalizeLabelText(v){
  return String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim()
}
function tokenSimilarity(a,b){
  const A=new Set(normalizeLabelText(a).split(/\s+/).filter(Boolean)),B=new Set(normalizeLabelText(b).split(/\s+/).filter(Boolean));
  if(!A.size||!B.size)return 0;
  let hit=0;for(const x of A)if(B.has(x))hit++;
  return hit/Math.max(A.size,B.size)
}
function daysDistance(a,b){
  if(!a||!b)return 9999;
  return Math.abs((new Date(a+"T00:00:00")-new Date(b+"T00:00:00"))/86400000)
}
function dueDatesForPosition(state,p){
  const s=(state.sources||[]).find(x=>x.id===p.sourceId);
  return Array.isArray(s?.dueDates)?s.dueDates:[]
}
function paymentMatchScore(state,payment,position){
  if(payment.direction!=="outflow")return {score:0,reasons:[]};
  let score=0,reasons=[];
  const amountDiff=Math.abs(Number(payment.amount||0)-Number(position.amount||0));
  const amountBase=Math.max(1,Number(position.amount||0));
  const rel=amountDiff/amountBase;
  if(rel<0.005){score+=55;reasons.push("Betrag stimmt praktisch exakt")}
  else if(rel<0.03){score+=42;reasons.push("Betrag sehr ähnlich")}
  else if(rel<0.10){score+=20;reasons.push("Betrag im plausiblen Bereich")}
  const label=tokenSimilarity(payment.label,position.label);
  score+=Math.round(label*25);if(label>.45)reasons.push("Bezeichnung passt");
  const dues=dueDatesForPosition(state,position);
  if(dues.length){
    const dd=Math.min(...dues.map(d=>daysDistance(payment.date,d)));
    if(dd<=2){score+=18;reasons.push("Zahlungsdatum nahe Fälligkeit")}
    else if(dd<=14){score+=10;reasons.push("Zahlungsdatum im Fälligkeitsfenster")}
  }else if(position.serviceEnd){
    const dd=daysDistance(payment.date,position.serviceEnd);
    if(dd<=45){score+=5;reasons.push("Datum nahe Leistungszeitraum")}
  }
  const src=(state.sources||[]).find(s=>s.id===position.sourceId);
  if(src&&tokenSimilarity(payment.label,src.name)>.35){score+=12;reasons.push("Quelle passt zur Buchungsbezeichnung")}
  return {score:Math.min(100,score),reasons}
}
function paymentMatchSuggestions(state,payment,limit=5){
  return (state.costPositions||[]).filter(p=>p.confirmed).map(p=>({position:p,...paymentMatchScore(state,payment,p)}))
    .filter(x=>x.score>=25).sort((a,b)=>b.score-a.score).slice(0,limit)
}
function autoReconciliationPlan(state){
  const used=new Set((state.payments||[]).filter(p=>p.positionId).map(p=>p.positionId)),suggestions=[];
  for(const pay of (state.payments||[]).filter(p=>p.direction==="outflow"&&!p.positionId)){
    const cands=paymentMatchSuggestions(state,pay).filter(x=>!used.has(x.position.id));
    if(cands[0])suggestions.push({payment:pay,best:cands[0],alternatives:cands.slice(1)});
  }
  return suggestions
}

function positionMonthlyEquivalent(p,monthStart,monthEnd){
  const start=p.serviceStart||monthStart,end=p.serviceEnd||monthEnd;
  const ov=overlapDays(start,end,monthStart,monthEnd);if(!ov)return 0;
  const factor=ov/daysInclusive(start,end),a=Number(p.amount||0);
  if(p.interval==="monthly")return a*(ov/daysInclusive(monthStart,monthEnd));
  if(p.interval==="quarterly")return a*4*factor;
  if(p.interval==="yearly")return a*factor;
  return a*factor
}
function predictedMonth(state,date){
  const ms=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-01`,
        me=new Date(date.getFullYear(),date.getMonth()+1,0).toISOString().slice(0,10),
        key=ms.slice(0,7);
  let rentalIncome=0;
  for(const l of state.leases||[]){
    const active=(!l.start||l.start<=me)&&(!l.end||l.end>=ms);
    if(active)rentalIncome+=Number(l.rent||0)+Number(l.advance||0)
  }
  let propertyCosts=Number(state.finance.repayment||0)+Number(state.finance.fixed||0);
  const costBreakdown=[];
  for(const p of state.costPositions||[]){
    if(!p.confirmed||p.assignment==="rental")continue;
    const amt=positionMonthlyEquivalent(p,ms,me);
    if(amt){propertyCosts+=amt;costBreakdown.push({label:p.label,amount:amt})}
  }
  const historic=(state.payments||[]).filter(p=>p.direction==="outflow"&&paymentMonthKey(p.date)===key).reduce((s,p)=>s+Number(p.amount||0),0);
  return {key,label:date.toLocaleDateString("de-DE",{month:"short",year:"2-digit"}),income:rentalIncome,outflow:propertyCosts,net:rentalIncome-propertyCosts,actualOutflow:historic,costBreakdown}
}
function intelligentForecast(state,months=12){
  const now=new Date(),rows=[];
  for(let i=0;i<months;i++)rows.push(predictedMonth(state,new Date(now.getFullYear(),now.getMonth()+i,1)));
  return rows
}
function forecastSignals(state){
  const rows=intelligentForecast(state,12),out=[];
  const worst=rows.slice().sort((a,b)=>a.net-b.net)[0];
  if(worst&&worst.net<0)out.push({severity:"warn",text:`Schwächster prognostizierter Monat: ${worst.label} mit ${euro(worst.net)}.`});
  const total=rows.reduce((s,r)=>s+r.net,0);out.push({severity:total>=0?"good":"warn",text:`Prognostizierter 12-Monats-Saldo: ${euro(total)}.`});
  const pending=(state.payments||[]).filter(p=>p.direction==="outflow"&&!p.positionId).length;
  if(pending)out.push({severity:"warn",text:`${pending} Ausgabe(n) warten auf automatische oder manuelle Zuordnung.`});
  return out
}

function extractDocumentIntelligence(text,baseFields={}){
  const lines=String(text||"").split(/\r?\n/).map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean),low=String(text||"").toLowerCase();
  const moneyMatches=[...String(text||"").matchAll(/\b(\d{1,6}(?:\.\d{3})*,\d{2})\s*€?/g)].map(m=>parseMoney(m[1])).filter(x=>x>=0);
  const issuerLine=lines.find(l=>/(stadt|gemeinde|versicherung|werke|wasser|entsorgung|rechnung|bescheid)/i.test(l)&&l.length<100)||lines[0]||"";
  const refLine=lines.find(l=>/(aktenzeichen|kassenzeichen|kundennummer|rechnungsnummer|bescheidnummer|zeichen)/i.test(l))||"";
  const ref=(refLine.match(/[A-Z0-9][A-Z0-9\-\/.]{4,}/i)||[])[0]||"";
  const totalLine=lines.slice().reverse().find(l=>/(gesamtsumme|gesamtbetrag|summe neu|zahlbetrag|zu zahlen|endbetrag)/i.test(l))||"";
  const totalVals=[...totalLine.matchAll(/(\d{1,6}(?:\.\d{3})*,\d{2})/g)].map(m=>parseMoney(m[1]));
  const total=totalVals.length?totalVals[totalVals.length-1]:(moneyMatches.length?Math.max(...moneyMatches):0);
  const vatLines=lines.filter(l=>/(ust|umsatzsteuer|mwst)/i.test(l));
  const vatAmounts=vatLines.flatMap(l=>[...l.matchAll(/(\d{1,6}(?:\.\d{3})*,\d{2})/g)].map(m=>parseMoney(m[1])));
  const due=extractDueDates(text);
  const propertyTaxDeferred=/grundsteuer.*(?:erst|ab).*januar.*folgejahr|erwerber.*erst.*januar.*folgejahr/i.test(low);
  return {
    issuer:issuerLine.slice(0,120),reference:ref,total,
    vatAmount:vatAmounts.length?vatAmounts[vatAmounts.length-1]:0,
    dueDates:due,
    documentFamily:/grundbesitzabgaben/i.test(low)?"municipal_assessment":/rechnung/i.test(low)?"invoice":/versicherung/i.test(low)?"insurance":baseFields.kind||"document",
    propertyTaxDeferred,
    anomalies:[]
  }
}
function validateDocumentTotals(fields){
  const proposals=fields.positionProposals||[],sum=proposals.reduce((s,p)=>s+Number(p.amount||0),0),total=Number(fields.intelligence?.total||0),issues=[];
  if(total>0&&sum>0){
    const diff=Math.abs(total-sum);
    if(diff>.02)issues.push({severity:diff/total>.10?"warn":"info",message:`Erkannte Einzelpositionen ${euro(sum)} weichen vom erkannten Gesamtbetrag ${euro(total)} um ${euro(diff)} ab.`})
  }
  if(fields.intelligence?.propertyTaxDeferred)issues.push({severity:"info",message:"Hinweis auf verschobenen Beginn der Grundsteuer erkannt; Grundsteuer für den aktuellen Teilzeitraum nicht automatisch ergänzen."});
  if(!(fields.dueDates||[]).length&&!(fields.intelligence?.dueDates||[]).length)issues.push({severity:"info",message:"Kein eindeutiger Fälligkeitstermin erkannt."});
  return issues
}
function documentConfidenceSummary(fields){
  const ps=fields.positionProposals||[];
  if(!ps.length)return 0;
  return ps.reduce((s,p)=>s+Number(p.confidence||0),0)/ps.length
}

function billingRecipient(lease){
  return {name:lease?.tenantName||"",address:lease?.tenantAddress||""}
}
function splitAddressLines(s){return String(s||"").split(/\n|,\s*(?=\d{5}\s)/).map(x=>x.trim()).filter(Boolean)}
function formatRuleForReport(e){
  if(e.decision?.rule==="area")return `Wohnfläche (${percent(e.tenantShare)})`;
  if(e.decision?.rule==="consumption")return `Verbrauch (${percent(e.tenantShare)})`;
  if(e.decision?.rule==="rental")return "direkt Mietwohnung";
  if(e.decision?.rule==="persons")return `Personen (${percent(e.tenantShare)})`;
  return e.decision?.rule||"individuell"
}
async function generateProfessionalBillingPDF(state,year,snapshot=null){
  const jsPDF=await loadJSPDF(),a=snapshot||billingAnalysis(state,year),lease=snapshot?.lease||state.leases?.[0],recipient=billingRecipient(lease),sender=state.correspondence||{},property=snapshot?.property||state.property;
  const doc=new jsPDF({unit:"mm",format:"a4"}),W=210,M=18;
  let y=18;
  const txt=(t,x,yy,size=10,style="normal")=>{doc.setFont("helvetica",style);doc.setFontSize(size);doc.text(String(t||""),x,yy)};
  const euroPdf=n=>Number(n||0).toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2})+" €";
  txt(sender.landlordName||"Vermieter",M,y,11,"bold");y+=5;
  for(const l of splitAddressLines(sender.landlordAddress||property.address||"")){txt(l,M,y,9);y+=4}
  y=18;txt(new Date().toLocaleDateString("de-DE"),W-M,y,9,"normal");doc.setTextColor(0); y=42;
  if(recipient.name){txt(recipient.name,M,y,10,"bold");y+=5}
  for(const l of splitAddressLines(recipient.address||property.address||"")){txt(l,M,y,10);y+=5}
  y=Math.max(y+8,68);
  txt("Betriebskostenabrechnung",M,y,16,"bold");y+=7;
  txt(`Abrechnungszeitraum: ${periodLabel(year)}`,M,y,10);y+=5;
  txt(`Mietobjekt: ${property.name||property.address||"Mietobjekt"}`,M,y,10);y+=9;
  doc.setDrawColor(190);doc.line(M,y,W-M,y);y+=7;
  txt("Kostenaufstellung",M,y,11,"bold");y+=6;
  txt("Kostenart",M,y,8,"bold");txt("Gesamt",112,y,8,"bold");txt("Umlage",140,y,8,"bold");txt("Ihr Anteil",W-M,y,8,"bold");y+=4;
  doc.line(M,y,W-M,y);y+=5;
  const events=a.events||[];
  for(const e of events){
    if(y>255){doc.addPage();y=18}
    const label=String(e.label||"").slice(0,48);
    txt(label,M,y,8);txt(euroPdf(e.amount),112,y,8);txt(formatRuleForReport(e),140,y,7);doc.text(euroPdf(e.tenantAmount),W-M,y,{align:"right"});y+=5
  }
  y+=2;doc.line(M,y,W-M,y);y+=7;
  txt("Anteilige Betriebskosten",M,y,10,"bold");doc.text(euroPdf(a.tenantCosts),W-M,y,{align:"right"});y+=6;
  txt("Abzüglich Vorauszahlungen",M,y,10);doc.text("− "+euroPdf(a.advances),W-M,y,{align:"right"});y+=6;
  doc.line(112,y,W-M,y);y+=7;
  const result=Number(a.result||0),title=result>=0?"Nachzahlung":"Guthaben";
  txt(title,M,y,12,"bold");doc.text(euroPdf(Math.abs(result)),W-M,y,{align:"right"});y+=10;
  if(result>0&&sender.iban){
    txt(`Bitte überweisen Sie den Betrag auf ${sender.iban}${sender.paymentReference?` unter Angabe „${sender.paymentReference}“`:""}.`,M,y,9);y+=6
  }else if(result<0){
    txt("Das Guthaben ist in der Abrechnung ausgewiesen und kann entsprechend ausgeglichen werden.",M,y,9);y+=6
  }
  txt("Die zugrunde liegenden Kostenpositionen und Verteilungsmaßstäbe sind oben einzeln dargestellt.",M,y,8);y+=5;
  txt("Belege können bei Bedarf anhand der in der App hinterlegten Herkunftsnachweise nachvollzogen werden.",M,y,8);y+=10;
  txt("Mit freundlichen Grüßen",M,y,9);y+=10;txt(sender.landlordName||"Vermieter",M,y,9);
  doc.setFontSize(7);doc.text(`Erstellt am ${new Date().toLocaleDateString("de-DE")}`,M,290);
  if(snapshot?.integrityHash)doc.text(`Snapshot ${String(snapshot.integrityHash).slice(0,20)}…`,W-M,290,{align:"right"});
  return doc
}


/* ===== quality.js ===== */
const QUALITY_VERSION=1;
function parseGermanNumber(v){
  let s=String(v??"").trim().replace(/\s/g,"").replace(/[€EUR]/gi,"");if(!s)return null;
  const neg=/^\(.*\)$/.test(s);s=s.replace(/[()]/g,"");
  if(s.includes(",")&&s.includes(".")){if(s.lastIndexOf(",")>s.lastIndexOf("."))s=s.replace(/\./g,"").replace(",",".");else s=s.replace(/,/g,"")}
  else if(s.includes(","))s=s.replace(",",".");
  s=s.replace(/[^\d.+-]/g,"");const n=Number(s);return Number.isFinite(n)?(neg?-Math.abs(n):n):null
}
function parseFlexibleDate(v){
  const s=String(v||"").trim();if(!s)return "";
  let m=s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);if(m)return `${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}`;
  m=s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);if(m){let y=Number(m[3]);if(y<100)y+=2000;return `${y}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`};return ""
}
function csvDetectDelimiter(text){
  const first=String(text||"").split(/\r?\n/).slice(0,5).join("\n"),candidates=[";",",","\t"];
  return candidates.map(d=>({d,n:(first.match(new RegExp(d==="\t"?"\\t":d===";"?";":",","g"))||[]).length})).sort((a,b)=>b.n-a.n)[0]?.d||";"
}
function csvRows(text,delimiter){
  const rows=[];let row=[],cell="",quoted=false;
  for(let i=0;i<String(text).length;i++){const ch=text[i],nx=text[i+1];
    if(ch==='"'&&quoted&&nx==='"'){cell+='"';i++;continue}
    if(ch==='"'){quoted=!quoted;continue}
    if(ch===delimiter&&!quoted){row.push(cell);cell="";continue}
    if((ch==="\n"||ch==="\r")&&!quoted){if(ch==="\r"&&nx==="\n")i++;row.push(cell);if(row.some(x=>String(x).trim()!==""))rows.push(row);row=[];cell="";continue}
    cell+=ch
  }
  row.push(cell);if(row.some(x=>String(x).trim()!==""))rows.push(row);return rows
}
function bankHeaderIndex(headers,patterns){const hs=headers.map(normalizeLabelText);for(const p of patterns){const i=hs.findIndex(h=>p.test(h));if(i>=0)return i}return -1}
function parseBankCSV(text){
  const delimiter=csvDetectDelimiter(text),rows=csvRows(text,delimiter);if(rows.length<2)throw new Error("Die CSV-Datei enthält keine Buchungen.");
  const h=rows[0],dateIdx=bankHeaderIndex(h,[/buchungstag/,/wertstellung/,/^datum$/, /date/]),amountIdx=bankHeaderIndex(h,[/^betrag/,/umsatz/,/amount/]),debitIdx=bankHeaderIndex(h,[/soll/,/debit/]),creditIdx=bankHeaderIndex(h,[/haben/,/credit/]),textIdx=bankHeaderIndex(h,[/verwendungszweck/,/buchungstext/,/beschreibung/,/umsatztext/,/purpose/,/description/]),nameIdx=bankHeaderIndex(h,[/zahlungspflichtiger/,/zahlungsempfanger/,/auftraggeber/,/empfanger/,/^name$/]);
  if(dateIdx<0||(amountIdx<0&&debitIdx<0&&creditIdx<0))throw new Error("Datum oder Betragsspalte konnte nicht erkannt werden.");
  const out=[];
  for(let i=1;i<rows.length;i++){
    const r=rows[i],date=parseFlexibleDate(r[dateIdx]);if(!date)continue;let amount=amountIdx>=0?parseGermanNumber(r[amountIdx]):null;
    if((amount==null||amount===0)&&debitIdx>=0){const d=parseGermanNumber(r[debitIdx]);if(d!=null&&d!==0)amount=-Math.abs(d)}
    if((amount==null||amount===0)&&creditIdx>=0){const c=parseGermanNumber(r[creditIdx]);if(c!=null&&c!==0)amount=Math.abs(c)}
    if(amount==null||amount===0)continue;
    const label=[nameIdx>=0?r[nameIdx]:"",textIdx>=0?r[textIdx]:""].filter(Boolean).join(" · ").trim()||"Kontobuchung";
    out.push({date,amount:Math.abs(amount),direction:amount<0?"outflow":"income",label,rawRow:i+1})
  }
  return {delimiter,headers:h,rows:out}
}
function paymentFingerprint(p){return `${p.date}|${p.direction}|${Number(p.amount||0).toFixed(2)}|${normalizeLabelText(p.label).slice(0,80)}`}
function detectRentPayment(state,payment){
  if(payment.direction!=="income")return null;let best=null;
  for(const l of state.leases||[]){
    for(const c of [{kind:"Gesamtmiete",value:Number(l.rent||0)+Number(l.advance||0)},{kind:"Kaltmiete",value:Number(l.rent||0)}].filter(x=>x.value>0)){
      const diff=Math.abs(Number(payment.amount)-c.value);let score=diff<.01?80:diff/Math.max(1,c.value)<.03?55:0;
      const tenant=normalizeLabelText(l.tenantName||"");if(tenant&&normalizeLabelText(payment.label).includes(tenant))score+=20;
      if(score>Number(best?.score||0))best={leaseId:l.id,kind:c.kind,expected:c.value,score:Math.min(100,score)}
    }
  }
  return best&&best.score>=55?best:null
}
function bankImportPreview(state,parsed){
  const existing=new Set((state.payments||[]).map(paymentFingerprint));
  return parsed.rows.map(r=>({...r,duplicate:existing.has(paymentFingerprint(r)),rentMatch:detectRentPayment(state,r)}))
}
function categoryLabel(k){return category(k)?.label||String(k||"Sonstige")}
function periodCategoryTotals(state,year){
  const a=billingAnalysis(state,year),map=new Map();
  for(const e of a.events||[]){const cat=e.category||positionById(state,e.positionId)?.category||"other",prev=map.get(cat)||{category:cat,total:0,tenant:0,count:0};prev.total+=Number(e.amount||0);prev.tenant+=Number(e.tenantAmount||0);prev.count++;map.set(cat,prev)}
  return [...map.values()]
}
function annualComparison(state,year){
  const current=periodCategoryTotals(state,year),prior=periodCategoryTotals(state,year-1),keys=new Set([...current.map(x=>x.category),...prior.map(x=>x.category)]);
  return [...keys].map(k=>{const c=current.find(x=>x.category===k)||{total:0,tenant:0},p=prior.find(x=>x.category===k)||{total:0,tenant:0};return{category:k,current:c.total,prior:p.total,tenantCurrent:c.tenant,change:c.total-p.total,pct:p.total?((c.total-p.total)/p.total):null}}).sort((a,b)=>Math.abs(b.change)-Math.abs(a.change))
}
function costTrendAlerts(state,year){
  return annualComparison(state,year).filter(x=>x.prior>0&&x.current>0&&x.pct!=null&&Math.abs(x.pct)>=.15).map(x=>({severity:x.pct>.25?"warn":"info",text:`${categoryLabel(x.category)}: ${x.pct>=0?"+":""}${Math.round(x.pct*100)} % gegenüber ${periodLabel(year-1)} (${euro(x.prior)} → ${euro(x.current)}).`}))
}
function meterTrend(meter){
  const r=(meter?.readings||[]).filter(x=>x.date&&Number.isFinite(Number(x.value))).slice().sort((a,b)=>a.date.localeCompare(b.date)),segments=[];
  for(let i=1;i<r.length;i++){const days=daysInclusive(r[i-1].date,r[i].date)-1,delta=Number(r[i].value)-Number(r[i-1].value);if(days>0&&delta>=0)segments.push({from:r[i-1],to:r[i],days,delta,perDay:delta/days,per30:delta/days*30})}
  const avg=segments.length?segments.reduce((s,x)=>s+x.perDay,0)/segments.length:0;return{segments,avgPerDay:avg,avgPer30:avg*30}
}
function meterAnomalies(meter){
  const t=meterTrend(meter);if(t.segments.length<2)return[];const baseline=t.segments.slice(0,-1).reduce((s,x)=>s+x.perDay,0)/Math.max(1,t.segments.length-1),last=t.segments.at(-1),out=[];
  if(baseline>0&&last.perDay>baseline*1.75&&last.delta>1)out.push({severity:"warn",text:`${meter.name}: letzter Verbrauch liegt ${Math.round((last.perDay/baseline-1)*100)} % über dem bisherigen Tagesmittel.`});return out
}
function allQualitySignals(state){
  const y=currentPeriodYear(),signals=[...forecastSignals(state),...costTrendAlerts(state,y)];for(const m of state.meters||[])signals.push(...meterAnomalies(m));
  const imp=(state.meta?.importHistory||[])[0];if(imp)signals.push({severity:"info",text:`Letzter Kontoimport: ${new Date(imp.at).toLocaleDateString("de-DE")} · ${imp.imported} Buchungen übernommen.`});return signals
}
function dataQualityScore(state){
  const integrity=integritySummary(state),checks=billingReadiness(state,currentPeriodYear()),openDocs=(state.documentsCache||[]).filter(d=>documentWorkflowState(d)!=="done").length;
  const matchable=(state.payments||[]).filter(p=>p.direction==="outflow"&&!p.positionId&&paymentMatchSuggestions(state,p,1)[0]?.score>=45).length;
  let score=100;score-=integrity.errors.length*20;score-=integrity.warnings.length*4;score-=checks.filter(x=>!x.ok).length*7;score-=Math.min(15,openDocs*3);score-=Math.min(10,matchable*2);
  return Math.max(0,Math.round(score))
}


/* ===== smart-engine.js ===== */
const SMART_ENGINE_VERSION=1;

function smartToday(){return new Date().toISOString().slice(0,10)}
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
function billingProjection(state,year=currentPeriodYear()){
  const current=billingAnalysis(state,year),cur=periodCategoryTotals(state,year),prior=periodCategoryTotals(state,year-1);
  const currentCats=new Set(cur.filter(x=>x.total>0).map(x=>x.category));
  const missing=prior.filter(x=>x.total>0&&!currentCats.has(x.category));
  const estimatedMissingTenant=missing.reduce((s,x)=>s+Number(x.tenant||0),0);
  const projectedTenantCosts=Number(current.tenantCosts||0)+estimatedMissingTenant;
  const projectedResult=projectedTenantCosts-Number(current.advances||0);
  const priorCats=prior.filter(x=>x.total>0).length,matched=prior.filter(x=>currentCats.has(x.category)).length;
  const confidence=priorCats?Math.round(55+40*(matched/priorCats)):Math.min(55,25+(current.events||[]).length*5);
  return {year,knownTenantCosts:Number(current.tenantCosts||0),estimatedMissingTenant,projectedTenantCosts,advances:Number(current.advances||0),projectedResult,missingCategories:missing,confidence:Math.max(20,Math.min(95,confidence))}
}
function advanceAdjustmentSuggestion(state){
  const snap=latestBillingSnapshot(state),lease=state.leases?.[0];if(!snap||!lease||Number(lease.advance||0)<=0)return null;
  const basisLease=snap.lease||lease,months=monthlyAdvanceInPeriod({...basisLease,advance:1},Number(snap.periodYear));
  if(months<=0)return null;
  const recommended=Number(snap.tenantCosts||0)/months,current=Number(lease.advance||0),diff=recommended-current;
  return {periodYear:snap.periodYear,current,recommended,diff,relative:current?diff/current:0,material:Math.abs(diff)>=5&&Math.abs(diff/current)>=.05,basis:"Rechnerischer Richtwert aus der letzten abgeschlossenen Abrechnung; eine Anpassung nach einer Abrechnung ist nach § 560 Abs. 4 BGB grundsätzlich möglich, die angemessene Höhe ist im Einzelfall zu prüfen."}
}
function billingDeadlineInsights(state){
  const out=[],today=smartToday(),cy=currentPeriodYear();
  for(let y=cy-4;y<cy;y++){
    const lease=state.leases?.[0];if(!lease||!activeLeaseInMonth(lease,`${y+1}-03`))continue;
    if(periodEnd(y)>=today||snapshotFor(state,y))continue;
    const deadline=periodDeadline(y),days=Math.ceil((new Date(deadline+"T00:00:00")-new Date(today+"T00:00:00"))/86400000);
    if(days<0)out.push({id:`deadline-${y}`,severity:"bad",title:`Abrechnung ${periodLabel(y)} ohne gespeicherten Abschluss`,detail:`Die reguläre 12-Monats-Frist endete am ${new Date(deadline+"T00:00:00").toLocaleDateString("de-DE")}.`,why:"§ 556 Abs. 3 BGB",confidence:100,route:"rental",sub:"calculation"});
    else if(days<=120)out.push({id:`deadline-${y}`,severity:days<=30?"bad":"warn",title:`Abrechnung ${periodLabel(y)} abschließen`,detail:`Noch ${days} Tage bis zum regulären Fristende ${new Date(deadline+"T00:00:00").toLocaleDateString("de-DE")}.`,why:"§ 556 Abs. 3 BGB",confidence:100,route:"rental",sub:"calculation"})
  }
  return out
}
function sourceExpectedAmounts(state,source){
  const vals=[];
  if(Number(source?.amount||0)>0)vals.push(Number(source.amount));
  const ps=sourcePositions(state,source?.id).filter(p=>p.confirmed),sum=ps.reduce((s,p)=>s+Number(p.amount||0),0);
  if(sum>0)vals.push(sum);
  return [...new Set(vals.map(x=>Number(x.toFixed(2))))]
}
function sourcePaymentMatchScore(state,payment,source){
  if(payment.direction!=="outflow")return {score:0,reasons:[]};
  let score=0,reasons=[],expected=sourceExpectedAmounts(state,source);
  if(expected.length){
    const best=Math.min(...expected.map(a=>Math.abs(Number(payment.amount||0)-a)/Math.max(1,a)));
    if(best<.005){score+=58;reasons.push("Betrag passt zur Kostenquelle")}
    else if(best<.03){score+=42;reasons.push("Betrag ist sehr ähnlich")}
    else if(best<.10){score+=18;reasons.push("Betrag ist plausibel")}
  }
  const sim=tokenSimilarity(payment.label,source.name||"");score+=Math.round(sim*25);if(sim>.4)reasons.push("Buchungstext passt zur Quelle");
  const dues=Array.isArray(source.dueDates)?source.dueDates:[];
  if(dues.length){const dd=Math.min(...dues.map(d=>daysDistance(payment.date,d)));if(dd<=2){score+=17;reasons.push("Datum passt zur Fälligkeit")}else if(dd<=14){score+=9;reasons.push("Datum liegt im Fälligkeitsfenster")}}
  return {score:Math.min(100,score),reasons}
}
function smartPaymentSuggestions(state,payment,limit=5){
  const pos=paymentMatchSuggestions(state,payment,limit).map(x=>({type:"position",target:x.position,score:x.score,reasons:x.reasons}));
  const src=(state.sources||[]).map(s=>({type:"source",target:s,...sourcePaymentMatchScore(state,payment,s)})).filter(x=>x.score>=35);
  return [...pos,...src].sort((a,b)=>b.score-a.score).slice(0,limit)
}
function smartPaymentPlan(state){
  return (state.payments||[]).filter(p=>p.direction==="outflow"&&!p.positionId&&!p.sourceId).map(payment=>({payment,suggestions:smartPaymentSuggestions(state,payment,4)})).filter(x=>x.suggestions[0]?.score>=45).sort((a,b)=>b.suggestions[0].score-a.suggestions[0].score)
}

function medianValue(values){const a=values.filter(Number.isFinite).slice().sort((x,y)=>x-y);if(!a.length)return 0;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
function robustMeterAnomalies(meter){
  const t=meterTrend(meter),segs=t.segments;if(segs.length<3)return meterAnomalies(meter);
  const hist=segs.slice(0,-1).map(x=>x.perDay),med=medianValue(hist),dev=medianValue(hist.map(x=>Math.abs(x-med))),last=segs.at(-1),out=[];
  const threshold=med+Math.max(med*.65,dev*4);
  if(med>0&&last.perDay>threshold&&last.delta>1)out.push({severity:"warn",text:`${meter.name}: der jüngste Verbrauch liegt deutlich über dem robusten bisherigen Niveau (${last.per30.toFixed(2)} statt etwa ${(med*30).toFixed(2)} ${meter.unit||""} je 30 Tage).`,confidence:Math.min(99,Math.round(70+(last.perDay/Math.max(threshold,.0001)-1)*20))});
  return out
}
function smartDataAnomalies(state){
  const out=[],positions=state.costPositions||[],groups=new Map();
  for(const p of positions){
    const k=`${normalizeLabelText(p.label)}|${Number(p.amount||0).toFixed(2)}|${p.serviceStart}|${p.serviceEnd}|${p.assignment}`;
    const a=groups.get(k)||[];a.push(p);groups.set(k,a)
  }
  for(const a of groups.values())if(a.length>1)out.push({id:`dup-pos-${a[0].id}`,severity:"warn",title:"Mögliche doppelte Kostenposition",detail:`${a[0].label} · ${euro(a[0].amount)} ist ${a.length}-mal mit gleichem Zeitraum und gleicher Zuordnung vorhanden.`,why:"Duplikatprüfung",confidence:96,route:"data",sub:"positions"});
  const payGroups=new Map();
  for(const p of state.payments||[]){const k=paymentFingerprint(p),a=payGroups.get(k)||[];a.push(p);payGroups.set(k,a)}
  for(const a of payGroups.values())if(a.length>1)out.push({id:`dup-pay-${a[0].id}`,severity:"warn",title:"Mögliche doppelte Zahlung",detail:`${a[0].date} · ${euro(a[0].amount)} · ${a[0].label}`,why:"Import-/Buchungsprüfung",confidence:94,route:"owner",sub:"cashflow"});
  for(const m of state.meters||[]){
    const r=(m.readings||[]).slice().sort((a,b)=>(a.date||"").localeCompare(b.date||""));
    for(let i=1;i<r.length;i++)if(Number(r[i].value)<Number(r[i-1].value)&&!r[i].synthetic)out.push({id:`meter-drop-${m.id}-${r[i].id}`,severity:"warn",title:`Zählerstand bei ${m.name} gesunken`,detail:`${r[i-1].value} → ${r[i].value} am ${r[i].date}. Zählerwechsel oder Eingabefehler prüfen.`,why:"Plausibilitätsprüfung",confidence:98,route:"data",sub:"infrastructure"});
    for(const a of robustMeterAnomalies(m))out.push({id:`meter-spike-${m.id}`,severity:"warn",title:"Ungewöhnlicher Verbrauch",detail:a.text,why:"Robuste Verbrauchsanalyse",confidence:a.confidence||80,route:"owner",sub:"analytics"})
  }
  return out
}

function historicalAssignmentPrediction(state,label,categoryId){
  const nl=normalizeLabelText(label),candidates=(state.costPositions||[]).filter(p=>p.confirmed&&p.assignment!=="review"&&(p.category===categoryId||tokenSimilarity(p.label,label)>.65));
  if(!candidates.length)return null;
  const counts={};for(const p of candidates)counts[p.assignment]=(counts[p.assignment]||0)+1;
  const [assignment,count]=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
  return {assignment,confidence:Math.round(100*count/candidates.length),samples:candidates.length}
}
function smartClassifyCostText(text){
  const s=normalizeLabelText(text);
  const defs=[
    {category:"repair",rx:/reparatur|instandsetzung|instandhaltung|sanierung|ersatzteil|defekt|erneuerung/,confidence:.96,reason:"Hinweis auf Instandhaltung/Reparatur"},
    {category:"admin",rx:/verwaltung|verwalter|buchfuhrung|kontofuhrung|geschaftsfuhrung/,confidence:.94,reason:"Hinweis auf Verwaltungskosten"},
    {category:"propertyTax",rx:/grundsteuer|grundbesitzabgabe.*steuer/,confidence:.98,reason:"Grundsteuer erkannt"},
    {category:"rainwater",rx:/niederschlagswasser|regenwasser/,confidence:.97,reason:"Niederschlagswasser erkannt"},
    {category:"water",rx:/schmutzwasser|frischwasser|wasserverbrauch|wasserversorgung|kanal|abwasser|grundgebuhr wasser/,confidence:.94,reason:"Wasser/Kanal erkannt"},
    {category:"waste",rx:/restmull|restmuell|bioabfall|biomull|biomuell|papier.*tonne|abfall|mullabfuhr|muellabfuhr/,confidence:.94,reason:"Abfallkosten erkannt"},
    {category:"street",rx:/strassenreinigung|straßenreinigung|winterdienst|schneeraum|schneeräum/,confidence:.94,reason:"Straßenreinigung/Winterdienst erkannt"},
    {category:"insurance",rx:/gebaudeversicherung|gebäudeversicherung|sachversicherung|haftpflicht.*gebaude|haftpflicht.*gebäude/,confidence:.91,reason:"Gebäudeversicherung erkannt"},
    {category:"chimney",rx:/schornsteinfeger|kehrgebuhr|kehrgebühr|feuerstattenschau|feuerstättenschau/,confidence:.94,reason:"Schornsteinfeger erkannt"},
    {category:"garden",rx:/gartenpflege|grunpflege|grünpflege|rasenpflege|heckenschnitt/,confidence:.88,reason:"Gartenpflege erkannt"},
    {category:"cleaning",rx:/gebaudereinigung|gebäudereinigung|treppenhausreinigung|ungeziefer|schadlingsbekampfung|schädlingsbekämpfung/,confidence:.88,reason:"Gebäudereinigung erkannt"}
  ];
  for(const d of defs)if(d.rx.test(s))return d;
  return {category:"other",confidence:.28,reason:"Keine eindeutige Kostenart erkannt"}
}
function cleanProposalLabel(line,categoryId){
  let x=String(line||"").replace(/\b\d{1,6}(?:\.\d{3})*,\d{2}\s*€?/g,"").replace(/\s{2,}/g," ").replace(/[·;:,\-–]+$/,"").trim();
  if(x.length<4||x.length>80)x=category(categoryId).label;return x
}
function smartGenericPositionProposals(state,text,fields){
  const lines=String(text||"").split(/\r?\n/).map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean),out=[];
  const start=fields.serviceStart||`${fields.year||new Date().getFullYear()}-01-01`,end=fields.serviceEnd||`${fields.year||new Date().getFullYear()}-12-31`;
  for(const line of lines){
    if(/gesamtsumme|gesamtbetrag|summe neu|zahlbetrag|zu zahlen|endbetrag|umsatzsteuer|mwst|ust\b/i.test(line))continue;
    const cls=smartClassifyCostText(line);if(cls.confidence<.78)continue;
    const ms=[...line.matchAll(/(\d{1,6}(?:\.\d{3})*,\d{2})\s*€?/g)];if(!ms.length)continue;
    const amount=parseMoney(ms.at(-1)[1]);if(!(amount>0))continue;
    const label=cleanProposalLabel(line,cls.category),hist=historicalAssignmentPrediction(state,label,cls.category);
    let assignment=hist?.confidence>=70?hist.assignment:(["repair","admin"].includes(cls.category)?"owner":cls.category==="waste"?"review":"house");
    out.push({id:uid(),label,category:cls.category,amount,serviceStart:start,serviceEnd:end,assignment,agreement:"auto",confidence:Math.min(.96,cls.confidence*(hist?.confidence>=70?1:.96)),evidence:line,confirmed:false,smartReason:hist?.confidence>=70?`${cls.reason}; Zuordnung aus ${hist.samples} früheren Position(en) gelernt`:cls.reason})
  }
  return out
}
function enrichDocumentProposalsSmart(state,text,fields,base){
  const out=(base||[]).slice(),generic=smartGenericPositionProposals(state,text,fields);
  for(const p of generic){
    const duplicate=out.some(x=>tokenSimilarity(x.label,p.label)>.78&&Math.abs(Number(x.amount)-Number(p.amount))<.02);
    if(!duplicate)out.push(p)
  }
  return out.slice(0,30)
}
function smartDocumentSummary(state,text,fields){
  const cls=smartClassifyCostText(text),issuer=fields.intelligence?.issuer||"",sourceMatches=(state.sources||[]).map(s=>({source:s,score:tokenSimilarity(issuer,s.name||"")})).filter(x=>x.score>.32).sort((a,b)=>b.score-a.score);
  const warnings=[];
  if(["repair","admin"].includes(cls.category))warnings.push(`Die Dokumentanalyse erkennt wahrscheinlich ${category(cls.category).label}. Diese Kostenart wird nicht automatisch auf die Mieterin umgelegt.`);
  if((fields.positionProposals||[]).some(p=>p.assignment==="review"))warnings.push("Mindestens eine Kostenposition benötigt eine ausdrückliche Zuordnungsentscheidung.");
  return {category:cls.category,categoryConfidence:Math.round(cls.confidence*100),reason:cls.reason,sourceId:sourceMatches[0]?.source.id||"",sourceName:sourceMatches[0]?.source.name||"",sourceConfidence:sourceMatches[0]?Math.round(sourceMatches[0].score*100):0,warnings}
}

function smartTaskSuggestions(state){
  const out=[],today=smartToday(),existing=new Set(taskList().map(t=>`${normalizeLabelText(t.title)}|${t.due}`));
  for(const s of state.sources||[])for(const d of s.dueDates||[]){
    if(d<today)continue;const title=`${s.name} – Fälligkeit`;const k=`${normalizeLabelText(title)}|${d}`;if(!existing.has(k))out.push({title,due:d,lead:14,reason:"Fälligkeit aus Kostenquelle"})
  }
  for(const m of state.meters||[]){
    const last=latestMeterReading(m),age=last?Math.floor((Date.now()-new Date(last.date+"T00:00:00"))/86400000):999;
    if(age>90){const due=new Date();due.setDate(due.getDate()+7);const title=`${m.name} ablesen`;const ds=due.toISOString().slice(0,10),k=`${normalizeLabelText(title)}|${ds}`;if(!existing.has(k))out.push({title,due:ds,lead:2,reason:last?`Letzte Ablesung vor ${age} Tagen`:"Noch keine Ablesung"})}
  }
  const backupAge=state.meta?.lastBackupAt?Math.floor((Date.now()-new Date(state.meta.lastBackupAt))/86400000):999;
  if(backupAge>30){const due=new Date();due.setDate(due.getDate()+3);out.push({title:"Verschlüsselte Datensicherung erstellen",due:due.toISOString().slice(0,10),lead:1,reason:"Datensicherung ist nicht aktuell"})}
  return out.slice(0,12)
}
function smartInsights(state){
  const out=[],today=smartToday(),rent=rentMonthStatus(state),proj=billingProjection(state),paymentPlan=smartPaymentPlan(state);
  for(const c of billingReadiness(state,currentPeriodYear()).filter(x=>!x.ok))out.push({id:`ready-${c.id}`,severity:"warn",title:c.label,detail:"Die Abrechnung ist an dieser Stelle noch nicht vollständig.",why:"Abschlussprüfung",confidence:100,route:c.route,sub:c.sub});
  if(rent.status==="missing"&&Number(rent.expected)>0&&Number(today.slice(8,10))>=10)out.push({id:`rent-${rent.key}`,severity:"bad",title:`Mietzahlung ${rent.key} noch nicht erkannt`,detail:`Erwartet ${euro(rent.expected)}. In den erfassten Kontobewegungen wurde noch keine passende Zahlung gefunden.`,why:"Abgleich Mietvertrag ↔ Zahlungseingänge; keine automatische Mahnaussage",confidence:78,route:"owner",sub:"cashflow"});
  else if(rent.status==="partial")out.push({id:`rent-${rent.key}`,severity:"warn",title:`Mietzahlung ${rent.key} nur teilweise erkannt`,detail:`Erkannt ${euro(rent.paid)} von ${euro(rent.expected)}.`,why:"Zahlungseingangsabgleich",confidence:rent.confidence||65,route:"owner",sub:"cashflow"});
  if(paymentPlan.length)out.push({id:"payment-match",severity:"warn",title:`${paymentPlan.length} Zahlung(en) mit plausiblem Zuordnungsvorschlag`,detail:`Bester aktueller Treffer: ${paymentPlan[0].suggestions[0].score} %.`,why:"Betrag, Text, Quelle und Fälligkeit",confidence:paymentPlan[0].suggestions[0].score,route:"owner",sub:"reconciliation"});
  const docs=(state.documentsCache||[]),reviewDocs=docs.filter(d=>documentWorkflowState(d)==="review").length,newDocs=docs.filter(d=>documentWorkflowState(d)==="new").length;
  if(reviewDocs||newDocs)out.push({id:"docs-review",severity:"warn",title:`${reviewDocs+newDocs} Dokument(e) warten auf Prüfung`,detail:`${newDocs} neu · ${reviewDocs} mit Prüfschritt.`,why:"Dokumenten-Inbox",confidence:100,route:"data",sub:"documents"});
  for(const d of billingDeadlineInsights(state))out.push(d);
  for(const a of smartDataAnomalies(state))out.push(a);
  const adv=advanceAdjustmentSuggestion(state);if(adv?.material)out.push({id:"advance",severity:"info",title:"Betriebskostenvorauszahlung prüfen",detail:`Aktuell ${euro(adv.current)} / Monat · rechnerischer Richtwert aus letzter Abrechnung ${euro(adv.recommended)} / Monat.`,why:"§ 560 Abs. 4 BGB; nur rechnerischer Vorschlag",confidence:80,route:"rental",sub:"calculation"});
  if(proj.missingCategories.length&&proj.confidence>=55)out.push({id:"projection",severity:"info",title:"Abrechnungsprognose nutzt Vorjahreswerte",detail:`Für ${proj.missingCategories.map(x=>categoryLabel(x.category)).join(", ")} fehlen noch aktuelle Werte. Prognose: ${euro(Math.abs(proj.projectedResult))} ${proj.projectedResult>=0?"Nachzahlung":"Guthaben"}.`,why:"Bekannte Kosten + fehlende Vorjahreskategorien",confidence:proj.confidence,route:"rental",sub:"calculation"});
  const age=state.meta?.lastBackupAt?Math.floor((Date.now()-new Date(state.meta.lastBackupAt))/86400000):9999;if(age>30)out.push({id:"backup",severity:"warn",title:state.meta?.lastBackupAt?"Datensicherung älter als 30 Tage":"Noch keine verschlüsselte Datensicherung",detail:"Eine aktuelle Vollsicherung schützt Daten und Dokumente bei Geräteverlust.",why:"Datensicherheit",confidence:100,route:"more",sub:"backup"});
  const rank={bad:0,warn:1,info:2,good:3};return out.sort((a,b)=>(rank[a.severity]??9)-(rank[b.severity]??9)||Number(b.confidence||0)-Number(a.confidence||0))
}
function smartSummaryText(state){
  const ins=smartInsights(state),rent=rentMonthStatus(state),p=billingProjection(state),q=dataQualityScore(state);
  return `Datenqualität ${q} %. ${ins.length?`${ins.filter(x=>x.severity==="bad").length} dringende und ${ins.filter(x=>x.severity==="warn").length} wichtige Hinweise.`:"Keine offenen Smart-Hinweise."} Mietzahlung aktuell: ${rentStatusLabel(rent)}. Abrechnungsprognose: ${euro(Math.abs(p.projectedResult))} ${p.projectedResult>=0?"Nachzahlung":"Guthaben"} bei ${p.confidence} % Modellkonfidenz.`
}
function smartAnswer(state,query){
  const q=normalizeLabelText(query),y=currentPeriodYear(),rent=rentMonthStatus(state),proj=billingProjection(state),ins=smartInsights(state);
  if(/miete|mietzahlung|zahlungseingang/.test(q))return {title:"Mietzahlung",answer:rent.status==="none"?"Für den aktuellen Monat ist kein aktiver Mietvertrag hinterlegt.":`Für ${rent.key} sind ${euro(rent.paid)} von ${euro(rent.expected)} als passende Mietzahlung erkannt. Status: ${rentStatusLabel(rent)}. Erkennungs-Sicherheit ${rent.confidence||0} %.`,route:"owner",sub:"cashflow"};
  if(/abrechnung|nachzahlung|guthaben|nebenkosten/.test(q))return {title:"Abrechnung",answer:`Aktuell bestätigte Mieter-Kosten: ${euro(proj.knownTenantCosts)}. Vorauszahlungen im Zeitraum: ${euro(proj.advances)}. Prognose: ${euro(Math.abs(proj.projectedResult))} ${proj.projectedResult>=0?"Nachzahlung":"Guthaben"} (${proj.confidence} % Modellkonfidenz).${proj.missingCategories.length?` Noch geschätzt aus dem Vorjahr: ${proj.missingCategories.map(x=>categoryLabel(x.category)).join(", ")}.`:""}`,route:"rental",sub:"calculation"};
  if(/wasser|zahler|zaehler|verbrauch/.test(q)){const {main,owner}=ensureDefaultMeters(state),tm=meterTrend(main),to=meterTrend(owner),sett=settlementConsumption(state,settlementByPeriod(state,y));return {title:"Wasser",answer:sett?.valid?`Abrechnungsperiode: Haus ${sett.house.toFixed(3)} m³, Eigennutzung ${sett.owner.toFixed(3)} m³, Mietwohnung ${sett.tenant.toFixed(3)} m³. Jüngerer Trend: Hauptzähler Ø ${tm.avgPer30.toFixed(2)} m³ / 30 Tage, Zwischenzähler Ø ${to.avgPer30.toFixed(2)} m³ / 30 Tage.`:"Für die aktuelle Abrechnungsperiode fehlen noch vollständige Verbrauchsdaten.",route:"rental",sub:"water"}}
  if(/kosten|steiger|teuer|entwicklung/.test(q)){const al=costTrendAlerts(state,y);return {title:"Kostenentwicklung",answer:al.length?al.map(x=>x.text).join(" "):"Es gibt derzeit keine belastbare Kostenveränderung ab 15 % gegenüber der Vorperiode.",route:"owner",sub:"analytics"}}
  if(/zahlung|zuord|bezahlt|rechnung/.test(q)){const p=smartPaymentPlan(state);return {title:"Zahlungszuordnung",answer:p.length?`${p.length} offene Ausgabe(n) haben plausible Treffer. Der beste Treffer liegt bei ${p[0].suggestions[0].score} % und bezieht sich auf „${p[0].suggestions[0].target.label||p[0].suggestions[0].target.name}“.`:"Aktuell gibt es keine unzugeordnete Ausgabe mit einem ausreichend starken Treffer.",route:"owner",sub:"reconciliation"}}
  if(/dokument|beleg|bescheid|post/.test(q)){const d=state.documentsCache||[],n=d.filter(x=>documentWorkflowState(x)==="new").length,r=d.filter(x=>documentWorkflowState(x)==="review").length;return {title:"Dokumente",answer:`Dokumenten-Inbox: ${n} neu, ${r} zu prüfen, ${d.filter(x=>documentWorkflowState(x)==="done").length} erledigt.`,route:"data",sub:"documents"}}
  if(/backup|sicherung/.test(q)){const age=state.meta?.lastBackupAt?Math.floor((Date.now()-new Date(state.meta.lastBackupAt))/86400000):null;return {title:"Datensicherung",answer:age==null?"Es ist noch keine verschlüsselte Vollsicherung dokumentiert.":`Die letzte verschlüsselte Vollsicherung ist ${age} Tag(e) alt.`,route:"more",sub:"backup"}}
  if(/frist|recht|rechtsstand/.test(q)){const dl=billingDeadlineInsights(state);return {title:"Fristen & Rechtsstand",answer:`Hinterlegter Rechtsstand: ${ACTIVE_LEGAL_PACK?.effectiveDate||LAW_DATE}. ${dl.length?dl.map(x=>x.detail).join(" "):"Aktuell erkennt die App keine unmittelbar bevorstehende offene Abrechnungsfrist."}`,route:"more",sub:"legal"}}
  if(/vorauszahlung|abschlag/.test(q)){const a=advanceAdjustmentSuggestion(state);return {title:"Betriebskostenvorauszahlung",answer:a?`${a.basis} Aktuell ${euro(a.current)}, rechnerischer Richtwert ${euro(a.recommended)} pro Monat.`:"Für einen belastbaren rechnerischen Vorschlag wird zunächst eine abgeschlossene Abrechnung benötigt.",route:"rental",sub:"calculation"}}
  return {title:"Gesamtstatus",answer:smartSummaryText(state),route:ins[0]?.route||"home",sub:ins[0]?.sub||""}
}

/* ===== legal-rules.js ===== */
const LAW_DATE="2026-09-05";

const LEGAL_SOURCES=[
  {name:"§ 556 BGB",url:"https://www.gesetze-im-internet.de/bgb/__556.html",purpose:"Betriebskosten, Abrechnung, Frist, Belegeinsicht"},
  {name:"§ 556a BGB",url:"https://www.gesetze-im-internet.de/bgb/__556a.html",purpose:"Abrechnungsmaßstab"},
  {name:"§ 556b BGB",url:"https://www.gesetze-im-internet.de/bgb/__556b.html",purpose:"Regelfälligkeit der Miete"},
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
function billingAnalysis(state,periodYear){return centralBillingAnalysis(state,periodYear)}

function billingReadiness(state,periodYear){
  const analysis=billingAnalysis(state,periodYear);
  const relevant=(state.costPositions||[]).some(p=>p.confirmed&&positionToEvents(p,periodYear).length>0);
  const waterPositions=(state.costPositions||[]).some(p=>p.confirmed&&p.category==="water"&&positionToEvents(p,periodYear).length>0);
  const settlement=settlementByPeriod(state,periodYear),cons=settlementConsumption(state,settlement);
  return [
    {id:"objectName",ok:!!state.property.name,label:"Objektname fehlt",route:"data",sub:"property"},
    {id:"totalArea",ok:Number(state.property.totalArea)>0,label:"Gesamtwohnfläche fehlt",route:"data",sub:"property"},
    {id:"ownerUnit",ok:!!unitByType(state,"owner"),label:"Eigennutzungs-Einheit fehlt",route:"data",sub:"units"},
    {id:"rentalUnit",ok:!!unitByType(state,"rental"),label:"Mietwohnung fehlt",route:"data",sub:"units"},
    {id:"lease",ok:!!state.leases.length,label:"Mietvertrag fehlt",route:"data",sub:"lease"},
    {id:"positions",ok:relevant,label:"Keine bestätigte Kostenposition für diese Abrechnungsperiode",route:"data",sub:"positions"},
    {id:"water",ok:!waterPositions||!!cons?.valid,label:"Wasserzähler / Verbrauchsdaten fehlen",route:"rental",sub:"water"},
    {id:"allocation",ok:analysis.unresolved.length===0,label:"Ungeklärte Umlageentscheidungen",route:"data",sub:"positions"}
  ]
}
function health(state){
  let score=100,issues=[];const p=(n,m)=>{score-=n;issues.push(m)},checks=billingReadiness(state,currentPeriodYear());
  const penalties={objectName:12,totalArea:14,ownerUnit:9,rentalUnit:9,lease:14,positions:12,water:8,allocation:12};
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
    legalEffectiveDate:ACTIVE_LEGAL_PACK?.effectiveDate||LAW_DATE,domainVersion:DOMAIN_VERSION,schemaVersion:SCHEMA_VERSION,
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
  if(rec?.data)return migrateDomainState(normalizeState(rec.data));
  const migrated=migrateDomainState(migrateLegacyStorage());await saveState(migrated);return migrated
}
async function saveState(state){
  const db=await openDB(),tx=db.transaction("state","readwrite");tx.objectStore("state").put({id:STATE_ID,data:state});
  return new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})
}
async function addDocument(doc){
  const db=await openDB(),tx=db.transaction("docs","readwrite");tx.objectStore("docs").put(doc);
  return new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})
}
async function getDocument(id){
  const db=await openDB(),tx=db.transaction("docs","readonly"),r=tx.objectStore("docs").get(id);
  return new Promise((res,rej)=>{r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})
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
function migrateLegacyStorage(){
  const state=repairDomainState(createEmptyState());LAST_STABLE_STATE=cloneState(state);
  const keys=["mietverwaltung_v2_4","mietverwaltung_v2_3","mietverwaltung_v2_2","mietverwaltung_v2_1","mietverwaltung_v2"];
  let old=null,from=null;
  for(const k of keys){try{const raw=localStorage.getItem(k);if(raw){old=JSON.parse(raw);from=k;break}}catch{}}
  if(!old)return state;
  state.meta.migratedFrom=from;
  state.property={...state.property,...(old.property||{})};
  state.finance={...state.finance,...(old.finance||{})};
  state.units=(old.units||[]).map(u=>({id:u.id||crypto.randomUUID(),name:u.name,type:u.type,area:Number(u.area||0),note:u.note||"",occupancy:(u.occupancyHistory||u.occupancy||[{from:"2026-09-01",to:"",count:u.type==="owner"?3:3}])}));
  state.leases=(old.contracts||[]).map(c=>({id:c.id||crypto.randomUUID(),tenantId:c.tenantId,start:c.start,end:c.end||"",rent:Number(c.rent||0),advance:Number(c.advance??c.opAdvance??0),note:c.note||""}));
  // compatibility import from earlier local data
  for(const c of old.costs||[]){
    state.sources.push({id:c.id||crypto.randomUUID(),kind:"manual",name:c.note||c.category||c.categoryId||"Betriebskosten",category:c.categoryId||mapImportedCategory(c.category),amount:Number(c.amount||0),interval:"once",serviceStart:c.start||"",serviceEnd:c.end||"",assignment:c.unitId||"house",agreement:c.agreement||c.key||"auto",legacy:true})
  }
  // own contracts
  for(const c of old.ownContracts||[]){
    state.sources.push({id:c.id||crypto.randomUUID(),kind:"contract",name:c.name||c.category||"Vertrag",category:mapImportedPrivateCategory(c.category),amount:Number(c.cost||0),interval:c.interval||"yearly",serviceStart:c.start||"",serviceEnd:c.end||"",assignment:c.assignment||((c.note||"").includes("nur Eigennutzung")?"owner":"house"),agreement:"auto",review:c.review||"",noticeDays:Number(c.noticeDays||0),note:c.note||""})
  }
  // house costs
  for(const c of old.houseCosts||[]){
    state.sources.push({id:c.id||crypto.randomUUID(),kind:"manual",name:c.name||c.category||"Hauskosten",category:mapImportedPrivateCategory(c.category),amount:Number(c.amount||0),interval:c.interval||"once",serviceStart:c.date||"",serviceEnd:c.date||"",assignment:c.assignment||"owner",agreement:"auto",note:c.note||""})
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
function mapImportedCategory(x=""){const s=String(x).toLowerCase();if(s.includes("grundsteuer"))return"propertyTax";if(s.includes("niedersch"))return"rainwater";if(s.includes("straße")||s.includes("winter"))return"street";if(s.includes("müll")||s.includes("abfall"))return"waste";if(s.includes("versicher"))return"insurance";if(s.includes("schorn"))return"chimney";if(s.includes("wasser")||s.includes("kanal"))return"water";if(s.includes("repar"))return"repair";return"other"}
function mapImportedPrivateCategory(x=""){const s=String(x).toLowerCase();if(s.includes("internet"))return"internet";if(s.includes("rundfunk")||s.includes("gez"))return"broadcasting";if(s.includes("repar"))return"repair";if(s.includes("versicher"))return"insurance";return"other"}
async function replaceDocuments(docs){
  const db=await openDB(),tx=db.transaction("docs","readwrite"),store=tx.objectStore("docs");
  store.clear();for(const d of docs)store.put(d);
  return new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})
}



/* ===== security.js ===== */

const SEC_KEY="mietverwaltung_webauthn";
const LEGACY_SEC_KEYS=["mietverwaltung_v75_webauthn"];

function toB64(bytes){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function fromB64(s){s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}

function authCredentialId(){
  let id=localStorage.getItem(SEC_KEY);if(id)return id;
  for(const key of LEGACY_SEC_KEYS){id=localStorage.getItem(key);if(id){localStorage.setItem(SEC_KEY,id);localStorage.removeItem(key);return id}}
  return ""
}
function authEnabled(){return !!authCredentialId()}
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
  const id=authCredentialId();if(!id)return true;
  try{
    await navigator.credentials.get({publicKey:{
      challenge:crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials:[{id:fromB64(id),type:"public-key"}],
      userVerification:"required",timeout:60000
    }});
    return true
  }catch{return false}
}
function disableAuth(){localStorage.removeItem(SEC_KEY);for(const key of LEGACY_SEC_KEYS)localStorage.removeItem(key)}

function bytesToB64(a){let s="";const chunk=0x8000;for(let i=0;i<a.length;i+=chunk)s+=String.fromCharCode(...a.subarray(i,i+chunk));return btoa(s)}
function b64ToBytes(s){const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
async function derive(password,salt){const mat=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveKey"]);return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:250000,hash:"SHA-256"},mat,{name:"AES-GCM",length:256},false,["encrypt","decrypt"])}
async function encryptJSON(obj,password){
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),key=await derive(password,salt),plain=new TextEncoder().encode(JSON.stringify(obj)),cipher=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,plain));
  return {schema:"mietverwaltung-encrypted-v1",salt:bytesToB64(salt),iv:bytesToB64(iv),data:bytesToB64(cipher)}
}
async function decryptJSON(wrapper,password){
  const salt=b64ToBytes(wrapper.salt),iv=b64ToBytes(wrapper.iv),key=await derive(password,salt),plain=await crypto.subtle.decrypt({name:"AES-GCM",iv},key,b64ToBytes(wrapper.data));
  return JSON.parse(new TextDecoder().decode(plain))
}


/* ===== backup.js ===== */



async function encodeBlobForBackup(blob){
  const bytes=new Uint8Array(await blob.arrayBuffer());
  return {type:blob.type||"application/octet-stream",base64:bytesToB64(bytes)}
}
async function createFullBackup(state,password){
  const docs=await listDocuments(),encoded=[];
  for(const d of docs){
    const copy={...d,blob:undefined,pages:undefined};
    if(Array.isArray(d.pages)&&d.pages.length){
      copy.pageData=[];
      for(const p of d.pages){
        copy.pageData.push({
          id:p.id,name:p.name,type:p.type,size:p.size,
          blobData:await encodeBlobForBackup(p.blob)
        })
      }
    }else if(d.blob){
      copy.blobData=await encodeBlobForBackup(d.blob)
    }
    encoded.push(copy)
  }
  return encryptJSON({schema:"mietverwaltung-full-backup-v2",state,documents:encoded},password)
}
async function decodeFullBackup(wrapper,password){
  const payload=await decryptJSON(wrapper,password);
  if(!["mietverwaltung-full-backup-v2","mietverwaltung-v81-full-backup","mietverwaltung-v75-full-backup"].includes(payload.schema))throw new Error("Falsches Backup-Format");
  const docs=[];
  for(const d of payload.documents||[]){
    const copy={...d};
    if(Array.isArray(d.pageData)){
      copy.pages=d.pageData.map(p=>({id:p.id,name:p.name,type:p.type,size:p.size,blob:new Blob([b64ToBytes(p.blobData.base64)],{type:p.blobData.type})}));delete copy.pageData
    }else if(d.blobData){copy.blob=new Blob([b64ToBytes(d.blobData.base64)],{type:d.blobData.type});delete copy.blobData}
    docs.push(copy)
  }
  return {state:payload.state,documents:docs}
}
async function restoreFullBackup(wrapper,password){const decoded=await decodeFullBackup(wrapper,password);await replaceDocuments(decoded.documents);return decoded.state}

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
  const parsed=analyzeOCRText("Bescheid über Grundbesitzabgaben Leistungszeitraum 01.09.26 - 31.12.26\nGrundsteuer B 123,45 €\nNiederschlagswasser 50,00 €");
  results.push(assert("Dokumentanalyse erkennt Teilzeitraum",parsed.serviceStart==="2026-09-01"&&parsed.serviceEnd==="2026-12-31"));
  results.push(assert("Dokumentanalyse erkennt Grundsteuerbetrag",Math.abs(parsed.tax-123.45)<0.001));
  const ds=createEmptyState();ds.property.totalArea=200;ds.units=[{type:"owner",area:100,occupancy:[{from:"2026-04-01",to:"",count:3}]},{type:"rental",area:100,occupancy:[{from:"2026-04-01",to:"",count:3}]}];ds.leases=[{start:"2026-04-01",advance:0}];ensureDefaultMeters(ds);ds.costPositions=[positionDefaults({label:"Grundsteuer Test",category:"propertyTax",amount:100,serviceStart:"2026-04-01",serviceEnd:"2027-03-31",assignment:"house"})];const ba=centralBillingAnalysis(ds,2026);results.push(assert("Zentrale Kostenposition wird abgerechnet",Math.abs(ba.tenantCosts-50)<0.01));
  results.push(assert("Aktuelles Datenschema aktiv",SCHEMA_VERSION===12));
  const mt={meters:[{id:"m1",name:"Haupt",number:"W812500185",readings:[]},{id:"m2",name:"Eigen",number:"A1234567",readings:[]}]};
  const ma=analyzeMeterOCRText(mt,"W812500185\nZählerstand 00075,123 m3","");results.push(assert("Zählerfoto ordnet gespeicherte Nummer zu",ma.meterId==="m1"));
  results.push(assert("Zählerfoto erkennt Dezimalstand",Math.abs(ma.reading-75.123)<0.001));const integrity=validateDomainState(ds);results.push(assert("Datenintegritätsprüfung läuft",Array.isArray(integrity.errors)&&Array.isArray(integrity.warnings)));
  
  const wf1=documentWorkflowState({analysis:{status:"queued"}}),wf2=documentWorkflowState({analysis:{status:"done",fields:{positionProposals:[{id:"x"}]}}});
  results.push(assert("Dokumenten-Inbox klassifiziert Neu",wf1==="new"));
  results.push(assert("Dokumenten-Inbox klassifiziert Prüfen",wf2==="review"));
  const tp=positionDefaults({label:"Test",amount:1,confirmed:true,origin:"manual"});results.push(assert("Kostenposition besitzt Herkunft",!!tp.provenance));
  results.push(assert("Herkunftsnachweise aktiv",TRACE_VERSION===1));

  const sim=tokenSimilarity("Stadtwerke Wasser 2026","Wasser Stadtwerke");results.push(assert("Textähnlichkeit funktioniert",sim>0.5));
  const px=positionDefaults({label:"Niederschlagswasser",amount:44.94,confirmed:true,sourceId:"s1"}),sx={...ds,sources:[{id:"s1",name:"Grundbesitzabgaben",dueDates:["2026-11-15"]}],costPositions:[px],payments:[]};const pm=paymentMatchScore(sx,{direction:"outflow",amount:44.94,label:"Grundbesitzabgaben Niederschlagswasser",date:"2026-11-15"},px);results.push(assert("Automatischer Zahlungsabgleich erkennt starken Treffer",pm.score>=80));
  const intel=extractDocumentIntelligence("Stadt Beispiel\nBescheid über Grundbesitzabgaben\nGesamtsumme 539,05 EUR\nFälligkeit 15.11.2026",{});results.push(assert("Dokumentintelligenz erkennt Gesamtbetrag",Math.abs(intel.total-539.05)<0.01));
  results.push(assert("Dokumentanalyse aktiv",INTELLIGENCE_VERSION===1));

  const c=parseBankCSV("Buchungstag;Betrag;Verwendungszweck\n05.09.2026;-44,94;Niederschlagswasser\n06.09.2026;525,00;Miete September");results.push(assert("Bank-CSV erkennt zwei Buchungen",c.rows.length===2&&c.rows[0].direction==="outflow"&&c.rows[1].direction==="income"));
  results.push(assert("Flexible Datumsanalyse",parseFlexibleDate("05.09.2026")==="2026-09-05"));
  const dupState={payments:[{date:"2026-09-05",direction:"outflow",amount:44.94,label:"Niederschlagswasser"}],leases:[]};results.push(assert("CSV-Duplikaterkennung",bankImportPreview(dupState,{rows:[{date:"2026-09-05",direction:"outflow",amount:44.94,label:"Niederschlagswasser"}]})[0].duplicate===true));
  const mtq={name:"Test",unit:"m³",readings:[{date:"2026-01-01",value:10},{date:"2026-02-01",value:13.1},{date:"2026-03-01",value:16.0}]};results.push(assert("Zählertrend berechnet Verbrauch",meterTrend(mtq).segments.length===2));
  results.push(assert("Qualitätsprüfungen aktiv",QUALITY_VERSION===1));

  results.push(assert("Fehlende Kerneditoren vorhanden",typeof openUnitEditor==="function"&&typeof openSourceEditor==="function"&&typeof openDocumentCapture==="function"&&typeof getDocument==="function"));
  const rentTest={leases:[{id:"l1",start:"2026-01-01",end:"",rent:400,advance:125,tenantName:"Test"}],payments:[{date:smartMonthKey()+"-05",direction:"income",amount:525,label:"Miete Test"}]};results.push(assert("Smart-Mietmonitor erkennt Vollzahlung",rentMonthStatus(rentTest).status==="paid"));
  const cls=smartClassifyCostText("Rechnung Niederschlagswasser 44,94 EUR");results.push(assert("Smart-Dokumentklassifikation erkennt Niederschlagswasser",cls.category==="rainwater"&&cls.confidence>.9));
  const srcTest={sources:[{id:"s",name:"Stadt Warstein",amount:539.05,dueDates:["2026-11-15"]}],costPositions:[],payments:[]};const sm=sourcePaymentMatchScore(srcTest,{direction:"outflow",amount:539.05,label:"Stadt Warstein",date:"2026-11-15"},srcTest.sources[0]);results.push(assert("Smart-Zahlungsabgleich erkennt Quellen-Gesamtzahlung",sm.score>=90));
  results.push(assert("Smart Engine aktiv",SMART_ENGINE_VERSION===1));
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
  state=repairDomainState(await loadState());LAST_STABLE_STATE=cloneState(state);
}catch(e){
  storageError=e;
  console.error("IndexedDB-Startfehler:",e);
  state=createEmptyState();
  state.meta.storageWarning=String(e?.message||e);
}
let route=location.hash.slice(1)||"home";
let sub={data:"property",rental:"overview",owner:"overview",more:"overview"};

function audit(action,detail){
  state.audit.unshift({id:uid(),at:new Date().toISOString(),revision:Number(state.meta?.revision||0)+1,action,detail});
  state.audit=state.audit.slice(0,500)
}
async function persist(action,detail){
  const before=LAST_STABLE_STATE?cloneState(LAST_STABLE_STATE):null;
  try{
    state=repairDomainState(state);
    const check=validateDomainState(state);if(check.errors.length)throw new Error("Datenintegrität: "+check.errors.join(" · "));
    if(action)audit(action,detail);
    state.meta.revision=Number(state.meta.revision||0)+1;state.meta.lastSavedAt=new Date().toISOString();state.meta.lastIntegrityCheckAt=new Date().toISOString();
    await saveState(state);LAST_STABLE_STATE=cloneState(state);storageError=null;try{await updateBadge()}catch{};return true
  }catch(e){
    recordClientError("persist",e);storageError=e;console.error("Speicher-/Integritätsfehler:",e);
    if(before){state=before;LAST_STABLE_STATE=cloneState(before)}
    alert("Die Änderung wurde nicht gespeichert und zurückgenommen: "+String(e.message||e));try{render()}catch{};return false
  }
}

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
  "Keine bestätigte Kostenposition für diese Abrechnungsperiode":{route:"data",sub:"positions",label:"Kostenpositionen"},
  "Wasserzähler / Verbrauchsdaten fehlen":{route:"rental",sub:"water",label:"Wasserzähler"},
  "Ungeklärte Umlageentscheidungen":{route:"data",sub:"positions",label:"Umlageentscheidung"}
};
function goToCheckInput(issue){
  const m=CHECK_INPUT_MAP[issue];if(!m)return;
  sub[m.route]=m.sub;go(m.route)
}
function checkInputCoverage(){
  const missing=[],routeTabs={
    data:["property","units","lease","sources","positions","infrastructure","assessment","documents"],
    rental:["overview","water","calculation","workflow"],
    owner:["overview","finance","cashflow","analytics","reconciliation","tasks"],
    more:["overview","smart","audit","legal","security","diagnostics","recovery","backup"]
  };
  for(const [issue,m] of Object.entries(CHECK_INPUT_MAP))if(!routeTabs[m.route]?.includes(m.sub))missing.push(`${issue} → ${m.route}/${m.sub}`);
  for(const c of billingReadiness(state,currentPeriodYear()))if(!CHECK_INPUT_MAP[c.label])missing.push(`${c.label} → keine Eingabezuordnung`);
  return [...new Set(missing)]
}

function home(){
  const quality=dataQualityScore(state),forecast=intelligentForecast(state),rent=state.leases.reduce((s,l)=>s+Number(l.rent||0),0),repay=Number(state.finance.repayment||0),rateAfterRent=repay-rent,a=billingAnalysis(state,currentPeriodYear()),sh=shares(state,periodStart(currentPeriodYear())),water=settlementConsumption(state,settlementByPeriod(state,currentPeriodYear())),insights=smartInsights(state),rentNow=rentMonthStatus(state),proj=billingProjection(state);
  $("app").innerHTML=`<section>${storageError?`<div class="legal-warn"><strong>Lokaler Speicher eingeschränkt</strong><br>${esc(storageError.message||storageError)}</div>`:""}
  <div class="hero"><div><p class="eyebrow">ÜBERSICHT</p><h2>Dein Haus auf einen Blick</h2><p class="muted">Finanzen, Vermietung, Dokumente, Verbrauch und Datenqualität in einer gemeinsamen Sicht.</p></div><div class="health ${quality>=85?"good":quality>=65?"mid":"low"}">${quality}%</div></div>
  <div class="grid cards"><article class="card"><span>Hausrate</span><strong>${euro(repay)}</strong><small>monatlich</small></article><article class="card"><span>Kaltmiete</span><strong>${euro(rent)}</strong><small>monatlich</small></article><article class="card"><span>Hausrate nach Kaltmiete</span><strong class="${rateAfterRent>0?"negative":"positive"}">${euro(rateAfterRent)}</strong><small>ohne weitere Hauskosten</small></article><article class="card"><span>Mieter-BK aktuell</span><strong>${euro(a.tenantCosts)}</strong><small>${periodLabel(currentPeriodYear())}</small></article></div>
  <div class="card"><div class="row between"><div><h3>Jetzt wichtig</h3><p class="muted">${rentNow.status!=="none"?`Mietzahlung ${rentNow.key}: ${rentStatusLabel(rentNow)} · `:""}Abrechnungsprognose ${proj.confidence}%.</p></div><button class="secondary" id="openSmart">Assistent öffnen</button></div>${insights.length?insights.slice(0,6).map((x,i)=>`<button class="priority-item ${x.severity==="bad"?"legal-bad":x.severity==="warn"?"legal-warn":"info"}" data-smart-home="${i}"><span>⚠ ${esc(x.title)}<small>${esc(x.detail||"")}</small></span><b>${Math.round(Number(x.confidence||0))}%</b></button>`).join(""):`<p class="legal-ok">✓ Aktuell keine offenen Smart-Prioritäten.</p>`}</div>
  <div class="card"><h3>Verteilungsbild</h3><div class="analysis-grid"><div><small>Wohnfläche Mieterin</small><strong>${percent(sh.area)}</strong></div><div><small>Kaltwasseranteil</small><strong>${water?.valid?percent(water.share):"–"}</strong></div><div><small>Umlagefähige Kosten</small><strong>${euro(a.tenantCosts)}</strong></div></div></div>
  <div class="card"><h3>12‑Monats-Prognose</h3><div class="tablewrap"><table class="costtable"><thead><tr><th>Monat</th><th>Einnahmen</th><th>Ausgaben</th><th>Saldo</th></tr></thead><tbody>${forecast.slice(0,4).map(x=>`<tr><td>${x.label}</td><td>${euro(x.income)}</td><td>${euro(x.outflow)}</td><td class="${x.net<0?"negative":"positive"}">${euro(x.net)}</td></tr>`).join("")}</tbody></table></div></div>
  <div class="card"><h3>Nächste Termine</h3>${taskList().slice(0,5).map(taskHTML).join("")}</div></section>`;
  $("openSmart").onclick=()=>{sub.more="smart";go("more")};document.querySelectorAll("[data-smart-home]").forEach(b=>b.onclick=()=>{const x=insights[Number(b.dataset.smartHome)];if(!x)return;if(x.sub)sub[x.route]=x.sub;go(x.route)})
}



function dataWorkspace(){
  const tabs=[
    {id:"property",label:"Objekt"},
    {id:"units",label:"Einheiten"},
    {id:"lease",label:"Mietvertrag"},
    {id:"sources",label:"Kostenquellen"},
    {id:"positions",label:"Kostenpositionen"},
    {id:"infrastructure",label:"Zähler & Behälter"},
    {id:"assessment",label:"Grundbesitzabgaben"},
    {id:"documents",label:"Dokumente"}
  ];
  const active=sub.data||"property";
  $("app").innerHTML=workspaceHeader("DATEN","Daten","Objekt, Mietverhältnis, Kosten, Zähler und Dokumente.",tabs,active);
  bindWorkspaceTabs("data",dataWorkspace);
  if(active==="property")propertyView();
  else if(active==="units")unitsDataView();
  else if(active==="lease")leaseDataView();
  else if(active==="sources")sourcesDataView();
  else if(active==="positions")costPositionsDataView();
  else if(active==="infrastructure")infrastructureDataView();
  else if(active==="assessment")assessmentDataView();
  else documentsDataView()
}
function propertyView(){
  $("workspaceBody").innerHTML=`<form id="propertyForm" class="card form-grid">
    ${formField({name:"name",label:"Objektname",value:state.property.name||"",placeholder:"z. B. Doppelhaus Hauptstraße"})}
    ${formField({name:"address",label:"Adresse",value:state.property.address||"",placeholder:"Straße, Hausnummer, Ort"})}
    ${formField({name:"totalArea",label:"Gesamtwohnfläche m²",type:"number",step:"0.01",min:0,value:state.property.totalArea||""})}
    ${formField({name:"year",label:"Baujahr",type:"number",min:1800,value:state.property.year||""})}<div class="full section-separator"><h3>Abrechnung & Korrespondenz</h3></div>
    ${formField({name:"landlordName",label:"Absender / Vermieter",value:state.correspondence.landlordName||""})}
    ${formField({name:"landlordAddress",label:"Absenderadresse",value:state.correspondence.landlordAddress||"",full:true})}
    ${formField({name:"iban",label:"IBAN für Nachzahlungen",value:state.correspondence.iban||""})}
    ${formField({name:"paymentReference",label:"Verwendungszweck",value:state.correspondence.paymentReference||""})}
    ${formField({name:"contact",label:"Kontakt für Rückfragen",value:state.correspondence.contact||""})}
    <div class="full"><button class="primary">Objektdaten speichern</button></div>
  </form>
  <div class="card"><h3>Warum diese Daten gebraucht werden</h3><p>Objektname und Adresse werden für Dokumentzuordnung und PDF-Ausgaben genutzt. Die Gesamtwohnfläche wird für wohnflächenbasierte Umlagen benötigt.</p></div>`;
  $("propertyForm").onsubmit=async e=>{
    e.preventDefault();const v=Object.fromEntries(new FormData(e.target));
    state.property={...state.property,name:v.name.trim(),address:v.address.trim(),totalArea:Number(v.totalArea)||0,year:v.year};state.correspondence={landlordName:v.landlordName.trim(),landlordAddress:v.landlordAddress.trim(),iban:v.iban.trim(),paymentReference:v.paymentReference.trim(),contact:v.contact.trim()};
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

function openUnitEditor(x=null){
  const today=new Date().toISOString().slice(0,10),current=currentPersons(x,today);
  modal(x?"Einheit bearbeiten":"Einheit hinzufügen",`<form id="f" class="form-grid">
    ${formField({name:"name",label:"Bezeichnung",value:x?.name||""})}
    ${formField({name:"type",label:"Nutzung",type:"select",value:x?.type||"rental",options:[{value:"owner",label:"Eigennutzung"},{value:"rental",label:"Mietwohnung"}]})}
    ${formField({name:"area",label:"Wohnfläche (m²)",type:"number",step:"0.01",min:0,value:x?.area||""})}
    ${formField({name:"persons",label:"Aktuelle Personenzahl",type:"number",step:"1",min:0,value:current||0})}
    ${formField({name:"occupancyFrom",label:"Personenzahl gültig ab",type:"date",value:today})}
    ${formField({name:"note",label:"Notiz",value:x?.note||"",full:true})}
    <div class="full"><button class="primary">Speichern</button></div>
  </form>`,()=>{
    $("f").onsubmit=async e=>{
      e.preventDefault();const v=Object.fromEntries(new FormData(e.target)),obj=x||{id:uid(),occupancy:[]};
      if(!v.name.trim())return alert("Bitte eine Bezeichnung eingeben.");
      if(Number(v.area)<=0)return alert("Bitte die Wohnfläche prüfen.");
      if(!x&&state.units.some(u=>u.type===v.type)&&!confirm(`Es existiert bereits eine Einheit vom Typ „${v.type==="owner"?"Eigennutzung":"Mietwohnung"}“. Trotzdem anlegen?`))return;
      obj.name=v.name.trim();obj.type=v.type;obj.area=Number(v.area)||0;obj.note=v.note.trim();obj.occupancy=Array.isArray(obj.occupancy)?obj.occupancy:[];
      const persons=Math.max(0,Number(v.persons)||0),from=v.occupancyFrom||today,last=obj.occupancy.slice().sort((a,b)=>(b.from||"").localeCompare(a.from||""))[0];
      if(!last||Number(last.count)!==persons||last.from!==from){
        const active=obj.occupancy.find(o=>(!o.to)&&o.from&&o.from<from);if(active){const d=new Date(from+"T00:00:00");d.setDate(d.getDate()-1);active.to=d.toISOString().slice(0,10)}
        obj.occupancy.push({from,to:"",count:persons});obj.occupancy.sort((a,b)=>(a.from||"").localeCompare(b.from||""))
      }
      if(!x)state.units.push(obj);
      await persist(x?"Einheit geändert":"Einheit angelegt",obj.name);$("modal").classList.add("hidden");unitsDataView()
    }
  })
}
function openSourceEditor(x=null){
  const cats=Object.entries(CATEGORIES).map(([value,c])=>({value,label:c.label})),y=currentPeriodYear();
  modal(x?"Kostenquelle bearbeiten":"Kostenquelle hinzufügen",`<form id="f" class="form-grid">
    ${formField({name:"name",label:"Bezeichnung / Anbieter",value:x?.name||""})}
    ${formField({name:"category",label:"Kategorie",type:"select",value:x?.category||"other",options:cats})}
    ${formField({name:"amount",label:"Betrag (€)",type:"number",step:"0.01",min:0,value:x?.amount??""})}
    ${formField({name:"interval",label:"Intervall",type:"select",value:x?.interval||"yearly",options:[{value:"once",label:"einmalig / Zeitraum"},{value:"monthly",label:"monatlich"},{value:"quarterly",label:"vierteljährlich"},{value:"yearly",label:"jährlich"}]})}
    ${formField({name:"serviceStart",label:"Leistungszeitraum von",type:"date",value:x?.serviceStart||periodStart(y)})}
    ${formField({name:"serviceEnd",label:"Leistungszeitraum bis",type:"date",value:x?.serviceEnd||periodEnd(y)})}
    ${formField({name:"assignment",label:"Zuordnung",type:"select",value:x?.assignment||"house",options:[{value:"house",label:"gesamtes Haus"},{value:"owner",label:"nur Eigennutzung"},{value:"rental",label:"nur Mietwohnung"},{value:"review",label:"noch prüfen"}]})}
    ${formField({name:"agreement",label:"Umlageregel",type:"select",value:x?.agreement||"auto",options:[{value:"auto",label:"automatisch / Standard"},{value:"area",label:"Wohnfläche"},{value:"persons",label:"Personen"},{value:"manual",label:"individuell prüfen"}]})}
    ${formField({name:"dueDates",label:"Fälligkeiten",value:Array.isArray(x?.dueDates)?x.dueDates.join(", "):"",full:true,placeholder:"z. B. 2026-11-15"})}
    ${formField({name:"note",label:"Notiz",value:x?.note||"",full:true})}
    <div class="full" id="sourceDecision"></div><div class="full"><button class="primary">Speichern</button></div>
  </form>`,()=>{
    const preview=()=>{const v=Object.fromEntries(new FormData($("f")));const d=v.assignment==="review"?{status:"check",reason:"Zuordnung muss bestätigt werden.",basis:"Objektzuordnung"}:legalDecision({category:v.category},{assignment:v.assignment,agreement:v.agreement,hasConsumption:v.category==="water"&&!!settlementConsumption(state,settlementByPeriod(state,currentPeriodYear()))?.valid});$("sourceDecision").innerHTML=`<div class="${d.status==="check"?"legal-warn":"info"}"><strong>Regelprüfung:</strong> ${esc(d.reason)}<br><small>${esc(d.basis||"")}</small></div>`};
    $("f").onchange=preview;preview();
    $("f").onsubmit=async e=>{
      e.preventDefault();const v=Object.fromEntries(new FormData(e.target));if(!v.name.trim())return alert("Bitte eine Bezeichnung eingeben.");if(v.serviceStart&&v.serviceEnd&&v.serviceEnd<v.serviceStart)return alert("Leistungszeitraum prüfen.");
      const obj=x||{id:uid(),kind:"manual"};
      Object.assign(obj,{name:v.name.trim(),category:v.category,amount:Number(v.amount)||0,interval:v.interval,serviceStart:v.serviceStart,serviceEnd:v.serviceEnd,assignment:v.assignment,agreement:v.agreement,dueDates:String(v.dueDates||"").split(/[,;]+/).map(s=>s.trim()).filter(Boolean),note:v.note.trim()});
      if(!x)state.sources.push(obj);syncSimpleSourcePosition(state,obj);
      await persist(x?"Kostenquelle geändert":"Kostenquelle angelegt",obj.name);$("modal").classList.add("hidden");sourcesDataView()
    }
  })
}
function documentsDataView(){documentsView()}
function openDocumentCapture(){
  DOC_DRAFT_PAGES=[];
  modal("Dokument hinzufügen",`<div class="card">
    <label>Bezeichnung<input id="newDocLabel" class="big-input" placeholder="z. B. Grundbesitzabgaben 2026"></label>
    <p class="muted">Mehrere Fotos oder PDF-Dateien können als ein Dokument gespeichert werden.</p>
    <div class="doc-capture-actions">
      <label class="primary">Seite fotografieren<input id="docCameraPage" type="file" accept="image/*" capture="environment" hidden></label>
      <label class="secondary">Fotos / PDF auswählen<input id="docPageFiles" type="file" accept="image/*,.pdf" multiple hidden></label>
    </div>
    <div id="draftPages"></div>
    <button id="saveDocumentBtn" class="primary" disabled>Speichern & analysieren</button>
    <button id="clearDraftBtn" class="secondary">Auswahl leeren</button>
  </div>`,()=>{
    renderDraftPages();
    $("docCameraPage").onchange=e=>{appendDraftFiles(e.target.files);e.target.value=""};
    $("docPageFiles").onchange=e=>{appendDraftFiles(e.target.files);e.target.value=""};
    $("saveDocumentBtn").onclick=saveDraftDocument;
    $("clearDraftBtn").onclick=()=>{DOC_DRAFT_PAGES=[];renderDraftPages()}
  })
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

function costPositionsDataView(){
  const positions=(state.costPositions||[]).slice().sort((a,b)=>(b.serviceStart||"").localeCompare(a.serviceStart||""));
  viewBody("workspaceBody").innerHTML=`<div class="card"><div class="row between"><div><h3>Zentrale Kostenpositionen</h3><p class="muted">Nur bestätigte Positionen fließen in die Abrechnung ein. Quelle, Dokument, Umlage und Zahlung bleiben getrennte Ebenen.</p></div><button id="addPosition" class="primary">Position hinzufügen</button></div></div>
  ${positions.map(p=>{const src=state.sources.find(s=>s.id===p.sourceId);const dec=allocateCostPosition(state,{...p,amount:p.amount},currentPeriodYear()).decision;return`<div class="item"><div class="row between"><div><h3>${esc(p.label)}</h3><p>${esc(category(p.category).label)} · ${euro(p.amount)} · ${esc(p.serviceStart||"–")} bis ${esc(p.serviceEnd||"–")}</p><p><span class="pill ${p.confirmed?"good":"warn"}">${p.confirmed?"bestätigt":"Entwurf"}</span> <span class="pill">${p.assignment==="review"?"Zuordnung prüfen":p.assignment==="owner"?"Eigennutzung":p.assignment==="rental"?"Mietwohnung":"Haus"}</span></p><small>${src?`Quelle: ${esc(src.name)}`:"Ohne Quelle"} · ${esc(dec.reason||"")}</small></div><button class="secondary" data-trace-pos="${p.id}">Herkunft</button><button class="secondary" data-pos="${p.id}">Bearbeiten</button></div></div>`}).join("")||`<div class="card muted">Noch keine Kostenpositionen vorhanden.</div>`}`;
  $("addPosition").onclick=()=>openCostPositionEditor();
  document.querySelectorAll("[data-pos]").forEach(b=>b.onclick=()=>openCostPositionEditor(positionById(state,b.dataset.pos)));
  document.querySelectorAll("[data-trace-pos]").forEach(b=>b.onclick=()=>openPositionTrace(positionById(state,b.dataset.tracePos)))
}

function openPositionTrace(p){
  if(!p)return;
  const t=traceForPosition(state,p),docPromise=t.documentId?getDocument(t.documentId):Promise.resolve(null);
  Promise.resolve(docPromise).then(doc=>{
    modal("Datenherkunft",`<div class="trace-chain">
      <div class="trace-node"><small>Ursprung</small><strong>${esc(t.origin)}</strong></div>
      <div class="trace-arrow">↓</div>
      <div class="trace-node"><small>Dokument / Quelle</small><strong>${esc(doc?.label||t.source?.name||"keine")}</strong></div>
      <div class="trace-arrow">↓</div>
      <div class="trace-node"><small>Kostenposition</small><strong>${esc(p.label)} · ${euro(p.amount)}</strong></div>
      <div class="trace-arrow">↓</div>
      <div class="trace-node"><small>Umlage</small><strong>${esc(p.assignment)} / ${esc(p.agreement)}</strong></div>
    </div>
    ${t.evidence?`<div class="card"><h3>Erkannte Belegstelle</h3><p>${esc(t.evidence)}</p>${t.confidence!=null?`<small>OCR-Konfidenz ${Math.round(Number(t.confidence)*100)} %</small>`:""}</div>`:""}
    <div class="card"><p>Bestätigt: ${t.confirmedAt?new Date(t.confirmedAt).toLocaleString("de-DE"):"nicht dokumentiert"}</p>${doc?`<button id="openTraceDoc" class="primary">Quelldokument öffnen</button>`:""}</div>`,()=>{
      if($("openTraceDoc"))$("openTraceDoc").onclick=()=>openDocumentAnalysis(doc)
    })
  })
}

function openCostPositionEditor(x=null){
  const cats=Object.entries(CATEGORIES).map(([value,c])=>({value,label:c.label}));
  const sources=[{value:"",label:"keine Quelle"},...(state.sources||[]).map(s=>({value:s.id,label:s.name}))];
  modal(x?"Kostenposition bearbeiten":"Kostenposition hinzufügen",`<form id="f" class="form-grid">
    ${formField({name:"label",label:"Bezeichnung",value:x?.label||""})}
    ${formField({name:"category",label:"Kategorie",type:"select",value:x?.category||"other",options:cats})}
    ${formField({name:"amount",label:"Betrag €",type:"number",step:"0.01",min:0,value:x?.amount||""})}
    ${formField({name:"interval",label:"Intervall",type:"select",value:x?.interval||"once",options:[{value:"once",label:"einmalig / Zeitraum"},{value:"monthly",label:"monatlich"},{value:"quarterly",label:"vierteljährlich"},{value:"yearly",label:"jährlich"}]})}
    ${formField({name:"serviceStart",label:"Leistungszeitraum von",type:"date",value:x?.serviceStart||periodStart(currentPeriodYear())})}
    ${formField({name:"serviceEnd",label:"Leistungszeitraum bis",type:"date",value:x?.serviceEnd||periodEnd(currentPeriodYear())})}
    ${formField({name:"assignment",label:"Zuordnung",type:"select",value:x?.assignment||"house",options:[{value:"house",label:"gesamtes Haus"},{value:"owner",label:"nur Eigennutzung"},{value:"rental",label:"nur Mietwohnung"},{value:"review",label:"noch prüfen"}]})}
    ${formField({name:"agreement",label:"Umlageregel",type:"select",value:x?.agreement||"auto",options:[{value:"auto",label:"automatisch / Standard"},{value:"area",label:"Wohnfläche"},{value:"persons",label:"Personen"},{value:"manual",label:"individuell prüfen"}]})}
    ${formField({name:"sourceId",label:"Quelle",type:"select",value:x?.sourceId||"",options:sources})}
    ${formField({name:"quantity",label:"Menge",type:"number",step:"0.001",value:x?.details?.quantity??""})}
    ${formField({name:"unit",label:"Einheit",value:x?.details?.unit||"",placeholder:"m³, Stück, m …"})}
    ${formField({name:"rate",label:"Tarif / Einheit €",type:"number",step:"0.0001",value:x?.details?.rate??""})}
    ${formField({name:"vatRate",label:"USt. %",type:"number",step:"0.01",value:x?.details?.vatRate??""})}
    <label class="full"><span>Bestätigt</span><select name="confirmed"><option value="yes" ${x?.confirmed!==false?"selected":""}>ja – abrechnungswirksam</option><option value="no" ${x?.confirmed===false?"selected":""}>nein – Entwurf</option></select></label>
    <div class="full" id="positionDecision"></div><div class="full"><button class="primary">Speichern</button></div>
  </form>`,()=>{
    const preview=()=>{const v=Object.fromEntries(new FormData($("f")));const d=v.assignment==="review"?{status:"check",reason:"Zuordnung muss bestätigt werden.",basis:"Objektzuordnung"}:legalDecision({category:v.category},{assignment:v.assignment,agreement:v.agreement,hasConsumption:v.category==="water"&&!!settlementConsumption(state,settlementByPeriod(state,currentPeriodYear()))?.valid});$("positionDecision").innerHTML=`<div class="${d.status==="check"?"legal-warn":"info"}"><strong>Regelprüfung:</strong> ${esc(d.reason)}<br><small>${esc(d.basis||"")}</small></div>`};
    $("f").onchange=preview;preview();
    $("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));if(v.serviceEnd<v.serviceStart)return alert("Leistungszeitraum prüfen.");const obj=positionDefaults({...x,id:x?.id||uid(),label:v.label.trim(),category:v.category,amount:Number(v.amount)||0,interval:v.interval,serviceStart:v.serviceStart,serviceEnd:v.serviceEnd,assignment:v.assignment,agreement:v.agreement,sourceId:v.sourceId,confirmed:v.confirmed==="yes",origin:x?.origin||"manual",details:{...(x?.details||{}),quantity:v.quantity===""?null:Number(v.quantity),unit:v.unit.trim(),rate:v.rate===""?null:Number(v.rate),vatRate:v.vatRate===""?null:Number(v.vatRate)}});const result=await executeCommand(x?"costPosition.update":"costPosition.create",{id:obj.id,label:obj.label,amount:obj.amount},async()=>{const i=state.costPositions.findIndex(p=>p.id===obj.id);if(i>=0)state.costPositions[i]=obj;else state.costPositions.push(obj)},{auditText:x?"Kostenposition geändert":"Kostenposition angelegt"});if(!result.ok)return alert(result.message);$("modal").classList.add("hidden");costPositionsDataView()}
  })
}


let METER_PHOTO_BUSY=false;
async function recognizeMeterPhoto(file,preferredMeterId="",progress){
  if(!file)throw new Error("Kein Foto ausgewählt.");
  if(!String(file.type||"").startsWith("image/"))throw new Error("Für Zählerstände bitte ein Foto/Bild auswählen.");
  const worker=await createOCRWorker(progress);
  try{
    progress?.("Zählerfoto wird gelesen …");
    const result=await worker.recognize(file),text=result.data.text||"";
    if(!text.trim())throw new Error("Auf dem Foto konnte kein Text erkannt werden.");
    return analyzeMeterOCRText(state,text,preferredMeterId)
  }finally{await worker.terminate()}
}
function openMeterPhotoCapture(preferredMeterId="",initialMode="camera"){
  const meters=state.meters||[],preferred=meters.find(m=>m.id===preferredMeterId);
  modal("Zählerstand per Foto",`<div class="card"><h3>${preferred?esc(preferred.name):"Zähler automatisch erkennen"}</h3><p class="muted">${preferred?"Die Aufnahme wird diesem Zähler zugeordnet. Zählernummer und Stand werden zusätzlich per OCR geprüft.":"Die App versucht die gespeicherte Zählernummer im Bild zu finden und dadurch den richtigen Zähler automatisch auszuwählen."}</p>
    <div class="doc-capture-actions">
      <label class="primary">Foto aufnehmen<input id="meterCameraInput" type="file" accept="image/*" capture="environment" hidden></label>
      <label class="secondary">Foto auswählen<input id="meterFileInput" type="file" accept="image/*" hidden></label>
    </div>
    <div id="meterPhotoProgress"></div><div id="meterPhotoResult"></div></div>`,()=>{
      const handle=async file=>{
        if(!file||METER_PHOTO_BUSY)return;METER_PHOTO_BUSY=true;
        const p=$("meterPhotoProgress"),r=$("meterPhotoResult");
        p.innerHTML=`<div class="info">OCR wird vorbereitet …</div>`;r.innerHTML="";
        try{
          const analysis=await recognizeMeterPhoto(file,preferredMeterId,msg=>{p.innerHTML=`<div class="info">${esc(msg)}</div>`});
          renderMeterPhotoProposal(file,analysis)
        }catch(err){
          recordClientError("meter-photo-ocr",err);
          r.innerHTML=`<div class="legal-bad"><strong>Foto konnte nicht ausgewertet werden</strong><br>${esc(err.message||err)}</div>`
        }finally{METER_PHOTO_BUSY=false}
      };
      $("meterCameraInput").onchange=e=>{const f=e.target.files?.[0];e.target.value="";handle(f)};
      $("meterFileInput").onchange=e=>{const f=e.target.files?.[0];e.target.value="";handle(f)};
      if(initialMode==="file")setTimeout(()=>$("meterFileInput")?.click(),80)
    })
}
function renderMeterPhotoProposal(file,a){
  const r=$("meterPhotoResult");if(!r)return;
  const meters=state.meters||[],meterOptions=meters.map(m=>({value:m.id,label:`${m.name}${m.number?` · ${m.number}`:""}`}));
  const candidates=a.candidates||[];
  r.innerHTML=`<form id="meterPhotoConfirm" class="form-grid">
    <div class="full ${a.meterId?"legal-ok":"legal-warn"}"><strong>Zuordnung:</strong> ${a.meterId?`${esc(a.meterName)} · ${Math.round(a.assignmentConfidence*100)} %`:"nicht eindeutig"}<br><small>${esc(a.assignmentReason)}</small></div>
    ${formField({name:"meterId",label:"Zähler",type:"select",value:a.meterId||"",options:[{value:"",label:"Bitte Zähler wählen"},...meterOptions]})}
    ${formField({name:"date",label:"Ablesedatum",type:"date",value:new Date().toISOString().slice(0,10)})}
    ${formField({name:"value",label:"Erkannter Zählerstand",type:"number",step:"0.001",value:a.reading??""})}
    ${a.serialCandidate?formField({name:"detectedNumber",label:"Erkannte mögliche Zählernummer",value:a.serialCandidate}):""}
    <div class="full" id="meterPhotoPlausibility"></div>
    ${candidates.length>1?`<div class="full"><details><summary>Weitere erkannte Zahlen</summary>${candidates.slice(1).map(c=>`<button type="button" class="secondary meter-candidate" data-value="${c.value}">${esc(c.raw)} · ${(c.score*100).toFixed(0)} %</button>`).join(" ")}</details></div>`:""}
    <div class="full info"><strong>OCR-Sicherheit Zählerstand:</strong> ${Math.round((a.readingConfidence||0)*100)} %${a.readingEvidence?`<br><small>${esc(a.readingEvidence)}</small>`:""}<br><small>Vor dem Speichern bitte Stand und Zähler kontrollieren.</small></div>
    <label class="full"><span>Zählernummer übernehmen</span><select name="saveDetectedNumber"><option value="no">nein</option><option value="yes" ${a.serialCandidate&&!a.meterId?"selected":""}>ja, erkannte Nummer am gewählten Zähler speichern</option></select></label>
    <div class="full"><button class="primary">Zählerstand bestätigen & Foto speichern</button></div>
  </form>`;
  const updatePlausibility=()=>{
    const v=Object.fromEntries(new FormData($("meterPhotoConfirm"))),m=meterById(state,v.meterId),val=Number(v.value);
    if(!m||v.value===""){ $("meterPhotoPlausibility").innerHTML=`<div class="legal-warn">Zähler und Stand auswählen.</div>`;return}
    const q=meterReadingPlausibility(m,v.date,val);
    $("meterPhotoPlausibility").innerHTML=`<div class="${q.ok?"legal-ok":"legal-warn"}">${esc(q.message)}</div>`
  };
  $("meterPhotoConfirm").oninput=updatePlausibility;updatePlausibility();
  document.querySelectorAll(".meter-candidate").forEach(b=>b.onclick=()=>{$("meterPhotoConfirm").elements.value.value=b.dataset.value;updatePlausibility()});
  $("meterPhotoConfirm").onsubmit=async e=>{
    e.preventDefault();const v=Object.fromEntries(new FormData(e.target)),m=meterById(state,v.meterId);
    if(!m)return alert("Bitte den Zähler auswählen.");
    if(v.value==="")return alert("Bitte den Zählerstand prüfen.");
    const value=Number(v.value),pl=meterReadingPlausibility(m,v.date,value);
    if(!pl.ok&&!confirm(pl.message+"\n\nTrotzdem speichern?"))return;
    const pages=[{id:uid(),name:file.name||"Zählerfoto.jpg",type:file.type||"image/jpeg",size:file.size,blob:file}],fingerprint=await documentFingerprint(pages);
    const doc={id:uid(),name:`Zählerfoto ${m.name} ${v.date}`,label:`Zählerfoto ${m.name} ${v.date}`,type:file.type||"image/jpeg",size:file.size,created:new Date().toISOString(),sourceId:"",pages,fingerprint,analysis:{status:"done",finishedAt:new Date().toISOString(),text:a.text,fields:{kind:"Zählerstand",meterId:m.id,meterName:m.name,detectedMeterNumber:v.detectedNumber||a.serialCandidate||"",reading:value,date:v.date,assignmentConfidence:a.assignmentConfidence,readingConfidence:a.readingConfidence}}};
    await addDocument(doc);
    const reading=addMeterReading(m,v.date,value,"photo",false);
    reading.photoDocumentId=doc.id;reading.ocrConfidence=Number(a.readingConfidence||0);reading.assignmentConfidence=Number(a.assignmentConfidence||0);reading.detectedMeterNumber=v.detectedNumber||a.serialCandidate||"";
    if(v.saveDetectedNumber==="yes"&&!m.number&&(v.detectedNumber||a.serialCandidate))m.number=String(v.detectedNumber||a.serialCandidate).trim();
    const ok=await persist("Zählerstand per Foto erfasst",`${m.name} · ${value} ${m.unit||""} · ${v.date}`);
    if(!ok){try{await deleteDocument(doc.id)}catch{};return}
    $("modal").classList.add("hidden");
    if(route==="data"&&sub.data==="infrastructure")infrastructureDataView();else if(route==="rental"&&sub.rental==="water")waterView();else render()
  }
}

function infrastructureDataView(){
  const {main,owner}=ensureDefaultMeters(state);
  viewBody("workspaceBody").innerHTML=`<div class="card"><div class="row between"><div><h3>Zähler</h3><p class="muted">Zählerstände können manuell oder per Foto erfasst werden. Bei einem allgemeinen Foto versucht die App die gespeicherte Zählernummer automatisch zu erkennen.</p></div><div><button id="meterPhotoCamera" class="primary">Foto aufnehmen</button><button id="meterPhotoFile" class="secondary">Foto auswählen</button></div></div></div>
  ${[main,owner].map(m=>{const last=latestMeterReading(m);return`<div class="item"><div class="row between"><div><h3>${esc(m.name)}</h3><p>Zählernummer: ${esc(m.number||"noch nicht eingetragen")} · ${esc(m.unit||"m³")}</p><small>${m.readings.length} Ablesung(en)${last?` · zuletzt ${last.value} ${esc(m.unit||"")} am ${esc(last.date)}${last.photoDocumentId?" · Foto":""}`:""}</small></div><div><button class="primary" data-meter-photo="${m.id}">Foto</button><button class="secondary" data-meter="${m.id}">Bearbeiten</button></div></div></div>`}).join("")}
  <div class="card"><div class="row between"><div><h3>Abfallbehälter</h3><p class="muted">Behälter werden getrennt von Gebühren geführt. Dadurch kann z. B. eine zusätzliche Restmülltonne eindeutig der Eigennutzung zugeordnet werden.</p></div><button id="addContainer" class="primary">Behälter hinzufügen</button></div></div>
  ${(state.containers||[]).map(c=>`<div class="item"><div class="row between"><div><h3>${esc(c.type)} ${c.volumeL?c.volumeL+" L":""}</h3><p>${c.assignment==="owner"?"nur Eigennutzung":c.assignment==="rental"?"nur Mietwohnung":c.assignment==="house"?"gemeinsam":"Zuordnung prüfen"} · ab ${esc(c.activeFrom||"–")}</p></div><button class="secondary" data-container="${c.id}">Bearbeiten</button></div></div>`).join("")||`<div class="card muted">Noch keine Behälter erfasst.</div>`}`;
  $("meterPhotoCamera").onclick=()=>openMeterPhotoCapture("","camera");
  $("meterPhotoFile").onclick=()=>openMeterPhotoCapture("","file");
  document.querySelectorAll("[data-meter-photo]").forEach(b=>b.onclick=()=>openMeterPhotoCapture(b.dataset.meterPhoto,"camera"));
  document.querySelectorAll("[data-meter]").forEach(b=>b.onclick=()=>openMeterEditor(meterById(state,b.dataset.meter)));
  $("addContainer").onclick=()=>openContainerEditor();
  document.querySelectorAll("[data-container]").forEach(b=>b.onclick=()=>openContainerEditor((state.containers||[]).find(c=>c.id===b.dataset.container)))
}
function openMeterEditor(m){
  modal("Zähler bearbeiten",`<form id="f" class="form-grid">${formField({name:"name",label:"Bezeichnung",value:m.name})}${formField({name:"number",label:"Zählernummer",value:m.number||"",placeholder:"wichtig für automatische Foto-Zuordnung"})}${formField({name:"unit",label:"Einheit",value:m.unit||"m³"})}<div class="full"><div class="row between"><h3>Ablesungen</h3><button type="button" id="photoFromMeterEditor" class="primary">Stand per Foto</button></div>${(m.readings||[]).slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map(r=>`<p>${esc(r.date)} · <strong>${r.value} ${esc(m.unit||"")}</strong>${r.synthetic?" · übernommen":r.origin==="photo"?" · 📷 Foto":""}</p>`).join("")||"<p class='muted'>Noch keine Ablesungen.</p>"}</div><div class="full"><button class="primary">Zähler speichern</button></div></form>`,()=>{
    $("photoFromMeterEditor").onclick=()=>{$("modal").classList.add("hidden");openMeterPhotoCapture(m.id,"camera")};
    $("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));m.name=v.name.trim();m.number=v.number.trim();m.unit=v.unit.trim()||"m³";await persist("Zähler geändert",m.name);$("modal").classList.add("hidden");infrastructureDataView()}
  })
}
function openContainerEditor(x=null){
  modal(x?"Behälter bearbeiten":"Behälter hinzufügen",`<form id="f" class="form-grid">${formField({name:"type",label:"Behälterart",type:"select",value:x?.type||"Restmüll",options:[{value:"Restmüll",label:"Restmüll"},{value:"Bioabfall",label:"Bioabfall"},{value:"Papier",label:"Papier"},{value:"Sonstige",label:"Sonstige"}]})}${formField({name:"volumeL",label:"Volumen (Liter)",type:"number",value:x?.volumeL||120})}${formField({name:"assignment",label:"Zuordnung",type:"select",value:x?.assignment||"review",options:[{value:"house",label:"gemeinsam"},{value:"owner",label:"nur Eigennutzung"},{value:"rental",label:"nur Mietwohnung"},{value:"review",label:"noch prüfen"}]})}${formField({name:"activeFrom",label:"Aktiv ab",type:"date",value:x?.activeFrom||""})}${formField({name:"activeTo",label:"Aktiv bis",type:"date",value:x?.activeTo||""})}<div class="full"><button class="primary">Speichern</button></div></form>`,()=>{$("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target)),obj=x||{id:uid()};Object.assign(obj,{type:v.type,volumeL:Number(v.volumeL)||0,assignment:v.assignment,activeFrom:v.activeFrom,activeTo:v.activeTo});if(!x)state.containers.push(obj);await persist(x?"Behälter geändert":"Behälter angelegt",`${obj.type} ${obj.volumeL} L`);$("modal").classList.add("hidden");infrastructureDataView()}})
}

function assessmentDataView(){
  const assessments=state.sources.filter(s=>s.kind==="assessment");
  viewBody("workspaceBody").innerHTML=`<div class="card"><button id="addAssessment" class="primary">Grundbesitzabgaben erfassen</button><p class="muted">Bescheid = Quelle. Einzelne Gebühren = zentrale Kostenpositionen.</p></div>${assessments.map(a=>{const ps=sourcePositions(state,a.id);return`<div class="item"><div class="row between"><div><h3>${esc(a.name)}</h3><p class="task-meta">${esc(a.serviceStart||"")} bis ${esc(a.serviceEnd||"")}</p><p>${ps.map(p=>`${esc(p.label)} ${euro(p.amount)}`).join(" · ")}</p></div><button class="secondary" data-assess="${a.id}">Bearbeiten</button></div></div>`}).join("")||"<div class='muted card'>Noch kein Bescheid erfasst.</div>"}`;
  $("addAssessment").onclick=()=>openAssessmentEditor();
  document.querySelectorAll("[data-assess]").forEach(b=>b.onclick=()=>openAssessmentEditor(assessments.find(x=>x.id===b.dataset.assess)))
}
function openAssessmentEditor(x=null){
  const existing=!!(x&&state.sources.some(s=>s.id===x.id)),src=existing?x:(x||{id:uid(),kind:"assessment"});
  const current=sourcePositions(state,src.id);
  const get=(label)=>current.find(p=>p.label===label)?.amount??"";
  const year=Number(src.year)||new Date().getFullYear(),start=src.serviceStart||`${year}-01-01`,end=src.serviceEnd||`${year}-12-31`;
  modal(existing?"Bescheid bearbeiten":"Grundbesitzabgaben erfassen",`<form id="f" class="form-grid">
    ${formField({name:"year",label:"Veranlagungsjahr",type:"number",value:year})}
    ${formField({name:"serviceStart",label:"Leistungszeitraum von",type:"date",value:start})}
    ${formField({name:"serviceEnd",label:"Leistungszeitraum bis",type:"date",value:end})}
    ${formField({name:"dueDates",label:"Fälligkeiten",value:Array.isArray(src.dueDates)?src.dueDates.join(", "):""})}
    ${formField({name:"street",label:"Winterdienst innerörtliche Straße €",type:"number",step:"0.01",value:get("Winterdienst innerörtliche Straße")})}
    ${formField({name:"rain",label:"Niederschlagswasser €",type:"number",step:"0.01",value:get("Niederschlagswasser")})}
    ${formField({name:"wasteEmpty",label:"Leerung 120 L Restmüll €",type:"number",step:"0.01",value:get("Leerung 120 L Restmüll")})}
    ${formField({name:"wasteBase",label:"Grundgebühr 120 L Restmüll €",type:"number",step:"0.01",value:get("Grundgebühr 120 L Restmüll")})}
    ${formField({name:"bio",label:"Gebühr 120 L Bioabfall €",type:"number",step:"0.01",value:get("Gebühr 120 L Bioabfall")})}
    ${formField({name:"sewage",label:"Schmutzwasser €",type:"number",step:"0.01",value:get("Schmutzwasser")})}
    ${formField({name:"waterBase",label:"Grundgebühr Wasser €",type:"number",step:"0.01",value:get("Grundgebühr Wasser")})}
    ${formField({name:"waterUse",label:"Wasserverbrauch €",type:"number",step:"0.01",value:get("Wasserverbrauch")})}
    ${formField({name:"propertyTax",label:"Grundsteuer B €",type:"number",step:"0.01",value:get("Grundsteuer B")})}
    <div class="full info">Jede Zeile wird als eigene Kostenposition gespeichert. Wasser/Kanal ist damit kein Sonderfeld mehr. Müllgebühren können später über „Zähler & Behälter“ einem konkreten Behälter bzw. Nutzer zugeordnet werden.</div>
    <div class="full"><button class="primary">Bescheid speichern</button></div>
  </form>`,()=>{
    $("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));if(v.serviceEnd<v.serviceStart)return alert("Leistungszeitraum prüfen.");
      const y=Number(v.year),due=String(v.dueDates||"").split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean);
      Object.assign(src,{kind:"assessment",year:y,serviceStart:v.serviceStart,serviceEnd:v.serviceEnd,dueDates:due,name:`Grundbesitzabgaben ${new Date(v.serviceStart+"T00:00:00").toLocaleDateString("de-DE")}–${new Date(v.serviceEnd+"T00:00:00").toLocaleDateString("de-DE")}`});
      if(!existing)state.sources.push(src);
      const rows=[
        ["Grundsteuer B","propertyTax",v.propertyTax,"house"],
        ["Winterdienst innerörtliche Straße","street",v.street,"house"],
        ["Niederschlagswasser","rainwater",v.rain,"house"],
        ["Leerung 120 L Restmüll","waste",v.wasteEmpty,"review"],
        ["Grundgebühr 120 L Restmüll","waste",v.wasteBase,"review"],
        ["Gebühr 120 L Bioabfall","waste",v.bio,"house"],
        ["Schmutzwasser","water",v.sewage,"house"],
        ["Grundgebühr Wasser","water",v.waterBase,"house"],
        ["Wasserverbrauch","water",v.waterUse,"house"]
      ].filter(r=>Number(r[2])>0).map(r=>positionDefaults({sourceId:src.id,documentId:src.sourceDocumentId||"",label:r[0],category:r[1],amount:Number(r[2]),serviceStart:v.serviceStart,serviceEnd:v.serviceEnd,assignment:r[3],agreement:"auto",origin:"assessment"}));
      replaceAssessmentPositions(state,src,rows);
      await persist(existing?"Bescheid geändert":"Bescheid angelegt",src.name);$("modal").classList.add("hidden");assessmentDataView()
    }
  })
}


let OCR_SCRIPT_PROMISE=null,PDFJS_PROMISE=null,JSPDF_PROMISE=null,DOC_DRAFT_PAGES=[],DOC_ANALYSIS_RUNNING=new Set();

function docPages(doc){
  if(Array.isArray(doc?.pages)&&doc.pages.length)return doc.pages;
  if(doc?.blob)return [{id:`legacy-${doc.id}`,name:doc.name||"Seite 1",type:doc.type||doc.blob.type,size:doc.size||doc.blob.size,blob:doc.blob}];
  return []
}
function docTotalSize(doc){return docPages(doc).reduce((s,p)=>s+Number(p.size||p.blob?.size||0),0)}
function docStatus(doc){
  const s=doc?.analysis?.status;
  if(s==="done")return {label:"analysiert",cls:"good"};
  if(s==="processing")return {label:"Analyse läuft",cls:"warn"};
  if(s==="error")return {label:"Analysefehler",cls:"bad"};
  return {label:"wartet auf Analyse",cls:"warn"}
}
function loadOCRLibrary(){
  if(window.Tesseract)return Promise.resolve(window.Tesseract);
  if(OCR_SCRIPT_PROMISE)return OCR_SCRIPT_PROMISE;
  OCR_SCRIPT_PROMISE=new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    s.async=true;
    s.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(new Error("OCR wurde geladen, ist aber nicht verfügbar."));
    s.onerror=()=>reject(new Error("OCR-Bibliothek konnte nicht geladen werden. Internetverbindung prüfen."));
    document.head.appendChild(s)
  });
  return OCR_SCRIPT_PROMISE
}
function loadPDFJS(){
  if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);
  if(PDFJS_PROMISE)return PDFJS_PROMISE;
  PDFJS_PROMISE=new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload=()=>window.pdfjsLib?resolve(window.pdfjsLib):reject(new Error("PDF.js wurde geladen, ist aber nicht verfügbar."));
    s.onerror=()=>reject(new Error("PDF-Analyse konnte nicht geladen werden. Internetverbindung prüfen."));
    document.head.appendChild(s)
  });
  return PDFJS_PROMISE
}
function loadJSPDF(){
  if(window.jspdf?.jsPDF)return Promise.resolve(window.jspdf.jsPDF);
  if(JSPDF_PROMISE)return JSPDF_PROMISE;
  JSPDF_PROMISE=new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload=()=>window.jspdf?.jsPDF?resolve(window.jspdf.jsPDF):reject(new Error("PDF-Erstellung konnte nicht geladen werden."));
    s.onerror=()=>reject(new Error("PDF-Erstellung konnte nicht geladen werden. Internetverbindung prüfen."));
    document.head.appendChild(s)
  });
  return JSPDF_PROMISE
}
function parseMoney(v){return Number(String(v||"").replace(/\./g,"").replace(",",".").replace(/[^\d.-]/g,""))||0}
function ocrAmount(lines,keys){
  const candidates=lines.filter(l=>keys.some(k=>l.toLowerCase().includes(k)));
  for(const l of candidates){
    const ms=[...l.matchAll(/(\d{1,6}(?:\.\d{3})*,\d{2})/g)].map(x=>x[1]);
    if(ms.length)return parseMoney(ms[ms.length-1])
  }
  return 0
}
function isoDateFromParts(d,m,y){
  let year=Number(y);if(year<100)year+=2000;
  const dt=new Date(year,Number(m)-1,Number(d));
  if(dt.getFullYear()!==year||dt.getMonth()!==Number(m)-1||dt.getDate()!==Number(d))return "";
  return `${year}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`
}
function extractServicePeriod(text){
  const clean=String(text||"").replace(/\s+/g," ");
  const dm='(\\d{1,2})[.\\/-](\\d{1,2})[.\\/-](\\d{2,4})';
  const preferred=[
    new RegExp(`(?:leistungszeitraum|abrechnungszeitraum|zeitraum|vom)\\D{{0,40}}${dm}\\D{{0,30}}(?:bis|[-–—])\\D{{0,10}}${dm}`,"i"),
    new RegExp(`${dm}\\s*(?:bis|[-–—])\\s*${dm}`,"i")
  ];
  for(const r of preferred){
    const m=clean.match(r);if(!m)continue;
    // Regex contains optional prefix only in first variant, date groups are always the last 6 capture groups.
    const nums=m.slice(-6);
    const start=isoDateFromParts(nums[0],nums[1],nums[2]),end=isoDateFromParts(nums[3],nums[4],nums[5]);
    if(start&&end&&end>=start)return {start,end}
  }
  return {start:"",end:""}
}
function extractDueDates(text){
  const lines=String(text||"").split(/\r?\n/).filter(l=>/fällig|fälligkeit|zahlung|abbuch/i.test(l));
  const out=[];
  for(const l of lines){
    for(const m of l.matchAll(/(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d{2}|\d{2})/g)){
      const d=isoDateFromParts(m[1],m[2],m[3]);if(d&&!out.includes(d))out.push(d)
    }
  }
  return out
}
function analyzeOCRText(text){
  const lines=String(text||"").split(/\r?\n/).map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean),low=String(text||"").toLowerCase();
  const period=extractServicePeriod(text),ym=(period.start||text).match(/\b(20\d{2})\b/);
  let kind="Sonstiges";
  if(/grundbesitz|grundsteuer|niederschlagswasser|straßenreinigung|strassenreinigung|grundbesitzabgaben/.test(low))kind="Grundbesitzabgaben";
  else if(/versicherung/.test(low))kind="Versicherung";
  else if(/schornstein|kehrgebühr|kehrgebuehr/.test(low))kind="Schornsteinfeger";
  else if(/wasser|kanal|abwasser/.test(low))kind="Wasser/Kanal";
  return {
    kind,year:ym?Number(ym[1]):new Date().getFullYear(),
    serviceStart:period.start,serviceEnd:period.end,dueDates:extractDueDates(text),
    tax:ocrAmount(lines,["grundsteuer b","grundsteuer"]),
    street:ocrAmount(lines,["straßenreinigung","strassenreinigung","winterdienst"]),
    rain:ocrAmount(lines,["niederschlagswasser"]),
    waterRef:ocrAmount(lines,["wasser / kanal","wasser/kanal","wasser kanal","festsetzungen wasser","wasser und kanal"]),
    bio:ocrAmount(lines,["biotonne","bio-tonne","bioabfall"]),
    rest:ocrAmount(lines,["restmüll","restmuell","restabfall"])
  }
}

function evidenceLine(lines,keys){
  return lines.find(l=>keys.some(k=>l.toLowerCase().includes(k)))||""
}
function extractPositionProposals(text,fields){
  const lines=String(text||"").split(/\r?\n/).map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean);
  const start=fields.serviceStart||`${fields.year}-01-01`,end=fields.serviceEnd||`${fields.year}-12-31`;
  const defs=[
    {label:"Grundsteuer B",category:"propertyTax",keys:["grundsteuer b"],assignment:"house"},
    {label:"Winterdienst innerörtliche Straße",category:"street",keys:["winterdienst innerörtl","winterdienst innerört","winterdienst"],assignment:"house"},
    {label:"Niederschlagswasser",category:"rainwater",keys:["niederschlagswasser"],assignment:"house"},
    {label:"Leerung 120 L Restmüll",category:"waste",keys:["leerung 120 l restmüll","leerung 120 l restmuell"],assignment:"review"},
    {label:"Grundgebühr 120 L Restmüll",category:"waste",keys:["grundgebühr 120 l restmüll","grundgebuehr 120 l restmuell"],assignment:"review"},
    {label:"Gebühr 120 L Bioabfall",category:"waste",keys:["gebühr 120 l bioabfall","gebuehr 120 l bioabfall"],assignment:"house"},
    {label:"Schmutzwasser",category:"water",keys:["schmutzwasser"],assignment:"house"},
    {label:"Grundgebühr Wasser",category:"water",keys:["grundgebühr q3+4","grundgebuehr q3+4","grundgebühr"],assignment:"house"},
    {label:"Wasserverbrauch",category:"water",keys:["wasserverbrauch"],assignment:"house"}
  ];
  const out=[];
  for(const d of defs){
    const ev=evidenceLine(lines,d.keys);if(!ev)continue;
    const matches=[...ev.matchAll(/(\d{1,6}(?:\.\d{3})*,\d{2})/g)].map(m=>m[1]);
    if(!matches.length)continue;
    const amount=parseMoney(matches[matches.length-1]);
    if(amount<=0)continue;
    out.push({id:uid(),label:d.label,category:d.category,amount,serviceStart:start,serviceEnd:end,assignment:d.assignment,agreement:"auto",confidence:0.92,evidence:ev,confirmed:false})
  }
  return out
}
function extractContainerProposals(text,fields){
  const low=String(text||"").toLowerCase(),out=[],from=fields.serviceStart||"";
  const add=(type,volume,pattern)=>{if(pattern.test(low))out.push({id:uid(),type,volumeL:volume,assignment:type==="Restmüll"?"review":"house",activeFrom:from,confidence:0.9})};
  add("Bioabfall",120,/bio\s*\(120\s*l\)|bioabfall|120\s*l\s*bio/);
  add("Restmüll",120,/rest\s*\(120\s*l\)|120\s*l\s*rest/);
  add("Papier",240,/papier\s*\(240\s*l\)|240\s*l\s*papier/);
  return out
}

async function createOCRWorker(progress){
  const T=await loadOCRLibrary();
  return T.createWorker("deu",1,{logger:m=>{
    if(progress&&m.status)progress(`${m.status}${m.progress!=null?" · "+Math.round(m.progress*100)+" %":""}`)
  }})
}
async function ocrImagePages(pages,progress){
  const worker=await createOCRWorker(progress),parts=[];
  try{
    for(let i=0;i<pages.length;i++){
      progress?.(`OCR Seite ${i+1}/${pages.length}`);
      const r=await worker.recognize(pages[i].blob);
      parts.push(r.data.text||"")
    }
    return parts.join("\n\n--- Seite ---\n\n")
  }finally{await worker.terminate()}
}
async function extractPDFTextAndImages(file,progress){
  const lib=await loadPDFJS();
  lib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const pdf=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise,parts=[],images=[],max=Math.min(pdf.numPages,12);
  for(let i=1;i<=max;i++){
    progress?.(`PDF Seite ${i}/${max}`);
    const page=await pdf.getPage(i),content=await page.getTextContent(),text=content.items.map(x=>x.str).join(" ").trim();
    parts.push(text);
    if(text.length<40){
      const viewport=page.getViewport({scale:1.6}),canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");
      canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      await page.render({canvasContext:ctx,viewport}).promise;
      const blob=await new Promise(res=>canvas.toBlob(res,"image/jpeg",0.9));
      if(blob)images.push({id:uid(),name:`PDF-Seite-${i}.jpg`,type:"image/jpeg",size:blob.size,blob})
    }
  }
  let text=parts.join("\n");
  if(images.length){
    progress?.("PDF enthält Scan-Seiten – OCR startet");
    const ocr=await ocrImagePages(images,progress);
    text += "\n\n"+ocr
  }
  return text
}
async function analyzeDocumentRecord(doc,progress){
  if(DOC_ANALYSIS_RUNNING.has(doc.id))return;
  DOC_ANALYSIS_RUNNING.add(doc.id);
  doc.analysis={...(doc.analysis||{}),status:"processing",startedAt:new Date().toISOString(),error:""};
  await updateDocument(doc);
  try{
    const pages=docPages(doc),texts=[],imagePages=[];
    for(let i=0;i<pages.length;i++){
      const p=pages[i],isPDF=p.type==="application/pdf"||String(p.name||"").toLowerCase().endsWith(".pdf");
      if(isPDF){
        progress?.(`PDF ${i+1}/${pages.length} wird gelesen`);
        texts.push(await extractPDFTextAndImages(p.blob,progress))
      }else imagePages.push(p)
    }
    if(imagePages.length)texts.push(await ocrImagePages(imagePages,progress));
    const text=texts.join("\n\n===== Dokumentseite =====\n\n"),fields=analyzeOCRText(text);
    fields.positionProposals=extractPositionProposals(text,fields);fields.containerProposals=extractContainerProposals(text,fields);
    fields.intelligence=extractDocumentIntelligence(text,fields);
    fields.positionProposals=enrichDocumentProposalsSmart(state,text,fields,fields.positionProposals);
    fields.smart=smartDocumentSummary(state,text,fields);
    if((fields.intelligence.dueDates||[]).length&&!fields.dueDates?.length)fields.dueDates=fields.intelligence.dueDates;
    fields.anomalies=validateDocumentTotals(fields);fields.confidence=documentConfidenceSummary(fields);
    doc.analysis={status:"done",finishedAt:new Date().toISOString(),text,fields,error:""};
    if(!doc.label||/^IMG_|^image|^photo/i.test(doc.label))doc.label=fields.kind!=="Sonstiges"?`${fields.kind} ${fields.serviceStart?new Date(fields.serviceStart+"T00:00:00").toLocaleDateString("de-DE"):fields.year}`:doc.label;
    await updateDocument(doc);
    return doc
  }catch(err){
    doc.analysis={...(doc.analysis||{}),status:"error",finishedAt:new Date().toISOString(),error:String(err?.message||err)};
    await updateDocument(doc);
    throw err
  }finally{DOC_ANALYSIS_RUNNING.delete(doc.id)}
}
async function analyzeDocumentById(id,progress){
  const docs=await listDocuments(),doc=docs.find(d=>d.id===id);if(!doc)return;
  return analyzeDocumentRecord(doc,progress)
}
async function autoAnalyzePendingDocuments(docs){
  for(const d of docs){
    if(!d.analysis||["queued"].includes(d.analysis.status)){
      try{
        await analyzeDocumentRecord(d);
        if(route==="data"&&sub.data==="documents")await documentsView(false)
      }catch{}
    }
  }
}
function draftPageRow(p,i){
  return `<div class="doc-page"><div><strong>Seite ${i+1}</strong><small>${esc(p.name)} · ${Math.round(p.size/1024)} KB</small></div><div><button class="secondary" data-up="${i}" ${i===0?"disabled":""}>↑</button><button class="secondary" data-down="${i}" ${i===DOC_DRAFT_PAGES.length-1?"disabled":""}>↓</button><button class="danger" data-remove-page="${i}">Entfernen</button></div></div>`
}
function renderDraftPages(){
  const host=$("draftPages");if(!host)return;
  host.innerHTML=DOC_DRAFT_PAGES.length?DOC_DRAFT_PAGES.map(draftPageRow).join(""):`<p class="muted">Noch keine Seiten ausgewählt.</p>`;
  const btn=$("saveDocumentBtn");if(btn)btn.disabled=!DOC_DRAFT_PAGES.length;
  document.querySelectorAll("[data-remove-page]").forEach(b=>b.onclick=()=>{DOC_DRAFT_PAGES.splice(Number(b.dataset.removePage),1);renderDraftPages()});
  document.querySelectorAll("[data-up]").forEach(b=>b.onclick=()=>{const i=Number(b.dataset.up);[DOC_DRAFT_PAGES[i-1],DOC_DRAFT_PAGES[i]]=[DOC_DRAFT_PAGES[i],DOC_DRAFT_PAGES[i-1]];renderDraftPages()});
  document.querySelectorAll("[data-down]").forEach(b=>b.onclick=()=>{const i=Number(b.dataset.down);[DOC_DRAFT_PAGES[i+1],DOC_DRAFT_PAGES[i]]=[DOC_DRAFT_PAGES[i],DOC_DRAFT_PAGES[i+1]];renderDraftPages()})
}
function appendDraftFiles(files){
  for(const f of Array.from(files||[]))DOC_DRAFT_PAGES.push({id:uid(),name:f.name||`Seite-${DOC_DRAFT_PAGES.length+1}`,type:f.type||"application/octet-stream",size:f.size,blob:f});
  renderDraftPages()
}
async function saveDraftDocument(){
  if(!DOC_DRAFT_PAGES.length)return;
  const label=$("newDocLabel").value.trim()||DOC_DRAFT_PAGES[0].name||"Dokument",fingerprint=await documentFingerprint(DOC_DRAFT_PAGES);
  const existing=await listDocuments(),duplicate=existing.find(d=>fingerprint&&d.fingerprint===fingerprint);
  if(duplicate&&!confirm(`Dieses Dokument scheint bereits als „${duplicate.label||duplicate.name}“ gespeichert zu sein. Trotzdem erneut speichern?`))return;
  const doc={id:uid(),name:label,label,type:DOC_DRAFT_PAGES.length>1?"application/x-mietverwaltung-document":DOC_DRAFT_PAGES[0].type,size:DOC_DRAFT_PAGES.reduce((sum,p)=>sum+p.size,0),created:new Date().toISOString(),sourceId:"",pages:DOC_DRAFT_PAGES.slice(),fingerprint,analysis:{status:"queued",createdAt:new Date().toISOString()}};
  await addDocument(doc);DOC_DRAFT_PAGES=[];await persist("Dokument gespeichert",`${label} · ${doc.pages.length} Seite(n)`);$("modal")?.classList.add("hidden");await documentsView(false);
  const progress=msg=>{const el=$("documentGlobalStatus");if(el)el.innerHTML=`<div class="info"><strong>Automatische Analyse:</strong> ${esc(msg)}</div>`};
  try{progress(`${label} wird analysiert …`);await analyzeDocumentById(doc.id,progress);progress(`${label} wurde analysiert.`)}catch(err){recordClientError("document-analysis",err);progress(`Analyse fehlgeschlagen: ${err.message||err}`)}
  if(route==="data"&&sub.data==="documents")await documentsView(false)
}
async function exportDocumentPDF(doc){
  const images=docPages(doc).filter(p=>p.type.startsWith("image/"));
  if(!images.length)return alert("Dieses Dokument enthält keine Bildseiten, die zusammengeführt werden können.");
  const JsPDF=await loadJSPDF(),pdf=new JsPDF({unit:"mm",format:"a4"}),pw=210,ph=297,margin=8;
  for(let i=0;i<images.length;i++){
    if(i>0)pdf.addPage();
    const url=URL.createObjectURL(images[i].blob);
    try{
      const img=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=url});
      const ratio=Math.min((pw-2*margin)/img.width,(ph-2*margin)/img.height),w=img.width*ratio,h=img.height*ratio;
      pdf.addImage(img,"JPEG",margin+(pw-2*margin-w)/2,margin,w,h,undefined,"FAST")
    }finally{URL.revokeObjectURL(url)}
  }
  pdf.save(`${(doc.label||"Dokument").replace(/[^\wäöüÄÖÜß -]/g,"_")}.pdf`)
}
function assessmentDraftFromDocument(doc){
  const f=doc?.analysis?.fields||{},smart=f.smart||{},family=f.intelligence?.documentFamily||"document",isAssessment=family==="municipal_assessment"||/grundbesitzabgaben/i.test(f.kind||"");
  return {id:uid(),kind:isAssessment?"assessment":"document",name:smart.sourceName||f.intelligence?.issuer||f.kind||"Dokument",year:Number(f.year)||new Date().getFullYear(),serviceStart:f.serviceStart||`${f.year||new Date().getFullYear()}-01-01`,serviceEnd:f.serviceEnd||`${f.year||new Date().getFullYear()}-12-31`,dueDates:f.dueDates||[],sourceDocumentId:doc.id,category:smart.category||"other",amount:Number(f.intelligence?.total||0),interval:"once",assignment:"house",agreement:"auto"}
}
async function acceptDocumentProposals(doc){
  const f=doc?.analysis?.fields||{},proposals=(f.positionProposals||[]);
  if(!proposals.length)return alert("Keine Kostenpositionen erkannt.");
  let src=state.sources.find(s=>s.sourceDocumentId===doc.id);
  if(!src&&f.smart?.sourceId)src=state.sources.find(s=>s.id===f.smart.sourceId);
  if(!src){src=assessmentDraftFromDocument(doc);if(!src.name||src.name==="Dokument")src.name=`${f.kind||"Dokument"} ${f.serviceStart?new Date(f.serviceStart+"T00:00:00").toLocaleDateString("de-DE"):f.year}`;state.sources.push(src)}
  if(!src.sourceDocumentId)src.sourceDocumentId=doc.id
  const accepted=[];
  document.querySelectorAll("[data-proposal]").forEach(el=>{
    if(!el.checked)return;const p=proposals.find(x=>x.id===el.dataset.proposal);if(!p)return;
    const assignment=document.querySelector(`[data-assignment="${p.id}"]`)?.value||p.assignment;
    accepted.push(positionDefaults({...p,sourceId:src.id,documentId:doc.id,assignment,confirmed:true,origin:"document",provenance:{origin:"document",documentId:doc.id,sourceId:src.id,evidence:p.evidence||"",confidence:p.confidence??null,confirmedAt:new Date().toISOString(),confirmedBy:"local-user"}}))
  });
  if(!accepted.length)return alert("Keine Position ausgewählt.");
  // Replace only document-origin positions from this document, preserving manual edits elsewhere.
  state.costPositions=state.costPositions.filter(p=>p.documentId!==doc.id||p.origin!=="document").concat(accepted);
  for(const c of f.containerProposals||[]){
    if(!state.containers.some(x=>x.type===c.type&&Number(x.volumeL)===Number(c.volumeL)&&x.activeFrom===c.activeFrom))state.containers.push({...c,id:c.id||uid(),sourceDocumentId:doc.id})
  }
  doc.sourceId=src.id;doc.analysis.acceptedAt=new Date().toISOString();await updateDocument(doc);
  await persist("Dokumentvorschläge bestätigt",`${doc.label||doc.name} · ${accepted.length} Kostenposition(en)`);
  $("modal").classList.add("hidden");sub.data="positions";dataWorkspace()
}
function openDocumentAnalysis(doc){
  const a=doc.analysis||{},f=a.fields||{},proposals=f.positionProposals||[];
  modal("Dokumentanalyse",`<div class="${a.status==="done"?"legal-ok":a.status==="error"?"legal-bad":"info"}"><strong>Status:</strong> ${esc(docStatus(doc).label)}${a.error?`<br>${esc(a.error)}`:""}</div>
    ${a.status==="done"?`<div class="card"><h3>${esc(f.kind||"Analyse")}</h3><p>Leistungszeitraum: <strong>${esc(f.serviceStart||"nicht erkannt")} bis ${esc(f.serviceEnd||"nicht erkannt")}</strong></p>${f.intelligence?`<p>Aussteller: <strong>${esc(f.intelligence.issuer||"nicht erkannt")}</strong>${f.intelligence.reference?` · Referenz ${esc(f.intelligence.reference)}`:""}${f.intelligence.total?` · Gesamt ${euro(f.intelligence.total)}`:""}</p><p>Dokumenttyp: ${esc(f.intelligence.documentFamily||"Dokument")} · mittlere OCR-Sicherheit ${Math.round(Number(f.confidence||0)*100)} %</p>`:""}${(f.anomalies||[]).map(x=>`<div class="${x.severity==="warn"?"legal-warn":"info"}">${esc(x.message)}</div>`).join("")}${f.smart?`<div class="smart-doc"><strong>Smart-Einschätzung:</strong> ${esc(category(f.smart.category).label)} · ${f.smart.categoryConfidence}%${f.smart.sourceName?`<br>Bekannte Quelle wahrscheinlich: ${esc(f.smart.sourceName)} · ${f.smart.sourceConfidence}%`:""}${(f.smart.warnings||[]).map(w=>`<br><span class="warning-text">${esc(w)}</span>`).join("")}</div>`:""}<p class="muted">Die Analyse erzeugt Vorschläge. Erst deine Bestätigung macht Positionen abrechnungswirksam.</p></div>
    ${proposals.length?`<div class="card"><h3>Erkannte Kostenpositionen</h3>${proposals.map(p=>`<div class="proposal-row"><label><input type="checkbox" data-proposal="${p.id}" checked> <strong>${esc(p.label)}</strong> · ${euro(p.amount)}</label><select data-assignment="${p.id}"><option value="house" ${p.assignment==="house"?"selected":""}>gesamtes Haus</option><option value="owner" ${p.assignment==="owner"?"selected":""}>nur Eigennutzung</option><option value="rental" ${p.assignment==="rental"?"selected":""}>nur Mietwohnung</option><option value="review" ${p.assignment==="review"?"selected":""}>noch prüfen</option></select><small>Erkennung ${(Number(p.confidence||0)*100).toFixed(0)} %${p.smartReason?` · ${esc(p.smartReason)}`:""} · ${esc(p.evidence||"")}</small></div>`).join("")}<button id="acceptProposals" class="primary">Ausgewählte Positionen bestätigen</button></div>`:`<div class="legal-warn">Keine einzelnen Kostenpositionen sicher erkannt.</div>`}
    <details><summary>Erkannten Text anzeigen</summary><textarea class="big-input" rows="14" readonly>${esc(a.text||"")}</textarea></details>`:""}
    ${a.status==="error"?`<button id="retryAnalysis" class="primary">Analyse erneut versuchen</button>`:""}`,()=>{
      if($("retryAnalysis"))$("retryAnalysis").onclick=async()=>{$("modal").classList.add("hidden");await analyzeDocumentById(doc.id,msg=>{});await documentsView(false)};
      if($("acceptProposals"))$("acceptProposals").onclick=()=>acceptDocumentProposals(doc)
    })
}
async function documentsView(autoQueue=true){
  const docs=await listDocuments();state.documentsCache=docs;
  if(autoQueue){
    const unanalysed=docs.filter(d=>!d.analysis||!d.analysis.status);
    for(const d of unanalysed){d.analysis={status:"queued",createdAt:new Date().toISOString()};await updateDocument(d)}
  }
  const groups=documentsByWorkflow(docs);
  const renderGroup=(key,title)=>`<section class="card"><div class="row between"><h3>${title}</h3><span class="pill">${groups[key].length}</span></div>${groups[key].map(d=>`<div class="item"><div class="row between"><div><strong>${esc(d.label||d.name)}</strong><p>${d.pages?.length||1} Seite(n) · ${humanBytes(d.size||0)} · ${esc(docStatus(d).label)}</p><small>Workflow: ${documentWorkflowLabel(d)}</small></div><div><button class="secondary" data-doc-analysis="${d.id}">Analyse</button><button class="secondary" data-doc-export="${d.id}">PDF</button></div></div></div>`).join("")||`<p class="muted">Keine Dokumente.</p>`}</section>`;
  viewBody("workspaceBody").innerHTML=`<div id="documentGlobalStatus"></div>
  <div class="card"><div class="row between"><div><h3>Dokumenten-Inbox</h3><p class="muted">Neu → Prüfen → Erledigt. Kein Dokument verschwindet ungeprüft in der Ablage.</p></div><button id="newDocument" class="primary">Dokument hinzufügen</button></div></div>
  ${renderGroup("new","Neu")}${renderGroup("review","Prüfen")}${renderGroup("done","Erledigt")}`;
  $("newDocument").onclick=()=>openDocumentCapture();
  document.querySelectorAll("[data-doc-analysis]").forEach(b=>b.onclick=()=>{const d=docs.find(x=>x.id===b.dataset.docAnalysis);if(d)openDocumentAnalysis(d)});
  document.querySelectorAll("[data-doc-export]").forEach(b=>b.onclick=()=>{const d=docs.find(x=>x.id===b.dataset.docExport);if(d)exportDocumentPDF(d)})
}
function rentalWorkspace(){
  const tabs=[
    {id:"overview",label:"Übersicht"},
    {id:"water",label:"Kaltwasser"},
    {id:"calculation",label:"Abrechnung"},
    {id:"workflow",label:"Status & Abschluss"}
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
  const y=currentPeriodYear(),a=billingAnalysis(state,y),p=billingProjection(state,y),rent=rentMonthStatus(state);
  $("workspaceBody").innerHTML=`<div class="grid cards">
    <article class="card"><span>Bestätigte Kosten Mieterin</span><strong>${euro(a.tenantCosts)}</strong></article>
    <article class="card"><span>Vorauszahlungen</span><strong>${euro(a.advances)}</strong></article>
    <article class="card"><span>Aktueller Rechenstand</span><strong>${euro(Math.abs(a.result))}</strong><small>${a.result>=0?"Nachzahlung":"Guthaben"}</small></article>
    <article class="card"><span>Prognose</span><strong>${euro(Math.abs(p.projectedResult))}</strong><small>${p.projectedResult>=0?"Nachzahlung":"Guthaben"} · ${p.confidence}%</small></article>
  </div>
  <div class="card"><h3>${periodLabel(y)}</h3><p>Reguläres Abrechnungsfristende: ${periodDeadline(y)}.</p>${p.missingCategories.length?`<p class="muted">Für die Prognose werden fehlende aktuelle Kategorien vorsichtig aus der Vorperiode ergänzt: ${p.missingCategories.map(x=>esc(categoryLabel(x.category))).join(", ")}.</p>`:""}</div>
  <div class="card"><h3>Mietzahlung ${esc(rent.key)}</h3><p>${rent.status==="none"?"Kein aktiver Mietvertrag.":`${euro(rent.paid)} von ${euro(rent.expected)} erkannt · ${esc(rentStatusLabel(rent))}.`}</p></div>
  <div class="card"><button id="toLeaseData" class="secondary">Mietvertragsdaten öffnen</button><button id="toSourceData" class="secondary">Kostenquellen öffnen</button><button id="toSmartRental" class="secondary">Assistent</button></div>`;
  $("toLeaseData").onclick=()=>{sub.data="lease";go("data")};$("toSourceData").onclick=()=>{sub.data="sources";go("data")};$("toSmartRental").onclick=()=>{sub.more="smart";go("more")}
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


function billingOverview(){
  const y=currentPeriodYear(),a=billingAnalysis(state,y);
  viewBody("billingBody").innerHTML=`<div class="grid cards"><article class="card"><span>Mieteranteil Kosten</span><strong>${euro(a.tenantCosts)}</strong></article><article class="card"><span>Vorauszahlungen</span><strong>${euro(a.advances)}</strong></article><article class="card"><span>Ergebnis</span><strong>${euro(Math.abs(a.result))}</strong><small>${a.result>=0?"Nachzahlung":"Guthaben"}</small></article><article class="card"><span>Ungeklärt</span><strong>${a.unresolved.length}</strong></article></div><div class="card"><h3>${periodLabel(y)}</h3><p>Abrechnungsfrist grundsätzlich bis ${periodDeadline(y)}.</p></div>`
}
function leaseView(){
  const l=state.leases[0];viewBody("billingBody").innerHTML=`<div class="card"><button id="editLease" class="primary">${l?"Mietvertrag bearbeiten":"Mietvertrag anlegen"}</button></div>${l?`<div class="item"><h3>Mietvertrag</h3><p>Beginn ${esc(l.start)} · Kaltmiete ${euro(l.rent)} · BK-Vorauszahlung ${euro(l.advance)}</p><p>${esc(l.note||"")}</p></div>`:""}`;$("editLease").onclick=()=>openLeaseEditor(l)
}
function openLeaseEditor(x=null){
  modal(x?"Mietvertrag bearbeiten":"Mietvertrag anlegen",`<form id="f" class="form-grid">${formField({name:"tenantName",label:"Mieter/in – Name",value:x?.tenantName||""})}${formField({name:"tenantAddress",label:"Korrespondenzadresse",value:x?.tenantAddress||"",full:true})}${formField({name:"start",label:"Beginn",type:"date",value:x?.start||"2026-09-01"})}${formField({name:"end",label:"Ende",type:"date",value:x?.end||""})}${formField({name:"rent",label:"Kaltmiete pro Monat (€)",type:"number",step:"0.01",value:x?.rent||400})}${formField({name:"advance",label:"Betriebskostenvorauszahlung pro Monat (€)",type:"number",step:"0.01",value:x?.advance||125})}${formField({name:"note",label:"Notiz",value:x?.note||"",full:true})}<div class="full"><button class="primary">Speichern</button></div></form>`,()=>{$("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target)),obj=x||{id:uid()};Object.assign(obj,{tenantName:v.tenantName.trim(),tenantAddress:v.tenantAddress.trim(),start:v.start,end:v.end,rent:Number(v.rent)||0,advance:Number(v.advance)||0,note:v.note.trim()});if(!x)state.leases.push(obj);await persist(x?"Mietvertrag geändert":"Mietvertrag angelegt","Mietvertrag");$("modal").classList.add("hidden");route==="data"?leaseDataView():leaseView()}})
}
function waterView(){
  const y=currentPeriodYear(),sett=settlementByPeriod(state,y),cons=settlementConsumption(state,sett),waterCosts=(state.costPositions||[]).filter(p=>p.confirmed&&p.category==="water"&&positionToEvents(p,y).length),{main,owner}=ensureDefaultMeters(state);
  viewBody("billingBody").innerHTML=`<div class="card"><div class="row between"><div><button id="editWater" class="primary">${sett?"Abrechnungsperiode bearbeiten":"Abrechnungsperiode erfassen"}</button><button id="openMeters" class="secondary">Zählerstammdaten</button></div><div><button id="photoMain" class="secondary">📷 Hauptzähler</button><button id="photoOwner" class="secondary">📷 Zwischenzähler</button></div></div></div>
  ${cons?`<div class="${cons.valid?"legal-ok":"legal-bad"}"><strong>${periodLabel(y)}</strong><br>Hausverbrauch ${cons.house.toFixed(3)} m³ · Eigennutzung ${cons.owner.toFixed(3)} m³ · Mietwohnung ${cons.tenant.toFixed(3)} m³ · Anteil ${percent(cons.share)}</div>`:`<div class="legal-warn">Für diese Periode fehlen vollständige Zählerstände. Fotoaufnahmen werden als historische Ablesungen gespeichert; die Abrechnungsperiode wählt anschließend die passenden Anfangs- und Endstände aus.</div>`}
  <div class="card"><h3>Letzte Ablesungen</h3><p>${esc(main.name)}: <strong>${latestMeterReading(main)?`${latestMeterReading(main).value} ${esc(main.unit||"")} · ${esc(latestMeterReading(main).date)}`:"noch keine"}</strong></p><p>${esc(owner.name)}: <strong>${latestMeterReading(owner)?`${latestMeterReading(owner).value} ${esc(owner.unit||"")} · ${esc(latestMeterReading(owner).date)}`:"noch keine"}</strong></p></div>
  <div class="card"><h3>Wasser-/Kanalkosten</h3>${waterCosts.map(p=>`<p>${esc(p.label)}: <strong>${euro(p.amount)}</strong></p>`).join("")||"<p class='muted'>Keine bestätigten Wasser-/Kanalkosten für diese Periode.</p>"}<p class="muted">Kosten und Verbrauch sind getrennt gespeichert. Die Abrechnung verbindet beides erst bei der Umlage.</p></div>`;
  $("editWater").onclick=()=>openWaterEditor(sett);$("openMeters").onclick=()=>{sub.data="infrastructure";go("data")};
  $("photoMain").onclick=()=>openMeterPhotoCapture(main.id,"camera");$("photoOwner").onclick=()=>openMeterPhotoCapture(owner.id,"camera")
}
function openWaterEditor(x=null){
  const y=Number(x?.periodYear)||currentPeriodYear(),{main,owner}=ensureDefaultMeters(state);
  const old=settlementConsumption(state,x);
  const mainStart=x?readingById(main,x.mainStartReadingId):null,mainEnd=x?readingById(main,x.mainEndReadingId):null,ownerStart=x?readingById(owner,x.ownerStartReadingId):null,ownerEnd=x?readingById(owner,x.ownerEndReadingId):null;
  modal(x?"Wasserperiode bearbeiten":"Wasserperiode erfassen",`<form id="f" class="form-grid">
    ${formField({name:"periodYear",label:"Abrechnungsjahr (Beginn)",type:"number",value:y})}
    ${formField({name:"mainStartDate",label:"Hauptzähler Anfang Datum",type:"date",value:mainStart?.date||periodStart(y)})}
    ${formField({name:"mainStart",label:"Hauptzähler Anfang",type:"number",step:"0.001",value:mainStart?.value??""})}
    ${formField({name:"mainEndDate",label:"Hauptzähler Ende Datum",type:"date",value:mainEnd?.date||periodEnd(y)})}
    ${formField({name:"mainEnd",label:"Hauptzähler Ende",type:"number",step:"0.001",value:mainEnd?.value??""})}
    ${formField({name:"ownerStartDate",label:"Eigener Zwischenzähler Anfang Datum",type:"date",value:ownerStart?.date||periodStart(y)})}
    ${formField({name:"ownerStart",label:"Eigener Zwischenzähler Anfang",type:"number",step:"0.001",value:ownerStart?.value??""})}
    ${formField({name:"ownerEndDate",label:"Eigener Zwischenzähler Ende Datum",type:"date",value:ownerEnd?.date||periodEnd(y)})}
    ${formField({name:"ownerEnd",label:"Eigener Zwischenzähler Ende",type:"number",step:"0.001",value:ownerEnd?.value??""})}
    <div class="full" id="waterCalc"></div><div class="full"><button class="primary">Speichern</button></div>
  </form>`,()=>{
    const calc=()=>{const v=Object.fromEntries(new FormData($("f"))),house=Number(v.mainEnd)-Number(v.mainStart),own=Number(v.ownerEnd)-Number(v.ownerStart),tenant=house-own;$("waterCalc").innerHTML=house>=0&&own>=0&&tenant>=0?`<div class="info">Haus ${house.toFixed(3)} m³ − Eigennutzung ${own.toFixed(3)} m³ = Mietwohnung <strong>${tenant.toFixed(3)} m³</strong> (${house>0?percent(tenant/house):"–"})</div>`:`<div class="legal-bad">Zählerstände ergeben einen negativen Verbrauch. Bitte prüfen.</div>`};$("f").oninput=calc;calc();
    $("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target)),house=Number(v.mainEnd)-Number(v.mainStart),own=Number(v.ownerEnd)-Number(v.ownerStart);if(house<0||own<0||house-own<0)return alert("Zählerstände prüfen.");
      const ms=addMeterReading(main,v.mainStartDate,Number(v.mainStart),"manual"),me=addMeterReading(main,v.mainEndDate,Number(v.mainEnd),"manual"),os=addMeterReading(owner,v.ownerStartDate,Number(v.ownerStart),"manual"),oe=addMeterReading(owner,v.ownerEndDate,Number(v.ownerEnd),"manual");
      const obj=x||{id:uid()};Object.assign(obj,{periodYear:Number(v.periodYear),mainMeterId:main.id,ownerMeterId:owner.id,mainStartReadingId:ms.id,mainEndReadingId:me.id,ownerStartReadingId:os.id,ownerEndReadingId:oe.id});if(!x)state.waterSettlements.push(obj);await persist(x?"Wasserperiode geändert":"Wasserperiode angelegt",periodLabel(obj.periodYear));$("modal").classList.add("hidden");waterView()
    }
  })
}
function calculationView(){
  const y=currentPeriodYear(),closure=billingClosureChecklist(state,y),a=closure.analysis,snap=(state.billingSnapshots||[]).find(s=>Number(s.periodYear)===Number(y));
  viewBody("billingBody").innerHTML=`<div class="card"><div class="row between"><div><h3>Abrechnung ${periodLabel(y)}</h3><p class="muted">Geführter Abschluss mit Pflichtprüfungen. Erst wenn alle Schritte grün sind, kann die Abrechnung eingefroren werden.</p></div><span class="pill ${closure.ok?"good":"warn"}">${closure.ok?"abschlussbereit":"noch offen"}</span></div></div>
  <div class="card"><h3>Abschlussprüfung</h3>${closure.points.map((p,i)=>`<div class="closure-step ${p.ok?"done":"open"}"><span>${p.ok?"✓":"!"}</span><div><strong>${i+1}. ${esc(p.label)}</strong></div></div>`).join("")}</div>
  <div class="grid cards"><article class="card"><span>Umlagefähige Kosten</span><strong>${euro(a.tenantCosts)}</strong></article><article class="card"><span>Vorauszahlungen</span><strong>${euro(a.advances)}</strong></article><article class="card"><span>Ergebnis</span><strong>${euro(a.result)}</strong></article></div>
  <div class="card"><h3>Abrechnungspositionen</h3><div class="tablewrap"><table class="costtable"><thead><tr><th>Position</th><th>Gesamt</th><th>Regel</th><th>Mieter</th><th>Herkunft</th></tr></thead><tbody>${a.events.map(e=>{const p=positionById(state,e.positionId);return`<tr><td>${esc(e.label)}</td><td>${euro(e.amount)}</td><td>${esc(e.decision.rule)}</td><td>${euro(e.tenantAmount)}</td><td><button class="linkbutton" data-bill-trace="${e.positionId}">${esc(provenanceLabel(p))}</button></td></tr>`}).join("")}</tbody></table></div></div>
  ${snap?`<div class="legal-ok"><strong>Abrechnung eingefroren</strong><br>${esc(snapshotVerification(snap).label)}</div><div class="card"><button id="downloadBillingPDF" class="primary">Professionelle PDF erstellen</button><button id="printBillingBtn" class="secondary">Druckansicht</button></div>`:`<div class="card"><button id="freezeBilling" class="primary" ${closure.ok?"":"disabled"}>Abrechnung final prüfen & einfrieren</button>${closure.ok?"":"<p class='muted'>Der Abschluss wird freigeschaltet, sobald alle Prüfpunkte erfüllt sind.</p>"}</div>`}`;
  document.querySelectorAll("[data-bill-trace]").forEach(b=>b.onclick=()=>openPositionTrace(positionById(state,b.dataset.billTrace)));
  if($("freezeBilling"))$("freezeBilling").onclick=()=>openBillingFinalReview(y);
  if($("downloadBillingPDF"))$("downloadBillingPDF").onclick=async()=>{try{const pdf=await generateProfessionalBillingPDF(state,y,snap);pdf.save(`Betriebskostenabrechnung_${y}-${y+1}.pdf`)}catch(e){recordClientError("billing-pdf",e);alert(e.message||e)}};
  if($("printBillingBtn"))$("printBillingBtn").onclick=()=>printBilling(snap||a,y,snap)
}
function openBillingFinalReview(y){
  const closure=billingClosureChecklist(state,y);if(!closure.ok)return alert("Die Abrechnung ist noch nicht vollständig.");
  const a=closure.analysis;
  modal("Abrechnung finalisieren",`<div class="legal-warn"><strong>Letzte Prüfung</strong><br>Nach dem Einfrieren wird ein revisionssicherer Snapshot mit Prüfsumme erstellt. Änderungen an Stammdaten wirken nicht rückwirkend auf diesen Snapshot.</div>
  <div class="card"><p>Umlagefähige Kosten: <strong>${euro(a.tenantCosts)}</strong></p><p>Vorauszahlungen: <strong>${euro(a.advances)}</strong></p><p>Ergebnis: <strong>${euro(a.result)}</strong></p></div>
  <label class="confirm-row"><input id="billingConfirm" type="checkbox"> Ich habe Zeitraum, Belege, Umlageschlüssel und Vorauszahlungen geprüft.</label>
  <button id="billingFinalize" class="primary" disabled>Abrechnung einfrieren</button>`,()=>{
    $("billingConfirm").onchange=e=>$("billingFinalize").disabled=!e.target.checked;
    $("billingFinalize").onclick=async()=>{
      const result=await executeCommand("billing.freeze",{periodYear:y},async()=>{
        const snap=createBillingSnapshot(state,y);await finalizeSnapshotIntegrity(snap);state.billingSnapshots.push(snap);return snap
      },{auditText:"Abrechnung eingefroren",restorePoint:true});
      if(!result.ok)return alert(result.message);
      $("modal").classList.add("hidden");calculationView()
    }
  })
}
function printBilling(a,y,snapshot=null){
  const w=window.open("","_blank");if(!w)return alert("Druckfenster blockiert.");
  const lease=snapshot?.lease||state.leases?.[0],recipient=billingRecipient(lease),sender=state.correspondence||{},property=snapshot?.property||state.property;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Betriebskostenabrechnung ${periodLabel(y)}</title><style>@page{size:A4;margin:18mm}body{font-family:Arial,sans-serif;color:#111;line-height:1.35}.sender{font-size:12px}.recipient{margin:28px 0 32px}.meta{font-size:12px;color:#444}table{width:100%;border-collapse:collapse;margin-top:18px;font-size:12px}th,td{padding:7px;border-bottom:1px solid #ddd;text-align:left}td.num,th.num{text-align:right}.result{margin-top:20px;padding:14px;border:2px solid #222}.foot{margin-top:35px;font-size:10px;color:#555}</style></head><body>
  <div class="sender"><strong>${esc(sender.landlordName||"Vermieter")}</strong><br>${esc(sender.landlordAddress||property.address||"").replace(/\n/g,"<br>")}</div>
  <div class="recipient"><strong>${esc(recipient.name||"Mieter/in")}</strong><br>${esc(recipient.address||property.address||"").replace(/\n/g,"<br>")}</div>
  <h1>Betriebskostenabrechnung</h1><p class="meta">Abrechnungszeitraum: ${periodLabel(y)}<br>Mietobjekt: ${esc(property.name||property.address||"")}</p>
  <table><thead><tr><th>Kostenart</th><th class="num">Gesamt</th><th>Verteilung</th><th class="num">Ihr Anteil</th></tr></thead><tbody>${(a.events||[]).map(e=>`<tr><td>${esc(e.label)}</td><td class="num">${euro(e.amount)}</td><td>${esc(formatRuleForReport(e))}</td><td class="num">${euro(e.tenantAmount)}</td></tr>`).join("")}</tbody></table>
  <div class="result"><strong>Anteilige Betriebskosten:</strong> ${euro(a.tenantCosts)}<br><strong>Vorauszahlungen:</strong> ${euro(a.advances)}<br><br><strong>${a.result>=0?"Nachzahlung":"Guthaben"}: ${euro(Math.abs(a.result))}</strong></div>
  <p>Die Kostenpositionen und verwendeten Verteilungsmaßstäbe sind einzeln ausgewiesen. Die hinterlegten Belege und Herkunftsnachweise können in der App nachvollzogen werden.</p>
  <p>Mit freundlichen Grüßen<br><br>${esc(sender.landlordName||"Vermieter")}</p>
  <div class="foot">Erstellt am ${new Date().toLocaleDateString("de-DE")}${snapshot?.integrityHash?` · Prüfsumme ${esc(String(snapshot.integrityHash).slice(0,20))}…`:""}</div>
  </body></html>`);w.document.close();setTimeout(()=>w.print(),250)
}
function workflowView(){
  const y=currentPeriodYear(),a=billingAnalysis(state,y),readiness=billingReadiness(state,y),ready=readiness.every(c=>c.ok);
  let wf=state.billingWorkflows.find(x=>x.periodYear===y);if(!wf){wf={id:uid(),periodYear:y,status:"draft"};state.billingWorkflows.push(wf);saveState(state)}
  viewBody("billingBody").innerHTML=`<div class="card"><h3>${periodLabel(y)}</h3><p>Status: <strong>${wf.status==="draft"?"Entwurf":wf.status==="checked"?"Geprüft":"Abgeschlossen"}</strong></p>${ready?`<p class="legal-ok">✓ App-Prüfung vollständig.</p>`:`<div class="legal-warn"><strong>Es fehlen:</strong>${readiness.filter(c=>!c.ok).map(c=>`<p>⚠ ${esc(c.label)}</p>`).join("")}</div>`}${wf.status==="draft"?`<button id="wfCheck" class="primary" ${ready?"":"disabled"}>Als geprüft markieren</button>`:""}${wf.status==="checked"?`<button id="wfFinal" class="primary">Abschließen</button>`:""}${wf.status==="final"?`<p class="legal-ok">✓ Abrechnung abgeschlossen.</p>`:""}</div>`;
  if($("wfCheck"))$("wfCheck").onclick=async()=>{wf.status="checked";await persist("Abrechnung geprüft",periodLabel(y));workflowView()};if($("wfFinal"))$("wfFinal").onclick=async()=>{if(!snapshotFor(state,y)){const snap=createBillingSnapshot(state,y);if(snap.unresolved.length)return alert("Abrechnung enthält ungeklärte Positionen.");await finalizeSnapshotIntegrity(snap);state.billingSnapshots.push(snap)}wf.status="final";await persist("Abrechnung abgeschlossen und eingefroren",periodLabel(y));workflowView()}
}


function ownerWorkspace(){
  const tabs=[
    {id:"overview",label:"Übersicht"},
    {id:"finance",label:"Finanzen"},
    {id:"cashflow",label:"Zahlungen"},
    {id:"analytics",label:"Auswertung"},
    {id:"reconciliation",label:"Zahlungen zuordnen"},
    {id:"tasks",label:"Erinnerungen"}
  ];
  const active=sub.owner||"overview";
  $("app").innerHTML=workspaceHeader("EIGENER BEREICH","Eigener Bereich","Private Hauskosten, Finanzierung und eigene Pflichten – klar getrennt von der Vermietung.",tabs,active);
  bindWorkspaceTabs("owner",ownerWorkspace);
  if(active==="overview")ownerOverview();
  else if(active==="finance")ownerFinanceView();
  else if(active==="cashflow")ownerCashflowView();
  else if(active==="analytics")ownerAnalyticsView();
  else if(active==="reconciliation")reconciliationView();
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
function ownerAnalyticsView(){analyticsView()}
function ownerTasksView(){
  tasksView()
}


function smartCenterView(){
  const insights=smartInsights(state),rent=rentMonitor(state,8),proj=billingProjection(state),adv=advanceAdjustmentSuggestion(state),matches=smartPaymentPlan(state),taskSuggestions=smartTaskSuggestions(state),anomalies=smartDataAnomalies(state);
  viewBody("workspaceBody").innerHTML=`<div class="smart-hero card">
    <div><p class="eyebrow">SMART-ASSISTENT</p><h3>Was braucht deine Aufmerksamkeit?</h3><p class="muted">Die Auswertung läuft lokal auf deinem Gerät. Empfehlungen sind nachvollziehbar und ändern Abrechnungsdaten nie ohne deine Bestätigung.</p></div><div class="smart-score">${dataQualityScore(state)}%</div>
  </div>
  <div class="card"><form id="smartAskForm" class="smart-ask"><input id="smartQuestion" class="big-input" placeholder="z. B. Wie sieht die Abrechnung aus?"><button class="primary">Fragen</button></form><div class="smart-chips"><button type="button" data-smart-q="Ist die Miete eingegangen?">Miete</button><button type="button" data-smart-q="Wie sieht die Abrechnung aus?">Abrechnung</button><button type="button" data-smart-q="Wie ist der Wasserverbrauch?">Wasser</button><button type="button" data-smart-q="Was ist gerade wichtig?">Status</button></div><div id="smartAnswer"></div></div>
  <div class="card"><div class="row between"><div><h3>Prioritäten</h3><p class="muted">${insights.length?`${insights.length} Hinweise nach Dringlichkeit und Sicherheit sortiert.`:"Keine offenen Hinweise."}</p></div>${taskSuggestions.length?`<button id="smartTasks" class="secondary">${taskSuggestions.length} Erinnerungen vorschlagen</button>`:""}</div>
    ${insights.slice(0,9).map((x,i)=>`<button class="smart-insight smart-${x.severity}" data-smart-insight="${i}"><span><strong>${esc(x.title)}</strong><small>${esc(x.detail||"")}</small><em>${esc(x.why||"")} · ${Math.round(Number(x.confidence||0))}% Sicherheit</em></span><b>Öffnen</b></button>`).join("")||`<div class="legal-ok">✓ Aktuell erkennt die App keine offenen Smart-Prioritäten.</div>`}
  </div>
  <div class="grid cards"><article class="card"><span>Abrechnungsprognose</span><strong>${euro(Math.abs(proj.projectedResult))}</strong><small>${proj.projectedResult>=0?"voraussichtliche Nachzahlung":"voraussichtliches Guthaben"} · ${proj.confidence}%</small></article><article class="card"><span>Mietzahlung ${rent[0]?.key||""}</span><strong>${rent[0]?euro(rent[0].paid):"–"}</strong><small>${rent[0]?rentStatusLabel(rent[0]):"kein Status"}</small></article></div>
  <div class="card"><h3>Mietzahlungs-Monitor</h3><div class="tablewrap"><table class="costtable"><thead><tr><th>Monat</th><th>Soll</th><th>Erkannt</th><th>Status</th></tr></thead><tbody>${rent.map(r=>`<tr><td>${esc(r.key)}</td><td>${r.status==="none"?"–":euro(r.expected)}</td><td>${euro(r.paid)}</td><td class="${r.status==="paid"?"positive":r.status==="missing"?"negative":""}">${esc(rentStatusLabel(r))}</td></tr>`).join("")}</tbody></table></div><small>Der Monitor erkennt Zahlungseingänge; er entscheidet nicht automatisch, ob rechtlich Zahlungsverzug vorliegt.</small></div>
  ${adv?`<div class="card"><h3>Vorauszahlungs-Check</h3><p>Aktuell <strong>${euro(adv.current)}</strong> / Monat · rechnerischer Richtwert aus der letzten abgeschlossenen Abrechnung <strong>${euro(adv.recommended)}</strong> / Monat.</p><small>${esc(adv.basis)}</small></div>`:""}
  ${matches.length?`<div class="card"><h3>Starke Zahlungszuordnungen</h3>${matches.slice(0,5).map((x,i)=>{const s=x.suggestions[0];return`<div class="item"><strong>${esc(x.payment.label)} · ${euro(x.payment.amount)}</strong><p>→ ${esc(s.target.label||s.target.name)} · ${s.score}%</p><small>${esc(s.reasons.join(" · "))}</small><p><button class="secondary" data-smart-match="${i}">Zuordnen</button></p></div>`}).join("")}</div>`:""}
  ${anomalies.length?`<div class="card"><h3>Plausibilitätsprüfungen</h3>${anomalies.map(a=>`<div class="legal-warn"><strong>${esc(a.title)}</strong><br>${esc(a.detail)}</div>`).join("")}</div>`:""}`;
  const ask=q=>{const a=smartAnswer(state,q),host=$("smartAnswer");host.innerHTML=`<div class="smart-answer"><strong>${esc(a.title)}</strong><p>${esc(a.answer)}</p><button id="smartAnswerOpen" class="secondary">Passenden Bereich öffnen</button></div>`;$("smartAnswerOpen").onclick=()=>{if(a.route==="home")go("home");else{if(a.sub)sub[a.route]=a.sub;go(a.route)}}};
  $("smartAskForm").onsubmit=e=>{e.preventDefault();ask($("smartQuestion").value)};
  document.querySelectorAll("[data-smart-q]").forEach(b=>b.onclick=()=>{$("smartQuestion").value=b.dataset.smartQ;ask(b.dataset.smartQ)});
  document.querySelectorAll("[data-smart-insight]").forEach(b=>b.onclick=()=>{const x=insights[Number(b.dataset.smartInsight)];if(!x)return;if(x.sub)sub[x.route]=x.sub;go(x.route)});
  document.querySelectorAll("[data-smart-match]").forEach(b=>b.onclick=async()=>{const x=matches[Number(b.dataset.smartMatch)],s=x?.suggestions?.[0];if(!x||!s)return;if(!confirm(`„${x.payment.label}“ mit „${s.target.label||s.target.name}“ verknüpfen?`))return;const r=await executeCommand("smart.payment.match",{paymentId:x.payment.id,type:s.type,targetId:s.target.id,score:s.score},async()=>{if(s.type==="position"){x.payment.positionId=s.target.id;x.payment.sourceId=s.target.sourceId||""}else x.payment.sourceId=s.target.id},{auditText:"Smart-Zahlungszuordnung"});if(!r.ok)return alert(r.message);smartCenterView()});
  if($("smartTasks"))$("smartTasks").onclick=()=>openSmartTaskSuggestions(taskSuggestions)
}
function openSmartTaskSuggestions(items=smartTaskSuggestions(state)){
  modal("Erinnerungsvorschläge",items.length?`<div class="card"><p>Diese Vorschläge werden aus Fälligkeiten, Ablesungen und Sicherungsstatus abgeleitet.</p></div>${items.map((t,i)=>`<label class="import-row"><input type="checkbox" data-smart-task="${i}" checked><span><strong>${esc(t.title)}</strong><br>${esc(t.due)} · ${esc(t.reason)}</span></label>`).join("")}<button id="acceptSmartTasks" class="primary">Ausgewählte Erinnerungen anlegen</button>`:`<div class="legal-ok">Keine neuen Erinnerungsvorschläge.</div>`,()=>{
    if($("acceptSmartTasks"))$("acceptSmartTasks").onclick=async()=>{const selected=[...document.querySelectorAll("[data-smart-task]:checked")].map(x=>items[Number(x.dataset.smartTask)]).filter(Boolean);if(!selected.length)return;for(const t of selected)state.tasks.push({id:uid(),title:t.title,due:t.due,lead:t.lead||14,origin:"smart"});await persist("Smart-Erinnerungen angelegt",`${selected.length} Vorschlag/Vorschläge`);$("modal").classList.add("hidden");smartCenterView()}
  })
}

function more(){
  const tabs=[
    {id:"overview",label:"Übersicht"},
    {id:"smart",label:"Assistent"},
    {id:"audit",label:"Änderungen"},
    {id:"legal",label:"Rechtsstand"},
    {id:"security",label:"Sicherheit"},
    {id:"diagnostics",label:"App-Prüfung"},
    {id:"recovery",label:"Sicherungspunkte"},
    {id:"backup",label:"Datensicherung"}
  ];
  const active=sub.more||"overview";
  $("app").innerHTML=workspaceHeader("MEHR","Assistent, Einstellungen & Sicherheit","Smart-Auswertung, Rechtsstand, Schutz und Datensicherung.",tabs,active);
  bindWorkspaceTabs("more",more);
  if(active==="smart")smartCenterView();
  else if(active==="audit")auditMoreView();
  else if(active==="legal")legalMoreView();
  else if(active==="security")securityMoreView();
  else if(active==="diagnostics")diagnosticsMoreView();
  else if(active==="recovery")recoveryView();
  else if(active==="backup")backupMoreView();
  else moreOverview()
}

function auditMoreView(){auditView()}
function legalMoreView(){legalView()}
function securityMoreView(){securityView()}
function diagnosticsMoreView(){diagnosticsView()}
function backupMoreView(){backupView()}

function moreOverview(){
  const lastBackup=state.meta?.lastBackupAt?new Date(state.meta.lastBackupAt).toLocaleDateString("de-DE"):"noch keine Datensicherung",smart=smartInsights(state);
  $("workspaceBody").innerHTML=`<div class="card"><div class="row between"><div><h3>Assistent</h3><p>${smart.length?`${smart.length} aktuelle Hinweise erkannt.`:"Keine offenen Hinweise erkannt."}</p></div><button id="openSmartMore" class="primary">Öffnen</button></div></div><div class="card"><h3>Datenschutz</h3><p>Stammdaten und Dokumente werden auf diesem Gerät gespeichert. Der Smart-Assistent wertet diese Daten lokal aus und benötigt keinen externen KI-Schlüssel.</p></div><div class="card"><h3>Datensicherung</h3><p>Letzte verschlüsselte Datensicherung: <strong>${esc(lastBackup)}</strong></p></div><div class="card"><h3>App-Prüfung</h3><p>Unter „App-Prüfung“ kannst du Datenbestand, Speicher und interne Prüfungen kontrollieren.</p></div>`;
  $("openSmartMore").onclick=()=>{sub.more="smart";more()}
}
function financeView(){
  const f=intelligentForecast(state,12),sum=f.reduce((s,x)=>s+x.net,0),signals=forecastSignals(state);
  $("workspaceBody").innerHTML=`<form id="financeForm" class="card form-grid">${formField({name:"repayment",label:"Hausrate pro Monat (€)",type:"number",step:"0.01",value:state.finance.repayment})}${formField({name:"fixed",label:"Weitere feste Hauskosten pro Monat (€)",type:"number",step:"0.01",value:state.finance.fixed})}<div class="full"><button class="primary">Speichern</button></div></form>
  <div class="grid cards"><article class="card"><span>12M-Prognose</span><strong class="${sum<0?"negative":"positive"}">${euro(sum)}</strong></article><article class="card"><span>Ø Monatsbelastung</span><strong>${euro(f.reduce((s,r)=>s+r.outflow,0)/Math.max(1,f.length))}</strong></article></div>
  ${signals.map(s=>`<div class="${s.severity==="warn"?"legal-warn":"legal-ok"}">${esc(s.text)}</div>`).join("")}
  <div class="card"><h3>12-Monats-Prognose</h3><p class="muted">Berücksichtigt Mietzahlungen, Hausrate, feste Hauskosten und bestätigte Kostenpositionen anhand ihres tatsächlichen Leistungszeitraums.</p><div class="tablewrap"><table class="costtable"><thead><tr><th>Monat</th><th>Einnahmen</th><th>Geplante Ausgaben</th><th>Saldo</th></tr></thead><tbody>${f.map(r=>`<tr><td>${r.label}</td><td>${euro(r.income)}</td><td>${euro(r.outflow)}</td><td class="${r.net<0?"negative":"positive"}">${euro(r.net)}</td></tr>`).join("")}</tbody></table></div></div>`;
  $("financeForm").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));const result=await executeCommand("finance.update",{repayment:Number(v.repayment)||0,fixed:Number(v.fixed)||0},async()=>{state.finance={repayment:Number(v.repayment)||0,fixed:Number(v.fixed)||0}},{auditText:"Finanzen geändert"});if(!result.ok)return alert(result.message);financeView()}
}

function cashflowView(){
  const rows=actualCashflowByMonth(state,12),sumIn=rows.reduce((s,r)=>s+r.income,0),sumOut=rows.reduce((s,r)=>s+r.outflow,0),rentHits=(state.payments||[]).filter(p=>detectRentPayment(state,p)?.score>=80);
  viewBody("workspaceBody").innerHTML=`<div class="card"><div class="row between"><div><h3>Tatsächlicher Zahlungsfluss</h3><p class="muted">Echte Kontobewegungen. CSV-Import arbeitet mit Vorschau und Duplikaterkennung.</p></div><div><button id="importBank" class="secondary">Kontoauszug CSV</button><button id="addPayment" class="primary">Buchung hinzufügen</button></div></div><input id="bankCsvInput" type="file" accept=".csv,text/csv,text/plain" hidden></div>
  <div class="grid cards"><article class="card"><span>Einnahmen 12M</span><strong>${euro(sumIn)}</strong></article><article class="card"><span>Ausgaben 12M</span><strong>${euro(sumOut)}</strong></article><article class="card"><span>Saldo 12M</span><strong class="${sumIn-sumOut<0?"negative":"positive"}">${euro(sumIn-sumOut)}</strong></article><article class="card"><span>erkannte Mietzahlungen</span><strong>${rentHits.length}</strong></article></div>
  <div class="card"><div class="tablewrap"><table class="costtable"><thead><tr><th>Monat</th><th>Einnahmen</th><th>Ausgaben</th><th>Saldo</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.label}</td><td>${euro(r.income)}</td><td>${euro(r.outflow)}</td><td class="${r.net<0?"negative":"positive"}">${euro(r.net)}</td></tr>`).join("")}</tbody></table></div></div>
  <div class="card"><h3>Letzte Buchungen</h3>${(state.payments||[]).slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,20).map(p=>{const rm=detectRentPayment(state,p);return`<div class="item"><strong>${esc(p.date)} · ${p.direction==="income"?"+":"−"} ${euro(p.amount)}</strong><p>${esc(p.label)}</p>${rm?`<small class="positive">Mietzahlung wahrscheinlich · ${rm.kind} · ${rm.score}%</small>`:""}</div>`}).join("")||"<p class='muted'>Noch keine Buchungen erfasst.</p>"}</div>`;
  $("addPayment").onclick=openPaymentEditor;$("importBank").onclick=()=>$("bankCsvInput").click();
  $("bankCsvInput").onchange=async e=>{const f=e.target.files?.[0];e.target.value="";if(!f)return;try{openBankImportPreview(parseBankCSV(await f.text()),f.name)}catch(err){recordClientError("bank-csv",err);alert("Import nicht möglich: "+(err.message||err))}}
}
function openBankImportPreview(parsed,fileName){
  const rows=bankImportPreview(state,parsed),fresh=rows.filter(x=>!x.duplicate);
  modal("Kontoauszug importieren",`<div class="card"><h3>${esc(fileName)}</h3><p>${rows.length} Buchungen erkannt · <strong>${fresh.length} neu</strong> · ${rows.length-fresh.length} Duplikat(e).</p><p class="muted">Vor dem Import wird nichts gespeichert.</p></div><div class="import-preview">${rows.slice(0,80).map((r,i)=>`<label class="import-row ${r.duplicate?"duplicate":""}"><input type="checkbox" data-import-row="${i}" ${r.duplicate?"disabled":"checked"}><span><strong>${esc(r.date)} · ${r.direction==="income"?"+":"−"} ${euro(r.amount)}</strong><br>${esc(r.label)}${r.rentMatch?`<br><small class="positive">Mietzahlung: ${esc(r.rentMatch.kind)} · ${r.rentMatch.score}%</small>`:""}${r.duplicate?"<br><small>bereits vorhanden</small>":""}</span></label>`).join("")}</div><button id="commitBankImport" class="primary" ${fresh.length?"":"disabled"}>Ausgewählte Buchungen importieren</button>`,()=>{
    $("commitBankImport").onclick=async()=>{const selected=[...document.querySelectorAll("[data-import-row]:checked")].map(x=>rows[Number(x.dataset.importRow)]).filter(Boolean);if(!selected.length)return;
      createRestorePoint("Vor Kontoimport");
      const result=await executeCommand("bank.csv.import",{fileName,count:selected.length},async()=>{for(const r of selected)state.payments.push({id:uid(),date:r.date,direction:r.direction,label:r.label,amount:r.amount,sourceId:"",positionId:"",importOrigin:"csv",importFile:fileName});state.meta.importHistory.unshift({id:uid(),at:new Date().toISOString(),fileName,recognized:rows.length,imported:selected.length,duplicates:rows.length-fresh.length});state.meta.importHistory=state.meta.importHistory.slice(0,25)},{auditText:"Kontoauszug importiert"});
      if(!result.ok)return alert(result.message);$("modal").classList.add("hidden");cashflowView()
    }
  })
}
function openPaymentEditor(){
  const sources=(state.sources||[]).map(s=>({value:s.id,label:s.name})),positions=(state.costPositions||[]).filter(p=>p.confirmed).map(p=>({value:p.id,label:`${p.label} · ${euro(p.amount)}`}));
  modal("Zahlung erfassen",`<form id="f" class="form-grid">${formField({name:"date",label:"Datum",type:"date",value:new Date().toISOString().slice(0,10)})}${formField({name:"direction",label:"Art",type:"select",value:"outflow",options:[{value:"outflow",label:"Ausgabe"},{value:"income",label:"Einnahme"}]})}${formField({name:"label",label:"Bezeichnung"})}${formField({name:"amount",label:"Betrag €",type:"number",step:"0.01",min:0})}${formField({name:"sourceId",label:"Quelle",type:"select",value:"",options:[{value:"",label:"keine Quelle"},...sources]})}${formField({name:"positionId",label:"Kostenposition",type:"select",value:"",options:[{value:"",label:"keine Kostenposition"},...positions]})}<div class="full"><button class="primary">Speichern</button></div></form>`,()=>{
    $("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));const payment={id:uid(),date:v.date,direction:v.direction,label:v.label.trim(),amount:Number(v.amount)||0,sourceId:v.sourceId||"",positionId:v.positionId||""};const result=await executeCommand("payment.create",payment,async()=>state.payments.push(payment),{auditText:"Zahlung erfasst"});if(!result.ok)return alert(result.message);$("modal").classList.add("hidden");cashflowView()}
  })
}

function analyticsView(){
  const y=currentPeriodYear(),cmp=annualComparison(state,y),alerts=costTrendAlerts(state,y),meters=state.meters||[];
  viewBody("workspaceBody").innerHTML=`<div class="card"><h3>Jahresvergleich & Verbrauchsanalyse</h3><p class="muted">Vergleicht Kostenperioden und normiert Zählerverbräuche auf 30 Tage.</p></div>
  ${alerts.length?alerts.map(a=>`<div class="${a.severity==="warn"?"legal-warn":"info"}">${esc(a.text)}</div>`).join(""):`<div class="legal-ok">✓ Keine belastbare Kostenänderung über 15 % erkannt.</div>`}
  <div class="card"><h3>${periodLabel(y-1)} → ${periodLabel(y)}</h3><div class="tablewrap"><table class="costtable"><thead><tr><th>Kategorie</th><th>Vorjahr</th><th>Aktuell</th><th>Änderung</th></tr></thead><tbody>${cmp.map(x=>`<tr><td>${esc(categoryLabel(x.category))}</td><td>${euro(x.prior)}</td><td>${euro(x.current)}</td><td class="${x.change>0?"negative":"positive"}">${x.pct==null?"–":`${x.pct>=0?"+":""}${Math.round(x.pct*100)} %`}</td></tr>`).join("")||"<tr><td colspan='4'>Noch keine zwei vergleichbaren Perioden vorhanden.</td></tr>"}</tbody></table></div></div>
  ${meters.map(m=>{const t=meterTrend(m),an=robustMeterAnomalies(m);return`<div class="card"><h3>${esc(m.name)}</h3><p>${t.segments.length?`Ø ${t.avgPer30.toFixed(2)} ${esc(m.unit||"")} je 30 Tage`:"Noch zu wenige Ablesungen für einen Trend."}</p>${an.map(a=>`<div class="legal-warn">${esc(a.text)}</div>`).join("")}<div class="tablewrap"><table class="costtable"><thead><tr><th>Zeitraum</th><th>Verbrauch</th><th>/30 Tage</th></tr></thead><tbody>${t.segments.slice(-8).reverse().map(x=>`<tr><td>${esc(x.from.date)}–${esc(x.to.date)}</td><td>${x.delta.toFixed(3)} ${esc(m.unit||"")}</td><td>${x.per30.toFixed(3)}</td></tr>`).join("")}</tbody></table></div></div>`}).join("")}`
}
function reconciliationView(){
  const r=reconciliationSummary(state),open=r.rows.filter(x=>Math.abs(x.difference)>.01),plan=smartPaymentPlan(state);
  viewBody("workspaceBody").innerHTML=`<div class="card"><div class="row between"><div><h3>Zahlungen zuordnen</h3><p class="muted">Die App bewertet Kostenpositionen und ganze Kostenquellen. Betrag, Buchungstext und Fälligkeit werden erklärt; gespeichert wird erst nach Bestätigung.</p></div><button id="runSmartMatch" class="primary">Vorschläge prüfen (${plan.length})</button></div></div>
  <div class="grid cards"><article class="card"><span>Positionen</span><strong>${r.rows.length}</strong></article><article class="card"><span>Abweichungen</span><strong>${open.length}</strong></article><article class="card"><span>Offene plausible Treffer</span><strong>${plan.length}</strong></article></div>
  ${plan.slice(0,6).map((x,i)=>{const s=x.suggestions[0];return`<div class="item"><div class="row between"><div><strong>${esc(x.payment.label)} · ${euro(x.payment.amount)}</strong><p>Vorschlag: ${esc(s.target.label||s.target.name)} · <strong>${s.score}%</strong> · ${s.type==="source"?"Kostenquelle":"Kostenposition"}</p><small>${esc(s.reasons.join(" · "))}</small></div><button class="secondary" data-recon-smart="${i}">Zuordnen</button></div></div>`}).join("")}
  <div class="card"><div class="tablewrap"><table class="costtable"><thead><tr><th>Position</th><th>Soll</th><th>bezahlt</th><th>Differenz</th></tr></thead><tbody>${r.rows.map(x=>`<tr><td>${esc(x.position.label)}</td><td>${euro(x.position.amount)}</td><td>${euro(x.paid)}</td><td class="${Math.abs(x.difference)>.01?"negative":"positive"}">${euro(x.difference)}</td></tr>`).join("")}</tbody></table></div></div>`;
  const accept=async i=>{const x=plan[i],s=x?.suggestions?.[0];if(!x||!s)return;if(!confirm(`„${x.payment.label}“ (${euro(x.payment.amount)}) mit „${s.target.label||s.target.name}“ verknüpfen?`))return;const res=await executeCommand("payment.smartMatch",{paymentId:x.payment.id,type:s.type,targetId:s.target.id,score:s.score},async()=>{if(s.type==="position"){x.payment.positionId=s.target.id;x.payment.sourceId=s.target.sourceId||""}else x.payment.sourceId=s.target.id},{auditText:"Zahlung zugeordnet"});if(!res.ok)return alert(res.message);reconciliationView()};
  document.querySelectorAll("[data-recon-smart]").forEach(b=>b.onclick=()=>accept(Number(b.dataset.reconSmart)));
  $("runSmartMatch").onclick=()=>{sub.more="smart";go("more")}
}
function openAutoMatchReview(){
  const plan=autoReconciliationPlan(state);
  modal("Zuordnungsvorschläge",plan.length?`<div class="card"><p>Die App zeigt nur Vorschläge. Du entscheidest bei jeder Zahlung.</p></div>${plan.map(x=>`<div class="item"><strong>${esc(x.payment.label)} · ${euro(x.payment.amount)}</strong><p>→ ${esc(x.best.position.label)} · ${x.best.score} %</p><small>${esc(x.best.reasons.join(" · "))}</small><p><button class="primary" data-autoaccept="${x.payment.id}" data-pos="${x.best.position.id}">Zuordnen</button></p></div>`).join("")}`:`<div class="legal-ok">Keine plausiblen offenen Zuordnungen gefunden.</div>`,()=>{
    document.querySelectorAll("[data-autoaccept]").forEach(b=>b.onclick=async()=>{const pay=state.payments.find(p=>p.id===b.dataset.autoaccept),pos=positionById(state,b.dataset.pos);if(!pay||!pos)return;pay.positionId=pos.id;pay.sourceId=pos.sourceId||"";await persist("Zahlung zugeordnet",`${pay.label} → ${pos.label}`);$("modal").classList.add("hidden");reconciliationView()})
  })
}
function tasksView(){
  viewBody("moreBody").innerHTML=`<div class="card"><button id="addTask" class="primary">Eigene Erinnerung</button><button id="ics" class="secondary">Kalender exportieren</button></div>${taskList().map(taskHTML).join("")}`;$("addTask").onclick=openTaskEditor;$("ics").onclick=exportICS
}
function openTaskEditor(){
  modal("Erinnerung hinzufügen",`<form id="f" class="form-grid">${formField({name:"title",label:"Titel"})}${formField({name:"due",label:"Fällig am",type:"date"})}${formField({name:"lead",label:"Vorwarnung (Tage)",type:"number",value:14})}<div class="full"><button class="primary">Speichern</button></div></form>`,()=>{$("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));state.tasks.push({id:uid(),title:v.title,due:v.due,lead:Number(v.lead)||14});await persist("Erinnerung angelegt",v.title);$("modal").classList.add("hidden");route==="owner"?ownerTasksView():tasksView()}})
}
function exportICS(){
  let out="BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Mietverwaltung//DE\r\n";
  for(const t of taskList()){if(!t.due)continue;out+=`BEGIN:VEVENT\r\nUID:${t.id}@mietverwaltung\r\nDTSTART;VALUE=DATE:${t.due.replaceAll("-","")}\r\nSUMMARY:${String(t.title).replace(/,/g,"\\,")}\r\nBEGIN:VALARM\r\nTRIGGER:-P${Number(t.lead||14)}D\r\nACTION:DISPLAY\r\nDESCRIPTION:${String(t.title).replace(/,/g,"\\,")}\r\nEND:VALARM\r\nEND:VEVENT\r\n`}
  out+="END:VCALENDAR\r\n";const blob=new Blob([out],{type:"text/calendar"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="Mietverwaltung_Erinnerungen.ics";a.click();URL.revokeObjectURL(a.href)
}
function auditView(){
  viewBody("moreBody").innerHTML=state.audit.length?state.audit.map(x=>`<div class="item"><h3>${esc(x.action)}</h3><p>${esc(x.detail)}</p><small>${new Date(x.at).toLocaleString("de-DE")}</small></div>`).join(""):`<div class="card muted">Noch keine Änderungen protokolliert.</div>`
}
function legalView(){
  const effective=ACTIVE_LEGAL_PACK?.effectiveDate||LAW_DATE,age=Math.floor((new Date()-new Date(effective+"T00:00:00"))/86400000),sources=ACTIVE_LEGAL_PACK?.sources||LEGAL_SOURCES;
  viewBody("moreBody").innerHTML=`<div class="${age<=90?"legal-ok":"legal-warn"}"><strong>Rechtsstand ${esc(effective)}</strong><br>${age<=90?"Aktueller Prüfstand hinterlegt.":`Letzte Prüfung vor ${age} Tagen.`}</div><div class="card"><h3>Amtliche Quellen</h3>${sources.map(s=>`<p><a href="${s.url}" target="_blank" rel="noopener">${esc(s.name)}</a>${s.purpose?`<br><small>${esc(s.purpose)}</small>`:""}</p>`).join("")}<button id="reloadRules" class="secondary">Rechtsstand neu laden</button></div>`;
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
    const now=new Date(new Date().toDateString()),tasks=typeof taskList==="function"?taskList():[];
    const due=tasks.filter(t=>{if(!t?.due)return false;const diff=Math.ceil((new Date(t.due+"T00:00:00")-now)/86400000);return diff<=Number(t.lead||30)}).length;
    const smart=typeof smartInsights==="function"?smartInsights(state).filter(x=>x.severity==="bad"||x.severity==="warn").length:0;
    const count=Math.min(99,due+smart);
    if(count>0&&navigator.setAppBadge)await navigator.setAppBadge(count);else if(navigator.clearAppBadge)await navigator.clearAppBadge()
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
async function activateWaitingServiceWorker(){
  try{const reg=await navigator.serviceWorker.getRegistration();if(reg?.waiting){reg.waiting.postMessage({type:"SKIP_WAITING"});location.reload()}else alert("Es wartet derzeit kein Update.")}
  catch(e){recordClientError("service-worker-update",e);alert("Update konnte nicht aktiviert werden.")}
}


function securityView(){
  viewBody("moreBody").innerHTML=`<div class="card"><h3>Geräteschutz</h3><div id="authStatus"></div><button id="authEnable" class="primary">Aktivieren</button><button id="authTest" class="secondary">Prüfen</button><button id="authDisable" class="danger">Deaktivieren</button><p class="muted">Auf unterstützten Geräten bestätigt iOS den Zugriff mit Face ID, Touch ID oder Gerätecode.</p></div><div class="info">Der Geräteschutz sperrt den App-Zugang. Die lokale Datenbank selbst wird dadurch nicht zusätzlich verschlüsselt; dafür dient die verschlüsselte Datensicherung.</div>`;
  const refresh=()=>$("authStatus").innerHTML=authEnabled()?`<p class="legal-ok">✓ Geräteschutz aktiv</p>`:`<p class="legal-warn">Geräteschutz nicht aktiv</p>`;refresh();
  $("authEnable").onclick=async()=>{try{await registerDevice();refresh()}catch(e){alert(e.message)}};
  $("authTest").onclick=async()=>alert(await authenticate()?"Geräteschutz funktioniert.":"Authentifizierung fehlgeschlagen.");
  $("authDisable").onclick=async()=>{if(authEnabled()&&!(await authenticate()))return alert("Authentifizierung erforderlich.");disableAuth();refresh()}
}
async function diagnosticsView(){
  const tests=runSelfTests(),coverageMissing=checkInputCoverage(),ok=tests.filter(t=>t.ok).length,st=await storageStatus(),pct=st.quota?Math.round(st.usage/st.quota*100):0,integrity=integritySummary(state),errors=state.meta?.errorLog||[],allOk=ok===tests.length&&integrity.ok&&!coverageMissing.length;
  viewBody("moreBody").innerHTML=`<div class="card"><h3>App-Prüfung</h3><div class="analysis-grid"><div><small>Gesamtstatus</small><strong>${allOk?"OK":"Prüfen"}</strong></div><div><small>Datenqualität</small><strong>${dataQualityScore(state)}%</strong></div><div><small>Prüfungen</small><strong>${ok}/${tests.length}</strong></div></div></div>
  ${integrity.errors.length?`<div class="legal-bad"><strong>Datenfehler</strong>${integrity.errors.map(x=>`<p>${esc(x)}</p>`).join("")}</div>`:`<div class="legal-ok">✓ Datenbestand ohne blockierende Fehler.</div>`}
  ${integrity.warnings.length?`<div class="legal-warn"><strong>Zu prüfen</strong>${integrity.warnings.map(x=>`<p>${esc(x)}</p>`).join("")}</div>`:""}
  ${coverageMissing.length?`<div class="legal-bad"><strong>Interner Navigationsfehler</strong><br>${coverageMissing.map(esc).join("<br>")}</div>`:""}
  <div class="card"><h3>Lokaler Speicher</h3><p>${st.persisted?"Dauerhafter Speicher ist angefordert.":"Der Browser kann lokale Daten bei starkem Speicherdruck theoretisch entfernen."}</p><p>Nutzung: ${humanBytes(st.usage)} von ca. ${humanBytes(st.quota)} (${pct} %)</p><div class="storage-meter"><span style="width:${Math.min(100,pct)}%"></span></div>${st.persisted?"":`<p><button id="persistBtn" class="primary">Dauerhaften Speicher anfordern</button></p>`}</div>
  <details class="card"><summary><strong>Prüfdetails</strong></summary>${tests.map(t=>`<p class="${t.ok?"test-ok":"test-bad"}">${t.ok?"✓":"✕"} ${esc(t.name)}</p>`).join("")}</details>
  <details class="card"><summary><strong>Technische Details</strong></summary><p>Geräteauthentifizierung: ${window.PublicKeyCredential?"verfügbar":"nicht verfügbar"} · App-Badge: ${navigator.setAppBadge?"verfügbar":"nicht verfügbar"} · Offline-Unterstützung: ${"serviceWorker" in navigator?"verfügbar":"nicht verfügbar"}</p><p>App ${APP_VERSION} · Schema ${SCHEMA_VERSION} · Datenmodell ${DOMAIN_VERSION} · Smart Engine ${SMART_ENGINE_VERSION}</p><p>Revision ${integrity.revision} · protokollierte Änderungen ${(state.meta?.commandLog||[]).length} · Sicherungspunkte ${(state.meta?.restorePoints||[]).length}</p><p>Rechtsstand ${esc(ACTIVE_LEGAL_PACK?.effectiveDate||LAW_DATE)}</p>${SW_UPDATE_WAITING?`<p class="legal-warn">Eine neue App-Version ist bereit.</p><button id="activateUpdate" class="primary">Update aktivieren</button>`:""}</details>
  <details class="card"><summary><strong>Fehlerprotokoll (${errors.length})</strong></summary>${errors.length?errors.slice(0,20).map(e=>`<div class="task"><strong>${esc(e.context)}</strong><br><small>${new Date(e.at).toLocaleString("de-DE")}</small><p>${esc(e.message)}</p></div>`).join(""):"<p class='muted'>Keine protokollierten Laufzeitfehler.</p>"}<button id="clearErrors" class="secondary">Fehlerprotokoll leeren</button></details>`;
  if($("persistBtn"))$("persistBtn").onclick=async()=>{const granted=await requestPersistentStorage();alert(granted?"Dauerhafter Speicher wurde angefordert.":"Der Browser hat die Anfrage derzeit nicht bestätigt.");diagnosticsView()};
  $("clearErrors").onclick=async()=>{state.meta.errorLog=[];await persist("Fehlerprotokoll geleert","");diagnosticsView()};if($("activateUpdate"))$("activateUpdate").onclick=()=>activateWaitingServiceWorker()
}

function recoveryView(){
  const pts=state.meta?.restorePoints||[];
  viewBody("moreBody").innerHTML=`<div class="card"><h3>Sicherungspunkte</h3><p class="muted">Vor wichtigen Änderungen kann ein lokaler Rücksprungpunkt gespeichert werden. Beim Wiederherstellen wird der aktuelle Stand automatisch als neuer Sicherungspunkt erhalten.</p><button id="createRestorePoint" class="primary">Sicherungspunkt erstellen</button></div>${pts.map(p=>`<div class="item"><div class="row between"><div><strong>${esc(p.label)}</strong><p>${new Date(p.at).toLocaleString("de-DE")}</p></div><button class="secondary" data-restore="${p.id}">Wiederherstellen</button></div></div>`).join("")||"<div class='card muted'>Noch keine Sicherungspunkte.</div>"}`;
  $("createRestorePoint").onclick=async()=>{createRestorePoint("Manuell erstellt");await persist("Sicherungspunkt erstellt","manuell");recoveryView()};
  document.querySelectorAll("[data-restore]").forEach(b=>b.onclick=async()=>{if(!confirm("Diesen Stand wiederherstellen? Der aktuelle Stand bleibt als Sicherungspunkt erhalten."))return;try{await restoreFromPoint(b.dataset.restore);alert("Stand wiederhergestellt.");render()}catch(e){alert("Wiederherstellung fehlgeschlagen: "+(e.message||e))}})
}

function backupView(){
  const stamp=new Date().toISOString().slice(0,10);
  viewBody("moreBody").innerHTML=`<div class="card"><h3>Verschlüsselte Datensicherung</h3><label>Passwort<input id="backupPw" type="password" class="big-input" placeholder="mindestens 8 Zeichen" autocomplete="new-password"></label><button id="fullExport" class="primary">Datensicherung erstellen</button><label class="file-label">Datensicherung wiederherstellen<input id="fullImportFile" type="file" accept=".json,application/json"></label><button id="fullImport" class="secondary">Ausgewählte Sicherung prüfen & wiederherstellen</button><p class="muted">Enthält Stammdaten und Dokumente und wird verschlüsselt gespeichert. Das Passwort wird nicht in der App gespeichert.</p></div><div class="card"><h3>Unverschlüsselter Datenexport</h3><p class="muted">Nur für technische Zwecke. Enthält persönliche Daten im Klartext und keine Dokumentdateien.</p><button id="exportState" class="secondary">Daten als JSON exportieren</button></div>`;
  $("exportState").onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`Mietverwaltung_Daten_${stamp}.json`;a.click();URL.revokeObjectURL(a.href)};
  $("fullExport").onclick=async()=>{const pw=$("backupPw").value;if(pw.length<8)return alert("Bitte mindestens 8 Zeichen für das Passwort verwenden.");const wrapper=await createFullBackup(state,pw),blob=new Blob([JSON.stringify(wrapper)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`Mietverwaltung_Datensicherung_${stamp}.json`;a.click();URL.revokeObjectURL(a.href);state.meta.lastBackupAt=new Date().toISOString();await persist("Datensicherung erstellt","verschlüsselt")};
  $("fullImport").onclick=async()=>{const f=$("fullImportFile").files[0],pw=$("backupPw").value;if(!f)return alert("Bitte eine Datensicherung auswählen.");if(pw.length<1)return alert("Bitte das Passwort der Datensicherung eingeben.");const oldState=cloneState(state),oldDocs=await listDocuments();try{const wrapper=JSON.parse(await f.text()),decoded=await decodeFullBackup(wrapper,pw),next=ensureTraceShape(repairDomainState(decoded.state)),check=validateDomainState(next);if(check.errors.length)throw new Error("Die Sicherung enthält fehlerhafte Daten: "+check.errors.join(" · "));if(!confirm(`Datensicherung vom ausgewählten Stand wiederherstellen? ${decoded.documents.length} Dokument(e) werden übernommen.`))return;createRestorePoint("Vor Datensicherung-Import");await replaceDocuments(decoded.documents);state=next;state.meta.restorePoints=[...(oldState.meta?.restorePoints||[]),...(state.meta.restorePoints||[])].slice(0,5);await saveState(state);LAST_STABLE_STATE=cloneState(state);alert("Datensicherung erfolgreich wiederhergestellt.");more()}catch(e){try{await replaceDocuments(oldDocs);state=oldState;await saveState(oldState);LAST_STABLE_STATE=cloneState(oldState)}catch{}alert("Wiederherstellung fehlgeschlagen: "+(e.message||e))}}
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
  state.sources.forEach(s=>rows.push({title:s.name,detail:"Kostenquelle",route:"data",sub:"sources"}));
  state.costPositions.forEach(p=>rows.push({title:p.label,detail:`Kostenposition · ${euro(p.amount)}`,route:"data",sub:"positions"}));
  state.tasks.forEach(t=>rows.push({title:t.title,detail:t.due||"",route:"owner",sub:"tasks"}));state.payments.forEach(p=>rows.push({title:p.label,detail:`Zahlung · ${p.date} · ${euro(p.amount)}`,route:"owner",sub:"cashflow"}));state.meters.forEach(m=>rows.push({title:m.name,detail:`Zähler · ${m.number||"ohne Nummer"}`,route:"data",sub:"infrastructure"}));(state.documentsCache||[]).forEach(d=>rows.push({title:d.label||d.name,detail:`Dokument · ${documentWorkflowLabel(d)}`,route:"data",sub:"documents"}));
  state.leases.forEach(l=>rows.push({title:"Mietvertrag",detail:`ab ${l.start}`,route:"data",sub:"lease"}));
  const f=rows.filter(r=>!z||`${r.title} ${r.detail}`.toLowerCase().includes(z)).slice(0,30);
  $("searchResults").innerHTML=f.length?f.map((r,i)=>`<button class="search-result" data-search="${i}"><strong>${esc(r.title)}</strong><small>${esc(r.detail)}</small></button>`).join(""):`<p class="muted">Keine passenden Einträge.</p>`;
  document.querySelectorAll("[data-search]").forEach(b=>b.onclick=()=>{const r=f[Number(b.dataset.search)];$("searchOverlay").classList.add("hidden");go(r.route);sub[r.route]=r.sub;setTimeout(()=>r.route==="data"?dataWorkspace():r.route==="rental"?rentalWorkspace():r.route==="owner"?ownerWorkspace():more(),0)})
}

function updateConnectionState(){
  const el=$("connectionState");if(!el)return;el.textContent=navigator.onLine?"Online":"Offline";el.className=`connection-pill ${navigator.onLine?"online":"offline"}`
}
function setupRuntimeGuards(){
  updateConnectionState();window.addEventListener("online",updateConnectionState);window.addEventListener("offline",updateConnectionState);
  window.addEventListener("error",e=>recordClientError("window-error",e.error||e.message));
  window.addEventListener("unhandledrejection",e=>recordClientError("unhandled-promise",e.reason));
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){for(const id of ["modal","searchOverlay","quickOverlay"]){const el=$(id);if(el&&!el.classList.contains("hidden")){el.classList.add("hidden");break}}}})
}
async function startApp(){
  setupGlobal();setupRuntimeGuards();
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
