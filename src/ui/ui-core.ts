// @ts-nocheck
/* ===== ui-core.ts · Phase 9 ===== */
export const $=id=>document.getElementById(id);

export const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

export function focusableIn(root){
  return [...root.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(x=>x.offsetParent!==null)
}
export function visibleDialog(){return ["modal","searchOverlay","quickOverlay"].map($).find(x=>x&&!x.classList.contains("hidden"))||null}
export function trapFocusInDialog(e){
  if(e.key!=="Tab")return;const dlg=visibleDialog();if(!dlg)return;const els=focusableIn(dlg);if(!els.length)return;
  const first=els[0],last=els[els.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
}

export function formField({name,label,type="text",value="",options=[],full=false,step,min,placeholder=""}){
  if(type==="select")return `<label class="${full?"full":""}">${esc(label)}<select name="${name}">${options.map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(value)?"selected":""}>${esc(o.label)}</option>`).join("")}</select></label>`;
  return `<label class="${full?"full":""}">${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${step?`step="${step}"`:""} ${min!==undefined?`min="${min}"`:""} placeholder="${esc(placeholder)}"></label>`
}

export function clearCentralValidation(form){
  form.querySelectorAll(".field-error").forEach(x=>x.remove());
  form.querySelectorAll('[aria-invalid="true"]').forEach(x=>x.removeAttribute("aria-invalid"))
}
export function centralFieldLabel(el){
  const label=el.closest("label");if(!label)return el.name||"Eingabe";
  const text=[...label.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join(" ").trim();
  return text||el.name||"Eingabe"
}
export function markCentralError(el,message){
  el.setAttribute("aria-invalid","true");
  const label=el.closest("label");if(label){const note=document.createElement("small");note.className="field-error";note.textContent=message;label.appendChild(note)}
}
export function validateCentralForm(form){
  clearCentralValidation(form);
  const values=Object.fromEntries(new FormData(form)),errors=[],warnings=[];
  const fail=(el,msg)=>{if(!el)return;errors.push({el,msg});markCentralError(el,msg)};
  const warn=(el,msg)=>warnings.push({el,msg});
  const byName=name=>form.elements.namedItem(name);

  for(const el of form.querySelectorAll("input[name],select[name],textarea[name]")){
    if(el.disabled)continue;const name=el.name,value=String(el.value??"").trim();
    if(el.type==="date"&&value){const r=AppValidation.validateIsoDate(value,false);if(!r.ok)fail(el,r.message||"Ungültiges Datum.")}
    if(el.type==="number"&&value!==""){
      const n=AppValidation.parseGermanNumber(value);if(n===null){fail(el,"Bitte eine gültige Zahl eingeben.");continue}
      if(el.min!==""&&n<Number(el.min))fail(el,`Der Wert muss mindestens ${el.min} sein.`);
      if(el.max!==""&&n>Number(el.max))fail(el,`Der Wert darf höchstens ${el.max} sein.`)
    }
    if(name==="iban"&&value){const r=AppValidation.validateIban(value,false);if(!r.ok)fail(el,r.message||"IBAN prüfen.")}
    if((name==="area"||name==="totalArea")&&value){const r=AppValidation.validateArea(value);if(!r.ok)fail(el,r.message||"Wohnfläche prüfen.");else if(Number(r.value)>1000)warn(el,"Die eingegebene Wohnfläche ist ungewöhnlich groß.")}
    if((name==="year"||name==="constructionYear"||name==="periodYear")&&value){const r=AppValidation.validateYear(value);if(!r.ok)fail(el,r.message||"Jahr prüfen.")}
    if(["rent","advance","amount","repayment","fixed"].includes(name)&&value){const r=AppValidation.validateMoney(value,{min:0});if(!r.ok)fail(el,r.message||"Betrag prüfen.");else if(Number(r.value)>100000)warn(el,"Der Betrag ist ungewöhnlich hoch.")}
    if(name==="persons"&&value!==""&&Number(value)>20)warn(el,"Die Personenzahl ist ungewöhnlich hoch.")
    if(["mainStart","mainEnd","ownerStart","ownerEnd"].includes(name)&&value!==""){
      const r=AppValidation.validateMeterReading(value);if(!r.ok)fail(el,r.message||"Zählerstand prüfen.")
    }
  }

  const datePair=(a,b,label)=>{const A=String(values[a]||""),B=String(values[b]||"");if(A&&B&&A>B)fail(byName(b),`${label}: Das Enddatum liegt vor dem Startdatum.`)};
  datePair("start","end","Vertragszeitraum");
  datePair("serviceStart","serviceEnd","Leistungszeitraum");
  datePair("mainStartDate","mainEndDate","Hauptzähler-Zeitraum");
  datePair("ownerStartDate","ownerEndDate","Zwischenzähler-Zeitraum");
  if(values.billingTakeoverDate&&values.predecessorBillingEnd&&values.predecessorBillingEnd>=values.billingTakeoverDate)fail(byName("predecessorBillingEnd"),"Der Abrechnungszeitraum des Voreigentümers muss vor der eigenen Übernahme enden.");
  if(values.mainStart!==undefined&&values.mainEnd!==undefined&&values.mainStart!==""&&values.mainEnd!==""&&Number(values.mainEnd)<Number(values.mainStart))fail(byName("mainEnd"),"Der Endstand des Hauptzählers darf nicht kleiner als der Anfangsstand sein.");
  if(values.ownerStart!==undefined&&values.ownerEnd!==undefined&&values.ownerStart!==""&&values.ownerEnd!==""&&Number(values.ownerEnd)<Number(values.ownerStart))fail(byName("ownerEnd"),"Der Endstand des Zwischenzählers darf nicht kleiner als der Anfangsstand sein.");

  if(errors.length){
    AppFeedback.showToast("Bitte markierte Eingaben prüfen.",{kind:"error",timeoutMs:4200});
    errors[0].el.focus();return false
  }
  if(warnings.length){
    const text=warnings.map(x=>`• ${centralFieldLabel(x.el)}: ${x.msg}`).join("\n");
    if(!confirm(`Ungewöhnliche Eingabe erkannt:\n\n${text}\n\nTrotzdem speichern?`)){warnings[0].el.focus();return false}
  }
  return true
}
document.addEventListener("submit",e=>{
  const form=e.target;if(!(form instanceof HTMLFormElement)||form.dataset.skipCentralValidation==="true")return;
  if(!validateCentralForm(form)){e.preventDefault();e.stopImmediatePropagation()}
},true);
