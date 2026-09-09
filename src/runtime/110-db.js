/* ===== db.js ===== */

const {
  DB_NAME,
  DB_VERSION,
  STATE_ID,
  openDB,
  readStateRecord,
  saveState,
  addDocument,
  getDocument,
  listDocuments,
  deleteDocument,
  updateDocument,
  replaceDocuments
}=AppPersistence;

async function loadState(){
  const rec=await readStateRecord();
  if(rec?.data)return migrateDomainState(normalizeState(rec.data));

  const fresh=repairDomainState(createEmptyState());
  LAST_STABLE_STATE=cloneState(fresh);
  const migrated=migrateDomainState(normalizeState(fresh));
  await saveState(migrated);
  return migrated
}

