import fs from "node:fs";

const index=fs.readFileSync("index.html","utf8");
const sw=fs.readFileSync("service-worker.js","utf8");
const live=fs.readFileSync(".github/workflows/e2e-live.yml","utf8");
const failures=[];
const must=(cond,msg)=>{if(!cond)failures.push(msg)};
const app=index.match(/src="(app\.js\?v=[^"]+)"/)?.[1];
const css=index.match(/href="(style\.css\?v=[^"]+)"/)?.[1];
const manifest=index.match(/href="(manifest\.webmanifest\?v=[^"]+)"/)?.[1];
must(!!app,"versionierte app.js fehlt in index.html");
must(!!css,"versionierte style.css fehlt in index.html");
must(!!manifest,"versioniertes Manifest fehlt in index.html");
for(const asset of [app,css,manifest].filter(Boolean))must(sw.includes(`"./${asset}"`),`Service-Worker CORE enthält ${asset} nicht exakt`);
must(sw.includes("mietverwaltung-v18-lifecycle-ledger-g-1"),"Design-System-F Production-Cache fehlt");
must(!sw.includes("mietverwaltung-v18-design-system-f-1"),"alter Design-System-F Cache ist noch vorhanden");
must(!sw.includes("mietverwaltung-v18-portfolio-admin-e-1"),"alter Portfolio-E Cache ist noch vorhanden");
must(!sw.includes("mietverwaltung-v18-presentation-d-1"),"alter Presentation-D Cache ist noch vorhanden");
must(!sw.includes("mietverwaltung-v18-application-c-1"),"alter Application-C Cache ist noch vorhanden");
must(!sw.includes("mietverwaltung-v18-prod-hardening-a-1"),"alter Hardening-Cache ist noch vorhanden");
must(!sw.includes("mietverwaltung-v18-phase2-calendar-validation-4"),"alter Cache-Name ist noch vorhanden");
must(sw.includes("function networkFirst"),"network-first Strategie fehlt");
for(const pathname of ["/app.js","/style.css","/index.html","/manifest.webmanifest","/legal-rules.json"]){must(sw.includes(`"${pathname}"`),`kritischer PWA-Pfad fehlt: ${pathname}`)}
must(live.includes("sha256sum app.js"),"Live-E2E wartet nicht auf den exakten app.js-Hash");
must(live.includes("src/**")&&live.includes("scripts/**")&&live.includes("tsconfig.json"),"Live-E2E Trigger deckt Quell-/Buildänderungen nicht ab");
must(!live.includes("EXPECTED_APP_VERSION"),"Live-Deployment darf nicht nur über die unveränderte App-Version erkannt werden");
if(failures.length){console.error("PWA-Vertrag fehlgeschlagen:\n- "+failures.join("\n- "));process.exit(1)}
console.log(`PWA-Vertrag bestanden: ${app}, ${css}, ${manifest}; kritische Assets network-first mit Offline-Fallback.`);
