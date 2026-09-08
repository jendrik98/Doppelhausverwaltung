type AnyRecord = Record<string, any>;
type MeterLike = AnyRecord & { readings: any[] };
type DomainState = AnyRecord & {
  costPositions: any[];
  meters: MeterLike[];
  waterSettlements: any[];
  containers: any[];
  sources: any[];
  water?: any[];
  leases: any[];
  units: any[];
  payments: any[];
  billingSnapshots: any[];
  property: AnyRecord;
  meta: AnyRecord;
};

declare const DOMAIN_VERSION: number;
declare function uid(): string;
declare function category(id: any): any;
declare function periodStart(year: number): string;
declare function periodEnd(year: number): string;
declare function smartToday(): string;
declare function meterTrend(meter: MeterLike): any;
declare function calendarDayDiff(start: string, end: string): number;
declare function billingPeriodInfo(state: DomainState, year: number): any;
declare function overlapDays(aStart: string, aEnd: string, bStart: string, bEnd: string): number;
declare function daysInclusive(start: string, end: string): number;
declare function legalDecision(source: AnyRecord, options?: AnyRecord): any;
declare function shares(state: DomainState, date: string): any;
declare function personShareForPeriod(state: DomainState, start: string, end: string): number;
declare function actualAdvanceEvidenceInPeriod(state: DomainState, lease: AnyRecord, periodYear: number): any;
declare const AppMeterParsing: {
  normalizeMeterNumber: (...args: any[]) => any;
  parseMeterReadingValue: (...args: any[]) => any;
  meterNumericInterpretations: (...args: any[]) => any[];
  meterReadingCandidates: (...args: any[]) => any[];
  detectedMeterSerialCandidates: (...args: any[]) => any[];
  meterNumberComparable: (...args: any[]) => any;
  editDistance: (...args: any[]) => number;
  meterNumberSimilarity: (...args: any[]) => number;
};

