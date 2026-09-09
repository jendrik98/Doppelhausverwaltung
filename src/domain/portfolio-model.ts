type AnyRecord = Record<string, any>;

export const PORTFOLIO_MODEL_VERSION = 2;
export const DEFAULT_PORTFOLIO_ID = "portfolio-main";
export const DEFAULT_BUILDING_ID = "building-main";

export interface PortfolioRecord extends AnyRecord {
  id: string;
  name: string;
  kind: "private" | "business" | "other";
}

export interface BuildingRecord extends AnyRecord {
  id: string;
  portfolioId: string;
  name: string;
  address: string;
  totalArea: number;
  year: string | number;
}

export interface PortfolioModelValidation {
  errors: string[];
  warnings: string[];
}

function array(value: any): any[] {
  return Array.isArray(value) ? value : [];
}

function uniqueFallbackId(prefix: string, index: number, used: Set<string>): string {
  let candidate = `${prefix}-${index + 1}`;
  let suffix = index + 1;
  while (used.has(candidate)) candidate = `${prefix}-${++suffix}`;
  used.add(candidate);
  return candidate;
}

function ensureIds(items: any[], prefix: string): void {
  const used = new Set(items.map((item) => String(item?.id || "")).filter(Boolean));
  items.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    if (!item.id) item.id = uniqueFallbackId(prefix, index, used);
  });
}

function firstByType(units: any[], type: string, buildingId?: string): any | null {
  return units.find((unit) => unit?.type === type && (!buildingId || unit.buildingId === buildingId)) || null;
}

function mapById(items: any[]): Map<string, any> {
  return new Map(items.filter((item) => item?.id).map((item) => [String(item.id), item]));
}

function linkedBuildingId(item: any, refs: Array<Map<string, any>>): string {
  for (const ref of refs) {
    for (const key of ["unitId", "leaseId", "positionId", "sourceId", "meterId", "mainMeterId", "ownerMeterId"]) {
      const linked = item?.[key] ? ref.get(String(item[key])) : null;
      if (linked?.buildingId) return String(linked.buildingId);
    }
  }
  return "";
}

