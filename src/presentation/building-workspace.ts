import {
  buildingScopedCollections,
  portfolioNavigation,
  queryBuildingWorkspace,
  queryTaskList
} from "../application";

type AnyRecord = Record<string, any>;

export const PRESENTATION_VERSION = 1;
export const ACTIVE_BUILDING_STORAGE_KEY = "mietverwaltung-active-building-v1";

const clone = <T>(value: T): T => {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
};

const records = (value: unknown): AnyRecord[] =>
  Array.isArray(value)
    ? value.filter((item): item is AnyRecord => !!item && typeof item === "object")
    : [];

function recordBelongsToBuilding(item: AnyRecord, buildingId: string, primaryBuildingId: string): boolean {
  const itemBuildingId = String(item?.buildingId || "");
  return itemBuildingId ? itemBuildingId === buildingId : buildingId === primaryBuildingId;
}

export interface BuildingChoice {
  id: string;
  name: string;
  address: string;
  active: boolean;
}

export interface PresentationWorkspace {
  portfolioId: string;
  portfolioName: string;
  activeBuildingId: string;
  activeBuildingName: string;
  showBuildingSelector: boolean;
  buildings: BuildingChoice[];
  counts: {
    units: number;
    tenancies: number;
    sources: number;
    costPositions: number;
    meters: number;
    tasks: number;
    payments: number;
  };
}

export function resolveActiveBuildingId(state: AnyRecord, requestedBuildingId = ""): string {
  const nav = portfolioNavigation(state);
  const requested = String(requestedBuildingId || "");
  if (requested && nav.buildings.some((item) => String(item.id || "") === requested)) return requested;
  return String(nav.activeBuildingId || nav.buildings[0]?.id || "");
}

export function createPresentationWorkspace(state: AnyRecord, requestedBuildingId = ""): PresentationWorkspace {
  const nav = portfolioNavigation(state);
  const activeBuildingId = resolveActiveBuildingId(state, requestedBuildingId);
  const workspace = queryBuildingWorkspace(state, { buildingId: activeBuildingId });
  const active = nav.buildings.find((item) => String(item.id || "") === activeBuildingId) || workspace.building;
  const tasks = queryTaskList(state, { buildingId: activeBuildingId });
  return {
    portfolioId: String(nav.portfolio?.id || ""),
    portfolioName: String(nav.portfolio?.name || "Portfolio"),
    activeBuildingId,
    activeBuildingName: String(active?.name || active?.address || "Gebäude"),
    showBuildingSelector: nav.showBuildingSelector,
    buildings: nav.buildings.map((item) => ({
      id: String(item.id || ""),
      name: String(item.name || item.address || "Gebäude"),
      address: String(item.address || ""),
      active: String(item.id || "") === activeBuildingId
    })),
    counts: {
      units: workspace.units.length,
      tenancies: workspace.tenancies.length,
      sources: workspace.sources.length,
      costPositions: workspace.costPositions.length,
      meters: workspace.meters.length,
      tasks: tasks.length,
      payments: workspace.payments.length
    }
  };
}

export function projectStateForBuilding(masterState: AnyRecord, requestedBuildingId = ""): AnyRecord {
  const master = clone(masterState || {});
  const activeBuildingId = resolveActiveBuildingId(master, requestedBuildingId);
  if (!activeBuildingId) return master;

  const primaryBuildingId = String(master?.meta?.primaryBuildingId || activeBuildingId);
  const activeBuilding = records(master.buildings).find((item) => String(item.id || "") === activeBuildingId) || null;
  const projected = clone(master);

  for (const key of buildingScopedCollections()) {
    projected[key] = records(master[key])
      .filter((item) => recordBelongsToBuilding(item, activeBuildingId, primaryBuildingId))
      .map((item) => ({ ...clone(item), buildingId: String(item.buildingId || activeBuildingId) }));
  }
  // Dokumente liegen separat im IndexedDB-Docs-Store. Dieser flüchtige UI-Cache
  // darf beim Gebäudewechsel keine Titel oder Metadaten eines Fremdgebäudes mitnehmen.
  projected.documentsCache = [];

  projected.meta = {
    ...(projected.meta || {}),
    primaryBuildingId: activeBuildingId,
    presentationBuildingId: activeBuildingId
  };

  projected.property = {
    ...(projected.property || {}),
    name: String(activeBuilding?.name || ""),
    address: String(activeBuilding?.address || ""),
    totalArea: Number(activeBuilding?.totalArea || 0),
    year: activeBuilding?.year || "",
    billingTakeoverDate: activeBuilding?.billingTakeoverDate || "",
    predecessorBillingEnd: activeBuilding?.predecessorBillingEnd || ""
  };

  if (activeBuilding?.finance && typeof activeBuilding.finance === "object") {
    projected.finance = clone(activeBuilding.finance);
  } else if (activeBuildingId !== primaryBuildingId) {
    projected.finance = { repayment: 0, fixed: 0 };
  }

  return projected;
}

