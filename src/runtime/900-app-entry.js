
}catch(error){
  console.error("Mietverwaltung Startfehler:",error);
  const host=document.getElementById("app");
  if(host){
    host.innerHTML=`<section>
      <div class="legal-bad">
        <h2>Die App konnte nicht gestartet werden</h2>
        <p>${String(error?.message||error)}</p>
        <p>Diese Fehlermeldung ist absichtlich sichtbar, damit ein Startproblem nicht mehr nur als leere Seite erscheint.</p>
      </div>
    </section>`;
  }
}
})();


/* Professional PWA hardening */
(async()=>{try{if(navigator.storage&&navigator.storage.persist){await navigator.storage.persist();}}catch(e){console.warn('Persistent storage request failed',e)}})();
