// @ts-nocheck -- Phase 8: semantikerhaltende Modul-Extraktion; Browser-E2E ist das Verhaltensgate.
/* ===== quality.js ===== */
export const QUALITY_VERSION=1;
export function parseGermanNumber(v){
  let s=String(v??"").trim().replace(/\s/g,"").replace(/[€EUR]/gi,"");if(!s)return null;
  const neg=/^\(.*\)$/.test(s);s=s.replace(/[()]/g,"");
  if(s.includes(",")&&s.includes(".")){if(s.lastIndexOf(",")>s.lastIndexOf("."))s=s.replace(/\./g,"").replace(",",".");else s=s.replace(/,/g,"")}
  else if(s.includes(","))s=s.replace(",",".");
  s=s.replace(/[^\d.+-]/g,"");const n=Number(s);return Number.isFinite(n)?(neg?-Math.abs(n):n):null
}
export function parseFlexibleDate(v){
  const s=String(v||"").trim();if(!s)return "";
  let m=s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);if(m)return `${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}`;
  m=s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);if(m){let y=Number(m[3]);if(y<100)y+=2000;return `${y}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`};return ""
}
export function csvDetectDelimiter(text){
  const first=String(text||"").split(/\r?\n/).slice(0,5).join("\n"),candidates=[";",",","\t"];
  return candidates.map(d=>({d,n:(first.match(new RegExp(d==="\t"?"\\t":d===";"?";":",","g"))||[]).length})).sort((a,b)=>b.n-a.n)[0]?.d||";"
}
export function csvRows(text,delimiter){
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
export function bankHeaderIndex(headers,patterns){const hs=headers.map(normalizeLabelText);for(const p of patterns){const i=hs.findIndex(h=>p.test(h));if(i>=0)return i}return -1}
export function parseBankCSV(text){
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
export function paymentFingerprint(p){return `${p.date}|${p.direction}|${Number(p.amount||0).toFixed(2)}|${normalizeLabelText(p.label).slice(0,80)}`}
export function detectRentPayment(state,payment){
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
export function bankImportPreview(state,parsed){
  const existing=new Set((state.payments||[]).map(paymentFingerprint));
  return parsed.rows.map(r=>({...r,duplicate:existing.has(paymentFingerprint(r)),rentMatch:detectRentPayment(state,r)}))
}
export function categoryLabel(k){return category(k)?.label||String(k||"Sonstige")}
export function periodCategoryTotals(state,year){
  const a=billingAnalysis(state,year),map=new Map();
  for(const e of a.events||[]){const cat=e.category||positionById(state,e.positionId)?.category||"other",prev=map.get(cat)||{category:cat,total:0,tenant:0,count:0};prev.total+=Number(e.amount||0);prev.tenant+=Number(e.tenantAmount||0);prev.count++;map.set(cat,prev)}
  return [...map.values()]
}
export function annualComparison(s,year){
  const current=periodCategoryTotals(s,year),prior=periodCategoryTotals(s,year-1),keys=new Set([...current.map(x=>x.category),...prior.map(x=>x.category)]),cp=billingPeriodInfo(s,year),pp=billingPeriodInfo(s,year-1);
  return [...keys].map(k=>{const c=current.find(x=>x.category===k)||{total:0,tenant:0},p=prior.find(x=>x.category===k)||{total:0,tenant:0},comparable=cp.days===cp.nominalDays&&pp.days===pp.nominalDays;
    return {category:k,current:c.total,prior:p.total,tenantCurrent:c.tenant,change:c.total-p.total,pct:comparable&&p.total?((c.total-p.total)/p.total):null,comparable,currentPartial:cp.days!==cp.nominalDays,priorPartial:pp.days!==pp.nominalDays}
  }).sort((a,b)=>Math.abs(b.change)-Math.abs(a.change))
}
export function costTrendAlerts(s,year){
  return annualComparison(s,year).filter(x=>x.comparable&&x.prior>0&&x.current>0&&x.pct!=null&&Math.abs(x.pct)>=.15).map(x=>({severity:x.pct>.25?"warn":"info",text:`${categoryLabel(x.category)}: ${x.pct>=0?"+":""}${Math.round(x.pct*100)} % gegenüber ${billingPeriodLabel(s,year-1)} (${euro(x.prior)} → ${euro(x.current)}).`}))
}
export function meterTrend(meter){
  const r=(meter?.readings||[]).filter(x=>x.date&&Number.isFinite(Number(x.value))).slice().sort((a,b)=>a.date.localeCompare(b.date)),segments=[];
  for(let i=1;i<r.length;i++){const days=daysInclusive(r[i-1].date,r[i].date)-1,delta=Number(r[i].value)-Number(r[i-1].value);if(days>0&&delta>=0)segments.push({from:r[i-1],to:r[i],days,delta,perDay:delta/days,per30:delta/days*30})}
  const avg=segments.length?segments.reduce((s,x)=>s+x.perDay,0)/segments.length:0;return{segments,avgPerDay:avg,avgPer30:avg*30}
}
export function meterAnomalies(meter){
  const t=meterTrend(meter);if(t.segments.length<2)return[];const baseline=t.segments.slice(0,-1).reduce((s,x)=>s+x.perDay,0)/Math.max(1,t.segments.length-1),last=t.segments.at(-1),out=[];
  if(baseline>0&&last.perDay>baseline*1.75&&last.delta>1)out.push({severity:"warn",text:`${meter.name}: letzter Verbrauch liegt ${Math.round((last.perDay/baseline-1)*100)} % über dem bisherigen Tagesmittel.`});return out
}

export function dataQualityScore(state){
  const integrity=integritySummary(state),checks=billingReadiness(state,currentPeriodYear()),openDocs=(state.documentsCache||[]).filter(d=>documentWorkflowState(d)!=="done").length;
  const matchable=(state.payments||[]).filter(p=>p.direction==="outflow"&&!p.positionId&&paymentMatchSuggestions(state,p,1)[0]?.score>=45).length;
  let score=100;score-=integrity.errors.length*20;score-=integrity.warnings.length*4;score-=checks.filter(x=>!x.ok).length*7;score-=Math.min(15,openDocs*3);score-=Math.min(10,matchable*2);
  return Math.max(0,Math.round(score))
}