export function mergeStateFromBuilding(masterState: AnyRecord, scopedState: AnyRecord, requestedBuildingId = ""): AnyRecord {
  const master = clone(masterState || {});
  const scoped = clone(scopedState || {});
  const activeBuildingId = resolveActiveBuildingId(
    master,
    requestedBuildingId || scoped?.meta?.presentationBuildingId || scoped?.meta?.primaryBuildingId
  );
  if (!activeBuildingId) return scoped;

  const primaryBuildingId = String(master?.meta?.primaryBuildingId || activeBuildingId);
  const scopedKeys = new Set(buildingScopedCollections());
  const result = clone(master);

  for (const key of scopedKeys) {
    const keep = records(master[key]).filter(
      (item) => !recordBelongsToBuilding(item, activeBuildingId, primaryBuildingId)
    );
    const changed = records(scoped[key]).map((item) => ({
      ...clone(item),
      buildingId: String(item.buildingId || activeBuildingId)
    }));
    result[key] = [...keep, ...changed];
  }

  for (const [key, value] of Object.entries(scoped)) {
    if (scopedKeys.has(key)) continue;
    if (["property", "finance", "portfolios", "buildings", "documentsCache"].includes(key)) continue;
    result[key] = clone(value);
  }

  result.portfolios = clone(master.portfolios || []);
  result.buildings = clone(master.buildings || []);
  result.documentsCache = [];

  const scopedBuilding = records(scoped.buildings).find((item) => String(item.id || "") === activeBuildingId) || {};
  const index = records(result.buildings).findIndex((item) => String(item.id || "") === activeBuildingId);
  if (index >= 0) {
    const prior = result.buildings[index];
    result.buildings[index] = {
      ...prior,
      ...clone(scopedBuilding),
      id: prior.id,
      portfolioId: prior.portfolioId,
      name: String(scoped?.property?.name || scopedBuilding.name || prior.name || "Gebäude"),
      address: String(scoped?.property?.address ?? scopedBuilding.address ?? prior.address ?? ""),
      totalArea: Number(scoped?.property?.totalArea ?? scopedBuilding.totalArea ?? prior.totalArea ?? 0),
      year: scoped?.property?.year ?? scopedBuilding.year ?? prior.year ?? "",
      billingTakeoverDate: scoped?.property?.billingTakeoverDate ?? scopedBuilding.billingTakeoverDate ?? prior.billingTakeoverDate ?? "",
      predecessorBillingEnd: scoped?.property?.predecessorBillingEnd ?? scopedBuilding.predecessorBillingEnd ?? prior.predecessorBillingEnd ?? "",
      finance: clone(scoped.finance || prior.finance || { repayment: 0, fixed: 0 })
    };
  }

  result.meta = { ...(result.meta || {}) };
  result.meta.primaryBuildingId = primaryBuildingId;
  result.meta.primaryPortfolioId = String(master?.meta?.primaryPortfolioId || result.meta.primaryPortfolioId || "");
  delete result.meta.presentationBuildingId;

  if (activeBuildingId === primaryBuildingId) {
    result.property = clone(scoped.property || master.property || {});
    result.finance = clone(scoped.finance || master.finance || {});
  } else {
    result.property = clone(master.property || {});
    result.finance = clone(master.finance || {});
  }

  return result;
}