export function ensurePortfolioModel<T extends AnyRecord>(value: T): T {
  const state: AnyRecord = value && typeof value === "object" ? value : {};
  state.meta = state.meta && typeof state.meta === "object" ? state.meta : {};
  state.property = state.property && typeof state.property === "object" ? state.property : {};
  for (const key of [
    "portfolios", "buildings", "units", "leases", "meters", "sources", "costPositions", "tasks",
    "payments", "waterSettlements", "billingWorkflows", "billingSnapshots", "containers", "water"
  ]) state[key] = array(state[key]);

  ensureIds(state.portfolios, "portfolio");
  ensureIds(state.buildings, "building");
  ensureIds(state.units, "unit");
  ensureIds(state.leases, "tenancy");

  let primaryPortfolio = state.portfolios.find((item: any) => item.id === state.meta.primaryPortfolioId) || state.portfolios[0];
  if (!primaryPortfolio) {
    primaryPortfolio = {
      id: DEFAULT_PORTFOLIO_ID,
      name: "Privatbestand",
      kind: "private",
      createdAt: state.meta.createdAt || ""
    };
    state.portfolios.push(primaryPortfolio);
  }
  primaryPortfolio.name = primaryPortfolio.name || "Privatbestand";
  primaryPortfolio.kind = primaryPortfolio.kind || "private";
  state.meta.primaryPortfolioId = primaryPortfolio.id;

  const portfolioIds = new Set(state.portfolios.map((item: any) => String(item.id)));
  for (const building of state.buildings) {
    if (!portfolioIds.has(String(building.portfolioId || ""))) building.portfolioId = primaryPortfolio.id;
  }

  let primaryBuilding = state.buildings.find((item: any) => item.id === state.meta.primaryBuildingId) || state.buildings[0];
  if (!primaryBuilding) {
    primaryBuilding = {
      id: DEFAULT_BUILDING_ID,
      portfolioId: primaryPortfolio.id,
      name: state.property.name || "Doppelhaus",
      address: state.property.address || "",
      totalArea: Number(state.property.totalArea || 0),
      year: state.property.year || "",
      source: "legacy-property"
    };
    state.buildings.push(primaryBuilding);
  }
  if (!portfolioIds.has(String(primaryBuilding.portfolioId || ""))) primaryBuilding.portfolioId = primaryPortfolio.id;
  state.meta.primaryBuildingId = primaryBuilding.id;

  // Bis die Mehrgebäude-UI eingeführt ist, bleibt das bisherige property-Formular
  // die editierbare Projektion des primären Gebäudes.
  primaryBuilding.name = state.property.name || primaryBuilding.name || "Doppelhaus";
  primaryBuilding.address = state.property.address || primaryBuilding.address || "";
  primaryBuilding.totalArea = Number(state.property.totalArea || primaryBuilding.totalArea || 0);
  primaryBuilding.year = state.property.year || primaryBuilding.year || "";
  primaryBuilding.billingTakeoverDate = state.property.billingTakeoverDate || primaryBuilding.billingTakeoverDate || "";
  primaryBuilding.predecessorBillingEnd = state.property.predecessorBillingEnd || primaryBuilding.predecessorBillingEnd || "";

  const buildingIds = new Set(state.buildings.map((item: any) => String(item.id)));
  for (const unit of state.units) {
    if (!buildingIds.has(String(unit.buildingId || ""))) unit.buildingId = primaryBuilding.id;
  }
  const unitById = mapById(state.units);
  const unitIds = new Set(unitById.keys());
  const primaryRental = firstByType(state.units, "rental", primaryBuilding.id) || firstByType(state.units, "rental") || state.units[0] || null;
  for (const lease of state.leases) {
    if (!unitIds.has(String(lease.unitId || ""))) lease.unitId = primaryRental?.id || "";
    const linkedUnit = unitById.get(String(lease.unitId || ""));
    lease.buildingId = linkedUnit?.buildingId || primaryBuilding.id;
  }
  const leaseById = mapById(state.leases);

  const ownerUnitFor = (buildingId: string): any | null =>
    firstByType(state.units, "owner", buildingId) || (buildingId === primaryBuilding.id ? firstByType(state.units, "owner") : null);

  for (const meter of state.meters) {
    const linkedUnit = unitById.get(String(meter.unitId || ""));
    if (!buildingIds.has(String(meter.buildingId || ""))) meter.buildingId = linkedUnit?.buildingId || primaryBuilding.id;
    if (meter.role === "ownerWater" && !linkedUnit) {
      const ownerUnit = ownerUnitFor(String(meter.buildingId));
      if (ownerUnit) meter.unitId = ownerUnit.id;
    }
    if (meter.unitId && !unitIds.has(String(meter.unitId))) delete meter.unitId;
  }
  const meterById = mapById(state.meters);

  for (const source of state.sources) {
    if (!buildingIds.has(String(source.buildingId || ""))) source.buildingId = primaryBuilding.id;
  }
  const sourceById = mapById(state.sources);

  for (const position of state.costPositions) {
    const linkedSource = sourceById.get(String(position.sourceId || ""));
    if (!buildingIds.has(String(position.buildingId || ""))) position.buildingId = linkedSource?.buildingId || primaryBuilding.id;
  }
  const positionById = mapById(state.costPositions);

  for (const settlement of state.waterSettlements) {
    const mainMeter = meterById.get(String(settlement.mainMeterId || ""));
    const ownerMeter = meterById.get(String(settlement.ownerMeterId || ""));
    if (!buildingIds.has(String(settlement.buildingId || ""))) {
      settlement.buildingId = mainMeter?.buildingId || ownerMeter?.buildingId || primaryBuilding.id;
    }
  }

  const refs = [unitById, leaseById, positionById, sourceById, meterById];
  for (const key of ["tasks", "payments"]) {
    for (const item of state[key]) {
      if (!buildingIds.has(String(item.buildingId || ""))) item.buildingId = linkedBuildingId(item, refs) || primaryBuilding.id;
      const linkedLease = leaseById.get(String(item.leaseId || ""));
      if (linkedLease && !unitIds.has(String(item.unitId || ""))) item.unitId = linkedLease.unitId || "";
    }
  }

  for (const key of ["billingWorkflows", "billingSnapshots", "containers", "water"]) {
    for (const item of state[key]) {
      if (item && typeof item === "object" && !buildingIds.has(String(item.buildingId || ""))) {
        item.buildingId = linkedBuildingId(item, refs) || primaryBuilding.id;
      }
    }
  }

  if (Number(state.meta.portfolioModelVersion || 0) < PORTFOLIO_MODEL_VERSION) {
    state.meta.portfolioModelMigratedAt = new Date().toISOString();
  }
  state.meta.portfolioModelVersion = PORTFOLIO_MODEL_VERSION;
  return state as T;
}

