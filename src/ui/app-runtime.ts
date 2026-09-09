// @ts-nocheck -- Phase 10 V3: semantikerhaltende Abschlussmigration im bisherigen äußeren Browser-Runtime-Scope.
/* Diese Datei bleibt TypeScript-Quelle, wird aber ohne zusätzliche Funktions-Closure an der bisherigen Laufzeitposition injiziert. */
/* ===== tests.js ===== */

function assert(name,cond){return{name,ok:!!cond}}
function runSelfTests(){
  const results=[];
  results.push(assert("Standardperiode startet 01.04.",periodStart(2025)==="2025-04-01"));
  results.push(assert("Standardperiode endet 31.03.",periodEnd(2025)==="2026-03-31"));
  results.push(assert("Schaltjahr 2028",daysInclusive("2028-01-01","2028-12-31")===366));
  results.push(assert("März bleibt trotz Sommerzeit 31 Kalendertage",daysInclusive("2027-03-01","2027-03-31")===31));
  results.push(assert("Date-only Vortag bleibt DST-sicher",dateOnlyAddDays("2026-09-01",-1)==="2026-08-31"));
  results.push(assert("Monatsende bleibt lokales Kalenderdatum",localMonthEndISO(new Date(2026,2,1))==="2026-03-31"));
  const dstState=createEmptyState();dstState.property.billingTakeoverDate="2027-04-01";dstState.leases=[{id:"dst-lease",start:"2027-04-01",end:"",rent:500,advance:150,tenantName:"DST-Test"}];
  results.push(assert("12 Monate Vorauszahlung DST-sicher",Math.abs(monthlyAdvanceInPeriod(dstState,dstState.leases[0],2027)-1800)<0.01));
  const v18Leap=createEmptyState();v18Leap.property={...v18Leap.property,totalArea:200,billingTakeoverDate:"2026-04-01"};v18Leap.units=[{id:"o",type:"owner",area:100,occupancy:[]},{id:"r",type:"rental",area:100,occupancy:[]}];v18Leap.costPositions=[positionDefaults({id:"ins-leap",label:"Gebäudeversicherung",category:"insurance",amount:1000,serviceStart:"2026-04-01",serviceEnd:"2027-03-31",assignment:"house",agreement:"area",confirmed:true})];const leapForecast=v18CategoryForecast(v18Leap,2027,{category:"insurance",label:"Gebäudeversicherung",route:"data",sub:"positions"});results.push(assert("V18 Volljahresprognose ignoriert Schaltjahr-Differenz",Math.abs(leapForecast.amount-500)<0.01));
  const v18Partial=createEmptyState();v18Partial.property={...v18Partial.property,totalArea:200,billingTakeoverDate:"2026-09-01"};v18Partial.units=[{id:"o",type:"owner",area:100,occupancy:[]},{id:"r",type:"rental",area:100,occupancy:[]}];v18Partial.leases=[{id:"l",start:"2026-09-01",end:"",rent:400,advance:125,tenantName:"V18"}];results.push(assert("V18 Teilperiode plant 7 BK-Vorauszahlungen",Math.abs(monthlyAdvanceInPeriod(v18Partial,v18Partial.leases[0],2026)-875)<0.01));
  const paidAdvanceState=createEmptyState();paidAdvanceState.property.billingTakeoverDate="2027-04-01";paidAdvanceState.leases=[{id:"paid-lease",start:"2027-04-01",end:"",rent:500,advance:150,tenantName:"Ist-Test"}];paidAdvanceState.payments=[];for(let i=0;i<12;i++){const d=new Date(Date.UTC(2027,3+i,3)),date=d.toISOString().slice(0,10);paidAdvanceState.payments.push({date,direction:"income",amount:i===5?500:650,label:"Miete Ist-Test"})}results.push(assert("Ist-Vorauszahlungen statt Vertragssoll",Math.abs(actualAdvanceInPeriod(paidAdvanceState,paidAdvanceState.leases[0],2027)-1650)<0.01));
  const s=createEmptyState();s.property.totalArea=200;s.units=[{type:"owner",area:100,occupancy:[{from:"2025-01-01",to:"",count:2}]},{type:"rental",area:100,occupancy:[{from:"2025-01-01",to:"",count:2}]}];s.leases=[{id:"lease-test",start:"2025-07-01",end:"",rent:500,advance:150,tenantName:"Testperson"}];
  results.push(assert("Wohnfläche 50/50",Math.abs(shares(s,"2025-07-01").area-.5)<1e-9));results.push(assert("Personen 50/50",Math.abs(shares(s,"2025-07-01").persons-.5)<1e-9));
  s.property.billingTakeoverDate="2025-07-01";s.property.predecessorBillingEnd="2025-06-30";const bp=billingPeriodInfo(s,2025),next=billingPeriodInfo(s,2026);
  results.push(assert("Übernahmeperiode beginnt am gespeicherten Datum",bp.start==="2025-07-01"&&bp.end==="2026-03-31"&&bp.isTakeoverPeriod));results.push(assert("Folgeperiode wieder jährlich",next.start==="2026-04-01"&&next.end==="2027-03-31"&&!next.isTakeoverPeriod));results.push(assert("Vorauszahlung Teilperiode korrekt",Math.abs(monthlyAdvanceInPeriod(s,s.leases[0],2025)-1350)<0.01));
  const oldPos=positionDefaults({label:"Vor Übernahme",category:"waste",amount:100,serviceStart:"2025-04-01",serviceEnd:"2025-06-30",assignment:"house",confirmed:true});results.push(assert("Kosten vor Übernahme ausgeschlossen",positionToEvents(s,oldPos,2025).length===0));
  s.costPositions=[positionDefaults({label:"Gemeinsame Kosten",category:"propertyTax",amount:100,serviceStart:"2025-07-01",serviceEnd:"2026-03-31",assignment:"house",confirmed:true})];results.push(assert("Zentrale Kostenposition 50/50",Math.abs(centralBillingAnalysis(s,2025).tenantCosts-50)<0.01));results.push(assert("Aktuelles Datenschema",SCHEMA_VERSION===13));
  const mt={meters:[{id:"m1",name:"Haupt",number:"MTR120456",readings:[{id:"r1",date:"2025-07-01",value:75}]},{id:"m2",name:"Eigen",number:"SUB654321",readings:[]}]},ma=analyzeMeterOCRText(mt,"MTR12O456\nZählerstand 00075,123 m3","");
  results.push(assert("Zählernummer toleriert OCR-Verwechslung",ma.meterId==="m1"));results.push(assert("Zählerfoto erkennt Dezimalstand",Math.abs(ma.reading-75.123)<0.001));const ranked=rankMeterCandidates(mt,"m1","2025-07-05",meterReadingCandidates("00075123","Kontrast",.76));results.push(assert("Fehlende Dezimalstelle rekonstruiert",ranked[0]&&Math.abs(ranked[0].value-75.123)<.001));
  results.push(assert("Dokumenten-Inbox Neu",documentWorkflowState({analysis:{status:"queued"}})==="new"));results.push(assert("Dokumenten-Inbox Prüfen",documentWorkflowState({analysis:{status:"done",fields:{positionProposals:[{id:"x"}]}}})==="review"));results.push(assert("Kostenposition besitzt Herkunft",!!positionDefaults({label:"Test",amount:1,confirmed:true,origin:"manual"}).provenance));
  const px=positionDefaults({label:"Niederschlagswasser",amount:44.94,confirmed:true,sourceId:"s1"}),ps={...createEmptyState(),sources:[{id:"s1",name:"Kommunalverwaltung Beispielstadt",amount:44.94,dueDates:["2025-11-15"]}],costPositions:[px],payments:[]};results.push(assert("Zahlungsabgleich starker Treffer",paymentMatchScore(ps,{direction:"outflow",amount:44.94,label:"Kommunalverwaltung Niederschlagswasser",date:"2025-11-15"},px).score>=80));results.push(assert("Quellen-Zahlungsabgleich",sourcePaymentMatchScore(ps,{direction:"outflow",amount:44.94,label:"Kommunalverwaltung Beispielstadt",date:"2025-11-15"},ps.sources[0]).score>=70));
  const c=parseBankCSV("Buchungstag;Betrag;Verwendungszweck\n05.08.2025;-44,94;Gebühr\n06.08.2025;650,00;Miete Testperson");results.push(assert("Bank-CSV Ein-/Ausgang",c.rows.length===2&&c.rows[0].direction==="outflow"&&c.rows[1].direction==="income"));
  const rentState={leases:[{id:"l1",start:"2025-01-01",end:"",rent:500,advance:150,tenantName:"Testperson"}],payments:[{date:smartMonthKey()+"-05",direction:"income",amount:650,label:"Miete Testperson"}]};results.push(assert("Mietmonitor erkennt Vollzahlung",rentMonthStatus(rentState).status==="paid"));
  results.push(assert("Smart-Klassifikation Niederschlagswasser",smartClassifyCostText("Niederschlagswasser 44,94 EUR").category==="rainwater"));results.push(assert("Navigation fünf Hauptbereiche",new Set(Object.keys(ROUTE_LABELS)).size===5));results.push(assert("Mietvertrag unter Vermietung",CHECK_INPUT_MAP["Mietvertrag fehlt"]?.route==="rental"));results.push(assert("Detailseiten besitzen Elternbereiche",visibleSub("data","positions")==="costs"&&visibleSub("owner","reconciliation")==="payments"));results.push(assert("Nur zentraler Abrechnungsweg",typeof sourceToEvents==="undefined"&&typeof allocateEvent==="undefined"&&typeof workflowView==="undefined"));
  results.push(assert("Konfidenz verständlich gestuft",confidenceBand(92).id==="high"&&confidenceBand(60).id==="medium"&&confidenceBand(30).id==="low"));results.push(assert("Datenqualität sprachlich gestuft",qualityBand(91).label==="Sehr gut"&&qualityBand(50).label==="Unvollständig"));results.push(assert("Entscheidungs-UX aktiv",DECISION_UI_VERSION===1));

  results.push(assert("Fristberechnung nutzt ISO-Datum",periodDeadlineISO(2025)==="2027-03-31"&&periodDeadline(2025)==="31.03.2027"));
  results.push(assert("Zuordnung wird menschenlesbar",assignmentLabel("house")==="gesamtes Haus"&&agreementLabel("area")==="Wohnfläche"));
  results.push(assert("Konfidenz 0–1 wird korrekt normalisiert",confidencePercent(.82)===82));
  const taskStateBackup=state;
  results.push(assert("Premium-Entscheidungsqueue aktiv",typeof smartDecisionQueue==="function"));
  results.push(assert("Meter-Crop besitzt Tipp-Alternative",typeof adjustMeterCrop==="function"));
return results
}

/* ===== ui.js ===== */
/* Phase 9 runtime bridge: zustandslose UI-Helfer in src/ui/ui-core.ts. */
/* Dialogzustand und Dialogsteuerung bleiben zusammen, da 160-app.js diese Bindungen direkt nutzt. */

const {
  $,
  esc,
  focusableIn,
  visibleDialog,
  trapFocusInDialog,
  formField,
  clearCentralValidation,
  centralFieldLabel,
  markCentralError,
  validateCentralForm
}=AppUiCore;

