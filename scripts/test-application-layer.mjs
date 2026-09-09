import assert from "node:assert/strict";
import fs from "node:fs";
import { build } from "esbuild";

const compiled = await build({
  entryPoints: ["src/application/index.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  target: "node22",
  logLevel: "silent"
});
const source = compiled.outputFiles[0].text;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const app = await import(moduleUrl);

function clone(value) { return structuredClone(value); }

function stateFixture() {
  return {
    schemaVersion: 15,
    meta: {
      revision: 4,
      primaryPortfolioId: "portfolio-1",
      primaryBuildingId: "building-a",
      commandLog: []
    },
    property: { name: "Haus A" },
    portfolios: [{ id: "portfolio-1", name: "Bestand", kind: "private" }],
    buildings: [
      { id: "building-a", portfolioId: "portfolio-1", name: "Haus A" },
      { id: "building-b", portfolioId: "portfolio-1", name: "Haus B" }
    ],
    units: [
      { id: "unit-a", buildingId: "building-a", name: "Wohnung A", type: "rental" },
      { id: "unit-b", buildingId: "building-b", name: "Wohnung B", type: "rental" }
    ],
    leases: [
      { id: "lease-a", unitId: "unit-a", buildingId: "building-a", tenantName: "A" },
      { id: "lease-b", unitId: "unit-b", buildingId: "building-b", tenantName: "B" }
    ],
    sources: [
      { id: "source-a", buildingId: "building-a", name: "Versorger A", dueDates: ["2026-10-01"] },
      { id: "source-b", buildingId: "building-b", name: "Versorger B", dueDates: ["2026-10-02"] }
    ],
    costPositions: [
      { id: "position-a", buildingId: "building-a", sourceId: "source-a", label: "Kosten A", amount: 100, confirmed: true },
      { id: "position-b", buildingId: "building-b", sourceId: "source-b", label: "Kosten B", amount: 200, confirmed: true }
    ],
    meters: [
      { id: "meter-a", buildingId: "building-a", name: "Zähler A" },
      { id: "meter-b", buildingId: "building-b", name: "Zähler B" }
    ],
    waterSettlements: [
      { id: "water-a", buildingId: "building-a", periodYear: 2025 },
      { id: "water-b", buildingId: "building-b", periodYear: 2025 }
    ],
    tasks: [
      { id: "task-a", buildingId: "building-a", title: "Aufgabe A", due: "2026-11-01", lead: 14 },
      { id: "task-b", buildingId: "building-b", title: "Aufgabe B", due: "2026-11-02", lead: 14 }
    ],
    payments: [
      { id: "payment-a", buildingId: "building-a", positionId: "position-a", date: "2026-01-01", direction: "outflow", amount: 25, label: "A" },
      { id: "payment-b", buildingId: "building-b", positionId: "position-b", date: "2026-01-02", direction: "outflow", amount: 50, label: "B" }
    ],
    billingWorkflows: [
      { id: "workflow-a", buildingId: "building-a", periodYear: 2025 },
      { id: "workflow-b", buildingId: "building-b", periodYear: 2025 }
    ],
    billingSnapshots: [],
    containers: [
      { id: "container-a", buildingId: "building-a" },
      { id: "container-b", buildingId: "building-b" }
    ],
    water: [
      { id: "water-row-a", buildingId: "building-a" },
      { id: "water-row-b", buildingId: "building-b" }
    ],
    finance: {}, audit: []
  };
}

const state = stateFixture();
assert.equal(app.APPLICATION_VERSION, 1);

const contextB = app.resolveApplicationContext(state, "payment.update", { paymentId: "payment-b" });
assert.equal(contextB.portfolioId, "portfolio-1");
assert.equal(contextB.buildingId, "building-b");
assert.equal(contextB.unitId, "");

const workspaceB = app.queryBuildingWorkspace(state, { buildingId: "building-b" });
for (const key of ["units", "tenancies", "sources", "costPositions", "meters", "waterSettlements", "tasks", "payments", "billingWorkflows", "containers", "water"]) {
  assert.ok(workspaceB[key].length > 0, `${key} für building-b fehlt`);
  assert.ok(workspaceB[key].every((item) => item.buildingId === "building-b"), `${key} enthält Fremdgebäude`);
}
assert.equal(workspaceB.building.id, "building-b");
assert.equal(workspaceB.units.some((item) => item.id === "unit-a"), false);

const navigation = app.portfolioNavigation(state);
assert.equal(navigation.buildings.length, 2);
assert.equal(navigation.showBuildingSelector, true);
const single = clone(state); single.buildings = [single.buildings[0]];
assert.equal(app.portfolioNavigation(single).showBuildingSelector, false, "Ein-Gebäude-UX darf keinen Selector erzwingen");

const reconciliationA = app.reconciliationSummary(state, { buildingId: "building-a" });
const reconciliationB = app.reconciliationSummary(state, { buildingId: "building-b" });
assert.equal(reconciliationA.rows.length, 1);
assert.equal(reconciliationA.rows[0].position.id, "position-a");
assert.equal(reconciliationA.rows[0].paid, 25);
assert.equal(reconciliationA.rows[0].difference, 75);
assert.equal(reconciliationB.rows.length, 1);
assert.equal(reconciliationB.rows[0].position.id, "position-b");
assert.equal(reconciliationB.rows[0].paid, 50);
assert.equal(reconciliationB.rows[0].difference, 150);

const tasksB = app.queryTaskList(state, { buildingId: "building-b" }, "2026-09-09");
assert.ok(tasksB.some((item) => item.id === "task-b"));
assert.ok(tasksB.some((item) => item.id === "source-source-b-2026-10-02"));
assert.equal(tasksB.some((item) => item.id === "task-a"), false);
assert.equal(tasksB.some((item) => item.id === "source-source-a-2026-10-01"), false);
assert.ok(tasksB.every((item) => item.buildingId === "building-b"));

const takeoverState = stateFixture();
takeoverState.property.billingTakeoverDate = "2025-07-15";
takeoverState.buildings.find((item) => item.id === "building-a").billingTakeoverDate = "2025-07-15";
const takeoverTasks = app.queryTaskList(takeoverState, { buildingId: "building-a" }, "2026-09-09");
const billingTasks = takeoverTasks.filter((item) => item.origin === "billing");
assert.deepEqual(billingTasks.map((item) => item.periodYear), [2025], "Jahre vor Übernahme dürfen keine Abrechnungsaufgabe erzeugen");
assert.equal(billingTasks[0].title, "Endabrechnung 15.07.2025 – 31.12.2025 fertigstellen");
assert.equal(billingTasks[0].due, "2026-03-31");

let active = clone(state);
let stable = clone(state);
let persisted = 0;
const errors = [];
let restorePoints = 0;
let uidCounter = 0;
const bus = app.createCommandBus({
  getState: () => active,
  setState: (value) => { active = value; },
  getLastStableState: () => stable,
  setLastStableState: (value) => { stable = value; },
  cloneState: clone,
  repairState: (value) => value,
  validateState: () => ({ errors: [], warnings: [] }),
  persist: async () => { persisted += 1; active.meta.revision = Number(active.meta.revision || 0) + 1; stable = clone(active); return true; },
  recordError: (context, error) => errors.push(`${context}:${String(error?.message || error)}`),
  createRestorePoint: () => { restorePoints += 1; },
  uid: () => `command-${++uidCounter}`,
  now: () => "2026-09-09T12:00:00.000Z"
});

let result = await bus.executeCommand("payment.update", { paymentId: "payment-a" }, async () => {
  active.payments.find((item) => item.id === "payment-a").amount = 30;
}, { auditText: "Zahlung geändert", restorePoint: true });
assert.equal(result.ok, true);
assert.equal(active.payments.find((item) => item.id === "payment-a").amount, 30);
assert.equal(active.payments.find((item) => item.id === "payment-b").amount, 50);
assert.equal(active.meta.commandLog[0].context.buildingId, "building-a");
assert.equal(active.meta.commandLog[0].applicationVersion, 1);
assert.equal(restorePoints, 1);
assert.equal(persisted, 1);

const beforeForbidden = clone(active);
result = await bus.executeCommand("payment.update", { paymentId: "payment-a" }, async () => {
  active.payments.find((item) => item.id === "payment-b").amount = 999;
});
assert.equal(result.ok, false, "Cross-Building-Mutation muss blockiert werden");
assert.equal(active.payments.find((item) => item.id === "payment-b").amount, beforeForbidden.payments.find((item) => item.id === "payment-b").amount);
assert.ok(errors.some((entry) => entry.includes("Application-Scope")));

const beforeDelete = clone(active);
result = await bus.executeCommand("payment.update", { paymentId: "payment-a" }, async () => {
  active.tasks = active.tasks.filter((item) => item.id !== "task-b");
});
assert.equal(result.ok, false, "Cross-Building-Löschung muss blockiert werden");
assert.deepEqual(active.tasks, beforeDelete.tasks);

result = await bus.executeCommand("payment.update", { paymentId: "payment-b" }, async () => {
  active.payments.find((item) => item.id === "payment-b").amount = 55;
});
assert.equal(result.ok, true);
assert.equal(active.payments.find((item) => item.id === "payment-b").amount, 55);
assert.equal(active.meta.commandLog[0].context.buildingId, "building-b");

let lifecycleSaved = 0;
const lifecycleExisting = await app.loadApplicationState({
  readStateRecord: async () => ({ data: stateFixture() }),
  saveState: async () => { lifecycleSaved += 1; },
  createEmptyState: () => ({ shouldNot: "run" }),
  repairState: (value) => ({ ...value, meta: { ...value.meta, repaired: true } }),
  validateState: () => ({ errors: [], warnings: [] })
});
assert.equal(lifecycleExisting.created, false);
assert.equal(lifecycleExisting.state.meta.repaired, true);
assert.equal(lifecycleExisting.context.buildingId, "building-a");
assert.equal(lifecycleSaved, 1);

const freshState = stateFixture(); freshState.meta.primaryBuildingId = "building-b";
const lifecycleFresh = await app.loadApplicationState({
  readStateRecord: async () => null,
  saveState: async () => { lifecycleSaved += 1; },
  createEmptyState: () => freshState,
  repairState: (value) => value,
  validateState: () => ({ errors: [], warnings: [] })
});
assert.equal(lifecycleFresh.created, true);
assert.equal(lifecycleFresh.context.buildingId, "building-b");
assert.equal(lifecycleSaved, 2);

await assert.rejects(() => app.loadApplicationState({
  readStateRecord: async () => ({ data: stateFixture() }),
  saveState: async () => { throw new Error("darf nicht speichern"); },
  createEmptyState: () => stateFixture(),
  repairState: (value) => value,
  validateState: () => ({ errors: ["kaputt"], warnings: [] })
}), /Application-Start: kaputt/);

const buildScript = fs.readFileSync("scripts/build-app.mjs", "utf8");
const traceRuntime = fs.readFileSync("src/runtime/040-traceability.js", "utf8");
const dbRuntime = fs.readFileSync("src/runtime/110-db.js", "utf8");
const integrityRuntime = fs.readFileSync("src/runtime/030-integrity.js", "utf8");
const traceability = fs.readFileSync("src/core/traceability.ts", "utf8");
assert.ok(buildScript.includes('compileModule("src/application/index.ts", "AppApplication")'), "Application-Bundle fehlt");
assert.ok(traceRuntime.includes("AppApplication.createCommandBus"), "Runtime nutzt den Application-Command-Bus nicht");
assert.ok(traceRuntime.includes("applicationExecuteCommand"), "Kompatibilitätsdelegation fehlt");
assert.ok(dbRuntime.includes("loadApplicationState"), "App-Start läuft nicht über Application-Lifecycle");
assert.ok(integrityRuntime.includes("AppApplication"), "Gebäudeisolierte Application-Query ist nicht verdrahtet");
assert.ok(traceability.includes("return applicationExecuteCommand"), "Core executeCommand delegiert nicht");
assert.equal(traceability.includes("state.meta.commandLog.unshift({"), false, "Command-Orchestrierung steckt noch im Core");

console.log("Application-Layer C: Lifecycle, Commands, Gebäude-Scope, Queries und Runtime-Verdrahtung bestanden.");
