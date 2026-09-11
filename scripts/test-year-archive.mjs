import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = process.cwd();
const entry = path.join(root, "src/domain/year-archive.ts");
assert.ok(fs.existsSync(entry), "src/domain/year-archive.ts fehlt");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "year-archive-"));
const outfile = path.join(dir, "year-archive.mjs");
await build({entryPoints:[entry], bundle:true, format:"esm", platform:"node", target:"node22", outfile, logLevel:"silent"});
const H = await import(pathToFileURL(outfile).href + "?" + Date.now());

const state = {
  meta:{primaryBuildingId:"building-1"},
  sources:[
    {id:"source-1",sourceDocumentId:"doc-1"},
    {id:"source-2",sourceDocumentId:"doc-2"},
  ],
  costPositions:[
    {id:"position-1",sourceId:"source-1",label:"Versicherung",category:"insurance",amount:1200,serviceStart:"2026-01-01",serviceEnd:"2026-12-31",confirmed:true,provenance:{documentId:"doc-1"}},
    {id:"position-2",sourceId:"source-2",label:"Grundsteuer",category:"propertyTax",amount:600,serviceStart:"2026-01-01",serviceEnd:"2026-12-31",confirmed:true},
  ],
  payments:[
    {id:"payment-1",date:"2027-03-15",direction:"outflow",amount:1200,label:"Versicherung 2026",positionId:"position-1",sourceId:"source-1"},
    {id:"payment-candidate",date:"2026-09-15",direction:"outflow",amount:600,label:"Grundsteuer",sourceId:"source-2"},
  ],
  billingSnapshots:[{
    id:"snapshot-1",buildingId:"building-1",leaseId:"lease-1",periodYear:2026,version:1,integrityHash:"a".repeat(64),createdAt:"2027-03-20T10:00:00Z",
    events:[{id:"event-1",positionId:"position-1",label:"Versicherung",amount:1200,tenantAmount:600},{id:"event-2",positionId:"position-2",label:"Grundsteuer",amount:600,tenantAmount:300}],
  }],
};
const documents = [
  {id:"doc-1",label:"Versicherung 2026",created:"2026-11-01T10:00:00Z",type:"application/pdf",size:1234,blob:{mustNotLeak:true},pages:[{base64:"secret"}]},
  {id:"doc-2",label:"Grundsteuer 2026",created:"2026-02-01T10:00:00Z",type:"application/pdf",size:800,pageData:[{base64:"secret"}]},
];
const beforeState = JSON.stringify(state);
const beforeDocs = JSON.stringify(documents);

const chains = H.buildEvidenceChains(state, documents, 2026);
assert.equal(chains.length, 2);
const complete = chains.find(x => x.position.id === "position-1");
assert.equal(complete.status, "complete");
assert.equal(complete.document.id, "doc-1");
assert.equal(complete.payments[0].id, "payment-1", "Direkte Zahlung darf auch im Folgejahr als Nachweis der Jahreskosten verknüpft werden");
assert.equal(complete.billingSnapshots[0].id, "snapshot-1");

const gap = chains.find(x => x.position.id === "position-2");
assert.equal(gap.status, "gap");
assert.ok(gap.missing.includes("payment"), "Nur eine explizite payment.positionId schließt die Zahlungslücke");
assert.equal(gap.candidatePayments.length, 1, "Quellgleiche Zahlung wird nur als Kandidat ausgewiesen");

const archive = H.buildYearArchive(state, documents, 2026);
assert.equal(archive.status, "review");
assert.deepEqual(archive.summary, {chains:2,completeChains:1,gaps:1,documents:2,payments:2,snapshots:1,unlinkedOutflows:1,unlinkedDocuments:0});
const exported = H.createYearArchiveExport(state, documents, 2026, "2027-03-21T10:00:00Z");
assert.equal(exported.schema, "doppelhaus-year-archive-v1");
const json = JSON.stringify(exported);
for (const forbidden of ["mustNotLeak","pageData","base64","secret"]) assert.ok(!json.includes(forbidden), `Archivexport enthält Binär-/Seitendaten: ${forbidden}`);
assert.equal(JSON.stringify(state), beforeState, "H1 darf State nicht mutieren");
assert.equal(JSON.stringify(documents), beforeDocs, "H1 darf Dokumentobjekte nicht mutieren");
console.log("Architecture H1 Jahresarchiv bestanden: explizite Dokument→Kosten→Zahlung→Abrechnung-Ketten, Lückenprüfung und JSON-sicherer Export.");
