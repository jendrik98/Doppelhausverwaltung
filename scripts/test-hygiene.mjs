import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const exists = file => fs.existsSync(path.join(root, file));

const workflowDir = path.join(root, ".github/workflows");
const workflows = fs.readdirSync(workflowDir).filter(name => /\.ya?ml$/i.test(name)).sort();
assert.deepEqual(workflows, ["ci.yml", "e2e-live.yml"], `Nur dauerhafte Workflows sind erlaubt; gefunden: ${workflows.join(", ")}`);
assert.ok(exists("README.md"), "README.md fehlt");
assert.ok(!exists("README_E2E.md"), "README_E2E.md ist eine historische Neben-README");

const testFiles = fs.readdirSync(path.join(root, "tests"));
for (const name of testFiles) {
  assert.ok(!/^v17-/i.test(name), `Historischer V17-Testname: ${name}`);
  assert.ok(!/phase\s*\d/i.test(name), `Historischer Phasen-Testname: ${name}`);
}

const runtimeManifest = JSON.parse(read("src/runtime/order.json"));
const runtimeOrder = Array.isArray(runtimeManifest?.files) ? runtimeManifest.files : [];
assert.ok(runtimeOrder.includes("src/runtime/080-assistant.js"), "Semantischer Assistant-Runtime-Dateiname fehlt");
assert.ok(!runtimeOrder.some(name => /preview|phase|v17/i.test(name)), "Historischer Runtime-Dateiname in order.json");
assert.ok(!exists("src/runtime/080-v18-billing-assistant-preview.js"), "Historische Preview-Runtime ist noch vorhanden");
for (const name of fs.readdirSync(path.join(root, "src/runtime")).filter(name => name.endsWith(".js"))) {
  assert.ok(!/\bPhase\s+\d/i.test(read(`src/runtime/${name}`)), `Historischer Phasenkommentar in src/runtime/${name}`);
}

const runtime = read("src/ui/app-runtime.ts");
for (const dead of ["v17LedgerMonthKeys", "v17RentLedgerCard", "v17UtilitiesCard", "v17PaymentQualityCard", "v17WaterPlus", "v17Badge"]) {
  assert.ok(!runtime.includes(dead), `Historischer Runtime-Name bleibt bestehen: ${dead}`);
}
assert.ok(runtime.includes("state.meta?.v17") || runtime.includes("s.meta?.v17"), "Persistierte utilityProfile-Kompatibilität über meta.v17 wurde versehentlich entfernt");
assert.ok(!/\bPhase\s+\d/i.test(runtime), "Historischer Phasenkommentar in app-runtime.ts");

const state = read("src/core/state.ts");
assert.ok(/\bv17\s*:/.test(state), "meta.v17 Initialisierung fehlt");
assert.ok(state.includes("state.meta?.v17"), "meta.v17 wird in normalizeState nicht erhalten");

const dbBridge = read("src/runtime/110-db.js");
for (const dead of ["listPortfolios", "listBuildings", "listUnitsByBuilding", "listTenanciesByBuilding", "listTenanciesByUnit", "getProjectionMeta", "getBuildingGraph"]) {
  assert.ok(!dbBridge.includes(dead), `Toter Repository-Runtime-Alias: ${dead}`);
}
const traceBridge = read("src/runtime/040-traceability.js");
for (const dead of ["commandResult", "safeCommandSummary"]) assert.ok(!traceBridge.includes(dead), `Toter Traceability-Runtime-Alias: ${dead}`);
assert.ok(!read("src/runtime/130-backup.js").includes("encodeBlobForBackup"), "Toter Backup-Runtime-Alias: encodeBlobForBackup");

const pkg = JSON.parse(read("package.json"));
const lock = JSON.parse(read("package-lock.json"));
assert.equal(pkg.name, "doppelhausverwaltung");
assert.equal(pkg.version, "18.0.0");
assert.equal(lock.name, pkg.name);
assert.equal(lock.version, pkg.version);
assert.equal(lock.packages?.[""]?.name, pkg.name);
assert.equal(lock.packages?.[""]?.version, pkg.version);
assert.ok(String(pkg.scripts?.["test:quality"] || "").includes("test:hygiene"), "CI-/Live-Quality-Gate bindet test:hygiene nicht ein");
assert.ok(read(".github/workflows/ci.yml").includes("npm run test:quality"), "CI ruft den Quality-/Hygiene-Gate nicht auf");
assert.ok(read(".github/workflows/e2e-live.yml").includes("npm run test:quality"), "Live-E2E ruft den Quality-/Hygiene-Gate nicht auf");
assert.ok(exists("src/domain/year-archive.ts") && exists("scripts/test-year-archive.mjs"), "Architecture-H1-Archivvertrag fehlt");
assert.ok(read("index.html").includes('id="appVersionBadge"'), "Semantische Versionsbadge-ID fehlt");
assert.ok(!read("index.html").includes("v17Badge"), "Historische Versionsbadge-ID bleibt bestehen");
console.log(`Repository-Hygiene bestanden: ${workflows.length} dauerhafte Workflows, semantische Runtime-/Testnamen, Paket ${pkg.name}@${pkg.version}, meta.v17 bewusst geschützt.`);
