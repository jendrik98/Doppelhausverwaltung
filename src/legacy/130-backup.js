/* ===== backup.js ===== */



async function encodeBlobForBackup(blob){
  const bytes=new Uint8Array(await blob.arrayBuffer());
  return {type:blob.type||"application/octet-stream",base64:bytesToB64(bytes)}
}
async function createFullBackup(state,password){
  const docs=await listDocuments(),encoded=[];
  for(const d of docs){
    const copy={...d,blob:undefined,pages:undefined};
    if(Array.isArray(d.pages)&&d.pages.length){
      copy.pageData=[];
      for(const p of d.pages){
        copy.pageData.push({
          id:p.id,name:p.name,type:p.type,size:p.size,
          blobData:await encodeBlobForBackup(p.blob)
        })
      }
    }else if(d.blob){
      copy.blobData=await encodeBlobForBackup(d.blob)
    }
    encoded.push(copy)
  }
  return encryptJSON({schema:"mietverwaltung-full-backup-v2",state,documents:encoded},password)
}
async function decodeFullBackup(wrapper,password){
  const payload=await decryptJSON(wrapper,password);
  if(!["mietverwaltung-full-backup-v2","mietverwaltung-v81-full-backup","mietverwaltung-v75-full-backup"].includes(payload.schema))throw new Error("Falsches Backup-Format");
  const docs=[];
  for(const d of payload.documents||[]){
    const copy={...d};
    if(Array.isArray(d.pageData)){
      copy.pages=d.pageData.map(p=>({id:p.id,name:p.name,type:p.type,size:p.size,blob:new Blob([b64ToBytes(p.blobData.base64)],{type:p.blobData.type})}));delete copy.pageData
    }else if(d.blobData){copy.blob=new Blob([b64ToBytes(d.blobData.base64)],{type:d.blobData.type});delete copy.blobData}
    docs.push(copy)
  }
  return {state:payload.state,documents:docs}
}