let MODAL_RETURN_FOCUS=null,MODAL_INITIAL_FORM="",MODAL_RETURN_FOCUS_OVERRIDE=null;
function formSnapshot(root){
  const form=root?.querySelector?.("form");if(!form)return"";
  return JSON.stringify([...new FormData(form).entries()])
}
function closeModal(force=false){
  const host=$("modal");if(!host||host.classList.contains("hidden"))return true;
  if(!force&&MODAL_INITIAL_FORM&&formSnapshot(host)!==MODAL_INITIAL_FORM&&!confirm("Ungespeicherte Änderungen verwerfen?"))return false;
  host.classList.add("hidden");
  const back=MODAL_RETURN_FOCUS;MODAL_RETURN_FOCUS=null;MODAL_INITIAL_FORM="";
  setTimeout(()=>back?.focus?.(),0);return true
}
function modal(title,html,onReady){
  MODAL_RETURN_FOCUS=MODAL_RETURN_FOCUS_OVERRIDE||document.activeElement;
  MODAL_RETURN_FOCUS_OVERRIDE=null;
  $("modalTitle").textContent=title;$("modalBody").innerHTML=html;$("modal").classList.remove("hidden");
  $("modalClose").onclick=()=>closeModal(false);
  onReady?.();
  MODAL_INITIAL_FORM=formSnapshot($("modal"));
  const candidates=focusableIn($("modal")).filter(x=>x.id!=="modalClose");
  setTimeout(()=>candidates[0]?.focus?.(),30)
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
const ROUTE_LABELS={home:"Start",rental:"Vermietung",data:"Haus",owner:"Finanzen",more:"Mehr"};
const DEFAULT_SUB={data:"overview",rental:"overview",owner:"overview",more:"smart"};
const SUB_PARENT={
  data:{object:"overview",property:"overview",units:"overview",sources:"costs",positions:"costs",assessment:"costs"},
  rental:{lease:"overview",calculation:"billing",workflow:"billing"},
  owner:{tasks:"overview",cashflow:"payments",reconciliation:"payments",finance:"planning",analytics:"planning"},
  more:{overview:"smart",legal:"app",security:"protection",backup:"protection",recovery:"protection",audit:"app",diagnostics:"app"}
};
let route="home";
let sub={...DEFAULT_SUB};

function normalizeSub(routeName,subName){
  if(!subName)return DEFAULT_SUB[routeName]||"";
  if(routeName==="more"&&subName==="overview")return "smart";
  if(routeName==="rental"&&(subName==="calculation"||subName==="workflow"))return subName;
  return subName
}
function visibleSub(routeName,subName){return SUB_PARENT[routeName]?.[subName]||subName||DEFAULT_SUB[routeName]||""}
function syncRouteFromHash(){
  const raw=decodeURIComponent(location.hash.replace(/^#/,"")).trim(),parts=raw.split("/").filter(Boolean);
  const r=ROUTE_LABELS[parts[0]]?parts[0]:"home";
  route=r;
  if(r!=="home")sub[r]=normalizeSub(r,parts[1]||DEFAULT_SUB[r])
}
function routeHash(r,s=null){return r==="home"?"#home":`#${r}/${encodeURIComponent(s||DEFAULT_SUB[r])}`}
function go(r,s=null){
  if(!ROUTE_LABELS[r])r="home";
  route=r;
  if(r!=="home"&&s)sub[r]=normalizeSub(r,s);
  const target=routeHash(r,r==="home"?null:sub[r]);
  if(location.hash!==target)location.hash=target;else render()
}
function goTop(r){go(r,r==="home"?null:DEFAULT_SUB[r])}
function goSub(group,id){sub[group]=normalizeSub(group,id);go(group,sub[group])}
syncRouteFromHash();
window.addEventListener("hashchange",()=>{syncRouteFromHash();render();window.scrollTo({top:0,left:0,behavior:"auto"})});

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
    await saveState(state);LAST_STABLE_STATE=cloneState(state);storageError=null;try{await updateBadge()}catch{};if(action)AppFeedback.showToast(action,{kind:"success"});return true
  }catch(e){
    recordClientError("persist",e);storageError=e;console.error("Speicher-/Integritätsfehler:",e);
    if(before){state=before;LAST_STABLE_STATE=cloneState(before)}
    AppFeedback.showToast("Speichern fehlgeschlagen – Änderung wurde zurückgenommen.",{kind:"error",timeoutMs:5000});
    alert("Die Änderung wurde nicht gespeichert und zurückgenommen: "+String(e.message||e));try{render()}catch{};return false
  }
}

function nav(){
  document.querySelectorAll(".main-tabs button").forEach(b=>{
    const active=b.dataset.route===route;b.classList.toggle("active",active);
    if(active)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current")
  });
  const ctx=$("pageContext");if(ctx)ctx.textContent=route==="home"?(state.property?.name||"Start"):ROUTE_LABELS[route];
  document.title=`${ROUTE_LABELS[route]||"Mietverwaltung"} · Mietverwaltung`
}
function taskList(){
  const out=[],seen=new Set(),today=smartToday(),cy=currentPeriodYear();
  const push=t=>{if(!t?.due||!t?.title)return;const k=`${t.due}|${normalizeLabelText(t.title)}`;if(seen.has(k))return;seen.add(k);out.push(t)};
  for(const s of state.sources||[]){
    for(const d of Array.isArray(s.dueDates)?s.dueDates:[]){
      push({id:`source-${s.id}-${d}`,title:`Fälligkeit: ${s.name||"Kostenquelle"}`,due:d,lead:14,origin:"source",sourceId:s.id})
    }
  }
  for(let y=cy-3;y<=cy;y++){
    const info=billingPeriodInfo(state,y);
    if(!info.active||info.end>=today||snapshotFor(state,y))continue;
    push({id:`billing-${y}`,title:`Endabrechnung ${billingPeriodLabel(state,y)} fertigstellen`,due:periodBillingTargetISO(y),lead:30,origin:"billing",periodYear:y})
  }
  for(const t of state.tasks||[])push(t);
  return out.sort((a,b)=>(a.due||"").localeCompare(b.due||""))
}
function daysUntil(d){const x=calendarDayDiff(smartToday(),d);return Number.isFinite(x)?x:0}
function taskHTML(t){
  const d=daysUntil(t.due),cls=d<0?"bad":d<=Number(t.lead||30)?"warn":"good",origin=t.origin==="source"?"aus Fälligkeit":t.origin==="billing"?"eigene Zielfrist 31.03.":t.origin==="smart"?"vorgeschlagen":"eigene Erinnerung";
  return `<div class="task premium-task"><div><h4>${esc(t.title)}</h4><small>${dateDE(t.due)} · ${esc(origin)}</small></div><span class="pill ${cls}">${d<0?`${Math.abs(d)} Tage überfällig`:d===0?"heute":`in ${d} Tagen`}</span></div>`
}

function render(){
  nav();
  if(route==="home")home();
  else if(route==="data")dataWorkspace();
  else if(route==="rental")rentalWorkspace();
  else if(route==="owner")ownerWorkspace();
  else more();
}

function workspaceHeader(eyebrow,title,description,tabs,active){
  return `<section class="workspace">
    <div class="section-head workspace-head"><div><p class="eyebrow">${esc(eyebrow)}</p><h2>${esc(title)}</h2><p class="muted">${esc(description)}</p></div></div>
    <div class="workspace-layout">
      <aside class="workspace-sidebar" aria-label="${esc(title)} Navigation">
        <p class="workspace-nav-title">Bereiche</p>
        ${tabs.map(i=>`<button data-workspace-sub="${i.id}" class="${i.id===active?"active":""}">${i.icon?`<span class="nav-symbol">${i.icon}</span>`:""}<span>${esc(i.label)}</span></button>`).join("")}
      </aside>
      <div class="workspace-content">
        <label class="workspace-mobile-picker"><span>Bereich</span><select id="workspaceSelect">${tabs.map(i=>`<option value="${esc(i.id)}" ${i.id===active?"selected":""}>${esc(i.label)}</option>`).join("")}</select></label>
        <div id="workspaceBody"></div>
      </div>
    </div>
  </section>`
}
function bindWorkspaceTabs(group,renderer){
  document.querySelectorAll("[data-workspace-sub]").forEach(b=>b.onclick=()=>goSub(group,b.dataset.workspaceSub));
  const picker=$("workspaceSelect");if(picker)picker.onchange=e=>goSub(group,e.target.value)
}


const CHECK_INPUT_MAP={
  "Objektname fehlt":{route:"data",sub:"property",label:"Objektname"},
  "Gesamtwohnfläche fehlt":{route:"data",sub:"property",label:"Gesamtwohnfläche"},
  "Eigennutzungs-Einheit fehlt":{route:"data",sub:"units",label:"Eigennutzung"},
  "Mietwohnung fehlt":{route:"data",sub:"units",label:"Mietwohnung"},
  "Mietvertrag fehlt":{route:"rental",sub:"overview",label:"Mietvertrag"},
  "Keine bestätigte Kostenposition für diese Abrechnungsperiode":{route:"data",sub:"positions",label:"Kostenpositionen"},
  "Wasserzähler / Verbrauchsdaten fehlen":{route:"rental",sub:"water",label:"Wasserzähler"},
  "Ungeklärte Umlageentscheidungen":{route:"data",sub:"positions",label:"Umlageentscheidung"}
};

function checkInputCoverage(){
  const missing=[],routeTabs={
    data:["overview","object","property","units","costs","sources","positions","infrastructure","assessment","documents"],
    rental:["overview","lease","water","billing","calculation","workflow"],
    owner:["overview","payments","cashflow","reconciliation","planning","finance","analytics","tasks"],
    more:["smart","legal","protection","security","backup","recovery","app","audit","diagnostics","overview"]
  };
  for(const [issue,m] of Object.entries(CHECK_INPUT_MAP))if(!routeTabs[m.route]?.includes(m.sub))missing.push(`${issue} → ${m.route}/${m.sub}`);
  for(const c of billingReadiness(state,currentPeriodYear()))if(!CHECK_INPUT_MAP[c.label])missing.push(`${c.label} → keine Eingabezuordnung`);
  return [...new Set(missing)]
}

function home(){
  const quality=dataQualityScore(state),qBand=qualityBand(quality),forecast=intelligentForecast(state),rent=state.leases.reduce((s,l)=>s+Number(l.rent||0),0),repay=Number(state.finance.repayment||0),rateAfterRent=repay-rent,a=billingAnalysis(state,currentPeriodYear()),sh=shares(state,billingPeriodStart(state,currentPeriodYear())),water=settlementConsumption(state,settlementByPeriod(state,currentPeriodYear())),decisions=smartDecisionQueue(state),next=decisions[0]||null,rentNow=rentMonthStatus(state),proj=billingProjection(state),v18=v18BillingAssistant(state,preferredBillingYear());
  $("app").innerHTML=`<section class="home-view">${storageError?`<div class="legal-warn"><strong>Lokaler Speicher eingeschränkt</strong><br>${esc(storageError.message||storageError)}</div>`:""}
  <div class="hero experience-hero"><div><p class="eyebrow">START</p><h2>Dein Haus auf einen Blick</h2><p class="muted">${esc(state.property.name||"Hausverwaltung")} · ${esc(billingPeriodLabel(state,currentPeriodYear()))}</p></div><div class="quality-orb quality-${qBand.id}" title="Datenqualität ${quality}%"><strong>${esc(qBand.label)}</strong><small>Datenstatus</small></div></div>
  <div class="quick-actions-bar"><button data-home-action="document"><span class="quick-symbol">▤</span><span><strong>Dokument</strong><small>erfassen</small></span></button><button data-home-action="meter"><span class="quick-symbol">◌</span><span><strong>Zähler</strong><small>ablesen</small></span></button><button data-home-action="payment"><span class="quick-symbol">€</span><span><strong>Zahlung</strong><small>erfassen</small></span></button><button data-home-action="billing"><span class="quick-symbol">✓</span><span><strong>Abrechnung</strong><small>prüfen</small></span></button></div>
  ${v18BillingAssistantHTML(state,v18.year,{compact:true})}
  ${next?`<section class="next-best-action decision-${next.severity}"><div><p class="eyebrow">NÄCHSTER SINNVOLLER SCHRITT</p><h3>${esc(next.title)}</h3><p>${esc(next.detail||"")}</p><div class="decision-meta"><span class="decision-kind">${esc(next.kind)}</span><span class="confidence confidence-${next.band.id}">${esc(next.band.short)}</span></div>${decisionWhyHTML(next)}</div><button id="openNextDecision" class="primary">${esc(next.actionLabel)}</button></section>`:`<div class="legal-ok experience-ok"><strong>Alles Wesentliche ist im grünen Bereich.</strong><br>Aktuell gibt es keinen dringenden nächsten Schritt.</div>`}
  <div class="grid cards overview-cards"><article class="card metric-card"><span>Hausrate</span><strong>${euro(repay)}</strong><small>monatlich</small></article><article class="card metric-card"><span>Kaltmiete</span><strong>${euro(rent)}</strong><small>monatlich</small></article><article class="card metric-card"><span>Hausrate nach Kaltmiete</span><strong class="${rateAfterRent>0?"negative":"positive"}">${euro(rateAfterRent)}</strong><small>ohne weitere Hauskosten</small></article><article class="card metric-card"><span>Mieter-BK aktuell</span><strong>${euro(a.tenantCosts)}</strong><small>bestätigter Stand</small></article></div>
  ${decisions.length>1?`<div class="card priority-card"><div class="card-head"><div><p class="eyebrow">WEITERE HINWEISE</p><h3>${decisions.length-1} weitere Punkte</h3></div><button class="secondary compact" id="openSmart">Alle ansehen</button></div>${decisions.slice(1,4).map((x,i)=>`<button class="decision-row" data-smart-home="${i+1}"><span><strong>${esc(x.title)}</strong><small>${esc(x.detail||"")}</small></span><span class="confidence confidence-${x.band.id}">${esc(x.band.short)}</span></button>`).join("")}</div>`:""}
  <div class="grid two-up"><div class="card"><p class="eyebrow">VERTEILUNG</p><h3>Aktuelle Anteile</h3><div class="fact-row"><span>Wohnfläche Mieterin</span><strong>${percent(sh.area)}</strong></div><div class="fact-row"><span>Kaltwasseranteil</span><strong>${water?.valid?percent(water.share):"noch offen"}</strong></div><div class="fact-row"><span>Umlagefähige Kosten</span><strong>${euro(a.tenantCosts)}</strong></div></div><div class="card"><p class="eyebrow">STATUS</p><h3>Vermietung</h3><div class="fact-row"><span>Mietzahlung</span><strong>${rentNow.status==="none"?"–":esc(rentStatusLabel(rentNow))}</strong></div><div class="fact-row"><span>Abrechnungsprognose</span><strong>${euro(Math.abs(proj.projectedResult))}</strong></div><div class="fact-row"><span>Einordnung</span><strong>${proj.projectedResult>=0?"Nachzahlung":"Guthaben"}</strong></div></div></div>
  <div class="card"><div class="card-head"><div><p class="eyebrow">PROGNOSE</p><h3>Nächste vier Monate</h3></div><button class="secondary compact" id="openPlanning">Planung öffnen</button></div><div class="tablewrap"><table class="costtable"><thead><tr><th>Monat</th><th>Einnahmen</th><th>Ausgaben</th><th>Saldo</th></tr></thead><tbody>${forecast.slice(0,4).map(x=>`<tr><td>${x.label}</td><td>${euro(x.income)}</td><td>${euro(x.outflow)}</td><td class="${x.net<0?"negative":"positive"}">${euro(x.net)}</td></tr>`).join("")}</tbody></table></div></div></section>`;
  if($("openNextDecision"))$("openNextDecision").onclick=()=>go(next.route,next.sub||DEFAULT_SUB[next.route]);
  if($("openSmart"))$("openSmart").onclick=()=>go("more","smart");$("openPlanning").onclick=()=>go("owner","planning");
  document.querySelectorAll("[data-smart-home]").forEach(b=>b.onclick=()=>{const x=decisions[Number(b.dataset.smartHome)];if(x)go(x.route,x.sub||DEFAULT_SUB[x.route])});
  document.querySelectorAll("[data-home-action]").forEach(b=>b.onclick=()=>{const a=b.dataset.homeAction;if(a==="document"){go("data","documents");setTimeout(openDocumentCapture,0)}else if(a==="meter"){go("data","infrastructure");setTimeout(()=>openMeterPhotoCapture(),0)}else if(a==="payment"){go("owner","cashflow");setTimeout(openPaymentEditor,0)}else go("rental","billing")});
  bindV18AssistantActions()
}




function hubAction(id,title,detail,badge=""){
  return `<button class="hub-action" data-hub-action="${id}"><span><strong>${esc(title)}</strong><small>${esc(detail)}</small></span>${badge?`<b>${esc(badge)}</b>`:""}<span class="chevron">›</span></button>`
}
async function houseOverviewView(){
  let docs=state.documentsCache||[];
  try{docs=await listDocuments();state.documentsCache=docs}catch{}
  if(route!=="data"||sub.data!=="overview")return;
  const owner=unitByType(state,"owner"),rental=unitByType(state,"rental"),openDocs=docs.filter(d=>documentWorkflowState(d)!=="done").length,takeover=state.property.billingTakeoverDate||state.property.ownershipEffective||"";
  $("workspaceBody").innerHTML=`<div class="grid cards overview-cards">
    <article class="card"><span>Wohnfläche gesamt</span><strong>${Number(state.property.totalArea||0).toLocaleString("de-DE")} m²</strong><small>${owner&&rental?`${owner.area} + ${rental.area} m²`:"Einheiten prüfen"}</small></article>
    <article class="card"><span>Kostenpositionen</span><strong>${state.costPositions.length}</strong><small>${state.costPositions.filter(p=>p.confirmed).length} bestätigt</small></article>
    <article class="card"><span>Zähler</span><strong>${state.meters.length}</strong><small>${state.meters.reduce((s,m)=>s+(m.readings?.length||0),0)} Ablesungen</small></article>
    <article class="card"><span>Dokumente offen</span><strong>${openDocs}</strong><small>${docs.length} insgesamt</small></article>
  </div>
  <section class="card embedded-overview-card">
    <div class="card-head"><div><p class="eyebrow">STAMMDATEN</p><h3>Objekt & Einheiten</h3></div><button class="secondary compact" id="editPropertyOverview">Objektdaten bearbeiten</button></div>
    <div class="fact-row"><span>Objekt</span><strong>${esc(state.property.name||"noch nicht benannt")}</strong></div>
    <div class="fact-row"><span>Adresse</span><strong>${esc(state.property.address||"fehlt")}</strong></div>
    <div class="fact-row"><span>Gesamtwohnfläche</span><strong>${state.property.totalArea?`${state.property.totalArea} m²`:"fehlt"}</strong></div>
    <div class="fact-row"><span>Eigennutzung</span><strong>${owner?`${esc(owner.name)} · ${owner.area} m²`:"fehlt"}</strong></div>
    <div class="fact-row"><span>Mietwohnung</span><strong>${rental?`${esc(rental.name)} · ${rental.area} m²`:"fehlt"}</strong></div>
    ${takeover?`<div class="fact-row"><span>Abrechnung übernommen</span><strong>${dateDE(takeover)}</strong></div>`:""}
    <button class="secondary wide" id="editUnitsOverview">Einheiten bearbeiten</button>
  </section>
  <div class="card">
    ${hubAction("costs","Kosten","Bescheide, Rechnungen, Kostenpositionen und Umlage",String(state.costPositions.length))}
    ${hubAction("infrastructure","Zähler","Wasserzähler, Ablesungen und Abfallbehälter",String(state.meters.length))}
    ${hubAction("documents","Dokumente","Belege, PDFs und OCR-Analyse",openDocs?`${openDocs} offen`:"")}
  </div>`;
  $("editPropertyOverview").onclick=()=>goSub("data","property");
  $("editUnitsOverview").onclick=()=>goSub("data","units");
  document.querySelectorAll("[data-hub-action]").forEach(b=>b.onclick=()=>goSub("data",b.dataset.hubAction))
}
function houseObjectHubView(){
  const owner=unitByType(state,"owner"),rental=unitByType(state,"rental");
  $("workspaceBody").innerHTML=`<div class="grid two-up">
    <article class="card"><p class="eyebrow">OBJEKT</p><h3>${esc(state.property.name||"Haus")}</h3><p>${esc(state.property.address||"Adresse fehlt")}</p><div class="fact-row"><span>Gesamtwohnfläche</span><strong>${state.property.totalArea?`${state.property.totalArea} m²`:"fehlt"}</strong></div><div class="fact-row"><span>Baujahr Stammgebäude</span><strong>${esc(state.property.year||"–")}</strong></div><button class="secondary wide" data-house-detail="property">Objektdaten bearbeiten</button></article>
    <article class="card"><p class="eyebrow">EINHEITEN</p><h3>${state.units.length} Einheiten</h3><div class="fact-row"><span>Eigennutzung</span><strong>${owner?`${owner.area} m²`:"fehlt"}</strong></div><div class="fact-row"><span>Mietwohnung</span><strong>${rental?`${rental.area} m²`:"fehlt"}</strong></div><button class="secondary wide" data-house-detail="units">Einheiten verwalten</button></article>
  </div>
  <div class="info-strip"><strong>Warum hier zusammen?</strong><span>Objekt- und Einheitendaten bilden gemeinsam die Grundlage für Flächenanteile und Abrechnungen.</span></div>`;
  document.querySelectorAll("[data-house-detail]").forEach(b=>b.onclick=()=>goSub("data",b.dataset.houseDetail))
}
function houseCostsHubView(){
  const y=currentPeriodYear(),sources=state.sources.length,positions=state.costPositions.length,open=state.costPositions.filter(p=>p.assignment==="review"||!p.confirmed).length;
  $("workspaceBody").innerHTML=`<div class="grid cards">
    <article class="card"><span>Kostenquellen</span><strong>${sources}</strong><small>Bescheide, Rechnungen, Verträge</small></article>
    <article class="card"><span>Kostenpositionen</span><strong>${positions}</strong><small>${open} zu prüfen</small></article>
    <article class="card"><span>Abrechnungsperiode</span><strong>${esc(billingPeriodLabel(state,y))}</strong><small>aktiver Zeitraum</small></article>
  </div>
  <div class="card">
    ${hubAction("sources","Kostenquellen","Anbieter, Bescheide und Fälligkeiten",String(sources))}
    ${hubAction("positions","Kostenpositionen","Umlage, Zeitraum, Betrag und Herkunft",open?`${open} offen`:"")}
    ${hubAction("assessment","Grundbesitzabgaben","Kommunale Abgaben strukturiert verwalten")}
  </div>`;
  document.querySelectorAll("[data-hub-action]").forEach(b=>b.onclick=()=>goSub("data",b.dataset.hubAction))
}
function financePaymentsHubView(){
  const rows=actualCashflowByMonth(state,12),income=rows.reduce((s,r)=>s+r.income,0),outflow=rows.reduce((s,r)=>s+r.outflow,0),matches=smartPaymentPlan(state);
  $("workspaceBody").innerHTML=`<div class="grid cards">
    <article class="card"><span>Einnahmen 12M</span><strong>${euro(income)}</strong></article>
    <article class="card"><span>Ausgaben 12M</span><strong>${euro(outflow)}</strong></article>
    <article class="card"><span>Zuordnungsvorschläge</span><strong>${matches.length}</strong><small>plausible offene Treffer</small></article>
  </div><div class="card">
    ${hubAction("cashflow","Zahlungen & Kontoimport","Buchungen erfassen, CSV importieren und Verlauf ansehen")}
    ${hubAction("reconciliation","Zahlungen zuordnen","Ausgaben mit Kostenquellen und Positionen verknüpfen",matches.length?String(matches.length):"")}
  </div>`;
  document.querySelectorAll("[data-hub-action]").forEach(b=>b.onclick=()=>goSub("owner",b.dataset.hubAction))
}
function financePlanningHubView(){
  const f=intelligentForecast(state,12),sum=f.reduce((s,x)=>s+x.net,0),alerts=costTrendAlerts(state,currentPeriodYear());
  $("workspaceBody").innerHTML=`<div class="grid cards">
    <article class="card"><span>12M-Cashflow</span><strong class="${sum<0?"negative":"positive"}">${euro(sum)}</strong><small>geplanter Gesamtsaldo</small></article>
    <article class="card"><span>Kostenhinweise</span><strong>${alerts.length}</strong><small>auffällige Veränderungen</small></article>
  </div><div class="card">
    ${hubAction("finance","Planung & Hauskosten","Hausrate, feste Kosten und 12-Monats-Prognose")}
    ${hubAction("analytics","Jahresvergleich & Verbrauch","Kostenentwicklung und Zählertrends",alerts.length?String(alerts.length):"")}
  </div>`;
  document.querySelectorAll("[data-hub-action]").forEach(b=>b.onclick=()=>goSub("owner",b.dataset.hubAction))
}
function protectionHubView(){
  const points=state.meta?.restorePoints?.length||0,last=state.meta?.lastBackupAt?new Date(state.meta.lastBackupAt).toLocaleDateString("de-DE"):"keine";
  $("workspaceBody").innerHTML=`<div class="grid cards">
    <article class="card"><span>Geräteschutz</span><strong>${authEnabled()?"Aktiv":"Aus"}</strong><small>Face ID / Geräteauthentifizierung</small></article>
    <article class="card"><span>Letzte Datensicherung</span><strong>${esc(last)}</strong><small>verschlüsselte Vollsicherung</small></article>
    <article class="card"><span>Sicherungspunkte</span><strong>${points}</strong><small>lokale Rücksprungstände</small></article>
  </div><div class="card">
    ${hubAction("security","Geräteschutz","Face ID / Geräteauthentifizierung verwalten")}
    ${hubAction("backup","Datensicherung","Verschlüsselte Sicherung erstellen oder wiederherstellen")}
    ${hubAction("recovery","Sicherungspunkte","Lokale Rücksprungstände verwalten",points?String(points):"")}
  </div>`;
  document.querySelectorAll("[data-hub-action]").forEach(b=>b.onclick=()=>goSub("more",b.dataset.hubAction))
}
function appManagementHubView(){
  const errors=state.meta?.errorLog?.length||0;
  $("workspaceBody").innerHTML=`<div class="card"><p class="eyebrow">SELTENER BENÖTIGT</p><h3>Erweitert</h3><p class="muted">Rechtsstand, Änderungsverlauf und technische Prüfungen bleiben erreichbar, ohne die tägliche Navigation zu belasten.</p></div>
  <div class="card">
    ${hubAction("legal","Recht & Regeln","Hinterlegte Rechtsgrundlagen und Prüfstand")}
    ${hubAction("audit","Änderungsverlauf","Nachvollziehen, was wann geändert wurde")}
    ${hubAction("diagnostics","App-Prüfung","Datenintegrität, Speicher, Tests und technische Details",errors?`${errors} Fehler`:"")}
  </div>`;
  document.querySelectorAll("[data-hub-action]").forEach(b=>b.onclick=()=>goSub("more",b.dataset.hubAction))
}

function dataWorkspace(){
  const tabs=[
    {id:"overview",label:"Überblick",icon:"⌂"},
    {id:"costs",label:"Kosten",icon:"€"},
    {id:"infrastructure",label:"Zähler",icon:"◌"},
    {id:"documents",label:"Dokumente",icon:"▤"}
  ];
  const active=sub.data||"overview",visible=visibleSub("data",active);
  $("app").innerHTML=workspaceHeader("HAUS","Haus","Objekt, Kosten, Zähler und Belege an einem Ort.",tabs,visible);
  bindWorkspaceTabs("data",dataWorkspace);
  if(active==="overview")houseOverviewView();
  else if(active==="object")houseObjectHubView();
  else if(active==="costs")houseCostsHubView();
  else if(active==="property")propertyView();
  else if(active==="units")unitsDataView();
  else if(active==="sources")sourcesDataView();
  else if(active==="positions")costPositionsDataView();
  else if(active==="assessment")assessmentDataView();
  else if(active==="infrastructure")infrastructureDataView();
  else documentsDataView()
}
function propertyView(){
  const takeover=state.property.billingTakeoverDate||state.property.ownershipEffective||"",pred=state.property.predecessorBillingEnd||"";
  $("workspaceBody").innerHTML=`<form id="propertyForm" class="card form-grid">
    ${formField({name:"name",label:"Objektname",value:state.property.name||"",placeholder:"z. B. Zweifamilienhaus"})}
    ${formField({name:"address",label:"Adresse",value:state.property.address||"",placeholder:"Straße, Hausnummer, Ort"})}
    ${formField({name:"totalArea",label:"Gesamtwohnfläche m²",type:"number",step:"0.01",min:0,value:state.property.totalArea||""})}
    ${formField({name:"year",label:"Baujahr Stammgebäude",type:"number",min:1800,value:state.property.year||""})}
    <div class="full section-separator"><h3>Abrechnungsrhythmus</h3><p class="muted">Abgerechnet wird immer nach Kalenderjahr 01.01.–31.12. Bei einer Übernahme mitten im Jahr beginnt nur die erste eigene Periode am Übernahmedatum; ab dem Folgejahr gilt wieder 01.01.–31.12.</p></div>
    ${formField({name:"billingTakeoverDate",label:"Abrechnung übernommen am",type:"date",value:takeover})}
    ${formField({name:"predecessorBillingEnd",label:"Voreigentümer rechnet bis",type:"date",value:pred})}
    <div class="full" id="billingPeriodPreview"></div>
    <div class="full section-separator"><h3>Abrechnung & Korrespondenz</h3></div>
    ${formField({name:"landlordName",label:"Absender / Vermieter",value:state.correspondence.landlordName||""})}
    ${formField({name:"landlordAddress",label:"Absenderadresse",value:state.correspondence.landlordAddress||"",full:true})}
    ${formField({name:"iban",label:"IBAN für Nachzahlungen",value:state.correspondence.iban||""})}
    ${formField({name:"paymentReference",label:"Verwendungszweck",value:state.correspondence.paymentReference||""})}
    ${formField({name:"contact",label:"Kontakt für Rückfragen",value:state.correspondence.contact||""})}
    <div class="full"><button class="primary">Objektdaten speichern</button></div>
  </form>`;
  const preview=()=>{const v=Object.fromEntries(new FormData($("propertyForm"))),tmp=structuredClone(state);tmp.property.billingTakeoverDate=v.billingTakeoverDate||"";tmp.property.predecessorBillingEnd=v.predecessorBillingEnd||"";
    const y=currentPeriodYear(),ctx=billingPeriodContext(tmp,y),p=billingPeriodInfo(tmp,y);$("billingPeriodPreview").innerHTML=`<div class="${ctx.kind==="takeover"?"info":"legal-ok"}"><strong>${esc(billingPeriodLabel(tmp,y))}</strong><br>${esc(ctx.message)}${p.isTakeoverPeriod?`<br><small>Danach: ${esc(billingPeriodLabel(tmp,y+1))}</small>`:""}<br><small>Endabrechnung intern bis ${periodBillingTarget(y)} · gesetzliche Abrechnungsfrist ${periodDeadline(y)}</small></div>`};
  $("propertyForm").oninput=preview;preview();
  $("propertyForm").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));state.property={...state.property,name:v.name.trim(),address:v.address.trim(),totalArea:Number(v.totalArea)||0,year:v.year,billingTakeoverDate:v.billingTakeoverDate||"",predecessorBillingEnd:v.predecessorBillingEnd||""};if(state.property.billingTakeoverDate&&!state.property.ownershipEffective)state.property.ownershipEffective=state.property.billingTakeoverDate;
    state.correspondence={landlordName:v.landlordName.trim(),landlordAddress:v.landlordAddress.trim(),iban:v.iban.trim(),paymentReference:v.paymentReference.trim(),contact:v.contact.trim()};await persist("Objektdaten geändert",state.property.name||"Objekt");propertyView()}
}
function unitsDataView(){
  const owner=unitByType(state,"owner"),rental=unitByType(state,"rental");
  $("workspaceBody").innerHTML=`<div class="card"><button id="addUnit" class="primary">Einheit hinzufügen</button></div>
  ${state.units.map(u=>`<div class="item"><div class="row between"><div><h3>${esc(u.name)}</h3><p>${u.type==="owner"?"Eigennutzung":"Mietwohnung"} · ${u.area} m²${u.constructionYear?` · Baujahr ${esc(u.constructionYear)}`:""}</p><p>${esc(u.note||"")}</p></div><button class="secondary" data-edit-unit="${u.id}">Bearbeiten</button></div></div>`).join("")||"<div class='legal-warn'>Noch keine Einheiten angelegt.</div>"}
  <div class="card"><h3>Aktuelle Zuordnung</h3><p>Eigennutzung: <strong>${owner?esc(owner.name):"fehlt"}</strong></p><p>Mietwohnung: <strong>${rental?esc(rental.name):"fehlt"}</strong></p></div>`;
  $("addUnit").onclick=()=>openUnitEditor();
  document.querySelectorAll("[data-edit-unit]").forEach(b=>b.onclick=()=>openUnitEditor(state.units.find(x=>x.id===b.dataset.editUnit)))
}

