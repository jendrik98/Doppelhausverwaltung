/* ===== schema.js ===== */
const {
  SCHEMA_VERSION,
  localDateISO,
  dateOnlyAddDays,
  localMonthEndISO,
  createEmptyState,
  validateState,
  normalizeState
}=AppState;

// Register the Service Worker before the first asynchronous startup wait.
// On fast page loads the window "load" event can fire while IndexedDB is still
// opening; registering only afterwards would permanently miss that event.
const SERVICE_WORKER_REGISTRATION=("serviceWorker" in navigator)
  ? navigator.serviceWorker.register("./service-worker.js",{updateViaCache:"none"}).catch(error=>{
      console.warn("Service Worker konnte nicht registriert werden:",error);
      return null;
    })
  : Promise.resolve(null);



