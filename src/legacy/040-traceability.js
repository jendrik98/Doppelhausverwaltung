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
  const allConfirmed=(state.costPositions||[]).filter(p=>positionToEvents(state,p,year).length).every(p=>p.confirmed);
  const allAssigned=analysis.unresolved.length===0;
  const periodEnded=!!analysis.period?.end&&smartToday()>analysis.period.end;
  const advanceOK=lease?(Number(lease.advance||0)<=0||Number(analysis.advanceEvidence?.recognizedPayments||0)>0):false;
  const noErrors=readiness.every(x=>x.ok);
  const points=[
    {id:"period",label:"Abrechnungsperiode und Mietvertrag vorhanden",ok:!!lease},
    {id:"periodComplete",label:"Abrechnungsperiode vollständig beendet",ok:periodEnded},
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