function openUnitEditor(x=null){
  const today=localDateISO(),current=currentPersons(x,today);
  modal(x?"Einheit bearbeiten":"Einheit hinzufügen",`<form id="f" class="form-grid">
    ${formField({name:"name",label:"Bezeichnung",value:x?.name||"",placeholder:"z. B. Eigennutzung"})}
    ${formField({name:"type",label:"Nutzung",type:"select",value:x?.type||"rental",options:[{value:"owner",label:"Eigennutzung"},{value:"rental",label:"Mietwohnung"}]})}
    ${formField({name:"area",label:"Wohnfläche (m²)",type:"number",step:"0.01",min:0,value:x?.area||""})}
    ${formField({name:"constructionYear",label:"Baujahr dieses Gebäudeteils",type:"number",min:1800,value:x?.constructionYear||""})}
    ${formField({name:"buildingPart",label:"Gebäudeteil",value:x?.buildingPart||"",placeholder:"z. B. Stammgebäude oder Anbau"})}
    ${formField({name:"persons",label:"Aktuelle Personenzahl",type:"number",step:"1",min:0,value:current||0})}
    ${formField({name:"occupancyFrom",label:"Personenzahl gültig ab",type:"date",value:today})}
    ${formField({name:"note",label:"Notiz",value:x?.note||"",full:true})}
    <div class="full form-actions"><button class="primary">Speichern</button></div>
  </form>`,()=>{
    $("f").onsubmit=async e=>{
      e.preventDefault();const v=Object.fromEntries(new FormData(e.target)),obj=x||{id:uid(),occupancy:[]};
      if(!v.name.trim())return alert("Bitte eine Bezeichnung eingeben.");
      if(Number(v.area)<=0)return alert("Bitte die Wohnfläche prüfen.");
      if(!x&&state.units.some(u=>u.type===v.type)&&!confirm(`Es existiert bereits eine Einheit vom Typ „${v.type==="owner"?"Eigennutzung":"Mietwohnung"}“. Trotzdem anlegen?`))return;
      obj.name=v.name.trim();obj.type=v.type;obj.area=Number(v.area)||0;obj.constructionYear=v.constructionYear?Number(v.constructionYear):null;obj.buildingPart=v.buildingPart.trim();obj.note=v.note.trim();obj.occupancy=Array.isArray(obj.occupancy)?obj.occupancy:[];
      const persons=Math.max(0,Number(v.persons)||0),from=v.occupancyFrom||today,last=obj.occupancy.slice().sort((a,b)=>(b.from||"").localeCompare(a.from||""))[0];
      if(!last||Number(last.count)!==persons||last.from!==from){
        const active=obj.occupancy.find(o=>(!o.to)&&o.from&&o.from<from);if(active)active.to=dateOnlyAddDays(from,-1)
        obj.occupancy.push({from,to:"",count:persons});obj.occupancy.sort((a,b)=>(a.from||"").localeCompare(b.from||""))
      }
      if(!x)state.units.push(obj);
      await persist(x?"Einheit geändert":"Einheit angelegt",obj.name);closeModal(true);unitsDataView()
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
    ${formField({name:"serviceStart",label:"Leistungszeitraum von",type:"date",value:x?.serviceStart||billingPeriodStart(state,y)})}
    ${formField({name:"serviceEnd",label:"Leistungszeitraum bis",type:"date",value:x?.serviceEnd||billingPeriodInfo(state,y).end})}
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
      await persist(x?"Kostenquelle geändert":"Kostenquelle angelegt",obj.name);closeModal(true);sourcesDataView()
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
  $("workspaceBody").innerHTML=`<div class="card"><div class="row between"><div><h3>Kostenpositionen</h3><p class="muted">Nur bestätigte Positionen fließen in die Abrechnung ein. Quelle, Dokument, Umlage und Zahlung bleiben nachvollziehbar getrennt.</p></div><button id="addPosition" class="primary">Position hinzufügen</button></div></div>
  ${positions.map(p=>{const src=state.sources.find(s=>s.id===p.sourceId),dec=allocateCostPosition(state,{...p,amount:p.amount},currentPeriodYear()).decision;return`<div class="item premium-list-item"><div class="list-main"><div><div class="item-title-row"><h3>${esc(p.label)}</h3><span class="pill ${p.confirmed?"good":"warn"}">${p.confirmed?"Bestätigt":"Entwurf"}</span></div><p>${esc(category(p.category).label)} · ${euro(p.amount)}</p><small>${dateDE(p.serviceStart)} – ${dateDE(p.serviceEnd)} · ${esc(assignmentLabel(p.assignment))} · ${esc(agreementLabel(p.agreement))}</small>${src?`<small>Quelle: ${esc(src.name)}</small>`:""}${dec.status==="check"?`<div class="inline-attention">${esc(dec.reason||"Umlage prüfen")}</div>`:""}</div><div class="item-actions"><button class="secondary" data-trace-pos="${p.id}">Herkunft</button><button class="secondary" data-pos="${p.id}">Bearbeiten</button></div></div></div>`}).join("")||`<div class="empty-state card"><strong>Noch keine Kostenpositionen</strong><p>Positionen entstehen aus Dokumenten oder können manuell angelegt werden.</p></div>`}`;
  $("addPosition").onclick=()=>openCostPositionEditor();
  document.querySelectorAll("[data-pos]").forEach(b=>b.onclick=()=>openCostPositionEditor(positionById(state,b.dataset.pos)));
  document.querySelectorAll("[data-trace-pos]").forEach(b=>b.onclick=()=>openPositionTrace(positionById(state,b.dataset.tracePos)))
}

function openPositionTrace(p){
  if(!p)return;
  const t=traceForPosition(state,p),docPromise=t.documentId?getDocument(t.documentId):Promise.resolve(null);
  Promise.resolve(docPromise).then(doc=>{
    const conf=t.confidence==null?null:confidenceBand(confidencePercent(t.confidence));
    modal("Datenherkunft",`<div class="trace-chain">
      <div class="trace-node"><small>Ursprung</small><strong>${esc(t.origin)}</strong></div><div class="trace-arrow">↓</div>
      <div class="trace-node"><small>Dokument / Quelle</small><strong>${esc(doc?.label||t.source?.name||"keine")}</strong></div><div class="trace-arrow">↓</div>
      <div class="trace-node"><small>Kostenposition</small><strong>${esc(p.label)} · ${euro(p.amount)}</strong></div><div class="trace-arrow">↓</div>
      <div class="trace-node"><small>Umlage</small><strong>${esc(assignmentLabel(p.assignment))} · ${esc(agreementLabel(p.agreement))}</strong></div>
    </div>
    ${t.evidence?`<div class="card"><h3>Erkannte Belegstelle</h3><p>${esc(t.evidence)}</p>${conf?`<span class="confidence confidence-${conf.id}">${esc(conf.label)}</span>`:""}</div>`:""}
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
    ${formField({name:"serviceStart",label:"Leistungszeitraum von",type:"date",value:x?.serviceStart||billingPeriodStart(state,currentPeriodYear())})}
    ${formField({name:"serviceEnd",label:"Leistungszeitraum bis",type:"date",value:x?.serviceEnd||billingPeriodInfo(state,currentPeriodYear()).end})}
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
    $("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));if(v.serviceEnd<v.serviceStart)return alert("Leistungszeitraum prüfen.");const obj=positionDefaults({...x,id:x?.id||uid(),label:v.label.trim(),category:v.category,amount:Number(v.amount)||0,interval:v.interval,serviceStart:v.serviceStart,serviceEnd:v.serviceEnd,assignment:v.assignment,agreement:v.agreement,sourceId:v.sourceId,confirmed:v.confirmed==="yes",origin:x?.origin||"manual",details:{...(x?.details||{}),quantity:v.quantity===""?null:Number(v.quantity),unit:v.unit.trim(),rate:v.rate===""?null:Number(v.rate),vatRate:v.vatRate===""?null:Number(v.vatRate)}});const result=await executeCommand(x?"costPosition.update":"costPosition.create",{id:obj.id,label:obj.label,amount:obj.amount},async()=>{const i=state.costPositions.findIndex(p=>p.id===obj.id);if(i>=0)state.costPositions[i]=obj;else state.costPositions.push(obj)},{auditText:x?"Kostenposition geändert":"Kostenposition angelegt"});if(!result.ok)return alert(result.message);closeModal(true);costPositionsDataView()}
  })
}


async function meterImageBitmap(file){
  if("createImageBitmap" in window)return createImageBitmap(file,{imageOrientation:"from-image"}).catch(()=>createImageBitmap(file));
  return new Promise((res,rej)=>{const img=new Image(),u=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(u);res(img)};img.onerror=e=>{URL.revokeObjectURL(u);rej(e)};img.src=u})
}
function defaultMeterCrop(){return{x:.10,y:.24,w:.80,h:.42}}
function clampCrop(c){return{x:Math.max(0,Math.min(.95,c.x)),y:Math.max(0,Math.min(.95,c.y)),w:Math.max(.05,Math.min(1-c.x,c.w)),h:Math.max(.05,Math.min(1-c.y,c.h))}}
async function prepareMeterVariant(file,crop=defaultMeterCrop(),variant="contrast"){
  const img=await meterImageBitmap(file),iw=img.width||img.naturalWidth,ih=img.height||img.naturalHeight,c=clampCrop(crop),sx=Math.round(iw*c.x),sy=Math.round(ih*c.y),sw=Math.max(20,Math.round(iw*c.w)),sh=Math.max(20,Math.round(ih*c.h)),scale=Math.min(4,Math.max(1.4,1600/sw)),canvas=document.createElement("canvas");
  canvas.width=Math.max(800,Math.round(sw*scale));canvas.height=Math.max(180,Math.round(sh*scale));const ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.drawImage(img,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
  if(variant!=="color"){const data=ctx.getImageData(0,0,canvas.width,canvas.height),px=data.data,hist=new Array(256).fill(0);for(let i=0;i<px.length;i+=4){const g=Math.round(.299*px[i]+.587*px[i+1]+.114*px[i+2]);hist[g]++;px[i]=px[i+1]=px[i+2]=g}
    if(variant==="contrast"){for(let i=0;i<px.length;i+=4){const v=Math.max(0,Math.min(255,(px[i]-128)*1.8+128));px[i]=px[i+1]=px[i+2]=v}}
    else if(variant==="threshold"){const total=canvas.width*canvas.height;let sum=0;for(let i=0;i<256;i++)sum+=i*hist[i];let sumB=0,wB=0,max=0,threshold=128;for(let i=0;i<256;i++){wB+=hist[i];if(!wB)continue;const wF=total-wB;if(!wF)break;sumB+=i*hist[i];const mB=sumB/wB,mF=(sum-sumB)/wF,b=wB*wF*(mB-mF)*(mB-mF);if(b>max){max=b;threshold=i}}for(let i=0;i<px.length;i+=4){const v=px[i]>threshold?255:0;px[i]=px[i+1]=px[i+2]=v}}
    ctx.putImageData(data,0,0)}
  return new Promise(res=>canvas.toBlob(res,"image/jpeg",.94))
}
async function setupMeterCropCanvas(file,cropState){
  const canvas=$("meterCropCanvas");if(!canvas)return;const img=await meterImageBitmap(file),iw=img.width||img.naturalWidth,ih=img.height||img.naturalHeight,maxW=900;canvas.width=maxW;canvas.height=Math.max(260,Math.round(maxW*ih/iw));const ctx=canvas.getContext("2d");
  const draw=()=>{const c=clampCrop(cropState.value);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);ctx.fillStyle="rgba(16,24,40,.48)";ctx.fillRect(0,0,canvas.width,canvas.height);const x=c.x*canvas.width,y=c.y*canvas.height,w=c.w*canvas.width,h=c.h*canvas.height;ctx.save();ctx.globalCompositeOperation="destination-out";ctx.fillRect(x,y,w,h);ctx.restore();ctx.strokeStyle="#fff";ctx.lineWidth=4;ctx.strokeRect(x,y,w,h);ctx.fillStyle="rgba(255,255,255,.92)";ctx.fillRect(x,y-25,155,23);ctx.fillStyle="#101828";ctx.font="bold 15px sans-serif";ctx.fillText("Ziffern hier einrahmen",x+7,y-8)};draw();
  let start=null;const point=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height}};
  canvas.onpointerdown=e=>{canvas.setPointerCapture?.(e.pointerId);start=point(e);cropState.value={x:start.x,y:start.y,w:.01,h:.01};draw()};
  canvas.onpointermove=e=>{if(!start)return;const p=point(e),x=Math.min(start.x,p.x),y=Math.min(start.y,p.y),w=Math.abs(p.x-start.x),h=Math.abs(p.y-start.y);cropState.value=clampCrop({x,y,w,h});draw()};
  canvas.onpointerup=()=>{start=null;draw()};canvas.onpointercancel=()=>{start=null};cropState.draw=draw
}
function meterCandidatesFromPass(text,source,base){return meterReadingCandidates(String(text||"").replace(/[Oo]/g,"0"),source,base)}

function adjustMeterCrop(cropState,action){
  const c={...cropState.value},step=.035,size=.06;
  if(action==="left")c.x-=step;if(action==="right")c.x+=step;if(action==="up")c.y-=step;if(action==="down")c.y+=step;
  if(action==="smaller"){c.x+=size/2;c.y+=size/2;c.w-=size;c.h-=size}
  if(action==="larger"){c.x-=size/2;c.y-=size/2;c.w+=size;c.h+=size}
  if(action==="auto")Object.assign(c,defaultMeterCrop());
  cropState.value=clampCrop(c);cropState.draw?.()
}

let METER_PHOTO_BUSY=false;
async function recognizeMeterPhoto(file,preferredMeterId="",progress,crop=defaultMeterCrop(),date=smartToday()){
  if(!file)throw new Error("Kein Foto ausgewählt.");if(!String(file.type||"").startsWith("image/"))throw new Error("Für Zählerstände bitte ein Foto/Bild auswählen.");
  const worker=await createOCRWorker(progress);
  try{
    progress?.("1/4 · Zählernummer und Beschriftung lesen …");await worker.setParameters({tessedit_pageseg_mode:"6"});const full=await worker.recognize(file),fullText=full.data.text||"",extra=[];
    const variants=[{name:"Kontrast",blob:await prepareMeterVariant(file,crop,"contrast"),score:.76},{name:"Schwarz/Weiß",blob:await prepareMeterVariant(file,crop,"threshold"),score:.72},{name:"Farbe",blob:await prepareMeterVariant(file,crop,"color"),score:.68}];
    await worker.setParameters({tessedit_char_whitelist:"0123456789,. ",preserve_interword_spaces:"1"});
    for(let i=0;i<variants.length;i++){const v=variants[i];progress?.(`${i+2}/4 · Ziffernfeld ${v.name} analysieren …`);await worker.setParameters({tessedit_pageseg_mode:"7"});const rr=await worker.recognize(v.blob);extra.push(...meterCandidatesFromPass(rr.data.text||"",v.name,v.score))}
    if(!fullText.trim()&&!extra.length)throw new Error("Im gewählten Bereich konnten keine Ziffern erkannt werden.");
    const analysis=analyzeMeterOCRText(state,fullText,preferredMeterId,extra,date);analysis.crop=clampCrop(crop);analysis.passCount=variants.length+1;return analysis
  }finally{await worker.terminate()}
}
function openMeterPhotoCapture(preferredMeterId="",initialMode="camera"){
  const meters=state.meters||[],preferred=meters.find(m=>m.id===preferredMeterId);
  modal("Wasserzähler per Foto",`<div class="card"><h3>${preferred?esc(preferred.name):"Zähler erfassen"}</h3><p class="muted">Für bessere Erkennung rahmst du nach dem Foto nur das Ziffernfeld ein. Die App liest den Bereich in mehreren Bildvarianten und gleicht den Wert mit früheren Ablesungen ab.</p>
    <div class="doc-capture-actions"><label class="primary">Foto aufnehmen<input id="meterCameraInput" type="file" accept="image/*" capture="environment" hidden></label><label class="secondary">Foto auswählen<input id="meterFileInput" type="file" accept="image/*" hidden></label></div>
    <div id="meterCropStage" class="hidden"><p><strong>1. Ziffernfeld einrahmen</strong><br><small>Mit dem Finger einen Rahmen möglichst eng um die Zahlenanzeige ziehen.</small></p><canvas id="meterCropCanvas" class="meter-crop-canvas"></canvas>
    <div class="crop-controls" aria-label="Rahmen ohne Ziehen anpassen">
      <span class="crop-help">Alternativ per Tippen anpassen:</span>
      <button type="button" data-crop-adjust="left" aria-label="Rahmen nach links">←</button>
      <button type="button" data-crop-adjust="up" aria-label="Rahmen nach oben">↑</button>
      <button type="button" data-crop-adjust="down" aria-label="Rahmen nach unten">↓</button>
      <button type="button" data-crop-adjust="right" aria-label="Rahmen nach rechts">→</button>
      <button type="button" data-crop-adjust="smaller">Enger</button>
      <button type="button" data-crop-adjust="larger">Größer</button>
      <button type="button" data-crop-adjust="auto">Auto</button>
    </div>
    <div class="row"><button id="meterCropReset" type="button" class="secondary">Rahmen zurücksetzen</button><button id="meterAnalyzeBtn" type="button" class="primary">Erkennung starten</button></div></div>
    <div id="meterPhotoProgress"></div><div id="meterPhotoResult"></div></div>`,()=>{
      let selectedFile=null,cropState={value:defaultMeterCrop(),draw:null};
      const load=async file=>{if(!file)return;selectedFile=file;cropState.value=defaultMeterCrop();$("meterPhotoResult").innerHTML="";$("meterPhotoProgress").innerHTML="";$("meterCropStage").classList.remove("hidden");await setupMeterCropCanvas(file,cropState)};
      const analyze=async()=>{if(!selectedFile||METER_PHOTO_BUSY)return;METER_PHOTO_BUSY=true;const p=$("meterPhotoProgress"),r=$("meterPhotoResult");r.innerHTML="";
        try{const analysis=await recognizeMeterPhoto(selectedFile,preferredMeterId,msg=>p.innerHTML=`<div class="info">${esc(msg)}</div>`,cropState.value,smartToday());p.innerHTML=`<div class="legal-ok">Mehrfachanalyse abgeschlossen · ${analysis.passCount} OCR-Durchläufe</div>`;renderMeterPhotoProposal(selectedFile,analysis)}
        catch(err){recordClientError("meter-photo-ocr",err);r.innerHTML=`<div class="legal-bad"><strong>Foto konnte nicht sicher ausgewertet werden</strong><br>${esc(err.message||err)}<br><small>Rahmen enger um das Ziffernfeld ziehen oder ein geraderes, schärferes Foto verwenden.</small></div>`}
        finally{METER_PHOTO_BUSY=false}};
      $("meterCameraInput").onchange=e=>{const f=e.target.files?.[0];e.target.value="";load(f)};$("meterFileInput").onchange=e=>{const f=e.target.files?.[0];e.target.value="";load(f)};$("meterAnalyzeBtn").onclick=analyze;$("meterCropReset").onclick=()=>{cropState.value=defaultMeterCrop();cropState.draw?.()};document.querySelectorAll("[data-crop-adjust]").forEach(b=>b.onclick=()=>adjustMeterCrop(cropState,b.dataset.cropAdjust));if(initialMode==="file")setTimeout(()=>$("meterFileInput")?.click(),80)
    })
}
function renderMeterPhotoProposal(file,a){
  const r=$("meterPhotoResult");if(!r)return;
  const meters=state.meters||[],meterOptions=meters.map(m=>({value:m.id,label:`${m.name}${m.number?` · ${m.number}`:""}`}));
  const candidates=a.candidates||[];
  r.innerHTML=`<form id="meterPhotoConfirm" class="form-grid">
    <div class="full ${a.meterId?"legal-ok":"legal-warn"}"><strong>Zuordnung:</strong> ${a.meterId?`${esc(a.meterName)} · ${Math.round(a.assignmentConfidence*100)} %`:"nicht eindeutig"}<br><small>${esc(a.assignmentReason)}</small></div>
    ${formField({name:"meterId",label:"Zähler",type:"select",value:a.meterId||"",options:[{value:"",label:"Bitte Zähler wählen"},...meterOptions]})}
    ${formField({name:"date",label:"Ablesedatum",type:"date",value:localDateISO()})}
    ${formField({name:"value",label:"Erkannter Zählerstand",type:"number",step:"0.001",value:a.reading??""})}
    ${a.serialCandidate?formField({name:"detectedNumber",label:"Erkannte mögliche Zählernummer",value:a.serialCandidate}):""}
    <div class="full" id="meterPhotoPlausibility"></div>
    ${candidates.length>1?`<div class="full"><details><summary>Weitere erkannte Zahlen</summary>${candidates.slice(1).map(c=>`<button type="button" class="secondary meter-candidate" data-value="${c.value}">${esc(c.raw)} · ${(c.score*100).toFixed(0)} %</button>`).join(" ")}</details></div>`:""}
    <div class="full info"><strong>Erkennungssicherheit Zählerstand:</strong> ${Math.round((a.readingConfidence||0)*100)} % · Mehrfach-OCR${a.readingEvidence?`<br><small>${esc(a.readingEvidence)}</small>`:""}<br><small>Der Wert wurde mit früheren Ablesungen plausibilisiert. Vor dem Speichern trotzdem mit dem Foto vergleichen.</small></div>
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
    closeModal(true);
    if(route==="data"&&sub.data==="infrastructure")infrastructureDataView();else if(route==="rental"&&sub.rental==="water")waterView();else render()
  }
}

function infrastructureDataView(){
  const {main,owner}=ensureDefaultMeters(state);
  $("workspaceBody").innerHTML=`<div class="card"><div class="row between"><div><h3>Zähler</h3><p class="muted">Zählerstände können manuell oder per Foto erfasst werden. Bei einem allgemeinen Foto versucht die App die gespeicherte Zählernummer automatisch zu erkennen.</p></div><div><button id="meterPhotoCamera" class="primary">Foto aufnehmen</button><button id="meterPhotoFile" class="secondary">Foto auswählen</button></div></div></div>
  ${[main,owner].map(m=>{const last=latestMeterReading(m);return`<div class="item"><div class="row between"><div><h3>${esc(m.name)}</h3><p>Zählernummer: ${esc(m.number||"noch nicht eingetragen")} · ${esc(m.unit||"m³")}</p><small>${m.readings.length} Ablesung(en)${last?` · zuletzt ${last.value} ${esc(m.unit||"")} am ${esc(last.date)}${last.photoDocumentId?" · Foto":""}`:""}</small></div><div><button class="primary" data-meter-photo="${m.id}">Foto</button><button class="secondary" data-meter="${m.id}">Bearbeiten</button></div></div></div>`}).join("")}
  <div class="card"><div class="row between"><div><h3>Abfallbehälter</h3><p class="muted">Behälter werden getrennt von Gebühren geführt. Dadurch kann z. B. eine zusätzliche Restmülltonne eindeutig der Eigennutzung zugeordnet werden.</p></div><button id="addContainer" class="primary">Behälter hinzufügen</button></div></div>
  ${(state.containers||[]).map(c=>`<div class="item"><div class="row between"><div><h3>${esc(c.type)} ${c.volumeL?c.volumeL+" L":""}</h3><p>${assignmentLabel(c.assignment)} · ab ${dateDE(c.activeFrom)}${c.containerNumber?` · Nr. ${esc(c.containerNumber)}`:""}</p></div><button class="secondary" data-container="${c.id}">Bearbeiten</button></div></div>`).join("")||`<div class="card muted">Noch keine Behälter erfasst.</div>`}`;
  $("meterPhotoCamera").onclick=()=>openMeterPhotoCapture("","camera");
  $("meterPhotoFile").onclick=()=>openMeterPhotoCapture("","file");
  document.querySelectorAll("[data-meter-photo]").forEach(b=>b.onclick=()=>openMeterPhotoCapture(b.dataset.meterPhoto,"camera"));
  document.querySelectorAll("[data-meter]").forEach(b=>b.onclick=()=>openMeterEditor(meterById(state,b.dataset.meter)));
  $("addContainer").onclick=()=>openContainerEditor();
  document.querySelectorAll("[data-container]").forEach(b=>b.onclick=()=>openContainerEditor((state.containers||[]).find(c=>c.id===b.dataset.container)))
}
function openMeterEditor(m){
  modal("Zähler bearbeiten",`<form id="f" class="form-grid">${formField({name:"name",label:"Bezeichnung",value:m.name})}${formField({name:"number",label:"Zählernummer",value:m.number||"",placeholder:"wichtig für automatische Foto-Zuordnung"})}${formField({name:"unit",label:"Einheit",value:m.unit||"m³"})}<div class="full"><div class="row between"><h3>Ablesungen</h3><button type="button" id="photoFromMeterEditor" class="primary">Stand per Foto</button></div>${(m.readings||[]).slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map(r=>`<p>${esc(r.date)} · <strong>${r.value} ${esc(m.unit||"")}</strong>${r.synthetic?" · übernommen":r.origin==="photo"?" · 📷 Foto":""}</p>`).join("")||"<p class='muted'>Noch keine Ablesungen.</p>"}</div><div class="full"><button class="primary">Zähler speichern</button></div></form>`,()=>{
    $("photoFromMeterEditor").onclick=()=>{MODAL_RETURN_FOCUS=null;closeModal(true);openMeterPhotoCapture(m.id,"camera")};
    $("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));m.name=v.name.trim();m.number=v.number.trim();m.unit=v.unit.trim()||"m³";await persist("Zähler geändert",m.name);closeModal(true);infrastructureDataView()}
  })
}
function openContainerEditor(x=null){
  modal(x?"Behälter bearbeiten":"Behälter hinzufügen",`<form id="f" class="form-grid">
    ${formField({name:"type",label:"Behälterart",type:"select",value:x?.type||"Restmüll",options:[{value:"Restmüll",label:"Restmüll"},{value:"Bioabfall",label:"Bioabfall"},{value:"Papier",label:"Papier"},{value:"Sonstige",label:"Sonstige"}]})}
    ${formField({name:"volumeL",label:"Volumen (Liter)",type:"number",value:x?.volumeL||120})}
    ${formField({name:"containerNumber",label:"Behälternummer",value:x?.containerNumber||"",placeholder:"optional"})}
    ${formField({name:"assignment",label:"Zuordnung",type:"select",value:x?.assignment||"review",options:[{value:"house",label:"gemeinsam"},{value:"owner",label:"nur Eigennutzung"},{value:"rental",label:"nur Mietwohnung"},{value:"review",label:"noch prüfen"}]})}
    ${formField({name:"activeFrom",label:"Aktiv ab",type:"date",value:x?.activeFrom||""})}
    ${formField({name:"activeTo",label:"Aktiv bis",type:"date",value:x?.activeTo||""})}
    <div class="full form-actions"><button class="primary">Speichern</button></div>
  </form>`,()=>{$("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target)),obj=x||{id:uid()};Object.assign(obj,{type:v.type,volumeL:Number(v.volumeL)||0,containerNumber:v.containerNumber.trim(),assignment:v.assignment,activeFrom:v.activeFrom,activeTo:v.activeTo});if(!x)state.containers.push(obj);await persist(x?"Behälter geändert":"Behälter angelegt",`${obj.type} ${obj.volumeL} L`);closeModal(true);infrastructureDataView()}})
}

function assessmentDataView(){
  const assessments=state.sources.filter(s=>s.kind==="assessment");
  $("workspaceBody").innerHTML=`<div class="card"><button id="addAssessment" class="primary">Grundbesitzabgaben erfassen</button><p class="muted">Bescheid = Quelle. Einzelne Gebühren = zentrale Kostenpositionen.</p></div>${assessments.map(a=>{const ps=sourcePositions(state,a.id);return`<div class="item"><div class="row between"><div><h3>${esc(a.name)}</h3><p class="task-meta">${esc(a.serviceStart||"")} bis ${esc(a.serviceEnd||"")}</p><p>${ps.map(p=>`${esc(p.label)} ${euro(p.amount)}`).join(" · ")}</p></div><button class="secondary" data-assess="${a.id}">Bearbeiten</button></div></div>`}).join("")||"<div class='muted card'>Noch kein Bescheid erfasst.</div>"}`;
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
      await persist(existing?"Bescheid geändert":"Bescheid angelegt",src.name);closeModal(true);assessmentDataView()
    }
  })
}


let OCR_SCRIPT_PROMISE=null,PDFJS_PROMISE=null,JSPDF_PROMISE=null,DOC_DRAFT_PAGES=[],DOC_ANALYSIS_RUNNING=new Set();

function docPages(doc){
  if(Array.isArray(doc?.pages)&&doc.pages.length)return doc.pages;
  if(doc?.blob)return [{id:`legacy-${doc.id}`,name:doc.name||"Seite 1",type:doc.type||doc.blob.type,size:doc.size||doc.blob.size,blob:doc.blob}];
  return []
}

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
  await addDocument(doc);DOC_DRAFT_PAGES=[];await persist("Dokument gespeichert",`${label} · ${doc.pages.length} Seite(n)`);closeModal(true);await documentsView(false);
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
  closeModal(true);sub.data="positions";dataWorkspace()
}
function openDocumentAnalysis(doc){
  const a=doc.analysis||{},f=a.fields||{},proposals=f.positionProposals||[],overall=confidenceBand(confidencePercent(f.confidence||0));
  modal("Dokumentanalyse",`<div class="${a.status==="done"?"legal-ok":a.status==="error"?"legal-bad":"info"}"><strong>${esc(docStatus(doc).label)}</strong>${a.error?`<br>${esc(a.error)}`:""}</div>
    ${a.status==="done"?`<div class="card"><div class="item-title-row"><div><p class="eyebrow">ANALYSE</p><h3>${esc(f.kind||"Dokument")}</h3></div><span class="confidence confidence-${overall.id}">${esc(overall.label)}</span></div>
      <div class="fact-row"><span>Leistungszeitraum</span><strong>${f.serviceStart?`${dateDE(f.serviceStart)} – ${dateDE(f.serviceEnd)}`:"nicht sicher erkannt"}</strong></div>
      ${f.intelligence?.issuer?`<div class="fact-row"><span>Aussteller</span><strong>${esc(f.intelligence.issuer)}</strong></div>`:""}
      ${f.intelligence?.total?`<div class="fact-row"><span>Gesamtbetrag erkannt</span><strong>${euro(f.intelligence.total)}</strong></div>`:""}
      ${(f.anomalies||[]).map(x=>`<div class="${x.severity==="warn"?"legal-warn":"info"}">${esc(x.message)}</div>`).join("")}
      <p class="muted">Die Analyse erzeugt Vorschläge. Erst deine Bestätigung macht eine Position abrechnungswirksam.</p></div>
    ${proposals.length?`<div class="card"><div class="card-head"><div><p class="eyebrow">VORSCHLÄGE</p><h3>Erkannte Kostenpositionen</h3></div></div>${proposals.map(p=>{const cb=confidenceBand(confidencePercent(p.confidence));return`<div class="proposal-row premium-proposal"><label><input type="checkbox" data-proposal="${p.id}" checked> <span><strong>${esc(p.label)}</strong><small>${euro(p.amount)}</small></span></label><select data-assignment="${p.id}" aria-label="Zuordnung für ${esc(p.label)}"><option value="house" ${p.assignment==="house"?"selected":""}>gesamtes Haus</option><option value="owner" ${p.assignment==="owner"?"selected":""}>nur Eigennutzung</option><option value="rental" ${p.assignment==="rental"?"selected":""}>nur Mietwohnung</option><option value="review" ${p.assignment==="review"?"selected":""}>noch prüfen</option></select><span class="confidence confidence-${cb.id}">${esc(cb.short)}</span><details><summary>Erkennungsgrund</summary><small>${esc(p.smartReason||p.evidence||"OCR-Vorschlag")}</small></details></div>`}).join("")}<button id="acceptProposals" class="primary">Ausgewählte Positionen bestätigen</button></div>`:`<div class="legal-warn">Keine einzelnen Kostenpositionen ausreichend sicher erkannt. Du kannst das Dokument trotzdem als Beleg behalten.</div>`}
    <details class="card secondary-detail"><summary>Technische Analyse anzeigen</summary><div class="detail-content">${f.intelligence?`<p>Dokumenttyp: ${esc(f.intelligence.documentFamily||"Dokument")}${f.intelligence.reference?` · Referenz ${esc(f.intelligence.reference)}`:""}</p>`:""}${f.smart?`<p>Smart-Kategorie: ${esc(category(f.smart.category).label)} · ${Math.round(confidencePercent(f.smart.categoryConfidence))}%</p>`:""}<textarea class="big-input" rows="12" readonly>${esc(a.text||"")}</textarea></div></details>`:""}
    ${a.status==="error"?`<button id="retryAnalysis" class="primary">Analyse erneut versuchen</button>`:""}`,()=>{
      if($("retryAnalysis"))$("retryAnalysis").onclick=async()=>{closeModal(true);await analyzeDocumentById(doc.id,msg=>{});await documentsView(false)};
      if($("acceptProposals"))$("acceptProposals").onclick=()=>acceptDocumentProposals(doc)
    })
}
async function documentsView(autoQueue=true){
  const docs=await listDocuments();state.documentsCache=docs;
  if(autoQueue){const unanalysed=docs.filter(d=>!d.analysis||!d.analysis.status);for(const d of unanalysed){d.analysis={status:"queued",createdAt:new Date().toISOString()};await updateDocument(d)}}
  const groups=documentsByWorkflow(docs);
  const rows=items=>items.map(d=>`<div class="item premium-list-item"><div class="list-main"><div><strong>${esc(d.label||d.name)}</strong><p>${d.pages?.length||1} Seite(n) · ${humanBytes(d.size||0)}</p><small>${esc(docStatus(d).label)} · ${esc(documentWorkflowLabel(d))}</small></div><div class="item-actions"><button class="primary" data-doc-analysis="${d.id}">${documentWorkflowState(d)==="review"?"Prüfen":"Öffnen"}</button><button class="secondary" data-doc-export="${d.id}">PDF</button></div></div></div>`).join("");
  $("workspaceBody").innerHTML=`<div id="documentGlobalStatus"></div>
  <div class="card"><div class="row between"><div><h3>Dokumente</h3><p class="muted">Neue Belege werden analysiert, anschließend geprüft und erst danach als erledigt abgelegt.</p></div><button id="newDocument" class="primary">Dokument hinzufügen</button></div></div>
  ${groups.review.length?`<section class="card"><div class="row between"><h3>Zu prüfen</h3><span class="pill warn">${groups.review.length}</span></div>${rows(groups.review)}</section>`:""}
  ${groups.new.length?`<section class="card"><div class="row between"><h3>In Analyse</h3><span class="pill">${groups.new.length}</span></div>${rows(groups.new)}</section>`:""}
  ${!groups.review.length&&!groups.new.length?`<div class="legal-ok">✓ Kein Dokument wartet auf Prüfung.</div>`:""}
  <details class="card secondary-detail" ${groups.done.length<=3?"open":""}><summary>Erledigte Dokumente (${groups.done.length})</summary><div class="detail-content">${rows(groups.done)||"<p class='muted'>Noch keine erledigten Dokumente.</p>"}</div></details>`;
  $("newDocument").onclick=()=>openDocumentCapture();
  document.querySelectorAll("[data-doc-analysis]").forEach(b=>b.onclick=()=>{const d=docs.find(x=>x.id===b.dataset.docAnalysis);if(d)openDocumentAnalysis(d)});
  document.querySelectorAll("[data-doc-export]").forEach(b=>b.onclick=()=>{const d=docs.find(x=>x.id===b.dataset.docExport);if(d)exportDocumentPDF(d)})
}
function rentalWorkspace(){
  const tabs=[
    {id:"overview",label:"Überblick",icon:"⌂"},
    {id:"water",label:"Kaltwasser",icon:"◌"},
    {id:"billing",label:"Abrechnung",icon:"€"}
  ];
  let active=sub.rental||"overview";
  if(active==="calculation"||active==="workflow")active="billing";
  sub.rental=active;
  $("app").innerHTML=workspaceHeader("VERMIETUNG","Vermietung","Mietverhältnis, Kaltwasser und Betriebskostenabrechnung.",tabs,visibleSub("rental",active));
  bindWorkspaceTabs("rental",rentalWorkspace);
  if(active==="overview")rentalOverview();
  else if(active==="lease")leaseDataView();
  else if(active==="water")waterRentalView();
  else calculationView()
}
function v17LedgerMonthKeys(count=12){
  const d=new Date(),out=[];
  for(let i=0;i<count;i++){const x=new Date(d.getFullYear(),d.getMonth()-i,1);out.push(`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}`)}
  return out
}
function v17RentLedgerCard(s){
  const rows=v17LedgerMonthKeys(12).map(key=>rentMonthStatus(s,key)).filter(r=>r.status!=="none");
  const current=rentMonthStatus(s),arrears=rows.reduce((sum,r)=>sum+Math.max(0,-Number(r.difference||0)),0);
  const pill=r=>{const c=r.status==="paid"?"good":r.status==="missing"?"bad":"warn";return `<span class="pill ${c}">${esc(rentStatusLabel(r))}</span>`};
  return `<section id="v17RentLedger" class="card"><div class="card-head"><div><p class="eyebrow">MIETKONTO</p><h3>Mietkonto & Zahlungsstatus</h3></div>${current.status!=="none"?pill(current):""}</div>
  <div class="grid cards"><article class="card metric-card"><span>Soll aktuell</span><strong>${euro(current.expected)}</strong></article><article class="card metric-card"><span>Erkannt aktuell</span><strong>${euro(current.paid)}</strong></article><article class="card metric-card"><span>Offener Saldo 12M</span><strong class="${arrears>0?"negative":"positive"}">${euro(arrears)}</strong></article></div>
  <div class="tablewrap"><table class="costtable"><thead><tr><th>Monat</th><th>Soll</th><th>Erhalten</th><th>Differenz</th><th>Status</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.key)}</td><td>${euro(r.expected)}</td><td>${euro(r.paid)}</td><td class="${r.difference<-.01?"negative":"positive"}">${euro(r.difference)}</td><td>${pill(r)}</td></tr>`).join("")}</tbody></table></div>
  <p class="muted">Erkennung aus Mietvertrag und gespeicherten Zahlungseingängen. Teil-, Fehl- und Überzahlungen bleiben sichtbar.</p></section>`
}
function v17UtilitiesCard(s){
  const p=s.meta?.v17?.utilityProfile||{};
  return `<section id="v17Utilities" class="card"><p class="eyebrow">VERSORGUNG</p><h3>Abrechnungsverantwortung</h3>
  <div class="fact-row"><span>Kaltwasser / Kanal</span><strong>${p.coldWater==="landlord"?"über Vermieter":"Mietervertrag"}</strong></div>
  <div class="fact-row"><span>Heizung</span><strong>${p.heating==="tenant"?"eigener Mietervertrag":"über Vermieter"}</strong></div>
  <div class="fact-row"><span>Warmwasser</span><strong>${p.hotWater==="tenant"?"eigene Verantwortung":"über Vermieter"}</strong></div>
  <div class="fact-row"><span>Strom</span><strong>${p.electricity==="tenant"?"eigener Mietervertrag":"über Vermieter"}</strong></div>
  <div class="fact-row"><span>Gas</span><strong>${p.gas==="tenant"?"eigener Mietervertrag":"über Vermieter"}</strong></div>
  <p class="muted">Heizung, Warmwasser, Strom und Gas werden in diesem Objekt nicht über die Vermieter-Betriebskostenabrechnung geführt.</p></section>`
}
function v17PaymentQualityCard(s){
  const payments=s.payments||[],bad=payments.filter(p=>!p.date||!String(p.label||"").trim()||!(Number(p.amount)>0)),seen=new Map();
  for(const p of payments){const k=`${p.date}|${p.direction}|${Number(p.amount||0).toFixed(2)}|${normalizeLabelText(p.label||"")}`;seen.set(k,(seen.get(k)||0)+1)}
  const dups=[...seen.values()].filter(n=>n>1).length,problem=bad.length||dups;
  return `<div id="v17PaymentQuality" class="${problem?"legal-warn":"legal-ok"}"><strong>Buchungsprüfung</strong><br>${bad.length?`${bad.length} Buchung(en) mit unvollständigen Pflichtdaten. `:""}${dups?`${dups} mögliche Dublette(n).`:"Keine ungültigen oder doppelten Buchungen erkannt."}</div>`
}

function leaseDocumentCandidate(doc){
  const hay=normalizeLabelText(`${doc?.label||""} ${doc?.name||""} ${doc?.analysis?.fields?.kind||""}`);
  return /mietvertrag|wohnraummietvertrag|mietvereinbarung/.test(hay)
}
function openStoredLeaseDocument(doc){
  const pages=docPages(doc);
  if(pages.length===1&&(pages[0].type==="application/pdf"||String(pages[0].name||"").toLowerCase().endsWith(".pdf"))){
    const url=URL.createObjectURL(pages[0].blob),opened=window.open(url,"_blank");
    if(!opened){URL.revokeObjectURL(url);openDocumentAnalysis(doc);return}
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    return
  }
  openDocumentAnalysis(doc)
}
async function renderLeaseDocumentSlot(){
  const host=$("leaseDocumentSlot");if(!host)return;
  try{
    const docs=await listDocuments();state.documentsCache=docs;
    if(route!=="rental"||sub.rental!=="overview"||!$("leaseDocumentSlot"))return;
    const matches=docs.filter(leaseDocumentCandidate);
    if(matches.length){
      const d=matches[0],more=matches.length-1;
      host.innerHTML=`<div class="mini-document-row"><span><strong>${esc(d.label||d.name)}</strong><small>${d.pages?.length||1} Seite(n) · ${esc(docStatus(d).label)}${more>0?` · +${more} weiteres Dokument`:""}</small></span><button class="secondary compact" id="openLeaseDocument">Öffnen</button></div>`;
      $("openLeaseDocument").onclick=()=>openStoredLeaseDocument(d)
    }else{
      host.innerHTML=`<div class="empty-inline"><span><strong>Noch kein Vertragsdokument erkannt</strong><small>Ein PDF oder Foto mit „Mietvertrag“ in der Bezeichnung erscheint hier automatisch.</small></span></div>`
    }
  }catch(e){
    host.innerHTML=`<div class="empty-inline"><span><strong>Vertragsdokument konnte nicht geladen werden</strong><small>${esc(e.message||e)}</small></span></div>`
  }
}
function rentalOverview(){
  const y=currentPeriodYear(),a=billingAnalysis(state,y),p=billingProjection(state,y),rent=rentMonthStatus(state),ctx=billingPeriodContext(state,y),cb=confidenceBand(p.confidence),l=state.leases[0];
  $("workspaceBody").innerHTML=`<div class="grid cards">
    <article class="card metric-card"><span>Bestätigte Kosten Mieterin</span><strong>${euro(a.tenantCosts)}</strong><small>aktueller Rechenstand</small></article>
    <article class="card metric-card"><span>Vorauszahlungen</span><strong>${euro(a.advances)}</strong><small>für diese Periode</small></article>
    <article class="card metric-card"><span>Aktuelles Ergebnis</span><strong>${euro(Math.abs(a.result))}</strong><small>${a.result>=0?"Nachzahlung":"Guthaben"}</small></article>
    <article class="card metric-card"><span>Prognose</span><strong>${euro(Math.abs(p.projectedResult))}</strong><small>${p.projectedResult>=0?"Nachzahlung":"Guthaben"} · ${esc(cb.short)}</small></article>
  </div>
  <section class="card embedded-overview-card lease-overview-card">
    <div class="card-head"><div><p class="eyebrow">MIETVERHÄLTNIS</p><h3>${l?esc(l.tenantName||"Mietvertrag"):"Noch kein Mietvertrag"}</h3></div><button id="editLeaseOverview" class="${l?"secondary":"primary"} compact">${l?"Vertragsdaten bearbeiten":"Mietvertrag anlegen"}</button></div>
    ${l?`<div class="overview-facts">
      <div class="fact-row"><span>Vertragsbeginn</span><strong>${dateDE(l.start)}</strong></div>
      <div class="fact-row"><span>Kaltmiete</span><strong>${euro(l.rent)} / Monat</strong></div>
      <div class="fact-row"><span>BK-Vorauszahlung</span><strong>${euro(l.advance)} / Monat</strong></div>
      ${l.end?`<div class="fact-row"><span>Vertragsende</span><strong>${dateDE(l.end)}</strong></div>`:""}
    </div>`:`<p class="muted">Lege einmalig die Vertragsdaten an. Danach erscheinen sie dauerhaft direkt hier in der Übersicht.</p>`}
    <div class="embedded-document">
      <div class="embedded-document-head"><span><strong>Mietvertrag / PDF</strong><small>Direkt beim Mietverhältnis abgelegt</small></span><button id="addLeaseDocument" class="secondary compact">Dokument hinzufügen</button></div>
      <div id="leaseDocumentSlot"><span class="muted">Dokument wird geladen …</span></div>
    </div>
  </section>
  <div class="${ctx.kind==="takeover"?"info":"legal-ok"}"><strong>${esc(billingPeriodLabel(state,y))}</strong><br>${esc(ctx.message)}<br><small>Endabrechnung intern bis ${periodBillingTarget(y)} · gesetzliche Abrechnungsfrist ${periodDeadline(y)}.</small></div>
  ${p.missingCategories.length?`<details class="card secondary-detail"><summary>Was in der Prognose noch geschätzt wird</summary><div class="detail-content"><p>${p.missingCategories.map(x=>`${esc(categoryLabel(x.category))}${x.annualized?" (aus Teilperiode hochgerechnet)":""}`).join(", ")}</p><span class="confidence confidence-${cb.id}">${esc(cb.label)} · ${p.confidence}%</span></div></details>`:""}
  <div class="card"><div class="fact-row"><span>Mietzahlung ${esc(rent.key)}</span><strong>${rent.status==="none"?"kein aktiver Vertrag":esc(rentStatusLabel(rent))}</strong></div>${rent.status!=="none"?`<small>${euro(rent.paid)} von ${euro(rent.expected)} in erfassten Zahlungen erkannt.</small>`:""}</div>
  ${v17RentLedgerCard(state)}
  ${v17UtilitiesCard(state)}`;
  $("editLeaseOverview").onclick=()=>openLeaseEditor(l||null);
  $("addLeaseDocument").onclick=()=>{go("data","documents");setTimeout(()=>{openDocumentCapture();setTimeout(()=>{if($("newDocLabel")&&!$("newDocLabel").value)$("newDocLabel").value="Mietvertrag"},0)},0)};
  renderLeaseDocumentSlot()
}
function waterRentalView(){
  // Reuse water view into workspaceBody
  waterView()
}






function openLeaseEditor(x=null){
  modal(x?"Mietvertrag bearbeiten":"Mietvertrag anlegen",`<form id="f" class="form-grid">
    <div class="full form-intro"><strong>${x?"Vertragsdaten aktualisieren":"Neuen Mietvertrag erfassen"}</strong><small>Personenbezogene Daten werden nur lokal in deiner App gespeichert.</small></div>
    ${formField({name:"tenantName",label:"Mieter/in – Name",value:x?.tenantName||"",placeholder:"Name"})}
    ${formField({name:"tenantAddress",label:"Korrespondenzadresse",value:x?.tenantAddress||"",full:true,placeholder:"Anschrift"})}
    ${formField({name:"start",label:"Vertragsbeginn",type:"date",value:x?.start||""})}
    ${formField({name:"end",label:"Vertragsende",type:"date",value:x?.end||""})}
    ${formField({name:"rent",label:"Kaltmiete pro Monat (€)",type:"number",step:"0.01",min:0,value:x?.rent??""})}
    ${formField({name:"advance",label:"Betriebskostenvorauszahlung pro Monat (€)",type:"number",step:"0.01",min:0,value:x?.advance??""})}
    ${formField({name:"note",label:"Vertragsnotiz",value:x?.note||"",full:true,placeholder:"Optionale Besonderheiten"})}
    <div class="full form-actions"><button class="primary">Speichern</button></div>
  </form>`,()=>{
    $("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target)),obj=x||{id:uid()};if(!v.start)return alert("Bitte den Vertragsbeginn eintragen.");Object.assign(obj,{tenantName:v.tenantName.trim(),tenantAddress:v.tenantAddress.trim(),start:v.start,end:v.end,rent:Number(v.rent)||0,advance:Number(v.advance)||0,note:v.note.trim()});if(!x)state.leases.push(obj);await persist(x?"Mietvertrag geändert":"Mietvertrag angelegt","Mietvertrag");closeModal(true);go("rental","overview")}
  })
}
function waterView(){
  const y=currentPeriodYear(),sett=settlementByPeriod(state,y),cons=settlementConsumption(state,sett),waterCosts=(state.costPositions||[]).filter(p=>p.confirmed&&p.category==="water"&&positionToEvents(state,p,y).length),waterCostTotal=waterCosts.reduce((sum,p)=>sum+positionToEvents(state,p,y).reduce((a,e)=>a+Number(e.amount||0),0),0),waterTenantCost=cons?.valid?waterCostTotal*cons.share:0,waterRate=cons?.valid&&cons.house>0?waterCostTotal/cons.house:0,{main,owner}=ensureDefaultMeters(state);
  $("workspaceBody").innerHTML=`<div class="card"><div class="row between"><div><button id="editWater" class="primary">${sett?"Abrechnungsperiode bearbeiten":"Abrechnungsperiode erfassen"}</button><button id="openMeters" class="secondary">Zählerstammdaten</button></div><div><button id="photoMain" class="secondary">📷 Hauptzähler</button><button id="photoOwner" class="secondary">📷 Zwischenzähler</button></div></div></div>
  ${cons?`<div class="${cons.valid?"legal-ok":"legal-bad"}"><strong>${billingPeriodLabel(state,y)}</strong><br>Hausverbrauch ${cons.house.toFixed(3)} m³ · Eigennutzung ${cons.owner.toFixed(3)} m³ · Mietwohnung ${cons.tenant.toFixed(3)} m³ · Anteil ${percent(cons.share)}</div>`:`<div class="legal-warn">Für diese Periode fehlen vollständige Zählerstände. Fotoaufnahmen werden als historische Ablesungen gespeichert; die Abrechnungsperiode wählt anschließend die passenden Anfangs- und Endstände aus.</div>`}
  <section id="v17WaterPlus" class="card"><div class="card-head"><div><p class="eyebrow">KALTWASSER</p><h3>Verbrauch & Kosten auf einen Blick</h3></div><span class="pill ${cons?.valid&&waterCostTotal>0?"good":"warn"}">${cons?.valid&&waterCostTotal>0?"Abrechnungsbereit":"Noch offen"}</span></div><div class="grid cards"><article class="card metric-card"><span>Hausverbrauch</span><strong>${cons?.valid?cons.house.toFixed(3)+" m³":"–"}</strong></article><article class="card metric-card"><span>Mietwohnung</span><strong>${cons?.valid?cons.tenant.toFixed(3)+" m³":"–"}</strong><small>${cons?.valid?percent(cons.share):"Anteil offen"}</small></article><article class="card metric-card"><span>Wasserkosten</span><strong>${euro(waterCostTotal)}</strong><small>${cons?.valid&&waterCostTotal?`${euro(waterRate)} / m³ Hausverbrauch`:"Tarif noch offen"}</small></article><article class="card metric-card"><span>Rechnerischer Mieteranteil</span><strong>${cons?.valid&&waterCostTotal?euro(waterTenantCost):"–"}</strong></article></div><p class="muted">Die Werte stammen direkt aus dem zentralen Zähler- und Kostenmodell; es gibt keine separate V17-Nebenrechnung mehr.</p></section>
  <div class="card"><h3>Letzte Ablesungen</h3><p>${esc(main.name)}: <strong>${latestMeterReading(main)?`${latestMeterReading(main).value} ${esc(main.unit||"")} · ${esc(latestMeterReading(main).date)}`:"noch keine"}</strong></p><p>${esc(owner.name)}: <strong>${latestMeterReading(owner)?`${latestMeterReading(owner).value} ${esc(owner.unit||"")} · ${esc(latestMeterReading(owner).date)}`:"noch keine"}</strong></p></div>
  <div class="card"><h3>Wasser-/Kanalkosten</h3>${waterCosts.map(p=>`<p>${esc(p.label)}: <strong>${euro(p.amount)}</strong></p>`).join("")||"<div class='empty-state compact-empty'><strong>Noch keine bestätigten Wasser-/Kanalkosten</strong><p>Bestätigte Kosten erscheinen hier automatisch.</p></div>"}<p class="muted">Kosten und Verbrauch sind getrennt gespeichert. Die Abrechnung verbindet beides erst bei der Umlage.</p></div>`;
  $("editWater").onclick=()=>openWaterEditor(sett);$("openMeters").onclick=()=>{sub.data="infrastructure";go("data")};
  $("photoMain").onclick=()=>openMeterPhotoCapture(main.id,"camera");$("photoOwner").onclick=()=>openMeterPhotoCapture(owner.id,"camera")
}
function openWaterEditor(x=null){
  const y=Number(x?.periodYear)||currentPeriodYear(),{main,owner}=ensureDefaultMeters(state);
  const old=settlementConsumption(state,x);
  const mainStart=x?readingById(main,x.mainStartReadingId):null,mainEnd=x?readingById(main,x.mainEndReadingId):null,ownerStart=x?readingById(owner,x.ownerStartReadingId):null,ownerEnd=x?readingById(owner,x.ownerEndReadingId):null;
  modal(x?"Wasserperiode bearbeiten":"Wasserperiode erfassen",`<form id="f" class="form-grid">
    ${formField({name:"periodYear",label:"Abrechnungsjahr (Beginn)",type:"number",value:y})}
    ${formField({name:"mainStartDate",label:"Hauptzähler Anfang Datum",type:"date",value:mainStart?.date||billingPeriodStart(state,y)})}
    ${formField({name:"mainStart",label:"Hauptzähler Anfang",type:"number",step:"0.001",value:mainStart?.value??""})}
    ${formField({name:"mainEndDate",label:"Hauptzähler Ende Datum",type:"date",value:mainEnd?.date||periodEnd(y)})}
    ${formField({name:"mainEnd",label:"Hauptzähler Ende",type:"number",step:"0.001",value:mainEnd?.value??""})}
    ${formField({name:"ownerStartDate",label:"Eigener Zwischenzähler Anfang Datum",type:"date",value:ownerStart?.date||billingPeriodStart(state,y)})}
    ${formField({name:"ownerStart",label:"Eigener Zwischenzähler Anfang",type:"number",step:"0.001",value:ownerStart?.value??""})}
    ${formField({name:"ownerEndDate",label:"Eigener Zwischenzähler Ende Datum",type:"date",value:ownerEnd?.date||periodEnd(y)})}
    ${formField({name:"ownerEnd",label:"Eigener Zwischenzähler Ende",type:"number",step:"0.001",value:ownerEnd?.value??""})}
    <div class="full" id="waterCalc"></div><div class="full"><button class="primary">Speichern</button></div>
  </form>`,()=>{
    const calc=()=>{const v=Object.fromEntries(new FormData($("f"))),house=Number(v.mainEnd)-Number(v.mainStart),own=Number(v.ownerEnd)-Number(v.ownerStart),tenant=house-own;$("waterCalc").innerHTML=house>=0&&own>=0&&tenant>=0?`<div class="info">Haus ${house.toFixed(3)} m³ − Eigennutzung ${own.toFixed(3)} m³ = Mietwohnung <strong>${tenant.toFixed(3)} m³</strong> (${house>0?percent(tenant/house):"–"})</div>`:`<div class="legal-bad">Zählerstände ergeben einen negativen Verbrauch. Bitte prüfen.</div>`};$("f").oninput=calc;calc();
    $("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target)),house=Number(v.mainEnd)-Number(v.mainStart),own=Number(v.ownerEnd)-Number(v.ownerStart);if(house<0||own<0||house-own<0)return alert("Zählerstände prüfen.");
      const ms=addMeterReading(main,v.mainStartDate,Number(v.mainStart),"manual"),me=addMeterReading(main,v.mainEndDate,Number(v.mainEnd),"manual"),os=addMeterReading(owner,v.ownerStartDate,Number(v.ownerStart),"manual"),oe=addMeterReading(owner,v.ownerEndDate,Number(v.ownerEnd),"manual");
      const obj=x||{id:uid()};Object.assign(obj,{periodYear:Number(v.periodYear),mainMeterId:main.id,ownerMeterId:owner.id,mainStartReadingId:ms.id,mainEndReadingId:me.id,ownerStartReadingId:os.id,ownerEndReadingId:oe.id});if(!x)state.waterSettlements.push(obj);await persist(x?"Wasserperiode geändert":"Wasserperiode angelegt",billingPeriodLabel(state,obj.periodYear));closeModal(true);waterView()
    }
  })
}
function calculationView(){
  const y=selectedBillingYear(state),yearOptions=billingSelectableYears(state),closure=billingClosureChecklist(state,y),a=closure.analysis,snap=(state.billingSnapshots||[]).find(s=>Number(s.periodYear)===Number(y)),ctx=billingPeriodContext(state,y),v18=v18BillingAssistant(state,y);
  const routeFor={period:["data","property"],periodComplete:["rental","billing"],costs:["data","positions"],assignment:["data","positions"],water:["rental","water"],advance:["rental","overview"],readiness:["more","smart"]};
  $("workspaceBody").innerHTML=`<div class="card"><div class="row between"><div><p class="eyebrow">BETRIEBSKOSTENABRECHNUNG</p><h3>${billingPeriodLabel(state,y)}</h3><p class="muted">${esc(ctx.message)}</p><label style="display:block;margin-top:10px"><span class="muted">Abrechnungsperiode</span><select id="billingYearSelect" aria-label="Abrechnungsperiode">${yearOptions.map(yy=>`<option value="${yy}" ${yy===y?"selected":""}>${esc(billingPeriodLabel(state,yy))}</option>`).join("")}</select></label></div><span class="pill ${closure.ok?"good":"warn"}">${closure.ok?"Abschlussbereit":"Noch offen"}</span></div></div>
  ${v18BillingAssistantHTML(state,y,{compact:false})}
  <div class="card"><h3>Abschlussprüfung</h3><p class="muted">Offene Punkte führen direkt zur passenden Eingabe.</p>${closure.points.map((p,i)=>`<${p.ok?"div":"button"} class="closure-step ${p.ok?"done":"open actionable"}" ${p.ok?"":`data-closure="${p.id}"`}><span>${p.ok?"✓":"!"}</span><div><strong>${i+1}. ${esc(p.label)}</strong>${p.ok?"":"<small>Öffnen und beheben</small>"}</div></${p.ok?"div":"button"}>`).join("")}</div>
  <div class="grid cards"><article class="card metric-card"><span>Umlagefähige Kosten</span><strong>${euro(a.tenantCosts)}</strong></article><article class="card metric-card"><span>Vorauszahlungen</span><strong>${euro(a.advances)}</strong></article><article class="card metric-card"><span>Ergebnis</span><strong>${euro(Math.abs(a.result))}</strong><small>${a.result>=0?"Nachzahlung":"Guthaben"}</small></article></div>
  <div class="card"><h3>Abrechnungspositionen</h3>${a.events.length?`<div class="tablewrap"><table class="costtable"><thead><tr><th>Position</th><th>Gesamt</th><th>Verteilung</th><th>Mieteranteil</th><th>Herkunft</th></tr></thead><tbody>${a.events.map(e=>{const p=positionById(state,e.positionId);return`<tr><td>${esc(e.label)}</td><td>${euro(e.amount)}</td><td>${esc(formatRuleForReport(e))}</td><td>${euro(e.tenantAmount)}</td><td><button class="linkbutton" data-bill-trace="${e.positionId}">${esc(provenanceLabel(p))}</button></td></tr>`}).join("")}</tbody></table></div>`:`<div class="empty-state compact-empty"><strong>Noch keine Abrechnungspositionen</strong><p>Bestätigte Kosten der Periode erscheinen hier.</p></div>`}</div>
  ${snap?`<div class="legal-ok"><strong>Abrechnung eingefroren</strong><br>${esc(snapshotVerification(snap).label)}</div><div class="card action-row"><button id="downloadBillingPDF" class="primary">PDF erstellen</button><button id="printBillingBtn" class="secondary">Druckansicht</button></div>`:`<div class="card"><button id="freezeBilling" class="primary wide" ${closure.ok?"":"disabled"}>Final prüfen & einfrieren</button>${closure.ok?"":"<p class='muted'>Der Abschluss wird automatisch freigeschaltet, sobald alle Pflichtpunkte erfüllt sind.</p>"}</div>`}`;
  if($("billingYearSelect"))$("billingYearSelect").onchange=e=>{sessionStorage.setItem("billingSelectedYear",String(Number(e.target.value)));calculationView()};
  bindV18AssistantActions();
  document.querySelectorAll("[data-closure]").forEach(b=>b.onclick=()=>{const r=routeFor[b.dataset.closure];if(r)go(r[0],r[1])});
  document.querySelectorAll("[data-bill-trace]").forEach(b=>b.onclick=()=>openPositionTrace(positionById(state,b.dataset.billTrace)));
  if($("freezeBilling"))$("freezeBilling").onclick=()=>openBillingFinalReview(y);
  if($("downloadBillingPDF"))$("downloadBillingPDF").onclick=async()=>{try{const pdf=await generateProfessionalBillingPDF(state,y,snap);pdf.save(`Betriebskostenabrechnung_${y}.pdf`);AppFeedback.showToast("Abrechnungs-PDF erstellt",{kind:"success"})}catch(e){recordClientError("billing-pdf",e);AppFeedback.showToast("PDF-Erstellung fehlgeschlagen",{kind:"error"});alert(e.message||e)}};
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
      closeModal(true);calculationView()
    }
  })
}
function printBilling(a,y,snapshot=null){
  const w=window.open("","_blank");if(!w)return alert("Druckfenster blockiert.");
  const lease=snapshot?.lease||state.leases?.[0],recipient=billingRecipient(lease),sender=snapshot?.correspondence||state.correspondence||{},property=snapshot?.property||state.property;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Betriebskostenabrechnung ${billingPeriodLabel(state,y)}</title><style>@page{size:A4;margin:18mm}body{font-family:Arial,sans-serif;color:#111;line-height:1.35}.sender{font-size:12px}.recipient{margin:28px 0 32px}.meta{font-size:12px;color:#444}table{width:100%;border-collapse:collapse;margin-top:18px;font-size:12px}th,td{padding:7px;border-bottom:1px solid #ddd;text-align:left}td.num,th.num{text-align:right}.result{margin-top:20px;padding:14px;border:2px solid #222}.foot{margin-top:35px;font-size:10px;color:#555}</style></head><body>
  <div class="sender"><strong>${esc(sender.landlordName||"Vermieter")}</strong><br>${esc(sender.landlordAddress||property.address||"").replace(/\n/g,"<br>")}</div>
  <div class="recipient"><strong>${esc(recipient.name||"Mieter/in")}</strong><br>${esc(recipient.address||property.address||"").replace(/\n/g,"<br>")}</div>
  <h1>Betriebskostenabrechnung</h1><p class="meta">Abrechnungszeitraum: ${billingPeriodLabel(state,y)}<br>Mietobjekt: ${esc(property.name||property.address||"")}</p>
  <table><thead><tr><th>Kostenart</th><th class="num">Gesamt</th><th>Verteilung</th><th class="num">Ihr Anteil</th></tr></thead><tbody>${(a.events||[]).map(e=>`<tr><td>${esc(e.label)}</td><td class="num">${euro(e.amount)}</td><td>${esc(formatRuleForReport(e))}</td><td class="num">${euro(e.tenantAmount)}</td></tr>`).join("")}</tbody></table>
  <div class="result"><strong>Anteilige Betriebskosten:</strong> ${euro(a.tenantCosts)}<br><strong>Vorauszahlungen:</strong> ${euro(a.advances)}<br><br><strong>${a.result>=0?"Nachzahlung":"Guthaben"}: ${euro(Math.abs(a.result))}</strong></div>
  <p>Die Kostenpositionen und verwendeten Verteilungsmaßstäbe sind einzeln ausgewiesen. Die hinterlegten Belege und Herkunftsnachweise können in der App nachvollzogen werden.</p>
  <p>Mit freundlichen Grüßen<br><br>${esc(sender.landlordName||"Vermieter")}</p>
  <div class="foot">Erstellt am ${new Date().toLocaleDateString("de-DE")}${snapshot?.integrityHash?` · Prüfsumme ${esc(String(snapshot.integrityHash).slice(0,20))}…`:""}</div>
  </body></html>`);w.document.close();setTimeout(()=>w.print(),250)
}



function ownerWorkspace(){
  const tabs=[
    {id:"overview",label:"Überblick",icon:"⌂"},
    {id:"payments",label:"Zahlungen",icon:"€"},
    {id:"planning",label:"Planung",icon:"↗"}
  ];
  const active=sub.owner||"overview",visible=visibleSub("owner",active);
  $("app").innerHTML=workspaceHeader("FINANZEN","Finanzen","Zahlungen, Planung und Termine – getrennt von der Mieterabrechnung.",tabs,visible);
  bindWorkspaceTabs("owner",ownerWorkspace);
  if(active==="overview")ownerOverview();
  else if(active==="payments")financePaymentsHubView();
  else if(active==="planning")financePlanningHubView();
  else if(active==="cashflow")ownerCashflowView();
  else if(active==="reconciliation")reconciliationView();
  else if(active==="finance")ownerFinanceView();
  else if(active==="analytics")ownerAnalyticsView();
  else ownerTasksView()
}
function ownerOverview(){
  const f=intelligentForecast(state,12),sum=f.reduce((s,x)=>s+x.net,0),rent=state.leases.reduce((s,l)=>s+Number(l.rent||0),0),repay=Number(state.finance.repayment||0),items=taskList(),overdue=items.filter(t=>daysUntil(t.due)<0),upcoming=items.filter(t=>daysUntil(t.due)>=0),shown=[...overdue,...upcoming].slice(0,4);
  $("workspaceBody").innerHTML=`<div class="grid cards">
    <article class="card metric-card"><span>Hausrate</span><strong>${euro(repay)}</strong><small>monatlich</small></article>
    <article class="card metric-card"><span>Kaltmiete</span><strong>${euro(rent)}</strong><small>monatlich</small></article>
    <article class="card metric-card"><span>Hausrate nach Kaltmiete</span><strong>${euro(repay-rent)}</strong><small>ohne weitere Hauskosten</small></article>
    <article class="card metric-card"><span>12M-Cashflow-Prognose</span><strong class="${sum<0?"negative":"positive"}">${euro(sum)}</strong><small>inkl. BK-Geldfluss</small></article>
  </div>
  <div class="info"><strong>Privater Bereich</strong><br>Hausfinanzierung und eigener Zahlungsfluss werden hier analysiert, aber niemals als umlagefähige Betriebskosten behandelt.</div>
  <section class="card embedded-overview-card">
    <div class="card-head"><div><p class="eyebrow">TERMINE</p><h3>Erinnerungen</h3></div><div class="overview-button-group"><button id="exportOverviewICS" class="secondary compact">Kalender exportieren</button><button id="addOverviewTask" class="primary compact">Hinzufügen</button></div></div>
    ${shown.length?shown.map(taskHTML).join(""):`<div class="empty-inline"><span><strong>Keine anstehenden Erinnerungen</strong><small>Fälligkeiten aus Kostenquellen und eigene Termine erscheinen automatisch hier.</small></span></div>`}
    ${items.length>4?`<button id="openAllTasks" class="secondary wide">Alle ${items.length} Erinnerungen anzeigen</button>`:""}
  </section>`;
  $("exportOverviewICS").onclick=exportICS;
  $("addOverviewTask").onclick=openTaskEditor;
  if($("openAllTasks"))$("openAllTasks").onclick=()=>go("owner","tasks")
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
  const decisions=smartDecisionQueue(state),next=decisions[0]||null,rent=rentMonitor(state,8),proj=billingProjection(state),adv=advanceAdjustmentSuggestion(state),matches=smartPaymentPlan(state),taskSuggestions=smartTaskSuggestions(state),q=dataQualityScore(state),qBand=qualityBand(q);
  $("workspaceBody").innerHTML=`<div class="smart-hero card"><div><p class="eyebrow">ASSISTENT</p><h3>Entscheidungen statt Meldungen</h3><p class="muted">Die App priorisiert nur Punkte, bei denen du sinnvoll handeln kannst. Dringlichkeit und Sicherheit werden getrennt bewertet.</p></div><div class="quality-orb quality-${qBand.id}"><strong>${esc(qBand.label)}</strong><small>${q}% Datenqualität</small></div></div>
  ${next?`<section class="next-best-action decision-${next.severity}"><div><p class="eyebrow">EMPFEHLUNG</p><h3>${esc(next.title)}</h3><p>${esc(next.detail||"")}</p><div class="decision-meta"><span class="decision-kind">${esc(next.kind)}</span><span class="confidence confidence-${next.band.id}">${esc(next.band.label)}</span></div>${decisionWhyHTML(next)}</div><button id="smartNextOpen" class="primary">${esc(next.actionLabel)}</button></section>`:`<div class="legal-ok experience-ok"><strong>Keine offene Handlungsempfehlung.</strong><br>Die vorhandenen Daten ergeben aktuell keinen priorisierten Handlungsbedarf.</div>`}
  <div class="card"><form id="smartAskForm" class="smart-ask"><input id="smartQuestion" class="big-input" placeholder="Was möchtest du über das Haus wissen?" aria-label="Frage an den Assistenten"><button class="primary">Fragen</button></form><div class="smart-chips"><button type="button" data-smart-q="Ist die Miete eingegangen?">Miete</button><button type="button" data-smart-q="Wie sieht die Abrechnung aus?">Abrechnung</button><button type="button" data-smart-q="Was fehlt für die Abrechnung?">Vorbereitung</button><button type="button" data-smart-q="Wie ist der Wasserverbrauch?">Wasser</button><button type="button" data-smart-q="Was ist gerade wichtig?">Status</button></div><div id="smartAnswer" aria-live="polite"></div></div>
  ${decisions.length>1?`<div class="card"><div class="card-head"><div><p class="eyebrow">WEITERE ENTSCHEIDUNGEN</p><h3>Nach Wirkung sortiert</h3></div>${taskSuggestions.length?`<button id="smartTasks" class="secondary compact">Erinnerungen</button>`:""}</div>${decisions.slice(1,10).map((x,i)=>`<div class="decision-card decision-${x.severity}"><button class="decision-main" data-smart-insight="${i+1}"><span><strong>${esc(x.title)}</strong><small>${esc(x.detail||"")}</small></span><span class="confidence confidence-${x.band.id}">${esc(x.band.short)}</span></button>${decisionWhyHTML(x)}</div>`).join("")}</div>`:""}
  <div class="grid two-up"><article class="card"><p class="eyebrow">ABRECHNUNG</p><h3>${euro(Math.abs(proj.projectedResult))}</h3><p>${proj.projectedResult>=0?"voraussichtliche Nachzahlung":"voraussichtliches Guthaben"}</p><span class="confidence confidence-${confidenceBand(proj.confidence).id}">${esc(confidenceBand(proj.confidence).label)}</span></article><article class="card"><p class="eyebrow">MIETZAHLUNG</p><h3>${rent[0]?euro(rent[0].paid):"–"}</h3><p>${rent[0]?esc(rentStatusLabel(rent[0])):"kein Status"}</p></article></div>
  <details class="card secondary-detail"><summary>Weitere Auswertungen</summary><div class="detail-content"><h3>Mietzahlungsverlauf</h3><div class="tablewrap"><table class="costtable"><thead><tr><th>Monat</th><th>Soll</th><th>Erkannt</th><th>Status</th></tr></thead><tbody>${rent.map(r=>`<tr><td>${esc(r.key)}</td><td>${r.status==="none"?"–":euro(r.expected)}</td><td>${euro(r.paid)}</td><td>${esc(rentStatusLabel(r))}</td></tr>`).join("")}</tbody></table></div>${adv?`<h3>Vorauszahlungs-Check</h3><p>Aktuell ${euro(adv.current)} / Monat · rechnerischer Richtwert ${euro(adv.recommended)} / Monat.</p><small>${esc(adv.basis)}</small>`:""}${matches.length?`<h3>Zahlungszuordnungen</h3><p>${matches.length} Ausgabe(n) haben einen plausiblen Zuordnungsvorschlag. Die eigentliche Zuordnung erfolgt weiterhin nur nach deiner Bestätigung.</p>`:""}</div></details>`;
  const ask=q=>{const a=smartAnswer(state,q),host=$("smartAnswer");host.innerHTML=`<div class="smart-answer"><div class="answer-head"><strong>${esc(a.title)}</strong><span class="decision-kind">Auswertung</span></div><p>${esc(a.answer)}</p><button id="smartAnswerOpen" class="secondary">Passenden Bereich öffnen</button></div>`;$("smartAnswerOpen").onclick=()=>{if(a.route==="home")go("home");else go(a.route,a.sub||DEFAULT_SUB[a.route])}};
  $("smartAskForm").onsubmit=e=>{e.preventDefault();ask($("smartQuestion").value)};
  document.querySelectorAll("[data-smart-q]").forEach(b=>b.onclick=()=>{$("smartQuestion").value=b.dataset.smartQ;ask(b.dataset.smartQ)});
  if($("smartNextOpen"))$("smartNextOpen").onclick=()=>go(next.route,next.sub||DEFAULT_SUB[next.route]);
  document.querySelectorAll("[data-smart-insight]").forEach(b=>b.onclick=()=>{const x=decisions[Number(b.dataset.smartInsight)];if(x)go(x.route,x.sub||DEFAULT_SUB[x.route])});
  if($("smartTasks"))$("smartTasks").onclick=()=>openSmartTaskSuggestions(taskSuggestions)
}
function openSmartTaskSuggestions(items=smartTaskSuggestions(state)){
  modal("Erinnerungsvorschläge",items.length?`<div class="card"><p>Diese Vorschläge werden aus Fälligkeiten, Ablesungen und Sicherungsstatus abgeleitet.</p></div>${items.map((t,i)=>`<label class="import-row"><input type="checkbox" data-smart-task="${i}" checked><span><strong>${esc(t.title)}</strong><br>${esc(t.due)} · ${esc(t.reason)}</span></label>`).join("")}<button id="acceptSmartTasks" class="primary">Ausgewählte Erinnerungen anlegen</button>`:`<div class="legal-ok">Keine neuen Erinnerungsvorschläge.</div>`,()=>{
    if($("acceptSmartTasks"))$("acceptSmartTasks").onclick=async()=>{const selected=[...document.querySelectorAll("[data-smart-task]:checked")].map(x=>items[Number(x.dataset.smartTask)]).filter(Boolean);if(!selected.length)return;for(const t of selected)state.tasks.push({id:uid(),title:t.title,due:t.due,lead:t.lead||14,origin:"smart"});await persist("Smart-Erinnerungen angelegt",`${selected.length} Vorschlag/Vorschläge`);closeModal(true);smartCenterView()}
  })
}

function more(){
  const tabs=[
    {id:"smart",label:"Assistent",icon:"✦"},
    {id:"protection",label:"Sicherung",icon:"◇"},
    {id:"app",label:"Erweitert",icon:"•••"}
  ];
  const active=sub.more||"smart",visible=visibleSub("more",active);
  $("app").innerHTML=workspaceHeader("MEHR","Mehr","Assistent, Datensicherung und selten benötigte Einstellungen.",tabs,visible);
  bindWorkspaceTabs("more",more);
  if(active==="smart"||active==="overview")smartCenterView();
  else if(active==="legal")legalMoreView();
  else if(active==="protection")protectionHubView();
  else if(active==="app")appManagementHubView();
  else if(active==="security")securityMoreView();
  else if(active==="backup")backupMoreView();
  else if(active==="recovery")recoveryView();
  else if(active==="audit")auditMoreView();
  else diagnosticsMoreView()
}

function auditMoreView(){auditView()}
function legalMoreView(){legalView()}
function securityMoreView(){securityView()}
function diagnosticsMoreView(){diagnosticsView()}
function backupMoreView(){backupView()}


function financeView(){
  const f=intelligentForecast(state,12),sum=f.reduce((s,x)=>s+x.net,0),signals=forecastSignals(state);
  $("workspaceBody").innerHTML=`<form id="financeForm" class="card form-grid">${formField({name:"repayment",label:"Hausrate pro Monat (€)",type:"number",step:"0.01",value:state.finance.repayment})}${formField({name:"fixed",label:"Weitere feste Hauskosten pro Monat (€)",type:"number",step:"0.01",value:state.finance.fixed})}<div class="full"><button class="primary">Speichern</button></div></form>
  <div class="grid cards"><article class="card"><span>12M-Cashflow</span><strong class="${sum<0?"negative":"positive"}">${euro(sum)}</strong></article><article class="card"><span>Ø Monatsbelastung</span><strong>${euro(f.reduce((s,r)=>s+r.outflow,0)/Math.max(1,f.length))}</strong></article></div>
  ${signals.map(s=>`<div class="${s.severity==="warn"?"legal-warn":"legal-ok"}">${esc(s.text)}</div>`).join("")}
  <div class="card"><h3>12-Monats-Cashflow-Prognose</h3><p class="muted">Berücksichtigt Mietzahlungen, Hausrate, feste Hauskosten und bestätigte Kostenpositionen anhand ihres tatsächlichen Leistungszeitraums.</p><div class="tablewrap"><table class="costtable"><thead><tr><th>Monat</th><th>Einnahmen</th><th>Geplante Ausgaben</th><th>Saldo</th></tr></thead><tbody>${f.map(r=>`<tr><td>${r.label}</td><td>${euro(r.income)}</td><td>${euro(r.outflow)}</td><td class="${r.net<0?"negative":"positive"}">${euro(r.net)}</td></tr>`).join("")}</tbody></table></div></div>`;
  $("financeForm").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));const result=await executeCommand("finance.update",{repayment:Number(v.repayment)||0,fixed:Number(v.fixed)||0},async()=>{state.finance={repayment:Number(v.repayment)||0,fixed:Number(v.fixed)||0}},{auditText:"Finanzen geändert"});if(!result.ok)return alert(result.message);financeView()}
}

