import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const failures=[];
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const walk=dir=>fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(entry=>{
  const rel=path.join(dir,entry.name);
  return entry.isDirectory()?walk(rel):[rel.replaceAll("\\","/")];
});

if(fs.existsSync(path.join(root,"src/legacy")))failures.push("src/legacy darf nicht wieder eingeführt werden");
const appRuntime=read("src/ui/app-runtime.ts");
if(appRuntime.includes("function runSelfTests"))failures.push("Historische Browser-Selbsttests dürfen nicht zurückkehren");
if(Buffer.byteLength(appRuntime,"utf8")>171000)failures.push(`app-runtime.ts wächst wieder zum Monolithen (${Buffer.byteLength(appRuntime,"utf8")} Bytes > 171000)`);

const allowedNoCheck=new Set([
  "src/ui/app-runtime.ts",
  "src/ui/ui-core.ts",
  "src/domain/intelligence.ts",
  "src/domain/quality.ts",
  "src/domain/smart-engine.ts",
  "src/domain/v18-assistant.ts"
]);
const tsFiles=walk("src").filter(p=>p.endsWith(".ts"));
const noCheck=tsFiles.filter(p=>/[@]ts-nocheck/.test(read(p)));
for(const p of noCheck)if(!allowedNoCheck.has(p))failures.push(`Neues @ts-nocheck nicht erlaubt: ${p}`);
for(const p of allowedNoCheck)if(!fs.existsSync(path.join(root,p)))failures.push(`Erwartete Übergangsdatei fehlt: ${p}`);

const pkg=JSON.parse(read("package.json"));
for(const script of ["build","typecheck","test:validation","test:architecture","test:quality","test:pwa","test:e2e"]){
  if(!pkg.scripts?.[script])failures.push(`package.json script fehlt: ${script}`);
}
const ci=read(".github/workflows/ci.yml");
for(const needle of ["src/**","scripts/**","npm run test:quality","npm run test:pwa","npm run typecheck","npm run test:e2e"]){
  if(!ci.includes(needle))failures.push(`CI-Vertrag fehlt: ${needle}`);
}
if(failures.length){
  console.error("Quality-Ratchet fehlgeschlagen:\n- "+failures.join("\n- "));
  process.exit(1);
}
console.log(`Quality-Ratchet bestanden: ${tsFiles.length} TypeScript-Dateien, ${noCheck.length} bewusst verbleibende @ts-nocheck-Dateien, app-runtime ${Buffer.byteLength(appRuntime,"utf8")} Bytes.`);
