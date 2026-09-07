/* ===== schema.js ===== */
const SCHEMA_VERSION=13;

// Register the Service Worker before the first asynchronous startup wait.
// On fast page loads the window "load" event can fire while IndexedDB is still
// opening; registering only afterwards would permanently miss that event.
const SERVICE_WORKER_REGISTRATION=("serviceWorker" in navigator)
  ? navigator.serviceWorker.register("./service-worker.js",{updateViaCache:"none"}).catch(error=>{
      console.warn("Service Worker konnte nicht registriert werden:",error);
      return null;
    })
  : Promise.resolve(null);

function localDateISO(date=new Date()){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`
}
function dateOnlyAddDays(value,days){
  const m=String(value||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return "";
  const d=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])+Number(days||0)));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`
}
function localMonthEndISO(date){
  return localDateISO(new Date(date.getFullYear(),date.getMonth()+1,0))
}

function createEmptyState(){
  return {
    schemaVersion:SCHEMA_VERSION,
    meta:{appVersion:"18.0.0",createdAt:new Date().toISOString(),migratedFrom:null,revision:0,lastSavedAt:null,lastBackupAt:null,lastIntegrityCheckAt:null,errorLog:[],v17:{integrated:true,profileSchema:3,waterModule:3,utilityProfile:{coldWater:"landlord",heating:"tenant",hotWater:"tenant",electricity:"tenant",gas:"tenant"}}},
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
  out.property.billingTakeoverDate=out.property.billingTakeoverDate||out.property.ownershipEffective||"";
  if(out.property.billingTakeoverDate&&!out.property.predecessorBillingEnd){
    out.property.predecessorBillingEnd=dateOnlyAddDays(out.property.billingTakeoverDate,-1)
  }
  out.correspondence={...base.correspondence,...(s?.correspondence||{})};
  out.finance={...base.finance,...(s?.finance||{})};
  for(const k of ["units","leases","sources","costPositions","meters","waterSettlements","containers","water","tasks","billingWorkflows","billingSnapshots","payments","audit"])out[k]=Array.isArray(s?.[k])?s[k]:[];
  out.schemaVersion=SCHEMA_VERSION;
  out.meta={...base.meta,...(s?.meta||{}),appVersion:"18.0.0"};
  out.meta.v17={...base.meta.v17,...(s?.meta?.v17||{}),integrated:true,profileSchema:3,waterModule:3,utilityProfile:{coldWater:"landlord",heating:"tenant",hotWater:"tenant",electricity:"tenant",gas:"tenant"}};
  out.meta.revision=Number(out.meta.revision||0);
  out.meta.errorLog=Array.isArray(out.meta.errorLog)?out.meta.errorLog:[];
  return out
}



