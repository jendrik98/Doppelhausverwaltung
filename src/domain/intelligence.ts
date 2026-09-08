// @ts-nocheck -- Phase 8: semantikerhaltende Modul-Extraktion; Browser-E2E ist das Verhaltensgate.
/* ===== intelligence.js ===== */
export const INTELLIGENCE_VERSION=1;

export function normalizeLabelText(v){
  return String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim()
}
export function tokenSimilarity(a,b){
  const A=new Set(normalizeLabelText(a).split(/\s+/).filter(Boolean)),B=new Set(normalizeLabelText(b).split(/\s+/).filter(Boolean));
  if(!A.size||!B.size)return 0;
  let hit=0;for(const x of A)if(B.has(x))hit++;
  return hit/Math.max(A.size,B.size)
}
export function daysDistance(a,b){
  if(!a||!b)return 9999;
  const d=calendarDayDiff(a,b);return Number.isFinite(d)?Math.abs(d):9999
}
export function dueDatesForPosition(state,p){
  const s=(state.sources||[]).find(x=>x.id===p.sourceId);
  return Array.isArray(s?.dueDates)?s.dueDates:[]
}
export function paymentMatchScore(state,payment,position){
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
export function paymentMatchSuggestions(state,payment,limit=5){
  return (state.costPositions||[]).filter(p=>p.confirmed).map(p=>({position:p,...paymentMatchScore(state,payment,p)}))
    .filter(x=>x.score>=25).sort((a,b)=>b.score-a.score).slice(0,limit)
}


export function positionMonthlyEquivalent(p,monthStart,monthEnd){
  const start=p.serviceStart||monthStart,end=p.serviceEnd||monthEnd;
  const ov=overlapDays(start,end,monthStart,monthEnd);if(!ov)return 0;
  const factor=ov/daysInclusive(start,end),a=Number(p.amount||0);
  if(p.interval==="monthly")return a*(ov/daysInclusive(monthStart,monthEnd));
  if(p.interval==="quarterly")return a*4*factor;
  if(p.interval==="yearly")return a*factor;
  return a*factor
}
export function predictedMonth(state,date){
  const ms=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-01`,
        me=localMonthEndISO(date),
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
export function intelligentForecast(state,months=12){
  const now=new Date(),rows=[];
  for(let i=0;i<months;i++)rows.push(predictedMonth(state,new Date(now.getFullYear(),now.getMonth()+i,1)));
  return rows
}
export function forecastSignals(state){
  const rows=intelligentForecast(state,12),out=[];
  const worst=rows.slice().sort((a,b)=>a.net-b.net)[0];
  if(worst&&worst.net<0)out.push({severity:"warn",text:`Schwächster prognostizierter Monat: ${worst.label} mit ${euro(worst.net)}.`});
  const total=rows.reduce((s,r)=>s+r.net,0);out.push({severity:total>=0?"good":"warn",text:`Prognostizierter 12-Monats-Saldo: ${euro(total)}.`});
  const pending=(state.payments||[]).filter(p=>p.direction==="outflow"&&!p.positionId).length;
  if(pending)out.push({severity:"warn",text:`${pending} Ausgabe(n) warten auf automatische oder manuelle Zuordnung.`});
  return out
}

export function extractDocumentIntelligence(text,baseFields={}){
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
export function validateDocumentTotals(fields){
  const proposals=fields.positionProposals||[],sum=proposals.reduce((s,p)=>s+Number(p.amount||0),0),total=Number(fields.intelligence?.total||0),issues=[];
  if(total>0&&sum>0){
    const diff=Math.abs(total-sum);
    if(diff>.02)issues.push({severity:diff/total>.10?"warn":"info",message:`Erkannte Einzelpositionen ${euro(sum)} weichen vom erkannten Gesamtbetrag ${euro(total)} um ${euro(diff)} ab.`})
  }
  if(fields.intelligence?.propertyTaxDeferred)issues.push({severity:"info",message:"Hinweis auf verschobenen Beginn der Grundsteuer erkannt; Grundsteuer für den aktuellen Teilzeitraum nicht automatisch ergänzen."});
  if(!(fields.dueDates||[]).length&&!(fields.intelligence?.dueDates||[]).length)issues.push({severity:"info",message:"Kein eindeutiger Fälligkeitstermin erkannt."});
  return issues
}
export function documentConfidenceSummary(fields){
  const ps=fields.positionProposals||[];
  if(!ps.length)return 0;
  return ps.reduce((s,p)=>s+Number(p.confidence||0),0)/ps.length
}

export function billingRecipient(lease){
  return {name:lease?.tenantName||"",address:lease?.tenantAddress||""}
}
export function splitAddressLines(s){return String(s||"").split(/\n|,\s*(?=\d{5}\s)/).map(x=>x.trim()).filter(Boolean)}
export function formatRuleForReport(e){
  if(e.decision?.rule==="area")return `Wohnfläche (${percent(e.tenantShare)})`;
  if(e.decision?.rule==="consumption")return `Verbrauch (${percent(e.tenantShare)})`;
  if(e.decision?.rule==="rental")return "direkt Mietwohnung";
  if(e.decision?.rule==="persons")return `Personen (${percent(e.tenantShare)})`;
  return e.decision?.rule||"individuell"
}

export function formatBillingRuleDetails(e,{property={},units=[],waterConsumption=null,allocationBases=null}={}){
  const share=Number(e.tenantShare||0),fmt=(v,d=0)=>Number(v||0).toLocaleString("de-DE",{minimumFractionDigits:d,maximumFractionDigits:d});
  if(e.decision?.rule==="consumption"){
    const house=Number(waterConsumption?.house??e.details?.quantity),tenant=Number(waterConsumption?.tenant??(Number.isFinite(house)?house*share:NaN));
    if(Number.isFinite(house)&&house>0&&Number.isFinite(tenant))return `Verbrauch ${fmt(tenant,3)} m³ von ${fmt(house,3)} m³ (${percent(share)})`
  }
  if(e.decision?.rule==="area"){
    const total=Number((allocationBases?.totalArea??property?.totalArea)||0),rental=Number((allocationBases?.rentalArea??units.find(u=>u.type==="rental")?.area)||0);
    if(total>0&&rental>=0)return `Wohnfläche ${fmt(rental,0)} m² von ${fmt(total,0)} m² (${percent(share)})`
  }
  return formatRuleForReport(e)
}
export async function generateProfessionalBillingPDF(state,year,snapshot=null){
  const jsPDF=await loadJSPDF(),a=snapshot||billingAnalysis(state,year),lease=snapshot?.lease||state.leases?.[0],recipient=billingRecipient(lease),sender=snapshot?.correspondence||state.correspondence||{},property=snapshot?.property||state.property,units=snapshot?.units||state.units||[],waterConsumption=snapshot?.waterConsumption||settlementConsumption(state,settlementByPeriod(state,year)),reportCtx={property,units,waterConsumption,allocationBases:snapshot?.allocationBases||null};
  const doc=new jsPDF({unit:"mm",format:"a4"}),W=210,M=18;
  let y=18;
  const txt=(t,x,yy,size=10,style="normal")=>{doc.setFont("helvetica",style);doc.setFontSize(size);doc.text(String(t||""),x,yy)};
  const euroPdf=n=>Number(n||0).toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2})+" €";
  txt(sender.landlordName||"Vermieter",M,y,11,"bold");y+=5;
  for(const l of splitAddressLines(sender.landlordAddress||property.address||"")){txt(l,M,y,9);y+=4}
  if(sender.contact){txt(sender.contact,M,y,8);y+=4}
  y=18;txt(new Date().toLocaleDateString("de-DE"),W-M,y,9,"normal");doc.setTextColor(0); y=42;
  if(recipient.name){txt(recipient.name,M,y,10,"bold");y+=5}
  for(const l of splitAddressLines(recipient.address||property.address||"")){txt(l,M,y,10);y+=5}
  y=Math.max(y+8,68);
  txt("Betriebskostenabrechnung",M,y,16,"bold");y+=7;
  txt(`Abrechnungszeitraum: ${billingPeriodLabel(state,year)}`,M,y,10);y+=5;
  txt(`Mietobjekt: ${property.name||property.address||"Mietobjekt"}`,M,y,10);y+=9;
  doc.setDrawColor(190);doc.line(M,y,W-M,y);y+=7;
  txt("Kostenaufstellung",M,y,11,"bold");y+=6;
  txt("Kostenart",M,y,8,"bold");txt("Gesamt",112,y,8,"bold");txt("Umlage",140,y,8,"bold");txt("Ihr Anteil",W-M,y,8,"bold");y+=4;
  doc.line(M,y,W-M,y);y+=5;
  const events=a.events||[];
  for(const e of events){
    if(y>255){doc.addPage();y=18}
    const label=String(e.label||"").slice(0,48);
    txt(label,M,y,8);txt(euroPdf(e.amount),112,y,8);txt(formatBillingRuleDetails(e,reportCtx),140,y,6);doc.text(euroPdf(e.tenantAmount),W-M,y,{align:"right"});y+=5
  }
  y+=2;doc.line(M,y,W-M,y);y+=7;
  txt("Anteilige Betriebskosten",M,y,10,"bold");doc.text(euroPdf(a.tenantCosts),W-M,y,{align:"right"});y+=6;
  txt("Abzüglich geleistete Vorauszahlungen",M,y,10);doc.text("− "+euroPdf(a.advances),W-M,y,{align:"right"});y+=6;
  doc.line(112,y,W-M,y);y+=7;
  const result=Number(a.result||0),title=result>=0?"Nachzahlung":"Guthaben";
  txt(title,M,y,12,"bold");doc.text(euroPdf(Math.abs(result)),W-M,y,{align:"right"});y+=10;
  if(result>0&&sender.iban){
    txt(`Bitte überweisen Sie den Betrag auf ${sender.iban}${sender.paymentReference?` unter Angabe „${sender.paymentReference}“`:""}.`,M,y,9);y+=6
  }else if(result<0){
    txt("Das Guthaben ist in der Abrechnung ausgewiesen und kann entsprechend ausgeglichen werden.",M,y,9);y+=6
  }
  txt("Die zugrunde liegenden Kostenpositionen und Verteilungsmaßstäbe sind oben einzeln dargestellt.",M,y,8);y+=5;
  txt("Belegeinsicht wird auf Verlangen ermöglicht (§ 556 Abs. 4 BGB).",M,y,8);y+=5;
  txt("Die zugehörigen Herkunftsnachweise sind in der App dokumentiert.",M,y,8);y+=5;
  if(sender.contact){txt(`Kontakt für Rückfragen: ${sender.contact}`,M,y,8);y+=5}y+=5;
  txt("Mit freundlichen Grüßen",M,y,9);y+=10;txt(sender.landlordName||"Vermieter",M,y,9);
  doc.setFontSize(7);doc.text(`Erstellt am ${new Date().toLocaleDateString("de-DE")}`,M,290);
  if(snapshot?.integrityHash)doc.text(`Snapshot ${String(snapshot.integrityHash).slice(0,20)}…`,W-M,290,{align:"right"});
  return doc
}


