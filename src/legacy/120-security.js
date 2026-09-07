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

function bytesToB64(a){let s="";const chunk=0x8000;for(let i=0;i<a.length;i+=chunk)s+=String.fromCharCode(...a.subarray(i,i+chunk));return btoa(s)}
function b64ToBytes(s){const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
async function derive(password,salt){const mat=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveKey"]);return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:250000,hash:"SHA-256"},mat,{name:"AES-GCM",length:256},false,["encrypt","decrypt"])}
async function encryptJSON(obj,password){
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),key=await derive(password,salt),plain=new TextEncoder().encode(JSON.stringify(obj)),cipher=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,plain));
  return {schema:"mietverwaltung-encrypted-v1",salt:bytesToB64(salt),iv:bytesToB64(iv),data:bytesToB64(cipher)}
}
async function decryptJSON(wrapper,password){
  const salt=b64ToBytes(wrapper.salt),iv=b64ToBytes(wrapper.iv),key=await derive(password,salt),plain=await crypto.subtle.decrypt({name:"AES-GCM",iv},key,b64ToBytes(wrapper.data));
  return JSON.parse(new TextDecoder().decode(plain))
}


