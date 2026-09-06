/* Mietverwaltung V17.0.2 – Kaltwasser Plus */
(() => {
"use strict";
const DB="mietverwaltung-v6", STATE="main", VERSION="17.0.2";
const euro=n=>new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(Number(n)||0);
const pct=n=>Number.isFinite(n)?new Intl.NumberFormat("de-DE",{style:"percent",maximumFractionDigits:1}).format(n):"–";
function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,2);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function readState(){const d=await openDb(),tx=d.transaction("state","readonly"),r=tx.objectStore("state").get(STATE);return new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result?.data||null);r.onerror=()=>reject(r.error)})}
async function writeState(s){const d=await openDb(),tx=d.transaction("state","readwrite");tx.objectStore("state").put({id:STATE,data:s});return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
function meterById(s,id){return (s.meters||[]).find(m=>m.id===id)}
function reading(m,id){return (m?.readings||[]).find(r=>r.id===id)}
function consumption(s,x){
 if(!x)return null; const main=meterById(s,x.mainMeterId),own=meterById(s,x.ownerMeterId);
 const ms=reading(main,x.mainStartReadingId),me=reading(main,x.mainEndReadingId),os=reading(own,x.ownerStartReadingId),oe=reading(own,x.ownerEndReadingId);
 if(!ms||!me||!os||!oe)return null;
 const house=Number(me.value)-Number(ms.value),owner=Number(oe.value)-Number(os.value),tenant=house-owner;
 return {house,owner,tenant,share:house>0?tenant/house:0,valid:house>=0&&owner>=0&&tenant>=0,dates:[ms.date,me.date,os.date,oe.date]};
}
function periodSettlement(s,y){return (s.waterSettlements||[]).find(x=>Number(x.periodYear)===Number(y))}
function currentYear(){const d=new Date();return d.getMonth()>=3?d.getFullYear():d.getFullYear()-1}
function waterPositions(s,y){return (s.costPositions||[]).filter(p=>p.confirmed&&p.category==="water"&&(!p.serviceStart||Number(String(p.serviceStart).slice(0,4))<=y+1)&&(!p.serviceEnd||Number(String(p.serviceEnd).slice(0,4))>=y))}
function analysis(s,y=currentYear()){
 const c=consumption(s,periodSettlement(s,y)),positions=waterPositions(s,y),cost=positions.reduce((a,p)=>a+Number(p.amount||0),0);
 const tenantCost=c?.valid?cost*c.share:0,rate=c?.valid&&c.house>0?cost/c.house:0;
 const issues=[];
 if(!c)issues.push("Zählerstände für Anfang und Ende fehlen."); else if(!c.valid)issues.push("Zählerstände ergeben einen unplausiblen Verbrauch.");
 if(!positions.length||cost<=0)issues.push("Bestätigte Wasser-/Kanalkosten fehlen.");
 if(c?.valid&&c.house===0)issues.push("Hausverbrauch ist 0 m³ – Ablesungen prüfen.");
 return {year:y,c,positions,cost,tenantCost,rate,issues,ready:issues.length===0};
}
function render(){
 if(location.hash!=="#rental/water")return;
 const host=document.getElementById("workspaceBody");if(!host||host.querySelector("#v17WaterPlus"))return;
 readState().then(s=>{if(!s)return;const a=analysis(s),c=a.c,box=document.createElement("section");box.id="v17WaterPlus";box.className="card";
 box.innerHTML=`<div class="card-head"><div><p class="eyebrow">V17.0.2 · KALTWASSER PLUS</p><h3>Verbrauch & Kosten auf einen Blick</h3></div><span class="pill ${a.ready?"good":"warn"}">${a.ready?"Abrechnungsbereit":"Noch offen"}</span></div>
 <div class="grid cards"><article class="card metric-card"><span>Hausverbrauch</span><strong>${c?.valid?c.house.toFixed(3)+" m³":"–"}</strong></article><article class="card metric-card"><span>Mietwohnung</span><strong>${c?.valid?c.tenant.toFixed(3)+" m³":"–"}</strong><small>${c?.valid?pct(c.share):"Anteil offen"}</small></article><article class="card metric-card"><span>Wasserkosten</span><strong>${euro(a.cost)}</strong><small>${c?.valid&&a.cost?`${euro(a.rate)} / m³ Hausverbrauch`:"Tarif noch offen"}</small></article><article class="card metric-card"><span>Rechnerischer Mieteranteil</span><strong>${a.ready?euro(a.tenantCost):"–"}</strong></article></div>
 ${a.issues.length?`<div class="legal-warn"><strong>Für die Abrechnung fehlt noch:</strong>${a.issues.map(x=>`<p>• ${x}</p>`).join("")}</div>`:`<div class="legal-ok"><strong>✓ Kaltwasser vollständig.</strong><br>${c.tenant.toFixed(3)} m³ von ${c.house.toFixed(3)} m³ = ${pct(c.share)}. Bei ${euro(a.cost)} Gesamtkosten ergibt das rechnerisch ${euro(a.tenantCost)}.</div>`}
 <p class="muted">Heizung, Warmwasser, Strom und Gas bleiben außerhalb dieser Vermieter-Wasserabrechnung. Die endgültige Umlage in der Betriebskostenabrechnung folgt weiterhin den hinterlegten Kostenpositionen und Regeln.</p>`;
 host.prepend(box)}).catch(console.warn)
}
async function migrate(){const s=await readState();if(!s)return;s.meta||={};s.meta.appVersion=VERSION;s.meta.v17||={};s.meta.v17.waterModule=2;await writeState(s)}
function patchVersion(){document.querySelectorAll("#workspaceBody p").forEach(p=>{if(/App 17\.0\.[01]/.test(p.textContent))p.innerHTML=p.innerHTML.replace(/App 17\.0\.[01]/,"App 17.0.2")})}
let t;function schedule(){clearTimeout(t);t=setTimeout(()=>{render();patchVersion()},60)}
window.addEventListener("hashchange",schedule);new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});migrate().catch(console.warn).finally(schedule);
})();