function cashflowView(){
  const rows=actualCashflowByMonth(state,12),sumIn=rows.reduce((s,r)=>s+r.income,0),sumOut=rows.reduce((s,r)=>s+r.outflow,0),rentHits=(state.payments||[]).filter(p=>detectRentPayment(state,p)?.score>=80);
  $("workspaceBody").innerHTML=`<div class="card"><div class="row between"><div><h3>Tatsächlicher Zahlungsfluss</h3><p class="muted">Echte Kontobewegungen. CSV-Import arbeitet mit Vorschau und Duplikaterkennung.</p></div><div><button id="importBank" class="secondary">Kontoauszug CSV</button><button id="addPayment" class="primary">Buchung hinzufügen</button></div></div><input id="bankCsvInput" type="file" accept=".csv,text/csv,text/plain" hidden></div>
  ${v17PaymentQualityCard(state)}
  <div class="grid cards"><article class="card"><span>Einnahmen 12M</span><strong>${euro(sumIn)}</strong></article><article class="card"><span>Ausgaben 12M</span><strong>${euro(sumOut)}</strong></article><article class="card"><span>Saldo 12M</span><strong class="${sumIn-sumOut<0?"negative":"positive"}">${euro(sumIn-sumOut)}</strong></article><article class="card"><span>erkannte Mietzahlungen</span><strong>${rentHits.length}</strong></article></div>
  <div class="card"><div class="tablewrap"><table class="costtable"><thead><tr><th>Monat</th><th>Einnahmen</th><th>Ausgaben</th><th>Saldo</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.label}</td><td>${euro(r.income)}</td><td>${euro(r.outflow)}</td><td class="${r.net<0?"negative":"positive"}">${euro(r.net)}</td></tr>`).join("")}</tbody></table></div></div>
  <div class="card"><h3>Letzte Buchungen</h3>${(state.payments||[]).slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,20).map(p=>{const rm=detectRentPayment(state,p);return`<div class="item"><strong>${esc(p.date)} · ${p.direction==="income"?"+":"−"} ${euro(p.amount)}</strong><p>${esc(p.label)}</p>${rm?(()=>{const cb=confidenceBand(rm.score);return`<small class="positive">Mietzahlung wahrscheinlich · ${esc(rm.kind)} · ${esc(cb.short)}</small>`})():""}</div>`}).join("")||"<div class='empty-state'><strong>Noch keine Zahlungen erfasst</strong><p>Du kannst eine Zahlung manuell hinzufügen oder einen Kontoauszug importieren.</p></div>"}</div>`;
  $("addPayment").onclick=openPaymentEditor;$("importBank").onclick=()=>$("bankCsvInput").click();
  $("bankCsvInput").onchange=async e=>{const f=e.target.files?.[0];e.target.value="";if(!f)return;try{openBankImportPreview(parseBankCSV(await f.text()),f.name)}catch(err){recordClientError("bank-csv",err);alert("Import nicht möglich: "+(err.message||err))}}
}
function openBankImportPreview(parsed,fileName){
  const rows=bankImportPreview(state,parsed),fresh=rows.filter(x=>!x.duplicate);
  modal("Kontoauszug importieren",`<div class="card"><h3>${esc(fileName)}</h3><p>${rows.length} Buchungen erkannt · <strong>${fresh.length} neu</strong> · ${rows.length-fresh.length} Duplikat(e).</p><p class="muted">Vor dem Import wird nichts gespeichert.</p></div><div class="import-preview">${rows.slice(0,80).map((r,i)=>`<label class="import-row ${r.duplicate?"duplicate":""}"><input type="checkbox" data-import-row="${i}" ${r.duplicate?"disabled":"checked"}><span><strong>${esc(r.date)} · ${r.direction==="income"?"+":"−"} ${euro(r.amount)}</strong><br>${esc(r.label)}${r.rentMatch?(()=>{const cb=confidenceBand(r.rentMatch.score);return`<br><small class="positive">Mietzahlung: ${esc(r.rentMatch.kind)} · ${esc(cb.short)}</small>`})():""}${r.duplicate?"<br><small>bereits vorhanden</small>":""}</span></label>`).join("")}</div><button id="commitBankImport" class="primary" ${fresh.length?"":"disabled"}>Ausgewählte Buchungen importieren</button>`,()=>{
    $("commitBankImport").onclick=async()=>{const selected=[...document.querySelectorAll("[data-import-row]:checked")].map(x=>rows[Number(x.dataset.importRow)]).filter(Boolean);if(!selected.length)return;
      createRestorePoint("Vor Kontoimport");
      const result=await executeCommand("bank.csv.import",{fileName,count:selected.length},async()=>{for(const r of selected)state.payments.push({id:uid(),date:r.date,direction:r.direction,label:r.label,amount:r.amount,sourceId:"",positionId:"",importOrigin:"csv",importFile:fileName});state.meta.importHistory.unshift({id:uid(),at:new Date().toISOString(),fileName,recognized:rows.length,imported:selected.length,duplicates:rows.length-fresh.length});state.meta.importHistory=state.meta.importHistory.slice(0,25)},{auditText:"Kontoauszug importiert"});
      if(!result.ok)return alert(result.message);AppFeedback.showToast(`${selected.length} Buchung(en) importiert`,{kind:"success"});closeModal(true);cashflowView()
    }
  })
}
function openPaymentEditor(){
  const sources=(state.sources||[]).map(s=>({value:s.id,label:s.name})),positions=(state.costPositions||[]).filter(p=>p.confirmed).map(p=>({value:p.id,label:`${p.label} · ${euro(p.amount)}`}));
  modal("Zahlung erfassen",`<form id="f" class="form-grid">${formField({name:"date",label:"Datum",type:"date",value:localDateISO()})}${formField({name:"direction",label:"Art",type:"select",value:"outflow",options:[{value:"outflow",label:"Ausgabe"},{value:"income",label:"Einnahme"}]})}${formField({name:"label",label:"Bezeichnung"})}${formField({name:"amount",label:"Betrag €",type:"number",step:"0.01",min:0.01})}${formField({name:"sourceId",label:"Quelle",type:"select",value:"",options:[{value:"",label:"keine Quelle"},...sources]})}${formField({name:"positionId",label:"Kostenposition",type:"select",value:"",options:[{value:"",label:"keine Kostenposition"},...positions]})}<div class="full"><button class="primary">Speichern</button></div></form>`,()=>{
    $("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target)),amount=Number(v.amount);if(!v.date)return alert("Bitte ein Buchungsdatum eintragen.");if(!String(v.label||"").trim())return alert("Bitte eine aussagekräftige Bezeichnung eintragen.");if(!Number.isFinite(amount)||amount<=0)return alert("Der Betrag muss größer als 0,00 € sein.");const payment={id:uid(),date:v.date,direction:v.direction,label:v.label.trim(),amount,sourceId:v.sourceId||"",positionId:v.positionId||""};const result=await executeCommand("payment.create",payment,async()=>state.payments.push(payment),{auditText:"Zahlung erfasst"});if(!result.ok)return alert(result.message);closeModal(true);cashflowView()}
  })
}

function analyticsView(){
  const y=currentPeriodYear(),cmp=annualComparison(state,y),alerts=costTrendAlerts(state,y),meters=state.meters||[],bp=billingPeriodInfo(state,y),prev=billingPeriodInfo(state,y-1);
  $("workspaceBody").innerHTML=`<div class="card"><h3>Jahresvergleich & Verbrauchsanalyse</h3><p class="muted">Volle Jahresperioden werden direkt verglichen. Übernahme-Teilperioden werden ausdrücklich als nicht direkt vergleichbar markiert.</p></div>
  ${(bp.days<bp.nominalDays||prev.days<prev.nominalDays)?`<div class="info"><strong>Teilperiode berücksichtigt</strong><br>${bp.days<bp.nominalDays?`${esc(billingPeriodLabel(state,y))} ist eine verkürzte Übernahmeperiode. `:""}${prev.days<prev.nominalDays?`${esc(billingPeriodLabel(state,y-1))} war eine verkürzte Periode. `:""}Prozentvergleiche werden dafür nicht als regulärer Jahresvergleich ausgegeben.</div>`:""}
  ${alerts.length?alerts.map(a=>`<div class="${a.severity==="warn"?"legal-warn":"info"}">${esc(a.text)}</div>`).join(""):`<div class="legal-ok">✓ Keine belastbare Kostenänderung über 15 % zwischen zwei vollen Jahresperioden erkannt.</div>`}
  <div class="card"><h3>${esc(billingPeriodLabel(state,y-1))} → ${esc(billingPeriodLabel(state,y))}</h3><div class="tablewrap"><table class="costtable"><thead><tr><th>Kategorie</th><th>Vorperiode</th><th>Aktuell</th><th>Änderung</th></tr></thead><tbody>${cmp.map(x=>`<tr><td>${esc(categoryLabel(x.category))}</td><td>${euro(x.prior)}</td><td>${euro(x.current)}</td><td class="${x.change>0?"negative":"positive"}">${x.comparable&&x.pct!=null?`${x.pct>=0?"+":""}${Math.round(x.pct*100)} %`:"Teilperiode"}</td></tr>`).join("")||"<tr><td colspan='4'>Noch keine zwei Perioden vorhanden.</td></tr>"}</tbody></table></div></div>
  ${meters.map(m=>{const t=meterTrend(m),an=robustMeterAnomalies(m);return`<div class="card"><h3>${esc(m.name)}</h3><p>${t.segments.length?`Ø ${t.avgPer30.toFixed(2)} ${esc(m.unit||"")} je 30 Tage`:"Noch zu wenige Ablesungen für einen Trend."}</p>${an.map(a=>`<div class="legal-warn">${esc(a.text)}</div>`).join("")}<div class="tablewrap"><table class="costtable"><thead><tr><th>Zeitraum</th><th>Verbrauch</th><th>/30 Tage</th></tr></thead><tbody>${t.segments.slice(-8).reverse().map(x=>`<tr><td>${esc(x.from.date)}–${esc(x.to.date)}</td><td>${x.delta.toFixed(3)} ${esc(m.unit||"")}</td><td>${x.per30.toFixed(3)}</td></tr>`).join("")}</tbody></table></div></div>`}).join("")}`
}
function reconciliationView(){
  const r=reconciliationSummary(state),open=r.rows.filter(x=>Math.abs(x.difference)>.01),plan=smartPaymentPlan(state);
  $("workspaceBody").innerHTML=`<div class="card"><div class="row between"><div><h3>Zahlungen zuordnen</h3><p class="muted">Betrag, Buchungstext und Fälligkeit werden gemeinsam bewertet. Gespeichert wird erst nach deiner Bestätigung.</p></div></div></div>
  <div class="grid cards"><article class="card"><span>Kostenpositionen</span><strong>${r.rows.length}</strong></article><article class="card"><span>Abweichungen</span><strong>${open.length}</strong></article><article class="card"><span>Plausible Vorschläge</span><strong>${plan.length}</strong></article></div>
  ${plan.length?`<div class="card"><h3>Vorschläge</h3>${plan.slice(0,8).map((x,i)=>{const s=x.suggestions[0],cb=confidenceBand(s.score);return`<div class="decision-row"><span><strong>${esc(x.payment.label)} · ${euro(x.payment.amount)}</strong><small>→ ${esc(s.target.label||s.target.name)} · ${s.type==="source"?"Kostenquelle":"Kostenposition"}<br>${esc(s.reasons.join(" · "))}</small></span><span><span class="confidence confidence-${cb.id}">${esc(cb.short)}</span><button class="secondary compact" data-recon-smart="${i}">Zuordnen</button></span></div>`}).join("")}</div>`:`<div class="legal-ok">✓ Aktuell keine ausreichend plausiblen offenen Zuordnungsvorschläge.</div>`}
  <div class="card"><h3>Zahlungsabgleich</h3><div class="tablewrap"><table class="costtable"><thead><tr><th>Position</th><th>Soll</th><th>Bezahlt</th><th>Differenz</th></tr></thead><tbody>${r.rows.map(x=>`<tr><td>${esc(x.position.label)}</td><td>${euro(x.position.amount)}</td><td>${euro(x.paid)}</td><td class="${Math.abs(x.difference)>.01?"negative":"positive"}">${euro(x.difference)}</td></tr>`).join("")}</tbody></table></div></div>`;
  const accept=async i=>{const x=plan[i],s=x?.suggestions?.[0];if(!x||!s)return;if(!confirm(`„${x.payment.label}“ (${euro(x.payment.amount)}) mit „${s.target.label||s.target.name}“ verknüpfen?`))return;const res=await executeCommand("payment.smartMatch",{paymentId:x.payment.id,type:s.type,targetId:s.target.id,score:s.score},async()=>{if(s.type==="position"){x.payment.positionId=s.target.id;x.payment.sourceId=s.target.sourceId||""}else x.payment.sourceId=s.target.id},{auditText:"Zahlung zugeordnet"});if(!res.ok)return alert(res.message);reconciliationView()};
  document.querySelectorAll("[data-recon-smart]").forEach(b=>b.onclick=()=>accept(Number(b.dataset.reconSmart)))
}

function tasksView(){
  const items=taskList(),overdue=items.filter(t=>daysUntil(t.due)<0),upcoming=items.filter(t=>daysUntil(t.due)>=0);
  $("workspaceBody").innerHTML=`<div class="card"><div class="row between"><div><h3>Erinnerungen</h3><p class="muted">Fälligkeiten aus Kostenquellen und eigene Erinnerungen erscheinen gemeinsam. Der Kalenderexport übernimmt den aktuellen Stand.</p></div><div><button id="ics" class="secondary">Kalender exportieren</button><button id="addTask" class="primary">Erinnerung hinzufügen</button></div></div></div>
  ${overdue.length?`<section class="card"><h3>Überfällig</h3>${overdue.map(taskHTML).join("")}</section>`:""}
  ${upcoming.length?`<section class="card"><h3>Demnächst</h3>${upcoming.slice(0,20).map(taskHTML).join("")}</section>`:`<div class="legal-ok">✓ Keine anstehenden Erinnerungen.</div>`}`;
  $("addTask").onclick=openTaskEditor;$("ics").onclick=exportICS
}
function openTaskEditor(){
  modal("Erinnerung hinzufügen",`<form id="f" class="form-grid">${formField({name:"title",label:"Titel"})}${formField({name:"due",label:"Fällig am",type:"date"})}${formField({name:"lead",label:"Vorwarnung (Tage)",type:"number",value:14})}<div class="full"><button class="primary">Speichern</button></div></form>`,()=>{$("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));state.tasks.push({id:uid(),title:v.title,due:v.due,lead:Number(v.lead)||14});await persist("Erinnerung angelegt",v.title);closeModal(true);route==="owner"?(sub.owner==="overview"?ownerOverview():ownerTasksView()):tasksView()}})
}
function exportICS(){
  let out="BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Mietverwaltung//DE\r\n";
  for(const t of taskList()){if(!t.due)continue;out+=`BEGIN:VEVENT\r\nUID:${t.id}@mietverwaltung\r\nDTSTART;VALUE=DATE:${t.due.replaceAll("-","")}\r\nSUMMARY:${String(t.title).replace(/,/g,"\\,")}\r\nBEGIN:VALARM\r\nTRIGGER:-P${Number(t.lead||14)}D\r\nACTION:DISPLAY\r\nDESCRIPTION:${String(t.title).replace(/,/g,"\\,")}\r\nEND:VALARM\r\nEND:VEVENT\r\n`}
  out+="END:VCALENDAR\r\n";const blob=new Blob([out],{type:"text/calendar"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="Mietverwaltung_Erinnerungen.ics";a.click();URL.revokeObjectURL(a.href)
}
function auditView(){
  $("workspaceBody").innerHTML=state.audit.length?state.audit.map(x=>`<div class="item"><h3>${esc(x.action)}</h3><p>${esc(x.detail)}</p><small>${new Date(x.at).toLocaleString("de-DE")}</small></div>`).join(""):`<div class="card muted">Noch keine Änderungen protokolliert.</div>`
}
function legalView(){
  const effective=ACTIVE_LEGAL_PACK?.effectiveDate||LAW_DATE,age=Math.max(0,calendarDayDiff(effective,smartToday())),sources=ACTIVE_LEGAL_PACK?.sources||LEGAL_SOURCES;
  $("workspaceBody").innerHTML=`<div class="${age<=90?"legal-ok":"legal-warn"}"><strong>Rechtsstand ${esc(effective)}</strong><br>${age<=90?"Aktueller Prüfstand hinterlegt.":`Letzte Prüfung vor ${age} Tagen.`}</div><div class="card"><h3>Amtliche Quellen</h3>${sources.map(s=>`<p><a href="${s.url}" target="_blank" rel="noopener">${esc(s.name)}</a>${s.purpose?`<br><small>${esc(s.purpose)}</small>`:""}</p>`).join("")}<button id="reloadRules" class="secondary">Rechtsstand neu laden</button></div>`;
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
    const smart=typeof smartDecisionQueue==="function"?smartDecisionQueue(state).filter(x=>x.severity==="bad"||x.severity==="warn").length:0;
    const count=Math.min(99,due+smart);
    if(count>0&&navigator.setAppBadge)await navigator.setAppBadge(count);else if(navigator.clearAppBadge)await navigator.clearAppBadge()
  }catch(e){console.warn("App-Badge nicht verfügbar:",e)}
}


let SW_UPDATE_WAITING=false;
function setupServiceWorkerUpdates(){
  if(!("serviceWorker" in navigator))return;
  SERVICE_WORKER_REGISTRATION.then(reg=>{
    if(!reg)return;
    const watch=worker=>{
      if(!worker)return;
      const mark=()=>{if(worker.state==="installed"&&navigator.serviceWorker.controller)SW_UPDATE_WAITING=true};
      mark();worker.addEventListener("statechange",mark)
    };
    if(reg.waiting&&navigator.serviceWorker.controller)SW_UPDATE_WAITING=true;
    watch(reg.installing);
    reg.addEventListener("updatefound",()=>watch(reg.installing));
  }).catch(e=>console.warn("Service-Worker-Updateprüfung nicht verfügbar:",e));
}
async function activateWaitingServiceWorker(){
  try{const reg=await navigator.serviceWorker.getRegistration();if(reg?.waiting){reg.waiting.postMessage({type:"SKIP_WAITING"});location.reload()}else alert("Es wartet derzeit kein Update.")}
  catch(e){recordClientError("service-worker-update",e);alert("Update konnte nicht aktiviert werden.")}
}


function securityView(){
  $("workspaceBody").innerHTML=`<div class="card"><div class="card-head"><div><p class="eyebrow">GERÄTESCHUTZ</p><h3>Face ID / Geräteauthentifizierung</h3></div><div id="authStatus"></div></div><p class="muted">Auf unterstützten Geräten bestätigt iOS den Zugriff mit Face ID, Touch ID oder Gerätecode.</p><div class="action-row"><button id="authEnable" class="primary">Aktivieren</button><button id="authTest" class="secondary">Funktion prüfen</button><button id="authDisable" class="danger">Deaktivieren</button></div></div><div class="info"><strong>Wichtig:</strong> Der Geräteschutz sperrt den App-Zugang. Die lokale IndexedDB wird dadurch nicht zusätzlich verschlüsselt. Für transportierbare Daten ist die verschlüsselte Datensicherung vorgesehen.</div>`;
  const refresh=()=>{const on=authEnabled();$("authStatus").innerHTML=`<span class="pill ${on?"good":"warn"}">${on?"Aktiv":"Nicht aktiv"}</span>`;$("authEnable").disabled=on;$("authDisable").disabled=!on};refresh();
  $("authEnable").onclick=async()=>{try{await registerDevice();refresh()}catch(e){alert(e.message)}};
  $("authTest").onclick=async()=>alert(await authenticate()?"Geräteschutz funktioniert.":"Authentifizierung fehlgeschlagen.");
  $("authDisable").onclick=async()=>{if(!confirm("Geräteschutz wirklich deaktivieren?"))return;if(authEnabled()&&!(await authenticate()))return alert("Authentifizierung erforderlich.");disableAuth();refresh()}
}
async function diagnosticsView(){
  const tests=runSelfTests(),coverageMissing=checkInputCoverage(),ok=tests.filter(t=>t.ok).length,st=await storageStatus(),pct=st.quota?Math.round(st.usage/st.quota*100):0,integrity=integritySummary(state),errors=state.meta?.errorLog||[],allOk=ok===tests.length&&integrity.ok&&!coverageMissing.length;
  $("workspaceBody").innerHTML=`<div class="card"><h3>App-Prüfung</h3><div class="analysis-grid"><div><small>Gesamtstatus</small><strong>${allOk?"OK":"Prüfen"}</strong></div><div><small>Datenqualität</small><strong>${dataQualityScore(state)}%</strong></div><div><small>Prüfungen</small><strong>${ok}/${tests.length}</strong></div></div></div>
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
  $("workspaceBody").innerHTML=`<div class="card"><h3>Sicherungspunkte</h3><p class="muted">Vor wichtigen Änderungen kann ein lokaler Rücksprungpunkt gespeichert werden. Beim Wiederherstellen wird der aktuelle Stand automatisch als neuer Sicherungspunkt erhalten.</p><button id="createRestorePoint" class="primary">Sicherungspunkt erstellen</button></div>${pts.map(p=>`<div class="item"><div class="row between"><div><strong>${esc(p.label)}</strong><p>${new Date(p.at).toLocaleString("de-DE")}</p></div><button class="secondary" data-restore="${p.id}">Wiederherstellen</button></div></div>`).join("")||"<div class='card muted'>Noch keine Sicherungspunkte.</div>"}`;
  $("createRestorePoint").onclick=async()=>{createRestorePoint("Manuell erstellt");await persist("Sicherungspunkt erstellt","manuell");recoveryView()};
  document.querySelectorAll("[data-restore]").forEach(b=>b.onclick=async()=>{if(!confirm("Diesen Stand wiederherstellen? Der aktuelle Stand bleibt als Sicherungspunkt erhalten."))return;try{await restoreFromPoint(b.dataset.restore);alert("Stand wiederhergestellt.");render()}catch(e){alert("Wiederherstellung fehlgeschlagen: "+(e.message||e))}})
}

