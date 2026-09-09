/* ===== db.js ===== */

const {
  DB_NAME,
  DB_VERSION,
  STATE_ID,
  openDB,
  addDocument:addDocumentRecord,
  getDocument:getDocumentRecord,
  listDocuments:listAllDocuments,
  deleteDocument:deleteDocumentRecord,
  updateDocument:updateDocumentRecord,
  replaceDocuments:replaceAllDocuments
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

function documentBelongsToActiveBuilding(document){
  if(!document)return false;
  const buildingId=String(document.buildingId||"");
  if(buildingId)return buildingId===activeBuildingId;
  const primary=String(portfolioState?.meta?.primaryBuildingId||state?.meta?.primaryBuildingId||"");
  return !!activeBuildingId&&activeBuildingId===primary
}
async function addDocument(document){
  return addDocumentRecord({...document,buildingId:document?.buildingId||activeBuildingId||""})
}
async function getDocument(id){
  const document=await getDocumentRecord(id);
  return documentBelongsToActiveBuilding(document)?document:null
}
async function listDocuments(){
  return (await listAllDocuments()).filter(documentBelongsToActiveBuilding)
}
async function deleteDocument(id){
  const document=await getDocumentRecord(id);
  if(!documentBelongsToActiveBuilding(document))throw new Error("Dokument gehört zu einem anderen Gebäude.");
  return deleteDocumentRecord(id)
}
async function updateDocument(document){
  const existing=document?.id?await getDocumentRecord(document.id):null;
  if(existing&&!documentBelongsToActiveBuilding(existing))throw new Error("Dokument gehört zu einem anderen Gebäude.");
  return updateDocumentRecord({...document,buildingId:document?.buildingId||activeBuildingId||""})
}
const replaceDocuments=replaceAllDocuments;
