import type { AnyRecord, ApplicationContext } from "./contracts";

const BUILDING_SCOPED_COLLECTIONS = [
  "units",
  "leases",
  "sources",
  "costPositions",
  "meters",
  "waterSettlements",
  "tasks",
  "payments",
  "billingWorkflows",
  "billingSnapshots",
  "containers",
  "water"
] as const;

function records(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter((item): item is AnyRecord => !!item && typeof item === "object") : [];
}

function byId(state: AnyRecord, collection: string, id: unknown): AnyRecord | null {
  if (!id) return null;
  const key = String(id);
  return records(state?.[collection]).find((item) => String(item.id || "") === key) || null;
}

function recordBuildingId(state: AnyRecord, collection: string, id: unknown): string {
  return String(byId(state, collection, id)?.buildingId || "");
}

function inferBuildingFromPayload(state: AnyRecord, type: string, payload: AnyRecord): string {
  if (payload.buildingId) return String(payload.buildingId);

  const directRefs: Array<[string, string]> = [
    ["unitId", "units"],
    ["tenancyId", "leases"],
    ["leaseId", "leases"],
    ["sourceId", "sources"],
    ["positionId", "costPositions"],
    ["meterId", "meters"],
    ["paymentId", "payments"]
  ];
  for (const [key, collection] of directRefs) {
    const buildingId = recordBuildingId(state, collection, payload[key]);
    if (buildingId) return buildingId;
  }

  if (payload.id) {
    const typeCollection = type.startsWith("unit.") ? "units"
      : type.startsWith("tenancy.") || type.startsWith("lease.") ? "leases"
      : type.startsWith("source.") ? "sources"
      : type.startsWith("costPosition.") ? "costPositions"
      : type.startsWith("meter.") ? "meters"
      : type.startsWith("payment.") ? "payments"
      : "";
    if (typeCollection) {
      const buildingId = recordBuildingId(state, typeCollection, payload.id);
      if (buildingId) return buildingId;
    }
  }
  return "";
}

export function resolveApplicationContext(
  state: AnyRecord,
  type = "",
  payload: AnyRecord = {}
): ApplicationContext {
  const buildings = records(state?.buildings);
  const units = records(state?.units);
  const leases = records(state?.leases);

  let buildingId = inferBuildingFromPayload(state, type, payload)
    || String(state?.meta?.primaryBuildingId || buildings[0]?.id || "");

  let unitId = String(payload.unitId || "");
  let tenancyId = String(payload.tenancyId || payload.leaseId || "");

  if (!unitId && tenancyId) unitId = String(byId(state, "leases", tenancyId)?.unitId || "");
  if (!tenancyId && payload.paymentId) {
    const payment = byId(state, "payments", payload.paymentId);
    tenancyId = String(payment?.tenancyId || payment?.leaseId || "");
    unitId ||= String(payment?.unitId || "");
  }
  if (!unitId && payload.id && (type.startsWith("tenancy.") || type.startsWith("lease."))) {
    unitId = String(byId(state, "leases", payload.id)?.unitId || "");
    tenancyId ||= String(payload.id);
  }

  const unit = units.find((item) => String(item.id || "") === unitId) || null;
  const tenancy = leases.find((item) => String(item.id || "") === tenancyId) || null;
  if (!buildingId) buildingId = String(unit?.buildingId || tenancy?.buildingId || "");
  if (!unitId && tenancy?.unitId) unitId = String(tenancy.unitId);

  const building = buildings.find((item) => String(item.id || "") === buildingId) || null;
  const portfolioId = String(payload.portfolioId || building?.portfolioId || state?.meta?.primaryPortfolioId || state?.portfolios?.[0]?.id || "");

  return { portfolioId, buildingId, unitId, tenancyId };
}

export function assertContextIntegrity(state: AnyRecord, context: ApplicationContext): void {
  const buildings = records(state?.buildings);
  const building = buildings.find((item) => String(item.id || "") === context.buildingId) || null;
  if (context.buildingId && !building) throw new Error(`Application-Kontext: Gebäude ${context.buildingId} fehlt`);
  if (building && context.portfolioId && String(building.portfolioId || "") !== context.portfolioId) {
    throw new Error("Application-Kontext: Gebäude gehört zu einem anderen Portfolio");
  }

  if (context.unitId) {
    const unit = byId(state, "units", context.unitId);
    if (!unit) throw new Error(`Application-Kontext: Einheit ${context.unitId} fehlt`);
    if (context.buildingId && String(unit.buildingId || "") !== context.buildingId) {
      throw new Error("Application-Kontext: Einheit gehört zu einem anderen Gebäude");
    }
  }

  if (context.tenancyId) {
    const tenancy = byId(state, "leases", context.tenancyId);
    if (!tenancy) throw new Error(`Application-Kontext: Mietverhältnis ${context.tenancyId} fehlt`);
    if (context.buildingId && String(tenancy.buildingId || "") !== context.buildingId) {
      throw new Error("Application-Kontext: Mietverhältnis gehört zu einem anderen Gebäude");
    }
    if (context.unitId && tenancy.unitId && String(tenancy.unitId) !== context.unitId) {
      throw new Error("Application-Kontext: Mietverhältnis gehört zu einer anderen Einheit");
    }
  }
}

function changedRecords(before: AnyRecord, after: AnyRecord, collection: string): AnyRecord[] {
  const beforeItems = records(before?.[collection]);
  const afterItems = records(after?.[collection]);
  const prior = new Map(beforeItems.map((item) => [String(item.id || ""), JSON.stringify(item)]));
  const afterIds = new Set(afterItems.map((item) => String(item.id || "")));
  const changed = afterItems.filter((item) => {
    const id = String(item.id || "");
    return !id || prior.get(id) !== JSON.stringify(item);
  });
  const deleted = beforeItems.filter((item) => item.id && !afterIds.has(String(item.id)));
  return [...changed, ...deleted];
}

export function assertBuildingScopedMutation(
  before: AnyRecord,
  after: AnyRecord,
  context: ApplicationContext
): void {
  if (!context.buildingId) return;
  for (const collection of BUILDING_SCOPED_COLLECTIONS) {
    for (const record of changedRecords(before, after, collection)) {
      const buildingId = String(record.buildingId || "");
      if (buildingId && buildingId !== context.buildingId) {
        throw new Error(`Application-Scope: ${collection}/${record.id || "?"} gehört zu ${buildingId} statt ${context.buildingId}`);
      }
    }
  }
}

export function buildingScopedCollections(): readonly string[] {
  return BUILDING_SCOPED_COLLECTIONS;
}
