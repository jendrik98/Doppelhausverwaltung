// @ts-nocheck -- Phase 8: semantikerhaltende Modul-Extraktion; Browser-E2E ist das Verhaltensgate.
/* ===== V18 billing assistant preview ===== */
export const V18_ASSISTANT_VERSION=1;
export const V18_EXPECTED_BILLING_CATEGORIES=[
  {category:"propertyTax",label:"Grundsteuer",route:"data",sub:"positions"},
  {category:"rainwater",label:"Niederschlagswasser",route:"data",sub:"positions"},
  {category:"street",label:"Straßenreinigung / Winterdienst",route:"data",sub:"positions"},
  {category:"waste",label:"Abfall",route:"data",sub:"positions"},
  {category:"insurance",label:"Gebäudeversicherung",route:"data",sub:"positions"},
  {category:"water",label:"Kaltwasser / Kanal",route:"rental",sub:"water"}
];

export function v18CategoryForecast(s,year,def){
  const cp=billingPeriodInfo(s,year),current=periodCategoryTotals(s,year).find(x=>x.category===def.category),water=def.category==="water"?settlementConsumption(s,settlementByPeriod(s,year)):null;
  if(current?.total>0){
    if(def.category==="water"&&!water?.valid)return {...def,status:"open",amount:0,knownTotal:Number(current.total||0),detail:"Kosten sind vorhanden, aber vollständige Verbrauchsdaten fehlen."};
    return {...def,status:"known",amount:Number(current.tenant||0),knownTotal:Number(current.total||0),detail:"Bestätigte Daten dieser Abrechnungsperiode."}
  }
  const prior=periodCategoryTotals(s,year-1).find(x=>x.category===def.category),pp=billingPeriodInfo(s,year-1);
  if(prior?.total>0&&pp.active&&pp.days>0){
    const currentFull=cp.active&&!cp.isTakeoverPeriod&&cp.days===cp.nominalDays;
    const priorFull=pp.active&&!pp.isTakeoverPeriod&&pp.days===pp.nominalDays;
    const scale=currentFull&&priorFull?1:(cp.days>0?cp.days/pp.days:1);
    const amount=Number(prior.tenant||0)*scale;
    const detail=currentFull&&priorFull
      ?`Aus ${billingPeriodLabel(s,year-1)} als Jahresvergleich übernommen.`
      :`Aus ${billingPeriodLabel(s,year-1)} zeitanteilig auf die aktuelle Teilperiode hochgerechnet.`;
    return {...def,status:"estimated",amount,knownTotal:0,detail}
  }
  return {...def,status:"open",amount:0,knownTotal:0,detail:"Noch kein aktueller oder ausreichend vergleichbarer historischer Wert vorhanden."}
}
export function v18BackupStatus(s){
  const at=s.meta?.lastBackupAt||"",age=at?Math.max(0,calendarDayDiff(String(at).slice(0,10),smartToday())):null;
  if(age==null)return {status:"open",label:"Noch kein Backup",detail:"Noch keine verschlüsselte Vollsicherung dokumentiert.",age:null,route:"more",sub:"backup"};
  if(age>30)return {status:"open",label:"Backup überfällig",detail:`Letzte verschlüsselte Sicherung vor ${age} Tagen.`,age,route:"more",sub:"backup"};
  return {status:"known",label:"Backup aktuell",detail:`Letzte verschlüsselte Sicherung vor ${age} Tagen.`,age,route:"more",sub:"backup"}
}
export function v18StatusWeight(status){return status==="known"?1:status==="estimated"?.5:0}
export function v18StatusLabel(status){return status==="known"?"Bekannt":status==="estimated"?"Geschätzt":"Offen"}
export function v18StatusClass(status){return status==="known"?"good":status==="estimated"?"warn":"bad"}
export function v18BillingAssistant(s,year=preferredBillingYear()){
  const period=billingPeriodInfo(s,year),analysis=billingAnalysis(s,year),lease=analysis.lease||s.leases?.[0]||null,owner=unitByType(s,"owner"),rental=unitByType(s,"rental"),rows=V18_EXPECTED_BILLING_CATEGORIES.map(d=>v18CategoryForecast(s,year,d));
  const leaseItem={id:"lease",label:"Mietvertrag",status:lease?"known":"open",detail:lease?`${euro(lease.rent)} Kaltmiete · ${euro(lease.advance)} BK-Vorauszahlung`:"Mietvertrag fehlt.",route:"rental",sub:"overview"};
  const areaOK=Number(s.property?.totalArea||0)>0&&Number(rental?.area||0)>0&&Number(owner?.area||0)>0;
  const areaItem={id:"area",label:"Wohnflächen",status:areaOK?"known":"open",detail:areaOK?`${rental.area} m² Mietwohnung von ${s.property.totalArea} m² gesamt`:"Wohnflächen sind noch nicht vollständig.",route:"data",sub:"object"};
  const correspondenceOK=!!String(s.correspondence?.landlordName||"").trim()&&!!String(s.correspondence?.landlordAddress||s.property?.address||"").trim();
  const correspondenceItem={id:"correspondence",label:"Absenderdaten",status:correspondenceOK?"known":"open",detail:correspondenceOK?"Für die spätere PDF vorhanden.":"Absenderdaten für die Endabrechnung ergänzen.",route:"data",sub:"object"};
  const evidence=lease?actualAdvanceEvidenceInPeriod(s,lease,year):{amount:0,recognizedPayments:0},scheduled=lease?monthlyAdvanceInPeriod(s,lease,year):0,periodEnded=!!period.end&&smartToday()>period.end;
  const advanceStatus=Number(evidence.recognizedPayments||0)>0?"known":lease&&Number(lease.advance||0)>0&&!periodEnded?"estimated":"open";
  const advanceItem={id:"advances",label:"Vorauszahlungen",status:advanceStatus,detail:advanceStatus==="known"?`${evidence.recognizedPayments} Zahlung(en) erkannt · bisher ${euro(evidence.amount)}`:advanceStatus==="estimated"?`Vertraglich geplant: ${euro(scheduled)}`:"Keine belastbare Vorauszahlungsbasis.",route:"owner",sub:"cashflow"};
  const checklist=[leaseItem,areaItem,correspondenceItem,...rows,advanceItem],score=Math.round(100*checklist.reduce((sum,x)=>sum+v18StatusWeight(x.status),0)/Math.max(1,checklist.length));
  const estimatedTenant=rows.filter(x=>x.status==="estimated").reduce((sum,x)=>sum+Number(x.amount||0),0),knownTenant=Number(analysis.tenantCosts||0),projectedTenantCosts=knownTenant+estimatedTenant;
  const projectedAdvances=periodEnded?Number(analysis.advances||0):Math.max(Number(analysis.advances||0),Number(scheduled||0)),projectedResult=projectedTenantCosts-projectedAdvances;
  const openItems=checklist.filter(x=>x.status==="open"),estimatedItems=checklist.filter(x=>x.status==="estimated"),knownItems=checklist.filter(x=>x.status==="known"),backup=v18BackupStatus(s);
  let confidence=Math.round(100*(knownItems.length+.55*estimatedItems.length)/Math.max(1,checklist.length));
  if(openItems.length)confidence-=Math.min(20,openItems.length*3);
  confidence=Math.max(20,Math.min(96,confidence));
  const label=score>=90?"Fast fertig":score>=75?"Gut vorbereitet":score>=50?"Im Aufbau":"Noch unvollständig";
  return {year,period,analysis,rows,checklist,score,label,confidence,knownTenant,estimatedTenant,projectedTenantCosts,actualAdvances:Number(analysis.advances||0),scheduledAdvances:Number(scheduled||0),projectedAdvances,projectedResult,openItems,estimatedItems,knownItems,backup,periodEnded}
}
export function v18BillingAssistantHTML(s,year,{compact=false}={}){
  const m=v18BillingAssistant(s,year),cb=confidenceBand(m.confidence),resultLabel=m.projectedResult>=0?"voraussichtliche Nachzahlung":"voraussichtliches Guthaben",problem=m.openItems.length+m.estimatedItems.length;
  if(compact){
    const next=[...m.openItems,...m.estimatedItems].slice(0,3);
    return `<section id="v18BillingAssistant" class="card"><div class="card-head"><div><p class="eyebrow">ABRECHNUNGSASSISTENT</p><h3>${m.score}% vorbereitet · ${esc(m.label)}</h3><p class="muted">${esc(billingPeriodLabel(s,year))}</p></div><span class="confidence confidence-${cb.id}">${esc(cb.short)}</span></div>
      <div class="storage-meter" aria-label="Vorbereitungsgrad"><span style="width:${m.score}%"></span></div>
      <div class="grid cards"><article class="card metric-card"><span>Bekannte Kosten</span><strong>${euro(m.knownTenant)}</strong></article><article class="card metric-card"><span>Geschätzt</span><strong>${euro(m.estimatedTenant)}</strong></article><article class="card metric-card"><span>Prognose</span><strong>${euro(Math.abs(m.projectedResult))}</strong><small>${resultLabel}</small></article></div>
      ${next.length?`<div class="card"><strong>${problem} Punkt(e) noch nicht endgültig</strong>${next.map(x=>`<div class="fact-row"><span>${esc(x.label)}</span><strong>${v18StatusLabel(x.status)}</strong></div>`).join("")}</div>`:`<div class="legal-ok">✓ Alle für die Prognose erwarteten Daten sind vorhanden.</div>`}
      <div class="${m.backup.status==="known"?"legal-ok":"legal-warn"}"><strong>${esc(m.backup.label)}</strong><br>${esc(m.backup.detail)}</div>
      <button class="primary wide" data-v18-go="rental|billing">Abrechnung vorbereiten</button></section>`
  }
  return `<section id="v18BillingAssistantFull" class="card"><div class="card-head"><div><p class="eyebrow">ABRECHNUNGSASSISTENT</p><h3>${m.score}% vorbereitet · ${esc(m.label)}</h3><p class="muted">Planungsansicht für ${esc(billingPeriodLabel(s,year))}. Schätzwerte werden niemals automatisch in die endgültige Abrechnung übernommen.</p></div><span class="confidence confidence-${cb.id}">${esc(cb.label)} · ${m.confidence}%</span></div>
    <div class="storage-meter" aria-label="Vorbereitungsgrad"><span style="width:${m.score}%"></span></div>
    <div class="grid cards">
      <article class="card metric-card"><span>Bekannte Kosten</span><strong>${euro(m.knownTenant)}</strong><small>abrechnungswirksam</small></article>
      <article class="card metric-card"><span>Geschätzte Ergänzung</span><strong>${euro(m.estimatedTenant)}</strong><small>nur Prognose</small></article>
      <article class="card metric-card"><span>Geplante Vorauszahlungen</span><strong>${euro(m.projectedAdvances)}</strong><small>bisher tatsächlich ${euro(m.actualAdvances)}</small></article>
      <article class="card metric-card"><span>Prognose</span><strong>${euro(Math.abs(m.projectedResult))}</strong><small>${resultLabel}</small></article>
    </div>
    <div class="tablewrap"><table class="costtable"><thead><tr><th>Baustein</th><th>Status</th><th>Prognoseanteil</th><th>Nächster Schritt</th></tr></thead><tbody>
      ${m.checklist.map(x=>`<tr ${x.category?`data-v18-category="${x.category}"`:""}><td><strong>${esc(x.label)}</strong><br><small>${esc(x.detail||"")}</small></td><td><span class="pill ${v18StatusClass(x.status)}">${v18StatusLabel(x.status)}</span></td><td>${x.category&&x.status!=="open"?euro(x.amount):"–"}</td><td>${x.status==="known"?"✓":`<button class="secondary compact" data-v18-go="${x.route}|${x.sub}">${x.status==="estimated"?"Aktualisieren":"Erfassen"}</button>`}</td></tr>`).join("")}
    </tbody></table></div>
    <div class="${m.backup.status==="known"?"legal-ok":"legal-warn"}"><strong>${esc(m.backup.label)}</strong><br>${esc(m.backup.detail)} ${m.backup.status!=="known"?`<button class="linkbutton" data-v18-go="more|backup">Sicherung öffnen</button>`:""}</div>
    <div class="info"><strong>Trennung von Prognose und Abrechnung:</strong> Nur bestätigte Kosten, echte Zählerdaten und tatsächlich geleistete Vorauszahlungen fließen in Abschluss, Snapshot und PDF ein. Gelbe Schätzwerte dienen ausschließlich der Planung.</div>
  </section>`
}
export function bindV18AssistantActions(root=document){
  root.querySelectorAll("[data-v18-go]").forEach(b=>b.onclick=()=>{const [r,s]=String(b.dataset.v18Go||"").split("|");if(r)go(r,s||DEFAULT_SUB[r])})
}

