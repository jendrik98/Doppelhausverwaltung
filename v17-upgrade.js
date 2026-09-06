/* Mietverwaltung V17 – Funktionspaket
   Ergänzt die stabile V16-Kernanwendung ohne bestehende Daten zu löschen. */
(() => {
"use strict";
const V="17.0.0", DB="mietverwaltung-v6", STATE="main";
const euro=n=>new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(Number(n)||0);
const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
const monthKey=d=>String(d||"").slice(0,7);
const nowKey=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`};
const offsetKey=o=>{const d=new Date(),x=new Date(d.getFullYear(),d.getMonth()+o,1);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}`};

function db(){
  return new Promise((res,rej)=>{const r=indexedDB.open(DB,2);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})
}
async function readState(){
  const d=await db(),tx=d.transaction("state","readonly"),r=tx.objectStore("state").get(STATE);
  return new Promise((res,rej)=>{r.onsuccess=()=>res(r.result?.data||null);r.onerror=()=>rej(r.error)})
}
async function writeState(s){
  const d=await db(),tx=d.transaction("state","readwrite");tx.objectStore("state").put({id:STATE,data:s});
  return new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})
}
function activeLease(s,key){
  const [y,m]=key.split("-").map(Number),start=`${key}-01`,end=new Date(y,m,0).toISOString().slice(0,10);
  return (s.leases||[]).find(l=>(!l.start||l.start<=end)&&(!l.end||l.end>=start))
}
function likelyRentPayment(s,p,l){
  if(p.direction!=="income"||!l)return false;
  const expected=Number(l.rent||0)+Number(l.advance||0), label=norm(p.label), tenant=norm(l.tenantName);
  return Math.abs(Number(p.amount||0)-expected)<=Math.max(.01,expected*.03) ||
    /\bmiete\b|betriebskosten|nebenkosten|\bbk\b/.test(label) || (tenant&&label.includes(tenant));
}
function rentRow(s,key){
  const l=activeLease(s,key); if(!l)return {key,status:"none",expected:0,paid:0,diff:0};
  const expected=Number(l.rent||0)+Number(l.advance||0);
  const pays=(s.payments||[]).filter(p=>monthKey(p.date)===key&&likelyRentPayment(s,p,l));
  const paid=pays.reduce((a,p)=>a+Number(p.amount||0),0),diff=paid-expected;
  let status=paid<=0?"offen":paid+0.01<expected?"teilweise":paid>expected+0.01?"überzahlt":"bezahlt";
  return {key,l,expected,paid,diff,status,pays};
}
function pill(r){
  const c=r.status==="bezahlt"?"good":r.status==="offen"?"bad":"warn";
  return `<span class="pill ${c}">${r.status}</span>`;
}
function escapeHTML(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

async function migrate(){
  const s=await readState(); if(!s)return;
  s.meta=s.meta||{}; s.meta.appVersion=V; s.meta.v17=s.meta.v17||{};
  s.meta.v17.utilityProfile=s.meta.v17.utilityProfile||{
    coldWater:"landlord",heating:"tenant",hotWater:"tenant",electricity:"tenant",gas:"tenant"
  };
  s.meta.v17.enabledAt=s.meta.v17.enabledAt||new Date().toISOString();
  await writeState(s);
}
function validatePaymentForm(form){
  if(!form?.querySelector('input[name="amount"]'))return true;
  const amount=Number(form.querySelector('input[name="amount"]').value);
  const date=form.querySelector('input[name="date"]')?.value||"";
  const label=form.querySelector('input[name="label"]')?.value.trim()||"";
  if(!date){alert("Bitte ein Buchungsdatum eintragen.");return false}
  if(!label){alert("Bitte eine aussagekräftige Bezeichnung eintragen.");return false}
  if(!Number.isFinite(amount)||amount<=0){alert("Der Betrag muss größer als 0,00 € sein.");return false}
  return true;
}
function installPaymentGuard(){
  document.addEventListener("submit",e=>{
    const f=e.target;
    if(f?.querySelector('select[name="direction"]')&&f?.querySelector('input[name="amount"]')){
      if(!validatePaymentForm(f)){e.preventDefault();e.stopImmediatePropagation()}
    }
  },true);
}
async function renderRentLedger(){
  if(location.hash!=="#rental/overview")return;
  const host=document.getElementById("workspaceBody"); if(!host||host.querySelector("#v17RentLedger"))return;
  const s=await readState(); if(!s)return;
  const rows=Array.from({length:12},(_,i)=>rentRow(s,offsetKey(-i)));
  const active=rows.filter(r=>r.status!=="none"), arrears=active.reduce((a,r)=>a+Math.max(0,-r.diff),0);
  const current=rentRow(s,nowKey());
  const card=document.createElement("section"); card.id="v17RentLedger"; card.className="card";
  card.innerHTML=`<div class="card-head"><div><p class="eyebrow">V17 · MIETKONTO</p><h3>Mietkonto & Zahlungsstatus</h3></div>${current.status!=="none"?pill(current):""}</div>
  <div class="grid cards">
    <article class="card metric-card"><span>Soll aktuell</span><strong>${euro(current.expected)}</strong></article>
    <article class="card metric-card"><span>Erkannt aktuell</span><strong>${euro(current.paid)}</strong></article>
    <article class="card metric-card"><span>Offener Saldo 12M</span><strong class="${arrears>0?"negative":"positive"}">${euro(arrears)}</strong></article>
  </div>
  <div class="tablewrap"><table class="costtable"><thead><tr><th>Monat</th><th>Soll</th><th>Erhalten</th><th>Differenz</th><th>Status</th></tr></thead><tbody>
  ${active.map(r=>`<tr><td>${escapeHTML(r.key)}</td><td>${euro(r.expected)}</td><td>${euro(r.paid)}</td><td class="${r.diff<-.01?"negative":"positive"}">${euro(r.diff)}</td><td>${pill(r)}</td></tr>`).join("")}
  </tbody></table></div>
  <p class="muted">Erkennung anhand Mietvertrag, Betrag, Mietername und Buchungstext. Abweichungen bleiben sichtbar und werden nicht automatisch überschrieben.</p>`;
  host.appendChild(card);
}
async function renderUtilityProfile(){
  if(location.hash!=="#rental/overview")return;
  const host=document.getElementById("workspaceBody"); if(!host||host.querySelector("#v17Utilities"))return;
  const s=await readState();if(!s)return;
  const p=s.meta?.v17?.utilityProfile||{};
  const card=document.createElement("section");card.id="v17Utilities";card.className="card";
  card.innerHTML=`<p class="eyebrow">V17 · VERSORGUNG</p><h3>Abrechnungsverantwortung</h3>
  <div class="fact-row"><span>Kaltwasser / Kanal</span><strong>${p.coldWater==="landlord"?"über Vermieter":"Mietervertrag"}</strong></div>
  <div class="fact-row"><span>Heizung</span><strong>${p.heating==="tenant"?"eigener Mietervertrag":"über Vermieter"}</strong></div>
  <div class="fact-row"><span>Warmwasser</span><strong>${p.hotWater==="tenant"?"eigene Verantwortung":"über Vermieter"}</strong></div>
  <div class="fact-row"><span>Strom</span><strong>${p.electricity==="tenant"?"eigener Mietervertrag":"über Vermieter"}</strong></div>
  <div class="fact-row"><span>Gas</span><strong>${p.gas==="tenant"?"eigener Mietervertrag":"über Vermieter"}</strong></div>
  <p class="muted">Damit bleibt die Betriebskostenlogik auf die tatsächlich von dir abzurechnenden Positionen fokussiert.</p>`;
  host.appendChild(card);
}
async function enhancePayments(){
  if(location.hash!=="#owner/cashflow")return;
  const host=document.getElementById("workspaceBody");if(!host||host.querySelector("#v17PaymentQuality"))return;
  const s=await readState();if(!s)return;
  const bad=(s.payments||[]).filter(p=>!p.date||!String(p.label||"").trim()||!(Number(p.amount)>0));
  const dup=new Map();for(const p of s.payments||[]){const k=`${p.date}|${p.direction}|${Number(p.amount).toFixed(2)}|${norm(p.label)}`;dup.set(k,(dup.get(k)||0)+1)}
  const dups=[...dup.values()].filter(n=>n>1).length;
  const box=document.createElement("div");box.id="v17PaymentQuality";box.className=bad.length||dups?"legal-warn":"legal-ok";
  box.innerHTML=`<strong>V17 Buchungsprüfung</strong><br>${bad.length?`${bad.length} ältere Buchung(en) mit unvollständigen Pflichtdaten. `:""}${dups?`${dups} mögliche Dublette(n).`:"Keine ungültigen oder doppelten Buchungen erkannt."}`;
  host.prepend(box);
}
function versionBadge(){
  let b=document.getElementById("v17Badge");if(b)return;
  b=document.createElement("span");b.id="v17Badge";b.className="pill good";b.textContent="V17";
  document.querySelector(".brand")?.appendChild(b);
}
function patchDiagnostics(){
  document.querySelectorAll("#workspaceBody p").forEach(p=>{if(p.textContent.includes("App 16.0.2"))p.innerHTML=p.innerHTML.replace("App 16.0.2","App 17.0.0")})
}
let timer;
function scheduleEnhance(){
  clearTimeout(timer);timer=setTimeout(async()=>{versionBadge();await renderRentLedger();await renderUtilityProfile();await enhancePayments();patchDiagnostics()},80)
}
window.addEventListener("hashchange",scheduleEnhance);
new MutationObserver(scheduleEnhance).observe(document.documentElement,{childList:true,subtree:true});
installPaymentGuard();
migrate().catch(console.warn).finally(scheduleEnhance);
})();