function backupView(){
  const stamp=localDateISO(),last=state.meta?.lastBackupAt?new Date(state.meta.lastBackupAt).toLocaleString("de-DE"):"noch keine";
  $("workspaceBody").innerHTML=`<div class="card"><div class="item-title-row"><div><p class="eyebrow">EMPFOHLEN</p><h3>Verschlüsselte Datensicherung</h3></div><span class="pill good">Stammdaten + Dokumente</span></div><p>Letzte erstellte Sicherung: <strong>${esc(last)}</strong></p><label>Passwort<input id="backupPw" type="password" class="big-input" placeholder="mindestens 8 Zeichen" autocomplete="new-password"></label><div class="action-row"><button id="fullExport" class="primary">Sicherung erstellen</button><label class="file-label">Sicherung auswählen<input id="fullImportFile" type="file" accept=".json,application/json"></label><button id="fullImport" class="secondary">Wiederherstellen</button></div><p class="muted">Das Passwort wird nicht gespeichert. Ohne Passwort kann eine verschlüsselte Sicherung nicht wiederhergestellt werden.</p></div>
  <details class="card secondary-detail"><summary>Technischer Klartext-Export</summary><div class="detail-content"><div class="legal-warn"><strong>Unverschlüsselt</strong><br>Enthält persönliche Verwaltungsdaten im Klartext und keine Dokumentdateien. Nur für technische Zwecke verwenden.</div><button id="exportState" class="secondary">JSON exportieren</button></div></details>`;
  $("exportState").onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`Mietverwaltung_Daten_${stamp}.json`;a.click();URL.revokeObjectURL(a.href)};
  $("fullExport").onclick=async()=>{const pw=$("backupPw").value;if(pw.length<8)return alert("Bitte mindestens 8 Zeichen für das Passwort verwenden.");const wrapper=await createFullBackup(state,pw),blob=new Blob([JSON.stringify(wrapper)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`Mietverwaltung_Datensicherung_${stamp}.json`;a.click();URL.revokeObjectURL(a.href);state.meta.lastBackupAt=new Date().toISOString();await persist("Datensicherung erstellt","verschlüsselt");backupView()};
  $("fullImport").onclick=async()=>{const f=$("fullImportFile").files[0],pw=$("backupPw").value;if(!f)return alert("Bitte zuerst eine Datensicherung auswählen.");if(pw.length<1)return alert("Bitte das Passwort der Datensicherung eingeben.");const oldState=cloneState(state),oldDocs=await listDocuments();try{const wrapper=JSON.parse(await f.text()),decoded=await decodeFullBackup(wrapper,pw),next=ensureTraceShape(repairDomainState(decoded.state)),check=validateDomainState(next);if(check.errors.length)throw new Error("Die Sicherung enthält fehlerhafte Daten: "+check.errors.join(" · "));if(!confirm(`Geprüfte Sicherung wiederherstellen? ${decoded.documents.length} Dokument(e) werden übernommen.`))return;createRestorePoint("Vor Datensicherung-Import");await replaceDocuments(decoded.documents);state=next;state.meta.restorePoints=[...(oldState.meta?.restorePoints||[]),...(state.meta.restorePoints||[])].slice(0,5);await saveState(state);LAST_STABLE_STATE=cloneState(state);alert("Datensicherung erfolgreich wiederhergestellt.");more()}catch(e){try{await replaceDocuments(oldDocs);state=oldState;await saveState(oldState);LAST_STABLE_STATE=cloneState(oldState)}catch{}alert("Wiederherstellung fehlgeschlagen: "+(e.message||e))}}
}
function setupGlobal(){
  document.querySelectorAll(".main-tabs button").forEach(b=>b.onclick=()=>goTop(b.dataset.route));
  $("modalClose").onclick=()=>closeModal(false);
  $("searchBtn").onclick=()=>{$("searchOverlay").classList.remove("hidden");$("searchInput").value="";search("");setTimeout(()=>$("searchInput").focus(),30)};
  $("searchClose").onclick=()=>{$("searchOverlay").classList.add("hidden");$("searchBtn").focus()};
  $("searchInput").oninput=e=>search(e.target.value);
  $("quickBtn").onclick=()=>{$("quickOverlay").classList.remove("hidden");setTimeout(()=>focusableIn($("quickOverlay"))[0]?.focus?.(),30)};
  $("quickClose").onclick=()=>{$("quickOverlay").classList.add("hidden");$("quickBtn").focus()};
  document.querySelectorAll("[data-quick]").forEach(b=>b.onclick=()=>{
    const q=b.dataset.quick;
    MODAL_RETURN_FOCUS_OVERRIDE=["document","meter","payment","source","task"].includes(q)?$("quickBtn"):null;
    $("quickOverlay").classList.add("hidden");
    if(q==="document"){go("data","documents");setTimeout(openDocumentCapture,0)}
    else if(q==="meter"){go("data","infrastructure");setTimeout(()=>openMeterPhotoCapture(),0)}
    else if(q==="payment"){go("owner","cashflow");setTimeout(openPaymentEditor,0)}
    else if(q==="source"){go("data","sources");setTimeout(openSourceEditor,0)}
    else if(q==="task"){go("owner","tasks");setTimeout(()=>openTaskEditor(),0)}
    else {go("rental","overview");setTimeout(()=>openLeaseEditor(state.leases?.[0]||null),0)}
  })
}
function search(q){
  const z=normalizeLabelText(q||""),rows=[];
  const add=(title,detail,route,sub,keywords="")=>rows.push({title,detail,route,sub,keywords});
  add(state.property.name||"Objekt","Haus · Objektdaten","data","object","adresse wohnfläche baujahr");
  (state.sources||[]).forEach(s=>add(s.name,"Haus · Kostenquelle","data","sources",`${categoryLabel(s.category)} fälligkeit bescheid vertrag`));
  (state.costPositions||[]).forEach(p=>add(p.label,`Haus · Kostenposition · ${euro(p.amount)}`,"data","positions",`${categoryLabel(p.category)} umlage kosten`));
  (state.tasks||[]).forEach(t=>add(t.title,`Finanzen · Erinnerung · ${dateDE(t.due)}`,"owner","tasks","termin fällig"));
  (state.payments||[]).forEach(p=>add(p.label,`Finanzen · ${p.direction==="income"?"Einnahme":"Ausgabe"} · ${dateDE(p.date)} · ${euro(p.amount)}`,"owner","cashflow","zahlung buchung konto"));
  (state.meters||[]).forEach(m=>add(m.name,`Haus · Zähler · ${m.number||"ohne Nummer"}`,"data","infrastructure","wasser zählerstand ablesung"));
  (state.documentsCache||[]).forEach(d=>add(d.label||d.name,`Haus · Dokument · ${documentWorkflowLabel(d)}`,"data","documents","beleg pdf scan ocr"));
  (state.leases||[]).forEach(l=>add("Mietvertrag",`Vermietung · ab ${dateDE(l.start)}`,"rental","overview",`${l.tenantName||""} miete vertrag`));
  [
    ["Kaltwasser","Vermietung · Zähler & Verbrauch","rental","water","wasser verbrauch"],
    ["Betriebskostenabrechnung","Vermietung · Abrechnung","rental","billing","abrechnung betriebskosten nebenkosten"],
    ["Datensicherung","Mehr · Sicherheit","more","backup","backup sicherung export"],
    ["Assistent","Mehr · Entscheidungen","more","smart","status wichtig"]
  ].forEach(x=>add(...x));

  if(!z){
    const suggestions=[
      ["Betriebskostenabrechnung","Vermietung · Abrechnung","rental","billing"],
      ["Kaltwasser","Vermietung · Verbrauch","rental","water"],
      ["Dokumente","Haus · Dokumente","data","documents"],
      ["Zahlungen","Finanzen · Zahlungsfluss","owner","cashflow"],
      ["Kostenpositionen","Haus · Kosten","data","positions"],
      ["Datensicherung","Mehr · Sicherheit","more","backup"]
    ];
    $("searchResults").innerHTML=`<p class="search-section-title">Häufig gebraucht</p>${suggestions.map((r,i)=>`<button class="search-result" data-suggestion="${i}"><span><strong>${esc(r[0])}</strong><small>${esc(r[1])}</small></span><b>›</b></button>`).join("")}`;
    document.querySelectorAll("[data-suggestion]").forEach(b=>b.onclick=()=>{const r=suggestions[Number(b.dataset.suggestion)];$("searchOverlay").classList.add("hidden");go(r[2],r[3])});return
  }
  const tokens=z.split(/\s+/).filter(Boolean);
  const ranked=rows.map(r=>{
    const hay=normalizeLabelText(`${r.title} ${r.detail} ${r.keywords}`),title=normalizeLabelText(r.title);
    let score=tokenSimilarity(z,hay)*60+tokenSimilarity(z,title)*35;
    if(title===z)score+=80;else if(title.startsWith(z))score+=55;else if(hay.includes(z))score+=30;
    score+=tokens.reduce((s,t)=>s+(title.includes(t)?12:hay.includes(t)?5:0),0);
    return {...r,score}
  }).filter(r=>r.score>8).sort((a,b)=>b.score-a.score).slice(0,24);
  $("searchResults").innerHTML=ranked.length?ranked.map((r,i)=>`<button class="search-result" data-search="${i}"><span><strong>${esc(r.title)}</strong><small>${esc(r.detail)}</small></span><b>›</b></button>`).join(""):`<div class="empty-state"><strong>Keine passenden Treffer</strong><p>Versuche einen kürzeren Begriff wie „Wasser“, „Miete“ oder „Bescheid“.</p></div>`;
  document.querySelectorAll("[data-search]").forEach(b=>b.onclick=()=>{const r=ranked[Number(b.dataset.search)];$("searchOverlay").classList.add("hidden");go(r.route,r.sub)})
}

function updateConnectionState(){
  const el=$("connectionState");if(!el)return;el.textContent=navigator.onLine?"Online":"Offline";el.className=`connection-pill ${navigator.onLine?"online":"offline"}`
}
function setupRuntimeGuards(){
  updateConnectionState();window.addEventListener("online",updateConnectionState);window.addEventListener("offline",updateConnectionState);
  window.addEventListener("error",e=>recordClientError("window-error",e.error||e.message));
  window.addEventListener("unhandledrejection",e=>recordClientError("unhandled-promise",e.reason));
  document.addEventListener("keydown",e=>{
    trapFocusInDialog(e);
    if(e.key==="Escape"){
      const dlg=visibleDialog();if(!dlg)return;
      if(dlg.id==="modal")closeModal(false);
      else{dlg.classList.add("hidden");$("searchBtn")?.focus?.()}
    }
  })
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

export {};
