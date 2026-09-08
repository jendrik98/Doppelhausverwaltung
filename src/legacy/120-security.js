/* ===== security.js ===== */

const SEC_KEY="mietverwaltung_webauthn";
const LEGACY_SEC_KEYS=["mietverwaltung_v75_webauthn"];

function toB64(bytes){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function fromB64(s){s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}

function authCredentialId(){
  let id=localStorage.getItem(SEC_KEY);if(id)return id;
  for(const key of LEGACY_SEC_KEYS){id=localStorage.getItem(key);if(id){localStorage.setItem(SEC_KEY,id);localStorage.removeItem(key);return id}}
  return ""
}
function authEnabled(){return !!authCredentialId()}
async function registerDevice(){
  if(!window.PublicKeyCredential||!navigator.credentials)throw new Error("Geräteauthentifizierung nicht unterstützt");
  const cred=await navigator.credentials.create({publicKey:{
    challenge:crypto.getRandomValues(new Uint8Array(32)),
    rp:{name:"Mietverwaltung"},
    user:{id:crypto.getRandomValues(new Uint8Array(16)),name:"private-user",displayName:"Mietverwaltung"},
    pubKeyCredParams:[{type:"public-key",alg:-7},{type:"public-key",alg:-257}],
    authenticatorSelection:{authenticatorAttachment:"platform",userVerification:"required"},
    timeout:60000,attestation:"none"
  }});
  localStorage.setItem(SEC_KEY,toB64(new Uint8Array(cred.rawId)));
}
async function authenticate(){
  const id=authCredentialId();if(!id)return true;
  try{
    await navigator.credentials.get({publicKey:{
      challenge:crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials:[{id:fromB64(id),type:"public-key"}],
      userVerification:"required",timeout:60000
    }});
    return true
  }catch{return false}
}
function disableAuth(){localStorage.removeItem(SEC_KEY);for(const key of LEGACY_SEC_KEYS)localStorage.removeItem(key)}

