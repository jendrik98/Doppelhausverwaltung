/* ===== db.js ===== */

const DB_NAME="mietverwaltung-v6",DB_VERSION=2,STATE_ID="main"; // Historical identifier intentionally stable so existing IndexedDB data is not orphaned.

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
/* Compatibility import only; not used by current billing calculations. */
function migrateLegacyStorage(){
  const state=repairDomainState(createEmptyState());LAST_STABLE_STATE=cloneState(state);
  const keys=["mietverwaltung_v2_4","mietverwaltung_v2_3","mietverwaltung_v2_2","mietverwaltung_v2_1","mietverwaltung_v2"];
  let old=null,from=null;
  for(const k of keys){try{const raw=localStorage.getItem(k);if(raw){old=JSON.parse(raw);from=k;break}}catch{}}
  if(!old)return state;
  state.meta.migratedFrom=from;
  state.property={...state.property,...(old.property||{})};
  state.finance={...state.finance,...(old.finance||{})};
  state.units=(old.units||[]).map(u=>({id:u.id||crypto.randomUUID(),name:u.name,type:u.type,area:Number(u.area||0),note:u.note||"",occupancy:(u.occupancyHistory||u.occupancy||[{from:"2000-01-01",to:"",count:Number(u.persons||0)}])}));
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



