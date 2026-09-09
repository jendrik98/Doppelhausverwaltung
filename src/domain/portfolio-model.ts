type AnyRecord = Record<string, any>;

export const PORTFOLIO_MODEL_VERSION = 1;
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

export function ensurePortfolioModel<T extends AnyRecord>(value: T): T {
  const state: AnyRecord = value && typeof value === "object" ? value : {};
  state.meta = state.meta && typeof state.meta === "object" ? state.meta : {};
  state.property = state.property && typeof state.property === "object" ? state.property : {};
  state.portfolios = array(state.portfolios);
  state.buildings = array(state.buildings);
  state.units = array(state.units);
  state.leases = array(state.leases);

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

  const portfolioIds = new Set(state.portfolios.map((item: any) => item.id));
  for (const building of state.buildings) {
    if (!portfolioIds.has(building.portfolioId)) building.portfolioId = primaryPortfolio.id;
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
  if (!portfolioIds.has(primaryBuilding.portfolioId)) primaryBuilding.portfolioId = primaryPortfolio.id;
  state.meta.primaryBuildingId = primaryBuilding.id;

  // B1 compatibility rule: the existing property form remains the source of truth
  // for the primary building until the multi-building UI is introduced.
  primaryBuilding.name = state.property.name || primaryBuilding.name || "Doppelhaus";
  primaryBuilding.address = state.property.address || primaryBuilding.address || "";
  primaryBuilding.totalArea = Number(state.property.totalArea || primaryBuilding.totalArea || 0);
  primaryBuilding.year = state.property.year || primaryBuilding.year || "";
  primaryBuilding.billingTakeoverDate = state.property.billingTakeoverDate || primaryBuilding.billingTakeoverDate || "";
  primaryBuilding.predecessorBillingEnd = state.property.predecessorBillingEnd || primaryBuilding.predecessorBillingEnd || "";

  const buildingIds = new Set(state.buildings.map((item: any) => item.id));
  for (const unit of state.units) {
    if (!buildingIds.has(unit.buildingId)) unit.buildingId = primaryBuilding.id;
  }

  const unitIds = new Set(state.units.map((item: any) => item.id));
  const primaryRental = firstByType(state.units, "rental", primaryBuilding.id) || firstByType(state.units, "rental") || state.units[0] || null;
  for (const lease of state.leases) {
    if (!unitIds.has(lease.unitId)) lease.unitId = primaryRental?.id || "";
    const linkedUnit = state.units.find((unit: any) => unit.id === lease.unitId);
    lease.buildingId = linkedUnit?.buildingId || primaryBuilding.id;
  }

  const ownerUnit = firstByType(state.units, "owner", primaryBuilding.id) || firstByType(state.units, "owner");
  const attachBuilding = (items: any[]): void => {
    for (const item of array(items)) {
      if (item && typeof item === "object" && !buildingIds.has(item.buildingId)) item.buildingId = primaryBuilding.id;
    }
  };

  for (const meter of array(state.meters)) {
    if (!buildingIds.has(meter.buildingId)) meter.buildingId = primaryBuilding.id;
    if (meter.role === "ownerWater" && ownerUnit && !unitIds.has(meter.unitId)) meter.unitId = ownerUnit.id;
    if (meter.unitId && !unitIds.has(meter.unitId)) delete meter.unitId;
  }

  attachBuilding(state.sources);
  attachBuilding(state.costPositions);
  attachBuilding(state.tasks);
  attachBuilding(state.payments);
  attachBuilding(state.waterSettlements);
  attachBuilding(state.billingWorkflows);
  attachBuilding(state.billingSnapshots);
  attachBuilding(state.containers);

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
      if (ids.has(item.id)) errors.push(`${label}: doppelte ID ${item.id}`);
      ids.add(item.id);
    }
    return ids;
  };

  const portfolioIds = unique(portfolios, "Portfolios");
  const buildingIds = unique(buildings, "Gebäude");
  const unitIds = unique(units, "Einheiten");
  unique(leases, "Mietverhältnisse");

  for (const building of buildings) {
    if (!portfolioIds.has(building.portfolioId)) errors.push(`Gebäude ${building.id}: Portfolio-Referenz fehlt`);
  }
  for (const unit of units) {
    if (!buildingIds.has(unit.buildingId)) errors.push(`Einheit ${unit.id}: Gebäude-Referenz fehlt`);
  }
  for (const lease of leases) {
    if (units.length && !unitIds.has(lease.unitId)) errors.push(`Mietverhältnis ${lease.id}: Einheit-Referenz fehlt`);
    if (!units.length && !lease.unitId) warnings.push(`Mietverhältnis ${lease.id}: noch keiner Einheit zugeordnet`);
    if (lease.buildingId && !buildingIds.has(lease.buildingId)) errors.push(`Mietverhältnis ${lease.id}: Gebäude-Referenz fehlt`);
  }

  for (const [key, label] of [
    ["meters", "Zähler"],
    ["sources", "Quellen"],
    ["costPositions", "Kostenpositionen"],
    ["tasks", "Aufgaben"],
    ["payments", "Zahlungen"],
    ["waterSettlements", "Wasserperioden"],
    ["billingWorkflows", "Abrechnungsworkflows"],
    ["billingSnapshots", "Snapshots"],
    ["containers", "Behälter"]
  ] as const) {
    for (const item of array(value[key])) {
      if (item?.buildingId && !buildingIds.has(item.buildingId)) errors.push(`${label} ${item.id || "?"}: Gebäude-Referenz fehlt`);
    }
  }

  if (value.meta?.primaryPortfolioId && !portfolioIds.has(value.meta.primaryPortfolioId)) {
    errors.push("Portfolio-Modell: primäres Portfolio ist ungültig");
  }
  if (value.meta?.primaryBuildingId && !buildingIds.has(value.meta.primaryBuildingId)) {
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
