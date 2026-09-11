import assert from "node:assert/strict";
import fs from "node:fs";

const ui=fs.readFileSync("src/ui/year-archive-ui.ts","utf8");
const runtime=fs.readFileSync("src/ui/app-runtime.ts","utf8");
const build=fs.readFileSync("scripts/build-app.mjs","utf8");
const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));
const architecture=fs.readFileSync("ARCHITECTURE.md","utf8");

assert.ok(ui.includes('from "../domain/year-archive"'),"H2 muss die H1-Domäne direkt verwenden");
for(const symbol of ["buildYearArchive","createYearArchiveExport","mountYearArchiveWorkspace","yearArchiveYearSelect","yearArchiveExport","data-archive-chain"]){
  assert.ok(ui.includes(symbol),`H2-UI-Vertrag fehlt: ${symbol}`);
}
assert.ok(ui.includes("loadDocuments"),"H2 muss Dokumente über die gebäudeisolierte Runtime-Grenze laden");
assert.ok(ui.includes("context:{buildingId"),"Export muss den aktiven Gebäudekontext dokumentieren");
assert.ok(build.includes('compileModule("src/ui/year-archive-ui.ts", "AppYearArchiveUi")'),"H2-UI fehlt im reproduzierbaren Build");
assert.ok(runtime.includes('{id:"archive",label:"Jahresarchiv"'),"Jahresarchiv-Tab fehlt");
assert.ok(runtime.includes('AppYearArchiveUi.mountYearArchiveWorkspace'),"Dünner H2-Runtime-Adapter fehlt");
assert.ok(String(pkg.scripts?.["test:architecture"]||"").includes("test:archive-ui"),"H2-Gate ist nicht in test:architecture verdrahtet");
assert.ok(architecture.includes("### H2: Jahresarchiv-Oberfläche"),"ARCHITECTURE.md dokumentiert H2 nicht");
console.log("Architecture H2 UI-Vertrag bestanden: Jahresauswahl, gebäudeisolierte Dokumente, Nachweisketten, Lücken und JSON-Export.");
