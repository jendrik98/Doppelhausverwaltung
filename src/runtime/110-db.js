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

async function loadState(){
  const rec=await readStateRecord();
  if(rec?.data){
    const migrated=repairDomainState(rec.data);
    await saveState(migrated);
    return migrated
  }

  const fresh=repairDomainState(createEmptyState());
  LAST_STABLE_STATE=cloneState(fresh);
  await saveState(fresh);
  return fresh
}