export function validatePortfolioModel(value: any): PortfolioModelValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!value || typeof value !== "object") return { errors: ["Portfolio-Modell fehlt"], warnings };

  const portfolios = array(value.portfolios);
  const buildings = array(value.buildings);
  const units = array(value.units);
  const leases = array(value.leases);

  if (!portfolios.length) errors.push("Portfolio-Modell: kein Portfolio vorhanden");
  if (!buildings.length) errors.push("Portfolio-Modell: kein Gebäude vorhanden");

  const unique = (items: any[], label: string): Set<string> => {
    const ids = new Set<string>();
    for (const item of items) {
      if (!item?.id) {
        errors.push(`${label}: Datensatz ohne ID`);
        continue;
      }
      const id = String(item.id);
      if (ids.has(id)) errors.push(`${label}: doppelte ID ${id}`);
      ids.add(id);
    }
    return ids;
  };

  const portfolioIds = unique(portfolios, "Portfolios");
  const buildingIds = unique(buildings, "Gebäude");
  const unitIds = unique(units, "Einheiten");
  unique(leases, "Mietverhältnisse");
  const unitById = mapById(units);
  const leaseById = mapById(leases);
  const sourceById = mapById(array(value.sources));
  const positionById = mapById(array(value.costPositions));
  const meterById = mapById(array(value.meters));

  for (const building of buildings) {
    if (!portfolioIds.has(String(building.portfolioId || ""))) errors.push(`Gebäude ${building.id}: Portfolio-Referenz fehlt`);
  }
  for (const unit of units) {
    if (!buildingIds.has(String(unit.buildingId || ""))) errors.push(`Einheit ${unit.id}: Gebäude-Referenz fehlt`);
  }
  for (const lease of leases) {
    const linkedUnit = unitById.get(String(lease.unitId || ""));
    if (units.length && !linkedUnit) errors.push(`Mietverhältnis ${lease.id}: Einheit-Referenz fehlt`);
    if (!units.length && !lease.unitId) warnings.push(`Mietverhältnis ${lease.id}: noch keiner Einheit zugeordnet`);
    if (!buildingIds.has(String(lease.buildingId || ""))) errors.push(`Mietverhältnis ${lease.id}: Gebäude-Referenz fehlt`);
    if (linkedUnit && lease.buildingId !== linkedUnit.buildingId) errors.push(`Mietverhältnis ${lease.id}: Gebäude und Einheit widersprechen sich`);
  }

  for (const meter of array(value.meters)) {
    if (!buildingIds.has(String(meter.buildingId || ""))) errors.push(`Zähler ${meter.id || "?"}: Gebäude-Referenz fehlt`);
    const linkedUnit = meter.unitId ? unitById.get(String(meter.unitId)) : null;
    if (meter.unitId && !linkedUnit) errors.push(`Zähler ${meter.id || "?"}: Einheit-Referenz fehlt`);
    if (linkedUnit && meter.buildingId !== linkedUnit.buildingId) errors.push(`Zähler ${meter.id || "?"}: Gebäude und Einheit widersprechen sich`);
  }

  for (const source of array(value.sources)) {
    if (!buildingIds.has(String(source.buildingId || ""))) errors.push(`Quelle ${source.id || "?"}: Gebäude-Referenz fehlt`);
  }
  for (const position of array(value.costPositions)) {
    if (!buildingIds.has(String(position.buildingId || ""))) errors.push(`Kostenposition ${position.id || "?"}: Gebäude-Referenz fehlt`);
    const source = position.sourceId ? sourceById.get(String(position.sourceId)) : null;
    if (source && source.buildingId !== position.buildingId) errors.push(`Kostenposition ${position.id || "?"}: Quelle gehört zu anderem Gebäude`);
  }

  for (const payment of array(value.payments)) {
    if (!buildingIds.has(String(payment.buildingId || ""))) errors.push(`Zahlung ${payment.id || "?"}: Gebäude-Referenz fehlt`);
    const linked = payment.positionId ? positionById.get(String(payment.positionId))
      : payment.sourceId ? sourceById.get(String(payment.sourceId))
      : payment.leaseId ? leaseById.get(String(payment.leaseId))
      : payment.unitId ? unitById.get(String(payment.unitId)) : null;
    if (linked?.buildingId && linked.buildingId !== payment.buildingId) errors.push(`Zahlung ${payment.id || "?"}: Referenz gehört zu anderem Gebäude`);
  }

  for (const settlement of array(value.waterSettlements)) {
    if (!buildingIds.has(String(settlement.buildingId || ""))) errors.push(`Wasserperiode ${settlement.id || settlement.periodYear || "?"}: Gebäude-Referenz fehlt`);
    for (const key of ["mainMeterId", "ownerMeterId"]) {
      const meter = settlement[key] ? meterById.get(String(settlement[key])) : null;
      if (meter?.buildingId && meter.buildingId !== settlement.buildingId) errors.push(`Wasserperiode ${settlement.id || settlement.periodYear || "?"}: Zähler gehört zu anderem Gebäude`);
    }
  }

  for (const [key, label] of [
    ["tasks", "Aufgaben"],
    ["billingWorkflows", "Abrechnungsworkflows"],
    ["billingSnapshots", "Snapshots"],
    ["containers", "Behälter"],
    ["water", "Wasserdaten"]
  ] as const) {
    for (const item of array(value[key])) {
      if (!buildingIds.has(String(item?.buildingId || ""))) errors.push(`${label} ${item?.id || "?"}: Gebäude-Referenz fehlt`);
    }
  }

  if (value.meta?.primaryPortfolioId && !portfolioIds.has(String(value.meta.primaryPortfolioId))) {
    errors.push("Portfolio-Modell: primäres Portfolio ist ungültig");
  }
  if (value.meta?.primaryBuildingId && !buildingIds.has(String(value.meta.primaryBuildingId))) {
    errors.push("Portfolio-Modell: primäres Gebäude ist ungültig");
  }
  return { errors, warnings };
}

export function portfolioSummary(value: any): {
  portfolios: number;
  buildings: number;
  units: number;
  tenancies: number;
  primaryPortfolioId: string;
  primaryBuildingId: string;
} {
  return {
    portfolios: array(value?.portfolios).length,
    buildings: array(value?.buildings).length,
    units: array(value?.units).length,
    tenancies: array(value?.leases).length,
    primaryPortfolioId: String(value?.meta?.primaryPortfolioId || ""),
    primaryBuildingId: String(value?.meta?.primaryBuildingId || "")
  };
}
