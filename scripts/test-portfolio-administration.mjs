import assert from "node:assert/strict";
import { build } from "esbuild";

async function load(entry) {
  const compiled = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    target: "node22",
    logLevel: "silent"
  });
  const source = compiled.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

const application = await load("src/application/index.ts");
const presentation = await load("src/presentation/index.ts");

function fixture() {
  return {
    schemaVersion: 15,
    meta: { primaryPortfolioId: "portfolio-1", primaryBuildingId: "building-a", revision: 4 },
    property: { name: "Haus A", address: "A-Straße 1", totalArea: 180, year: 1990 },
    finance: { repayment: 900, fixed: 20 },
    portfolios: [{ id: "portfolio-1", name: "Privatbestand", kind: "private" }],
    buildings: [{ id: "building-a", portfolioId: "portfolio-1", name: "Haus A", address: "A-Straße 1", totalArea: 180, year: 1990, finance: { repayment: 900, fixed: 20 } }],
    units: [{ id: "unit-a", buildingId: "building-a", name: "Wohnung A", type: "rental", area: 80 }],
    leases: [{ id: "lease-a", unitId: "unit-a", buildingId: "building-a", rent: 700 }],
    meters: [], sources: [], costPositions: [], tasks: [], payments: [], waterSettlements: [], billingWorkflows: [], billingSnapshots: [], containers: [], water: []
  };
}

const original = fixture();
const created = application.createBuildingInPortfolio(original, "building-b", {
  name: "Haus B",
  address: "B-Straße 2",
  totalArea: 210,
  year: 2001,
  billingTakeoverDate: "2026-07-01",
  predecessorBillingEnd: "2026-06-30",
  repayment: 700,
  fixed: 12
});

assert.equal(application.PORTFOLIO_ADMIN_VERSION, 1);
assert.equal(original.buildings.length, 1, "Use-Case darf Eingabe-State nicht mutieren");
assert.equal(created.buildings.length, 2);
assert.equal(created.meta.primaryBuildingId, "building-a", "Anlegen darf das Primärgebäude nicht umdefinieren");
assert.equal(created.property.name, "Haus A", "Kompatibilitäts-property bleibt beim Primärgebäude");
assert.equal(created.buildings.find((item) => item.id === "building-b").portfolioId, "portfolio-1");
assert.equal(created.buildings.find((item) => item.id === "building-b").finance.repayment, 700);

const model = presentation.createPortfolioAdministrationModel(created, "building-b");
assert.equal(presentation.PORTFOLIO_ADMIN_PRESENTATION_VERSION, 1);
assert.equal(model.buildings.length, 2);
assert.equal(model.buildings.find((item) => item.id === "building-a").primary, true);
assert.equal(model.buildings.find((item) => item.id === "building-b").active, true);
assert.equal(model.buildings.find((item) => item.id === "building-a").counts.units, 1);
assert.equal(model.buildings.find((item) => item.id === "building-b").counts.units, 0);

const updatedB = application.updateBuildingInPortfolio(created, "building-b", {
  name: "Haus B neu", address: "B-Straße 3", totalArea: 220, year: 2002, repayment: 710, fixed: 15
});
assert.equal(updatedB.buildings.find((item) => item.id === "building-b").name, "Haus B neu");
assert.equal(updatedB.property.name, "Haus A", "Bearbeiten eines Nebenobjekts darf property nicht verschieben");
assert.equal(updatedB.meta.primaryBuildingId, "building-a");

const updatedA = application.updateBuildingInPortfolio(updatedB, "building-a", {
  name: "Haus A neu", address: "A-Straße 9", totalArea: 185, year: 1991, repayment: 905, fixed: 25
});
assert.equal(updatedA.property.name, "Haus A neu", "Primärgebäude muss die Kompatibilitätsprojektion synchronisieren");
assert.equal(updatedA.finance.repayment, 905);
assert.equal(updatedA.meta.primaryBuildingId, "building-a");

assert.throws(() => application.createBuildingInPortfolio(created, "building-c", { name: "", totalArea: 100 }), /Gebäudename/);
assert.throws(() => application.createBuildingInPortfolio(created, "building-c", { name: "Haus C", totalArea: -1 }), /Wohnfläche/);
assert.throws(() => application.updateBuildingInPortfolio(created, "missing", { name: "X", totalArea: 10 }), /nicht gefunden/);

console.log("Portfolio-Administration E: Anlegen, Bearbeiten, Primärschutz und Presentation-Modell bestanden.");
