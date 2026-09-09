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
  costPositions: [{ id: "position-1", sourceId: "source-1" }],
  tasks: [{ id: "task-1" }],
  payments: [{ id: "payment-1", positionId: "position-1" }],
  waterSettlements: [], billingWorkflows: [], billingSnapshots: [], containers: [], water: []
};
model.ensurePortfolioModel(legacy);
assert.equal(legacy.meta.portfolioModelVersion, 2);
assert.equal(legacy.meta.primaryPortfolioId, "portfolio-main");
assert.equal(legacy.meta.primaryBuildingId, "building-main");
assert.equal(legacy.units[0].buildingId, "building-main");
assert.equal(legacy.units[1].buildingId, "building-main");
assert.equal(legacy.leases[0].unitId, "unit-rental");
assert.equal(legacy.leases[0].buildingId, "building-main");
assert.equal(legacy.meters[1].unitId, "unit-owner");
assert.equal(legacy.costPositions[0].buildingId, "building-main");
assert.equal(legacy.payments[0].buildingId, "building-main");
assert.deepEqual(model.validatePortfolioModel(legacy).errors, []);
const once = JSON.stringify(legacy);
model.ensurePortfolioModel(legacy);
assert.equal(JSON.stringify(legacy), once, "B2-Migration muss idempotent sein");

const multi = {
  meta: { primaryPortfolioId: "portfolio-1", primaryBuildingId: "building-a" },
  property: { name: "Haus A", address: "A-Straße 1", totalArea: 180 },
  portfolios: [{ id: "portfolio-1", name: "Bestand", kind: "private" }],
  buildings: [
    { id: "building-a", portfolioId: "portfolio-1", name: "Alt A" },
    { id: "building-b", portfolioId: "portfolio-1", name: "Haus B" }
  ],
  units: [
    { id: "unit-a", buildingId: "building-a", type: "rental" },
    { id: "unit-b", buildingId: "building-b", type: "rental" }
  ],
  leases: [
    { id: "lease-a", unitId: "unit-a", buildingId: "building-a" },
    { id: "lease-b", unitId: "unit-b", buildingId: "building-b" }
  ],
  sources: [
    { id: "source-a", buildingId: "building-a" },
    { id: "source-b", buildingId: "building-b" }
  ],
  costPositions: [
    { id: "position-a", sourceId: "source-a", buildingId: "building-a" },
    { id: "position-b", sourceId: "source-b", buildingId: "building-b" }
  ],
  payments: [
    { id: "payment-a", positionId: "position-a" },
    { id: "payment-b", positionId: "position-b" }
  ],
  meters: [], tasks: [], waterSettlements: [], billingWorkflows: [], billingSnapshots: [], containers: [], water: []
};
model.ensurePortfolioModel(multi);
assert.equal(multi.payments[0].buildingId, "building-a");
assert.equal(multi.payments[1].buildingId, "building-b");
assert.equal(multi.buildings[0].name, "Haus A", "property spiegelt nur das primäre Gebäude");
assert.equal(multi.buildings[1].name, "Haus B", "sekundäres Gebäude darf nicht überschrieben werden");
assert.deepEqual(model.validatePortfolioModel(multi).errors, []);

const conflict = JSON.parse(JSON.stringify(multi));
conflict.payments[1].buildingId = "building-a";
assert.ok(model.validatePortfolioModel(conflict).errors.some((entry) => entry.includes("anderem Gebäude")));

const missingIds = {
  meta: {}, property: {}, portfolios: [], buildings: [],
  units: [{ type: "owner" }, { type: "rental" }], leases: [{ start: "2026-01-01" }],
  meters: [], sources: [], costPositions: [], tasks: [], payments: [], waterSettlements: [],
  billingWorkflows: [], billingSnapshots: [], containers: [], water: []
};
model.ensurePortfolioModel(missingIds);
assert.ok(missingIds.units.every((unit) => unit.id));
assert.ok(missingIds.leases.every((lease) => lease.id));
assert.equal(missingIds.leases[0].unitId, missingIds.units[1].id);
assert.deepEqual(model.validatePortfolioModel(missingIds).errors, []);

console.log("Portfolio-Modell B2: Migration, Idempotenz und Mehrgebäude-Referenzintegrität bestanden.");
