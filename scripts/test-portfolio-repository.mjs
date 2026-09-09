import assert from "node:assert/strict";
import { build } from "esbuild";

const compiled = await build({
  entryPoints: ["src/infrastructure/portfolio-repository.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  target: "node22",
  logLevel: "silent"
});
const source = compiled.outputFiles[0].text;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const repository = await import(moduleUrl);

const state = {
  schemaVersion: 15,
  meta: { revision: 7, portfolioModelVersion: 2 },
  portfolios: [{ id: "portfolio-1", name: "Bestand" }],
  buildings: [
    { id: "building-a", portfolioId: "portfolio-1", name: "Haus A" },
    { id: "building-b", portfolioId: "portfolio-1", name: "Haus B" }
  ],
  units: [
    { id: "unit-a1", buildingId: "building-a", type: "rental" },
    { id: "unit-a2", buildingId: "building-a", type: "owner" },
    { id: "unit-b1", buildingId: "building-b", type: "rental" }
  ],
  leases: [
    { id: "lease-a", buildingId: "building-a", unitId: "unit-a1" },
    { id: "lease-b", buildingId: "building-b", unitId: "unit-b1" }
  ]
};

const projection = repository.projectPortfolioState(state);
assert.equal(projection.portfolios.length, 1);
assert.equal(projection.buildings.length, 2);
assert.equal(projection.units.filter((unit) => unit.buildingId === "building-a").length, 2);
assert.equal(projection.units.filter((unit) => unit.buildingId === "building-b").length, 1);
assert.equal(projection.tenancies.filter((lease) => lease.buildingId === "building-a").length, 1);
assert.equal(projection.tenancies.filter((lease) => lease.buildingId === "building-b").length, 1);
assert.deepEqual(repository.validatePortfolioProjection(projection), []);

const roundTrip = JSON.parse(JSON.stringify(state));
assert.deepEqual(repository.projectPortfolioState(roundTrip), projection, "Backup-/JSON-Roundtrip muss die Projektion erhalten");

const broken = repository.projectPortfolioState({
  ...state,
  leases: [{ id: "lease-broken", buildingId: "building-b", unitId: "unit-a1" }]
});
assert.ok(repository.validatePortfolioProjection(broken).some((entry) => entry.includes("inkonsistent")));

console.log("Portfolio-Repository B2: Projektion, Gebäudeisolation und JSON-Roundtrip bestanden.");
