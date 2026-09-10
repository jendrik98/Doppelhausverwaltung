type AnyRecord = Record<string, any>;
type Context = { portfolioId?: string; buildingId?: string; unitId?: string; tenancyId?: string };
declare const AppLifecycleLedger: any;

const uid=(prefix="id")=>globalThis.crypto?.randomUUID?.()||`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const RENTAL_LIFECYCLE_APPLICATION_VERSION=1;

export function lifecycleWorkspaceModel(state:AnyRecord,context:Context={},today=new Date().toISOString().slice(0,10)){
  AppLifecycleLedger.ensureLifecycleState(state);
  const buildingId=String(context.buildingId||state?.meta?.primaryBuildingId||"");
  const leases=(state.leases||[]).filter((l:AnyRecord)=>!buildingId||String(l.buildingId||"")===buildingId).sort((a:AnyRecord,b:AnyRecord)=>String(b.start||"").localeCompare(String(a.start||"")));
  const active=leases.find((l:AnyRecord)=>(!l.start||l.start<=today)&&(!l.end||l.end>=today))||null;
  const ledger=AppLifecycleLedger.rentLedger(state,{buildingId});
  const replacements=(state.meterReplacements||[]).filter((r:AnyRecord)=>!buildingId||String(r.buildingId||"")===buildingId).sort((a:AnyRecord,b:AnyRecord)=>String(b.date||"").localeCompare(String(a.date||"")));
  const alerts=AppLifecycleLedger.lifecycleAlerts(state,buildingId,today);
  const snapshots=(state.billingSnapshots||[]).filter((s:AnyRecord)=>!buildingId||String(s.buildingId||"")===buildingId).sort((a:AnyRecord,b:AnyRecord)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
  return {buildingId,leases,active,ledger,replacements,alerts,snapshots};
}

export function createTenancyCommand(state:AnyRecord,payload:AnyRecord,context:Context={}){
  AppLifecycleLedger.ensureLifecycleState(state);
  const unitId=String(payload.unitId||context.unitId||state.units?.find((u:AnyRecord)=>u.type==="rental"&&(!context.buildingId||u.buildingId===context.buildingId))?.id||"");
  return AppLifecycleLedger.createTenancy(state,{...payload,unitId});
}
export function addLeaseTermCommand(state:AnyRecord,payload:AnyRecord){return AppLifecycleLedger.addLeaseTerm(state,String(payload.leaseId||payload.id||""),payload)}
export function closeTenancyCommand(state:AnyRecord,payload:AnyRecord){return AppLifecycleLedger.updateTenancyEnd(state,String(payload.leaseId||payload.id||""),String(payload.end||""),String(payload.note||""))}
export function recordHandoverCommand(state:AnyRecord,payload:AnyRecord){return AppLifecycleLedger.recordHandover(state,String(payload.leaseId||""),payload)}
export function allocateRentPaymentCommand(state:AnyRecord,payload:AnyRecord){return AppLifecycleLedger.replacePaymentAllocations(state,String(payload.paymentId||""),payload.allocations||[])}
export function recordMeterReplacementCommand(state:AnyRecord,payload:AnyRecord){return AppLifecycleLedger.recordMeterReplacement(state,payload)}

export function createRentReversalCommand(state:AnyRecord,payload:AnyRecord,context:Context={}){
  AppLifecycleLedger.ensureLifecycleState(state);
  const original=state.payments?.find((p:AnyRecord)=>String(p.id||"")===String(payload.paymentId||payload.originalPaymentId||""));
  if(!original)throw new Error("Ursprüngliche Mietzahlung fehlt.");
  const prior=AppLifecycleLedger.paymentAllocations(state,original.id);if(!prior.length)throw new Error("Die ursprüngliche Zahlung ist noch keinem Mietmonat zugeordnet.");
  const requested=payload.amount==null?Number(original.amount||0):Number(payload.amount||0);if(!(requested>0))throw new Error("Rücklastschriftbetrag ist ungültig.");
  const reversal={id:uid("payment"),buildingId:original.buildingId||context.buildingId||"",unitId:original.unitId||"",leaseId:original.leaseId||prior[0]?.leaseId||"",direction:"outflow",kind:"rent-reversal",rentReversal:true,reversesPaymentId:original.id,date:String(payload.date||new Date().toISOString().slice(0,10)),amount:requested,label:String(payload.label||`Rücklastschrift ${original.label||"Mietzahlung"}`),createdAt:new Date().toISOString()};
  state.payments.push(reversal);
  let remaining=requested;const allocations=[] as AnyRecord[];
  for(const a of prior){if(remaining<=.005)break;const max=Number(a.total||0),part=Math.min(remaining,max),ratio=max>0?part/max:0;allocations.push({leaseId:a.leaseId,month:a.month,rentAmount:Number(a.rentAmount||0)*ratio,advanceAmount:Number(a.advanceAmount||0)*ratio,total:part});remaining-=part}
  AppLifecycleLedger.replacePaymentAllocations(state,reversal.id,allocations);
  return reversal
}