export function positionDefaults(p: AnyRecord = {}){
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
export function sourcePositions(state: DomainState,sourceId: string){return (state.costPositions||[]).filter(p=>p.sourceId===sourceId)}
export function positionById(state: DomainState,id: string){return (state.costPositions||[]).find(p=>p.id===id)}

export function migrateDomainState(state: DomainState){
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
      const mainStart=addMeterReading(main!,ps,0,"migration",true);
      const mainEnd=addMeterReading(main!,pe,Number(w.houseConsumption||0),"migration",true);
      const ownerStart=addMeterReading(owner!,ps,Number(w.ownerStart||0),"migration",true);
      const ownerEnd=addMeterReading(owner!,pe,Number(w.ownerEnd||0),"migration",true);
      state.waterSettlements.push({
        id:w.id||uid(),periodYear:py,mainMeterId:main!.id,ownerMeterId:owner!.id,
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

export function ensureDefaultMeters(state: DomainState){
  state.meters=Array.isArray(state.meters)?state.meters:[];
  let main=state.meters.find(m=>m.role==="mainWater");
  let owner=state.meters.find(m=>m.role==="ownerWater");
  if(!main){main={id:uid(),role:"mainWater",name:"Hauptwasserzähler",number:"",unit:"m³",readings:[]};state.meters.push(main)}
  if(!owner){owner={id:uid(),role:"ownerWater",name:"Zwischenzähler Eigennutzung",number:"",unit:"m³",readings:[]};state.meters.push(owner)}
  main.readings=Array.isArray(main.readings)?main.readings:[];
  owner.readings=Array.isArray(owner.readings)?owner.readings:[];
  return {main,owner}
}
export function meterById(state: DomainState,id: string){return (state.meters||[]).find(m=>m.id===id)}
export function readingById(meter: MeterLike | null | undefined,id: string){return (meter?.readings||[]).find(r=>r.id===id)}
export function addMeterReading(meter: MeterLike,date: string,value: any,origin="manual",synthetic=false){
  const same=(meter.readings||[]).find(r=>r.date===date&&Number(r.value)===Number(value));
  if(same)return same;
  const r={id:uid(),date,value:Number(value),origin,synthetic,createdAt:new Date().toISOString()};
  meter.readings.push(r);meter.readings.sort((a,b)=>a.date.localeCompare(b.date));return r
}

const {
  normalizeMeterNumber,
  parseMeterReadingValue,
  meterNumericInterpretations,
  meterReadingCandidates,
  detectedMeterSerialCandidates,
  meterNumberComparable,
  editDistance,
  meterNumberSimilarity
}=AppMeterParsing;

export function matchMeterFromOCR(s: DomainState,text: string,preferredMeterId=""){
  const meters=s.meters||[];if(preferredMeterId){const preferred=meters.find(m=>m.id===preferredMeterId);if(preferred)return{meter:preferred,confidence:1,reason:"Aufnahme direkt an diesem Zähler gestartet"}}
  const serials=detectedMeterSerialCandidates(text),matches=[];
  for(const m of meters){if(!m.number)continue;const best=serials.map(c=>({candidate:c,similarity:meterNumberSimilarity(c.raw,m.number)})).sort((a,b)=>b.similarity-a.similarity)[0];if(best?.similarity>=.78)matches.push({meter:m,confidence:Math.min(.98,.62+best.similarity*.36),reason:best.similarity>.96?"gespeicherte Zählernummer erkannt":"Zählernummer trotz kleiner OCR-Abweichung wiedererkannt"})}
  matches.sort((a,b)=>b.confidence-a.confidence);if(matches.length===1||matches[0]?.confidence-(matches[1]?.confidence||0)>.08)return matches[0]||{meter:null,confidence:0,reason:"keine gespeicherte Zählernummer erkannt"};
  return {meter:null,confidence:0,reason:matches.length?"mehrere Zähler ähnlich erkannt":"keine gespeicherte Zählernummer erkannt"}
}
export function meterCandidateHistoryScore(meter: MeterLike | null | undefined,date: string,value: any){
  if(!meter||value==null)return 0;const prev=(meter.readings||[]).filter(r=>r.date<=date).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];if(!prev)return 0;
  const diff=Number(value)-Number(prev.value);if(diff<0)return-.42;let score=diff<1?.12:diff<50?.20:diff<250?.08:-.24;
  const trend=meterTrend(meter),last=trend.segments?.at(-1);if(last&&prev.date<date){const days=Math.max(1,calendarDayDiff(prev.date,date)),expected=Math.max(.001,last.perDay*days),ratio=diff/expected;if(ratio>=.25&&ratio<=4)score+=.14;else if(ratio>12)score-=.18}return score
}
export function rankMeterCandidates(s: DomainState,meterId: string,date: string,candidates: any[]){
  const meter=meterById(s,meterId),groups=new Map();
  for(const c of candidates||[]){if(c.value<0||c.value>1000000)continue;const key=Number(c.value).toFixed(4),g=groups.get(key)||{...c,consensus:0,sources:new Set(),score:0};g.consensus++;g.sources.add(c.source);g.score=Math.max(g.score,Number(c.score||0));groups.set(key,g)}
  return [...groups.values()].map(g=>{let score=g.score+Math.min(.16,(g.consensus-1)*.055)+meterCandidateHistoryScore(meter,date,g.value);if(g.sources.size>=2)score+=.05;return{...g,source:[...g.sources].join(" + "),score:Math.max(.01,Math.min(.995,score))}}).sort((a,b)=>b.score-a.score)
}
export function analyzeMeterOCRText(s: DomainState,text: string,preferredMeterId="",extraCandidates: any[] = [],date=smartToday()){
  const assignment=matchMeterFromOCR(s,text,preferredMeterId),base=meterReadingCandidates(text,"Vollbild",.48),serials=detectedMeterSerialCandidates(text),meterId=assignment.meter?.id||preferredMeterId||"",ranked=rankMeterCandidates(s,meterId,date,[...base,...extraCandidates]),chosen=ranked[0]||null;
  return{meterId,meterName:assignment.meter?.name||meterById(s,preferredMeterId)?.name||"",assignmentConfidence:assignment.confidence||0,assignmentReason:assignment.reason,reading:chosen?.value??null,readingRaw:chosen?.raw||"",readingConfidence:chosen?.score||0,readingEvidence:chosen?.line||"",serialCandidate:serials[0]?.raw||"",serialConfidence:serials[0]?.score||0,candidates:ranked.slice(0,10),text:String(text||"")}
}
export function latestMeterReading(meter: MeterLike | null | undefined){return (meter?.readings||[]).slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0]||null}
export function meterReadingPlausibility(meter: MeterLike | null | undefined,date: string,value: any){
  const all=(meter?.readings||[]).filter(r=>r.date<=date).sort((a,b)=>(b.date||"").localeCompare(a.date||"")),prev=all[0];
  if(!prev)return {ok:true,message:"Keine frühere Ablesung zum Vergleich vorhanden."};
  if(Number(value)<Number(prev.value))return {ok:false,message:`Der neue Stand ${value} liegt unter der letzten Ablesung ${prev.value} vom ${prev.date}. Zählerwechsel oder OCR-Fehler prüfen.`};
  return {ok:true,message:`Letzte Ablesung ${prev.value} am ${prev.date}; Differenz ${(Number(value)-Number(prev.value)).toFixed(3)} ${meter!.unit||""}.`}
}

export function settlementByPeriod(state: DomainState,year: number){return (state.waterSettlements||[]).find(w=>Number(w.periodYear)===Number(year))}
export function settlementConsumption(state: DomainState,settlement: AnyRecord | null | undefined){
  if(!settlement)return null;
  const main=meterById(state,settlement.mainMeterId),owner=meterById(state,settlement.ownerMeterId);
  const ms=readingById(main,settlement.mainStartReadingId),me=readingById(main,settlement.mainEndReadingId);
  const os=readingById(owner,settlement.ownerStartReadingId),oe=readingById(owner,settlement.ownerEndReadingId);
  if(!ms||!me||!os||!oe)return null;
  const house=Number(me.value)-Number(ms.value),own=Number(oe.value)-Number(os.value),tenant=house-own;
  const bp=Number.isInteger(Number(settlement.periodYear))?billingPeriodInfo(state,Number(settlement.periodYear)):null;
  const periodAligned=!bp||(ms.date===bp.start&&os.date===bp.start&&me.date===bp.end&&oe.date===bp.end);
  return {house,owner:own,tenant,share:house>0?tenant/house:0,periodAligned,
    valid:house>=0&&own>=0&&tenant>=0&&periodAligned}
}

export function positionToEvents(s: DomainState,position: AnyRecord,periodYear: number){
  const p=positionDefaults(position),bp=billingPeriodInfo(s,periodYear);
  if(!p.confirmed||!bp.active)return [];
  const ps=bp.start,pe=bp.end,start=p.serviceStart||ps,end=p.serviceEnd||pe;
  const ov=overlapDays(start,end,ps,pe);if(!ov)return [];
  const factor=ov/daysInclusive(start,end);let amount=Number(p.amount||0);
  if(p.interval==="monthly")amount=amount*12*factor;
  else if(p.interval==="quarterly")amount=amount*4*factor;
  else if(p.interval==="yearly")amount=amount*factor;
  else amount=amount*factor;
  return [{positionId:p.id,sourceId:p.sourceId,documentId:p.documentId,label:p.label,category:p.category,amount,
    assignment:p.assignment,agreement:p.agreement,serviceStart:start,serviceEnd:end,details:p.details}]
}
export function allocateCostPosition(s: DomainState,event: AnyRecord,periodYear: number){
  const settlement=settlementByPeriod(s,periodYear),cons=settlementConsumption(s,settlement),bp=billingPeriodInfo(s,periodYear);
  const hasConsumption=event.category==="water"&&!!cons?.valid;
  let decision=event.assignment==="review"
    ?{status:"check",billable:true,rule:"manual",reason:"Zuordnung muss bestätigt werden.",basis:"Dokument-/Objektzuordnung"}
    :legalDecision(event,{hasConsumption,assignment:event.assignment,agreement:event.agreement});
  let share=0;const area=shares(s,bp.start).area;
  if(decision.rule==="area")share=area;
  else if(decision.rule==="persons")share=personShareForPeriod(s,bp.start,bp.end);
  else if(decision.rule==="rental")share=1;
  else if(decision.rule==="owner")share=0;
  else if(decision.rule==="consumption"&&cons?.valid)share=cons.share;
  return {...event,decision,tenantShare:share,tenantAmount:Number(event.amount||0)*share}
}
export function centralBillingAnalysis(s: DomainState,periodYear: number){
  const bp=billingPeriodInfo(s,periodYear);
  const events=bp.active?(s.costPositions||[]).flatMap(p=>positionToEvents(s,p,periodYear)).map(e=>allocateCostPosition(s,e,periodYear)):[];
  const unresolved=events.filter(e=>e.decision.status==="check"||e.decision.rule==="manual");
  const tenantCosts=events.reduce((sum,e)=>sum+Number(e.tenantAmount||0),0);
  const lease=s.leases[0],advanceEvidence=actualAdvanceEvidenceInPeriod(s,lease,periodYear),advances=advanceEvidence.amount;
  return {events,unresolved,tenantCosts,advances,advanceEvidence,result:tenantCosts-advances,lease,period:bp}
}
export function syncSimpleSourcePosition(state: DomainState,source: AnyRecord){
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
export function replaceAssessmentPositions(state: DomainState,source: AnyRecord,positions: AnyRecord[]){
  const keep=(state.costPositions||[]).filter(p=>p.sourceId!==source.id);
  state.costPositions=keep.concat((positions||[]).map(p=>positionDefaults({
    ...p,sourceId:source.id,documentId:source.sourceDocumentId||p.documentId||"",
    serviceStart:p.serviceStart||source.serviceStart,serviceEnd:p.serviceEnd||source.serviceEnd,
    confirmed:true
  })))
}


