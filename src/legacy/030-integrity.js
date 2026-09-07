/* ===== integrity.js ===== */
const APP_VERSION="18.0.0";
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