export function advanceAdjustmentSuggestion(state){
  const snap=latestBillingSnapshot(state),lease=state.leases?.[0];if(!snap||!lease||Number(lease.advance||0)<=0)return null;
  const basisLease=snap.lease||lease,months=monthlyAdvanceInPeriod(state,{...basisLease,advance:1},Number(snap.periodYear));
  if(months<=0)return null;
  const recommended=Number(snap.tenantCosts||0)/months,current=Number(lease.advance||0),diff=recommended-current;
  return {periodYear:snap.periodYear,current,recommended,diff,relative:current?diff/current:0,material:Math.abs(diff)>=5&&Math.abs(diff/current)>=.05,basis:"Rechnerischer Richtwert aus der letzten abgeschlossenen Abrechnung; eine Anpassung nach einer Abrechnung ist nach § 560 Abs. 4 BGB grundsätzlich möglich, die angemessene Höhe ist im Einzelfall zu prüfen."}
}
export function billingDeadlineInsights(state){
  const out=[],today=smartToday(),cy=currentPeriodYear(),lease=state.leases?.[0];
  for(let y=cy-4;y<=cy;y++){
    const p=billingPeriodInfo(state,y);if(!lease||!p.active||snapshotFor(state,y)||p.end>=today)continue;
    const leaseStart=lease.start||p.start,leaseEnd=lease.end||p.end;
    if(leaseStart>p.end||leaseEnd<p.start)continue;
    const target=periodBillingTargetISO(y),legal=periodDeadlineISO(y),targetDays=calendarDayDiff(today,target),legalDays=calendarDayDiff(today,legal);
    if(targetDays>=0&&targetDays<=120){
      out.push({id:`target-${y}`,severity:targetDays<=30?"warn":"info",title:`Endabrechnung ${billingPeriodLabel(state,y)} vorbereiten`,detail:`Eigene Zielfrist: ${new Date(target+"T00:00:00").toLocaleDateString("de-DE")} · noch ${targetDays} Tage.`,why:"Eigene Arbeitszielfrist",confidence:100,route:"rental",sub:"billing"})
    }else if(targetDays<0&&legalDays>=0){
      out.push({id:`target-${y}`,severity:"warn",title:`Eigene Zielfrist für ${billingPeriodLabel(state,y)} überschritten`,detail:`Die Endabrechnung sollte bis ${new Date(target+"T00:00:00").toLocaleDateString("de-DE")} fertig sein. Die gesetzliche Abrechnungsfrist läuft bis ${new Date(legal+"T00:00:00").toLocaleDateString("de-DE")}.`,why:"Interne Zielfrist; gesetzliche Frist separat",confidence:100,route:"rental",sub:"billing"})
    }else if(legalDays<0){
      out.push({id:`deadline-${y}`,severity:"bad",title:`Gesetzliche Abrechnungsfrist ${billingPeriodLabel(state,y)} überschritten`,detail:`Die reguläre Frist endete am ${new Date(legal+"T00:00:00").toLocaleDateString("de-DE")}.`,why:"§ 556 Abs. 3 BGB",confidence:100,route:"rental",sub:"billing"})
    }
  }
  return out
}
export function sourceExpectedAmounts(state,source){
  const vals=[];
  if(Number(source?.amount||0)>0)vals.push(Number(source.amount));
  const ps=sourcePositions(state,source?.id).filter(p=>p.confirmed),sum=ps.reduce((s,p)=>s+Number(p.amount||0),0);
  if(sum>0)vals.push(sum);
  return [...new Set(vals.map(x=>Number(x.toFixed(2))))]
}
export function sourcePaymentMatchScore(state,payment,source){
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
export function smartPaymentSuggestions(state,payment,limit=5){
  const pos=paymentMatchSuggestions(state,payment,limit).map(x=>({type:"position",target:x.position,score:x.score,reasons:x.reasons}));
  const src=(state.sources||[]).map(s=>({type:"source",target:s,...sourcePaymentMatchScore(state,payment,s)})).filter(x=>x.score>=35);
  return [...pos,...src].sort((a,b)=>b.score-a.score).slice(0,limit)
}
export function smartPaymentPlan(state){
  const candidates=(state.payments||[]).filter(p=>p.direction==="outflow"&&!p.positionId&&!p.sourceId).map(payment=>({payment,suggestions:smartPaymentSuggestions(state,payment,4)})).filter(x=>x.suggestions.length);
  candidates.sort((a,b)=>(b.suggestions[0]?.score||0)-(a.suggestions[0]?.score||0));
  const reservedPositions=new Set(),out=[];
  for(const x of candidates){
    const suggestions=x.suggestions.filter(s=>s.type!=="position"||!reservedPositions.has(s.target.id));
    const best=suggestions[0];if(!best||best.score<45)continue;
    if(best.type==="position")reservedPositions.add(best.target.id);
    out.push({...x,suggestions})
  }
  return out
}

export function medianValue(values){const a=values.filter(Number.isFinite).slice().sort((x,y)=>x-y);if(!a.length)return 0;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
export function robustMeterAnomalies(meter){
  const t=meterTrend(meter),segs=t.segments;if(segs.length<3)return meterAnomalies(meter);
  const hist=segs.slice(0,-1).map(x=>x.perDay),med=medianValue(hist),dev=medianValue(hist.map(x=>Math.abs(x-med))),last=segs.at(-1),out=[];
  const threshold=med+Math.max(med*.65,dev*4);
  if(med>0&&last.perDay>threshold&&last.delta>1)out.push({severity:"warn",text:`${meter.name}: der jüngste Verbrauch liegt deutlich über dem robusten bisherigen Niveau (${last.per30.toFixed(2)} statt etwa ${(med*30).toFixed(2)} ${meter.unit||""} je 30 Tage).`,confidence:Math.min(99,Math.round(70+(last.perDay/Math.max(threshold,.0001)-1)*20))});
  return out
}
export function smartDataAnomalies(state){
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

export function historicalAssignmentPrediction(state,label,categoryId){
  const nl=normalizeLabelText(label),candidates=(state.costPositions||[]).filter(p=>p.confirmed&&p.assignment!=="review"&&(p.category===categoryId||tokenSimilarity(p.label,label)>.65));
  if(!candidates.length)return null;
  const counts={};for(const p of candidates)counts[p.assignment]=(counts[p.assignment]||0)+1;
  const [assignment,count]=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
  return {assignment,confidence:Math.round(100*count/candidates.length),samples:candidates.length}
}
export function smartClassifyCostText(text){
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
export function cleanProposalLabel(line,categoryId){
  let x=String(line||"").replace(/\b\d{1,6}(?:\.\d{3})*,\d{2}\s*€?/g,"").replace(/\s{2,}/g," ").replace(/[·;:,\-–]+$/,"").trim();
  if(x.length<4||x.length>80)x=category(categoryId).label;return x
}
export function smartGenericPositionProposals(state,text,fields){
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
export function enrichDocumentProposalsSmart(state,text,fields,base){
  const out=(base||[]).slice(),generic=smartGenericPositionProposals(state,text,fields);
  for(const p of generic){
    const duplicate=out.some(x=>tokenSimilarity(x.label,p.label)>.78&&Math.abs(Number(x.amount)-Number(p.amount))<.02);
    if(!duplicate)out.push(p)
  }
  return out.slice(0,30)
}
export function smartDocumentSummary(state,text,fields){
  const cls=smartClassifyCostText(text),issuer=fields.intelligence?.issuer||"",sourceMatches=(state.sources||[]).map(s=>({source:s,score:tokenSimilarity(issuer,s.name||"")})).filter(x=>x.score>.32).sort((a,b)=>b.score-a.score);
  const warnings=[];
  if(["repair","admin"].includes(cls.category))warnings.push(`Die Dokumentanalyse erkennt wahrscheinlich ${category(cls.category).label}. Diese Kostenart wird nicht automatisch auf die Mieterin umgelegt.`);
  if((fields.positionProposals||[]).some(p=>p.assignment==="review"))warnings.push("Mindestens eine Kostenposition benötigt eine ausdrückliche Zuordnungsentscheidung.");
  return {category:cls.category,categoryConfidence:Math.round(cls.confidence*100),reason:cls.reason,sourceId:sourceMatches[0]?.source.id||"",sourceName:sourceMatches[0]?.source.name||"",sourceConfidence:sourceMatches[0]?Math.round(sourceMatches[0].score*100):0,warnings}
}

export function smartTaskSuggestions(state){
  const out=[],today=smartToday(),existing=new Set(taskList().map(t=>`${normalizeLabelText(t.title)}|${t.due}`));
  for(const s of state.sources||[])for(const d of s.dueDates||[]){
    if(d<today)continue;const title=`${s.name} – Fälligkeit`;const k=`${normalizeLabelText(title)}|${d}`;if(!existing.has(k))out.push({title,due:d,lead:14,reason:"Fälligkeit aus Kostenquelle"})
  }
  for(const m of state.meters||[]){
    const last=latestMeterReading(m),age=last?Math.max(0,calendarDayDiff(last.date,smartToday())):999;
    if(age>90){const due=new Date();due.setDate(due.getDate()+7);const title=`${m.name} ablesen`;const ds=localDateISO(due),k=`${normalizeLabelText(title)}|${ds}`;if(!existing.has(k))out.push({title,due:ds,lead:2,reason:last?`Letzte Ablesung vor ${age} Tagen`:"Noch keine Ablesung"})}
  }
  const backupAge=state.meta?.lastBackupAt?Math.max(0,calendarDayDiff(String(state.meta.lastBackupAt).slice(0,10),smartToday())):999;
  if(backupAge>30){const due=new Date();due.setDate(due.getDate()+3);out.push({title:"Verschlüsselte Datensicherung erstellen",due:localDateISO(due),lead:1,reason:"Datensicherung ist nicht aktuell"})}
  return out.slice(0,12)
}
export function smartInsights(state){
  const out=[],today=smartToday(),rent=rentMonthStatus(state),proj=billingProjection(state),paymentPlan=smartPaymentPlan(state),todayDay=Number(today.slice(8,10)),rentAttention=rentAttentionDay(state);
  for(const c of billingReadiness(state,currentPeriodYear()).filter(x=>!x.ok))out.push({id:`ready-${c.id}`,severity:"warn",title:c.label,detail:"Die Abrechnung ist an dieser Stelle noch nicht vollständig.",why:"Abschlussprüfung",confidence:100,route:c.route,sub:c.sub});
  if(rent.status==="missing"&&Number(rent.expected)>0&&todayDay>=rentAttention){const late=todayDay-rentAttention;out.push({id:`rent-${rent.key}`,severity:late>=7?"bad":"warn",title:`Mietzahlung ${rent.key} noch nicht erkannt`,detail:`Erwartet ${euro(rent.expected)}. In den erfassten Kontobewegungen wurde noch keine passende Zahlung gefunden.`,why:"Abgleich Mietvertrag ↔ Zahlungseingänge; Zeitpunkt orientiert sich – wenn vorhanden – an bisherigen Zahlungseingängen. Keine automatische Mahnaussage.",confidence:78,route:"owner",sub:"cashflow"})}
  if(rent.status==="partial")out.push({id:`rent-${rent.key}`,severity:"warn",title:`Mietzahlung ${rent.key} nur teilweise erkannt`,detail:`Erkannt ${euro(rent.paid)} von ${euro(rent.expected)}.`,why:"Zahlungseingangsabgleich",confidence:rent.confidence||65,route:"owner",sub:"cashflow"});
  if(paymentPlan.length)out.push({id:"payment-match",severity:"warn",title:`${paymentPlan.length} Zahlung(en) mit plausiblem Zuordnungsvorschlag`,detail:`Bester aktueller Treffer: ${paymentPlan[0].suggestions[0].score} %.`,why:"Betrag, Text, Quelle und Fälligkeit",confidence:paymentPlan[0].suggestions[0].score,route:"owner",sub:"reconciliation"});
  const docs=(state.documentsCache||[]),reviewDocs=docs.filter(d=>documentWorkflowState(d)==="review").length,newDocs=docs.filter(d=>documentWorkflowState(d)==="new").length;
  if(reviewDocs||newDocs)out.push({id:"docs-review",severity:"warn",title:`${reviewDocs+newDocs} Dokument(e) warten auf Prüfung`,detail:`${newDocs} neu · ${reviewDocs} mit Prüfschritt.`,why:"Dokumenten-Inbox",confidence:100,route:"data",sub:"documents"});
  for(const d of billingDeadlineInsights(state))out.push(d);
  for(const a of smartDataAnomalies(state))out.push(a);
  const adv=advanceAdjustmentSuggestion(state);if(adv?.material)out.push({id:"advance",severity:"info",title:"Betriebskostenvorauszahlung prüfen",detail:`Aktuell ${euro(adv.current)} / Monat · rechnerischer Richtwert aus letzter Abrechnung ${euro(adv.recommended)} / Monat.`,why:"§ 560 Abs. 4 BGB; nur rechnerischer Vorschlag",confidence:80,route:"rental",sub:"calculation"});
  if(proj.missingCategories.length&&proj.confidence>=55)out.push({id:"projection",severity:"info",title:"Abrechnungsprognose nutzt Vorjahreswerte",detail:`Für ${proj.missingCategories.map(x=>categoryLabel(x.category)).join(", ")} fehlen noch aktuelle Werte. Prognose: ${euro(Math.abs(proj.projectedResult))} ${proj.projectedResult>=0?"Nachzahlung":"Guthaben"}.`,why:"Bekannte Kosten + fehlende Vorjahreskategorien",confidence:proj.confidence,route:"rental",sub:"calculation"});
  const age=state.meta?.lastBackupAt?Math.max(0,calendarDayDiff(String(state.meta.lastBackupAt).slice(0,10),smartToday())):9999;if(age>30)out.push({id:"backup",severity:"warn",title:state.meta?.lastBackupAt?"Datensicherung älter als 30 Tage":"Noch keine verschlüsselte Datensicherung",detail:"Eine aktuelle Vollsicherung schützt Daten und Dokumente bei Geräteverlust.",why:"Datensicherheit",confidence:100,route:"more",sub:"backup"});
  const rank={bad:0,warn:1,info:2,good:3};return out.sort((a,b)=>(rank[a.severity]??9)-(rank[b.severity]??9)||Number(b.confidence||0)-Number(a.confidence||0))
}

export const DECISION_UI_VERSION=1;
export function confidenceBand(score){const n=Math.max(0,Math.min(100,Number(score||0)));if(n>=90)return{id:"high",label:"Sehr sicher",short:"Sicher"};if(n>=75)return{id:"good",label:"Gut begründet",short:"Plausibel"};if(n>=55)return{id:"medium",label:"Mit Vorbehalt",short:"Prüfen"};return{id:"low",label:"Unsicher",short:"Unsicher"}}
export function qualityBand(score){const n=Number(score||0);if(n>=90)return{id:"high",label:"Sehr gut"};if(n>=75)return{id:"good",label:"Gut"};if(n>=55)return{id:"medium",label:"Prüfen"};return{id:"low",label:"Unvollständig"}}
export function decisionSeverityWeight(s){return s==="bad"?400:s==="warn"?260:s==="info"?100:0}
export function decisionActionLabel(x){if(x.route==="rental"&&x.sub==="calculation")return"Abrechnung prüfen";if(x.route==="rental"&&x.sub==="water")return"Wasser prüfen";if(x.route==="owner"&&x.sub==="cashflow")return"Zahlungen öffnen";if(x.route==="owner"&&x.sub==="reconciliation")return"Zuordnung prüfen";if(x.route==="data"&&x.sub==="documents")return"Dokumente prüfen";if(x.route==="data"&&x.sub==="positions")return"Kosten prüfen";if(x.route==="more"&&x.sub==="backup")return"Sicherung öffnen";return"Öffnen"}
export function decisionKind(x){if((x.why||"").includes("§"))return"Regel";if(/Prognose|Richtwert|Analyse|Abgleich|Plausibil/i.test(x.why||""))return"Auswertung";return Number(x.confidence||0)>=95?"Fakt":"Hinweis"}
export function smartDecisionQueue(s){const raw=smartInsights(s),seen=new Set(),out=[];for(const x of raw){const key=`${normalizeLabelText(x.title)}|${x.route}|${x.sub||""}`;if(seen.has(key))continue;seen.add(key);const confidence=Math.max(0,Math.min(100,Number(x.confidence||0))),band=confidenceBand(confidence),blocker=x.severity==="bad"||/fehlt|offen|ungeklärt|abschließen|nicht erkannt/i.test(`${x.title} ${x.detail||""}`),actionability=x.route&&x.route!=="home"?60:0;if(x.severity==="info"&&confidence<55&&!blocker)continue;out.push({...x,confidence,band,blocker,kind:decisionKind(x),actionLabel:decisionActionLabel(x),decisionScore:decisionSeverityWeight(x.severity)+confidence+actionability+(blocker?50:0)})}return out.sort((a,b)=>b.decisionScore-a.decisionScore)}
export function decisionWhyHTML(x){return `<details class="decision-details"><summary>Warum zeigt mir die App das?</summary><div><p>${esc(x.why||"Auswertung der vorhandenen Daten")}</p><p><strong>Einordnung:</strong> ${esc(x.kind)} · ${esc(x.band.label)}${x.confidence?` (${Math.round(x.confidence)} %)`:""}</p>${x.severity==="info"?`<p class="muted">Dieser Hinweis ist nicht dringend. Er soll eine Entscheidung vorbereiten, nicht automatisch ausführen.</p>`:""}</div></details>`}
export function rentAttentionDay(s){const days=(s.payments||[]).filter(p=>p.direction==="income"&&detectRentPayment(s,p)?.score>=70&&p.date).map(p=>Number(p.date.slice(8,10))).filter(n=>n>=1&&n<=28).sort((a,b)=>a-b);if(days.length>=2){const mid=days[Math.floor(days.length/2)];return Math.max(6,Math.min(14,mid+3))}return 10}

export function smartSummaryText(state){
  const ins=smartInsights(state),rent=rentMonthStatus(state),p=billingProjection(state),q=dataQualityScore(state);
  return `Datenqualität ${q} %. ${ins.length?`${ins.filter(x=>x.severity==="bad").length} dringende und ${ins.filter(x=>x.severity==="warn").length} wichtige Hinweise.`:"Keine offenen Smart-Hinweise."} Mietzahlung aktuell: ${rentStatusLabel(rent)}. Abrechnungsprognose: ${euro(Math.abs(p.projectedResult))} ${p.projectedResult>=0?"Nachzahlung":"Guthaben"} bei ${p.confidence} % Modellkonfidenz.`
}
export function smartAnswer(state,query){
  const q=normalizeLabelText(query),y=currentPeriodYear(),rent=rentMonthStatus(state),proj=billingProjection(state),ins=smartInsights(state);
  if(/miete|mietzahlung|zahlungseingang/.test(q))return {title:"Mietzahlung",answer:rent.status==="none"?"Für den aktuellen Monat ist kein aktiver Mietvertrag hinterlegt.":`Für ${rent.key} sind ${euro(rent.paid)} von ${euro(rent.expected)} als passende Mietzahlung erkannt. Status: ${rentStatusLabel(rent)}. Erkennungs-Sicherheit ${rent.confidence||0} %.`,route:"owner",sub:"cashflow"};
  if(/abrechnung|nachzahlung|guthaben|nebenkosten/.test(q))return {title:"Abrechnung",answer:`Aktuell bestätigte Mieter-Kosten: ${euro(proj.knownTenantCosts)}. Vorauszahlungen im Zeitraum: ${euro(proj.advances)}. Prognose: ${euro(Math.abs(proj.projectedResult))} ${proj.projectedResult>=0?"Nachzahlung":"Guthaben"} (${proj.confidence} % Modellkonfidenz).${proj.missingCategories.length?` Noch geschätzt aus dem Vorjahr: ${proj.missingCategories.map(x=>categoryLabel(x.category)).join(", ")}.`:""}`,route:"rental",sub:"calculation"};
  if(/wasser|zahler|zaehler|verbrauch/.test(q)){const {main,owner}=ensureDefaultMeters(state),tm=meterTrend(main),to=meterTrend(owner),sett=settlementConsumption(state,settlementByPeriod(state,y));return {title:"Wasser",answer:sett?.valid?`Abrechnungsperiode: Haus ${sett.house.toFixed(3)} m³, Eigennutzung ${sett.owner.toFixed(3)} m³, Mietwohnung ${sett.tenant.toFixed(3)} m³. Jüngerer Trend: Hauptzähler Ø ${tm.avgPer30.toFixed(2)} m³ / 30 Tage, Zwischenzähler Ø ${to.avgPer30.toFixed(2)} m³ / 30 Tage.`:"Für die aktuelle Abrechnungsperiode fehlen noch vollständige Verbrauchsdaten.",route:"rental",sub:"water"}}
  if(/kosten|steiger|teuer|entwicklung/.test(q)){const al=costTrendAlerts(state,y);return {title:"Kostenentwicklung",answer:al.length?al.map(x=>x.text).join(" "):"Es gibt derzeit keine belastbare Kostenveränderung ab 15 % gegenüber der Vorperiode.",route:"owner",sub:"analytics"}}
  if(/zahlung|zuord|bezahlt|rechnung/.test(q)){const p=smartPaymentPlan(state);return {title:"Zahlungszuordnung",answer:p.length?`${p.length} offene Ausgabe(n) haben plausible Treffer. Der beste Treffer liegt bei ${p[0].suggestions[0].score} % und bezieht sich auf „${p[0].suggestions[0].target.label||p[0].suggestions[0].target.name}“.`:"Aktuell gibt es keine unzugeordnete Ausgabe mit einem ausreichend starken Treffer.",route:"owner",sub:"reconciliation"}}
  if(/dokument|beleg|bescheid|post/.test(q)){const d=state.documentsCache||[],n=d.filter(x=>documentWorkflowState(x)==="new").length,r=d.filter(x=>documentWorkflowState(x)==="review").length;return {title:"Dokumente",answer:`Dokumenten-Inbox: ${n} neu, ${r} zu prüfen, ${d.filter(x=>documentWorkflowState(x)==="done").length} erledigt.`,route:"data",sub:"documents"}}
  if(/backup|sicherung/.test(q)){const age=state.meta?.lastBackupAt?Math.max(0,calendarDayDiff(String(state.meta.lastBackupAt).slice(0,10),smartToday())):null;return {title:"Datensicherung",answer:age==null?"Es ist noch keine verschlüsselte Vollsicherung dokumentiert.":`Die letzte verschlüsselte Vollsicherung ist ${age} Tag(e) alt.`,route:"more",sub:"backup"}}
  if(/frist|recht|rechtsstand/.test(q)){const dl=billingDeadlineInsights(state);return {title:"Fristen & Rechtsstand",answer:`Hinterlegter Rechtsstand: ${ACTIVE_LEGAL_PACK?.effectiveDate||LAW_DATE}. ${dl.length?dl.map(x=>x.detail).join(" "):"Aktuell erkennt die App keine unmittelbar bevorstehende offene Abrechnungsfrist."}`,route:"more",sub:"legal"}}
  if(/was fehlt.*abrechnung|abrechnung.*fehlt|abrechnung.*vorberei/.test(q)){const v=v18BillingAssistant(state,preferredBillingYear()),parts=[...v.openItems,...v.estimatedItems].slice(0,5).map(x=>`${x.label} (${v18StatusLabel(x.status)})`);return {title:"Abrechnung vorbereiten",answer:`${v.score} % vorbereitet. ${parts.length?`Noch zu klären: ${parts.join(", ")}.`:"Alle erwarteten Datenbausteine sind vorhanden."} Prognose: ${euro(Math.abs(v.projectedResult))} ${v.projectedResult>=0?"Nachzahlung":"Guthaben"}.`,route:"rental",sub:"billing"}}
  if(/vorauszahlung|abschlag/.test(q)){const a=advanceAdjustmentSuggestion(state);return {title:"Betriebskostenvorauszahlung",answer:a?`${a.basis} Aktuell ${euro(a.current)}, rechnerischer Richtwert ${euro(a.recommended)} pro Monat.`:"Für einen belastbaren rechnerischen Vorschlag wird zunächst eine abgeschlossene Abrechnung benötigt.",route:"rental",sub:"calculation"}}
  return {title:"Gesamtstatus",answer:smartSummaryText(state),route:ins[0]?.route||"home",sub:ins[0]?.sub||""}
}

