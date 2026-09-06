const CACHE="mietverwaltung-v16-0-2-e2e-focus-hotfix";
const CORE=["./","./index.html","./style.css","./app.js?v=1602","./manifest.webmanifest","./legal-rules.json","./icon-192.png","./icon-512.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE))));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("message",e=>{if(e.data?.type==="SKIP_WAITING")self.skipWaiting()});
self.addEventListener("fetch",e=>{
 if(e.request.method!=="GET")return;const u=new URL(e.request.url);if(u.origin!==location.origin)return;
 const fresh=u.pathname.endsWith("/index.html")||u.pathname.endsWith("/legal-rules.json")||u.pathname.endsWith("/");
 if(fresh)e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match("./index.html"))));
 else e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).then(r=>{const x=r.clone();caches.open(CACHE).then(k=>k.put(e.request,x));return r})));
});
