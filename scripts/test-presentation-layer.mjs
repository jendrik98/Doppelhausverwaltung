import assert from "node:assert/strict";
import { build } from "esbuild";

const compiled = await build({
  entryPoints: ["src/presentation/index.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  target: "node22",
  logLevel: "silent"
});
const source = compiled.outputFiles[0].text;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const presentation = await import(moduleUrl);

function fixture() {
  return {
    schemaVersion: 15,
    meta: { primaryPortfolioId: "portfolio-1", primaryBuildingId: "building-a", revision: 7, commandLog: [] },
    property: { name: "Haus A", address: "A-Straße 1", totalArea: 180, year: "1990" },
    finance: { repayment: 900, fixed: 20 },
    correspondence: { landlordName: "Vermieter" },
    portfolios: [{ id: "portfolio-1", name: "Privatbestand", kind: "private" }],
    buildings: [
      { id: "building-a", portfolioId: "portfolio-1", name: "Haus A", address: "A-Straße 1", totalArea: 180, year: "1990" },
      { id: "building-b", portfolioId: "portfolio-1", name: "Haus B", address: "B-Straße 2", totalArea: 210, year: "2001", finance: { repayment: 700, fixed: 12 } }
    ],
    units: [
      { id: "unit-a", buildingId: "building-a", name: "Wohnung A", type: "rental" },
      { id: "unit-b", buildingId: "building-b", name: "Wohnung B", type: "rental" }
    ],
    leases: [
      { id: "lease-a", unitId: "unit-a", buildingId: "building-a", rent: 700 },
      { id: "lease-b", unitId: "unit-b", buildingId: "building-b", rent: 800 }
    ],
    sources: [
      { id: "source-a", buildingId: "building-a", name: "Quelle A" },
      { id: "source-b", buildingId: "building-b", name: "Quelle B" }
    ],
    costPositions: [
      { id: "position-a", buildingId: "building-a", sourceId: "source-a", label: "A", amount: 100, confirmed: true },
      { id: "position-b", buildingId: "building-b", sourceId: "source-b", label: "B", amount: 200, confirmed: true }
    ],
    meters: [
      { id: "meter-a", buildingId: "building-a" },
      { id: "meter-b", buildingId: "building-b" }
    ],
    waterSettlements: [],
    tasks: [
      { id: "task-a", buildingId: "building-a", title: "A", due: "2026-10-01" },
      { id: "task-b", buildingId: "building-b", title: "B", due: "2026-10-02" }
    ],
    payments: [
      { id: "payment-a", buildingId: "building-a", amount: 10 },
      { id: "payment-b", buildingId: "building-b", amount: 20 }
    ],
    billingWorkflows: [],
    billingSnapshots: [],
    containers: [],
    water: [],
    audit: [],
    documentsCache: [{ id: "cached-a", buildingId: "building-a", label: "Nur Dokument A" }]
  };
}

const state = fixture();
assert.equal(presentation.PRESENTATION_VERSION, 1);
assert.equal(presentation.parseRouteHash("#data/property").route, "data");
assert.equal(presentation.parseRouteHash("#data/property").sub, "property");
assert.equal(presentation.routeHash("rental", "water"), "#rental/water");

const workspace = presentation.createPresentationWorkspace(state, "building-b");
assert.equal(workspace.showBuildingSelector, true);
assert.equal(workspace.activeBuildingId, "building-b");
assert.equal(workspace.activeBuildingName, "Haus B");
assert.equal(workspace.counts.units, 1);
assert.equal(workspace.counts.tenancies, 1);
assert.equal(workspace.counts.payments, 1);

const scopedB = presentation.projectStateForBuilding(state, "building-b");
assert.equal(scopedB.meta.primaryBuildingId, "building-b");
assert.equal(scopedB.meta.presentationBuildingId, "building-b");
assert.equal(scopedB.property.name, "Haus B");
assert.equal(scopedB.finance.repayment, 700);
assert.deepEqual(scopedB.units.map((item) => item.id), ["unit-b"]);
assert.deepEqual(scopedB.leases.map((item) => item.id), ["lease-b"]);
assert.deepEqual(scopedB.payments.map((item) => item.id), ["payment-b"]);
assert.deepEqual(scopedB.documentsCache, [], "Dokumentcache darf nicht gebäudeübergreifend projiziert werden");

scopedB.property.name = "Haus B neu";
scopedB.finance.repayment = 710;
scopedB.payments.push({ id: "payment-b-new", amount: 33 });
const merged = presentation.mergeStateFromBuilding(state, scopedB, "building-b");

assert.equal(merged.meta.primaryBuildingId, "building-a");
assert.equal(merged.property.name, "Haus A");
assert.equal(merged.finance.repayment, 900);
assert.equal(merged.buildings.find((item) => item.id === "building-b").name, "Haus B neu");
assert.equal(merged.buildings.find((item) => item.id === "building-b").finance.repayment, 710);
assert.equal(merged.payments.find((item) => item.id === "payment-a").amount, 10);
assert.equal(merged.payments.find((item) => item.id === "payment-b").amount, 20);
assert.equal(merged.payments.find((item) => item.id === "payment-b-new").buildingId, "building-b");
assert.deepEqual(merged.documentsCache, [], "Transienter Dokumentcache darf nicht in den Portfolio-State zurückgeschrieben werden");

const scopedAAfter = presentation.projectStateForBuilding(merged, "building-a");
const scopedBAfter = presentation.projectStateForBuilding(merged, "building-b");
assert.equal(scopedAAfter.payments.some((item) => item.id === "payment-b-new"), false);
assert.equal(scopedBAfter.payments.some((item) => item.id === "payment-b-new"), true);

const single = fixture();
single.buildings = [single.buildings[0]];
single.units = [single.units[0]];
single.leases = [single.leases[0]];
assert.equal(presentation.createPresentationWorkspace(single).showBuildingSelector, false);

console.log("Presentation-Layer D: Routing, Gebäudeprojektion, Merge und Ein-/Mehrgebäude-UX bestanden.");
