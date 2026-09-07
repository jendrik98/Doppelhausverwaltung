/* ===== ui.js ===== */
const $=id=>document.getElementById(id);

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

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
function focusableIn(root){
  return [...root.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(x=>x.offsetParent!==null)
}
function visibleDialog(){return ["modal","searchOverlay","quickOverlay"].map($).find(x=>x&&!x.classList.contains("hidden"))||null}
function trapFocusInDialog(e){
  if(e.key!=="Tab")return;const dlg=visibleDialog();if(!dlg)return;const els=focusableIn(dlg);if(!els.length)return;
  const first=els[0],last=els[els.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
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
function formField({name,label,type="text",value="",options=[],full=false,step,min,placeholder=""}){
  if(type==="select")return `<label class="${full?"full":""}">${esc(label)}<select name="${name}">${options.map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(value)?"selected":""}>${esc(o.label)}</option>`).join("")}</select></label>`;
  return `<label class="${full?"full":""}">${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${step?`step="${step}"`:""} ${min!==undefined?`min="${min}"`:""} placeholder="${esc(placeholder)}"></label>`
}



