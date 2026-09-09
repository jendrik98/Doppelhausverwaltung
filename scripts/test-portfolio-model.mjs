import assert from "node:assert/strict";
import { build } from "esbuild";

const compiled = await build({
  entryPoints: ["src/domain/portfolio-model.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  target: "node22",
  logLevel: "silent"
});
const source = compiled.outputFiles[0].text;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const model = await import(moduleUrl);

const legacy = {
  meta: { createdAt: "2026-01-01T00:00:00.000Z" },
  property: { name: "Doppelhaus", address: "Musterweg 1", totalArea: 200, year: "1990" },
  units: [
    { id: "unit-owner", name: "Eigennutzung", type: "owner", area: 100 },
    { id: "unit-rental", name: "Mietwohnung", type: "rental", area: 100 }
  ],
  leases: [{ id: "lease-1", start: "2026-01-01", rent: 900, advance: 150 }],
  meters: [
    { id: "meter-main", role: "mainWater", readings: [] },
    { id: "meter-owner", role: "ownerWater", readings: [] }
  ],
  sources: [{ id: "source-1" }],
  costPositions: [{ id: "position-1" }],
  tasks: [{ id: "task-1" }],
  payments: [{ id: "payment-1" }],
  waterSettlements: [],
  billingWorkflows: [],
  billingSnapshots: [],
  containers: []
};

model.ensurePortfolioModel(legacy);
assert.equal(legacy.meta.portfolioModelVersion, 1);
assert.equal(legacy.meta.primaryPortfolioId, "portfolio-main");
assert.equal(legacy.meta.primaryBuildingId, "building-main");
assert.equal(legacy.portfolios.length, 1);
assert.equal(legacy.buildings.length, 1);
assert.equal(legacy.buildings[0].name, "Doppelhaus");
assert.equal(legacy.buildings[0].address, "Musterweg 1");
assert.equal(legacy.units[0].buildingId, "building-main");
assert.equal(legacy.units[1].buildingId, "building-main");
assert.equal(legacy.leases[0].unitId, "unit-rental");
assert.equal(legacy.leases[0].buildingId, "building-main");
assert.equal(legacy.meters[0].buildingId, "building-main");
assert.equal(legacy.meters[1].unitId, "unit-owner");
assert.equal(legacy.sources[0].buildingId, "building-main");
assert.equal(legacy.costPositions[0].buildingId, "building-main");
assert.equal(legacy.tasks[0].buildingId, "building-main");
assert.equal(legacy.payments[0].buildingId, "building-main");
assert.deepEqual(model.validatePortfolioModel(legacy).errors, []);
assert.deepEqual(model.portfolioSummary(legacy), {
  portfolios: 1,
  buildings: 1,
  units: 2,
  tenancies: 1,
  primaryPortfolioId: "portfolio-main",
  primaryBuildingId: "building-main"
});

const once = JSON.stringify(legacy);
model.ensurePortfolioModel(legacy);
assert.equal(JSON.stringify(legacy), once, "B1-Migration muss idempotent sein");

const multi = {
  meta: { primaryPortfolioId: "portfolio-1", primaryBuildingId: "building-2" },
  property: { name: "Primärgebäude", address: "Neue Straße 2", totalArea: 180 },
  portfolios: [{ id: "portfolio-1", name: "Bestand", kind: "private" }],
  buildings: [
    { id: "building-1", portfolioId: "portfolio-1", name: "Altbau" },
    { id: "building-2", portfolioId: "portfolio-1", name: "Vor Migration" }
  ],
  units: [
    { id: "unit-1", buildingId: "building-1", type: "rental" },
    { id: "unit-2", buildingId: "building-2", type: "rental" }
  ],
  leases: [{ id: "lease-2", unitId: "unit-1" }],
  meters: [], sources: [], costPositions: [], tasks: [], payments: [],
  waterSettlements: [], billingWorkflows: [], billingSnapshots: [], containers: []
};
model.ensurePortfolioModel(multi);
assert.equal(multi.units[0].buildingId, "building-1", "gültige Mehrgebäude-Zuordnung darf nicht überschrieben werden");
assert.equal(multi.leases[0].unitId, "unit-1", "gültige Mietverhältnis-Zuordnung darf nicht überschrieben werden");
assert.equal(multi.buildings[1].name, "Primärgebäude", "Legacy-property spiegelt nur das primäre Gebäude");
assert.deepEqual(model.validatePortfolioModel(multi).errors, []);

const missingIds = {
  meta: {}, property: {}, portfolios: [], buildings: [],
  units: [{ type: "owner" }, { type: "rental" }], leases: [{ start: "2026-01-01" }],
  meters: [], sources: [], costPositions: [], tasks: [], payments: [],
  waterSettlements: [], billingWorkflows: [], billingSnapshots: [], containers: []
};
model.ensurePortfolioModel(missingIds);
assert.ok(missingIds.units.every((unit) => unit.id));
assert.ok(missingIds.leases.every((lease) => lease.id));
assert.equal(missingIds.leases[0].unitId, missingIds.units[1].id);

const broken = {
  meta: { primaryPortfolioId: "missing", primaryBuildingId: "missing" },
  portfolios: [{ id: "portfolio-x" }],
  buildings: [{ id: "building-x", portfolioId: "missing" }],
  units: [{ id: "unit-x", buildingId: "missing" }],
  leases: [{ id: "lease-x", unitId: "missing", buildingId: "missing" }]
};
const brokenResult = model.validatePortfolioModel(broken);
assert.ok(brokenResult.errors.length >= 4, "ungültige Referenzen müssen erkannt werden");

console.log("Portfolio-Modell B1: Migration, Idempotenz und Referenzintegrität bestanden.");
