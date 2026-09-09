/* ===== db.js ===== */

const {
  DB_NAME,
  DB_VERSION,
  STATE_ID,
  openDB,
  addDocument,
  getDocument,
  listDocuments,
  deleteDocument,
  updateDocument,
  replaceDocuments
}=AppPersistence;
const {
  readStateRecord,
  saveState,
  listPortfolios,
  listBuildings,
  listUnitsByBuilding,
  listTenanciesByBuilding,
  listTenanciesByUnit,
  getProjectionMeta,
  getBuildingGraph
}=AppPortfolioRepository;

const {loadApplicationState}=AppApplication;

async function loadState(){
  const result=await loadApplicationState({
    readStateRecord,
    saveState,
    createEmptyState,
    repairState:repairDomainState,
    validateState:validateDomainState
  });
  LAST_STABLE_STATE=cloneState(result.state);
  return result.state
}

