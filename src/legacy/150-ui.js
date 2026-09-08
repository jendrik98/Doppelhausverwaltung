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
