/* ===== backup.js ===== */

async function createFullBackup(state,password){
  const docs=await listAllDocuments();
  return AppBackupCodec.createFullBackup(state,password,docs)
}

const {encodeBlobForBackup,decodeFullBackup}=AppBackupCodec;
