const CACHE="mietverwaltung-v18-visual-polish-1";
const CORE=[
  "./",
  "./index.html",
  "./style.css?v=1810p12",
  "./app.js?v=1811",
  "./manifest.webmanifest?v=1810p2",
  "./legal-rules.json",
  "./icon-192.png",
  "./icon-512.png"
];
const CRITICAL_PATHS=new Set(["/","/index.html","/app.js","/style.css","/manifest.webmanifest","/legal-rules.json"]);

async function networkFirst(request){
  const cache=await caches.open(CACHE);
  try{
    const response=await fetch(request);
    if(response&&response.ok)await cache.put(request,response.clone());
    return response;
  }catch(error){
    const cached=await cache.match(request,{ignoreSearch:false}) || await caches.match(request,{ignoreSearch:true});
    if(cached)return cached;
    if(request.mode==="navigate")return (await caches.match("./index.html")) || Response.error();
    throw error;
  }
}

async function cacheFirst(request){
  const cached=await caches.match(request);
  if(cached)return cached;
  const response=await fetch(request);
  if(response&&response.ok){const cache=await caches.open(CACHE);await cache.put(request,response.clone())}
  return response;
}

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener("message",event=>{if(event.data?.type==="SKIP_WAITING")self.skipWaiting()});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  const scopePath=new URL(self.registration.scope).pathname.replace(/\/$/,"");
  const relativePath=url.pathname.startsWith(scopePath)?url.pathname.slice(scopePath.length)||"/":url.pathname;
  const critical=event.request.mode==="navigate"||CRITICAL_PATHS.has(relativePath);
  event.respondWith(critical?networkFirst(event.request):cacheFirst(event.request));
});
