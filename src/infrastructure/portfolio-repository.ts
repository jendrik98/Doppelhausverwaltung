import {
  BUILDING_STORE,
  PORTFOLIO_STORE,
  REPOSITORY_META_STORE,
  STATE_ID,
  STATE_STORE,
  TENANCY_STORE,
  UNIT_STORE,
  openDB,
  readStateRecord as readSnapshotRecord,
  requestValue,
  transactionDone
} from "../core/persistence";

type AnyRecord = Record<string, any>;

export const PORTFOLIO_REPOSITORY_VERSION = 1;
export const PORTFOLIO_PROJECTION_ID = "portfolio-projection";

export interface PortfolioProjection {
  portfolios: AnyRecord[];
  buildings: AnyRecord[];
  units: AnyRecord[];
  tenancies: AnyRecord[];
}

export interface PortfolioProjectionMeta extends AnyRecord {
  id: string;
  repositoryVersion: number;
  revision: number;
  schemaVersion: number;
  portfolioModelVersion: number;
  counts: { portfolios: number; buildings: number; units: number; tenancies: number };
  updatedAt: string;
}

function records(value: any): AnyRecord[] {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

export function projectPortfolioState(state: any): PortfolioProjection {
  return {
    portfolios: records(state?.portfolios),
    buildings: records(state?.buildings),
    units: records(state?.units),
    tenancies: records(state?.leases)
  };
}

export function validatePortfolioProjection(projection: PortfolioProjection): string[] {
  const errors: string[] = [];
  const unique = (items: AnyRecord[], label: string): Set<string> => {
    const ids = new Set<string>();
    for (const item of items) {
      const id = String(item?.id || "");
      if (!id) { errors.push(`${label}: ID fehlt`); continue; }
      if (ids.has(id)) errors.push(`${label}: doppelte ID ${id}`);
      ids.add(id);
    }
    return ids;
  };
  const portfolioIds = unique(projection.portfolios, "Portfolio");
  const buildingIds = unique(projection.buildings, "Gebäude");
  const unitIds = unique(projection.units, "Einheit");
  unique(projection.tenancies, "Mietverhältnis");
  const unitById = new Map(projection.units.map((unit) => [String(unit.id), unit]));

  for (const building of projection.buildings) {
    if (!portfolioIds.has(String(building.portfolioId || ""))) errors.push(`Gebäude ${building.id}: Portfolio fehlt`);
  }
  for (const unit of projection.units) {
    if (!buildingIds.has(String(unit.buildingId || ""))) errors.push(`Einheit ${unit.id}: Gebäude fehlt`);
  }
  for (const tenancy of projection.tenancies) {
    const unitId = String(tenancy.unitId || "");
    const unit = unitById.get(unitId);
    if (!unitIds.has(unitId) || !unit) errors.push(`Mietverhältnis ${tenancy.id}: Einheit fehlt`);
    if (!buildingIds.has(String(tenancy.buildingId || ""))) errors.push(`Mietverhältnis ${tenancy.id}: Gebäude fehlt`);
    if (unit && unit.buildingId !== tenancy.buildingId) errors.push(`Mietverhältnis ${tenancy.id}: Gebäude/Einheit inkonsistent`);
  }
  return errors;
}

function projectionMeta(state: any, projection: PortfolioProjection): PortfolioProjectionMeta {
  return {
    id: PORTFOLIO_PROJECTION_ID,
    repositoryVersion: PORTFOLIO_REPOSITORY_VERSION,
    revision: Number(state?.meta?.revision || 0),
    schemaVersion: Number(state?.schemaVersion || 0),
    portfolioModelVersion: Number(state?.meta?.portfolioModelVersion || 0),
    counts: {
      portfolios: projection.portfolios.length,
      buildings: projection.buildings.length,
      units: projection.units.length,
      tenancies: projection.tenancies.length
    },
    updatedAt: new Date().toISOString()
  };
}

export async function readStateRecord<T = unknown>() {
  return readSnapshotRecord<T>();
}

export async function saveState<T extends AnyRecord>(state: T): Promise<void> {
  const projection = projectPortfolioState(state);
  const errors = validatePortfolioProjection(projection);
  if (errors.length) throw new Error(`Portfolio-Persistenz: ${errors.join(" · ")}`);

  const db = await openDB();
  const transaction = db.transaction(
    [STATE_STORE, PORTFOLIO_STORE, BUILDING_STORE, UNIT_STORE, TENANCY_STORE, REPOSITORY_META_STORE],
    "readwrite"
  );
  transaction.objectStore(STATE_STORE).put({ id: STATE_ID, data: state });
  const portfolioStore = transaction.objectStore(PORTFOLIO_STORE);
  const buildingStore = transaction.objectStore(BUILDING_STORE);
  const unitStore = transaction.objectStore(UNIT_STORE);
  const tenancyStore = transaction.objectStore(TENANCY_STORE);
  portfolioStore.clear();
  buildingStore.clear();
  unitStore.clear();
  tenancyStore.clear();
  for (const item of projection.portfolios) portfolioStore.put(item);
  for (const item of projection.buildings) buildingStore.put(item);
  for (const item of projection.units) unitStore.put(item);
  for (const item of projection.tenancies) tenancyStore.put(item);
  transaction.objectStore(REPOSITORY_META_STORE).put(projectionMeta(state, projection));
  await transactionDone(transaction);
}

async function getAll<T = AnyRecord>(storeName: string): Promise<T[]> {
  const db = await openDB();
  const transaction = db.transaction(storeName, "readonly");
  return (await requestValue<T[]>(transaction.objectStore(storeName).getAll())) || [];
}

async function getAllByIndex<T = AnyRecord>(storeName: string, indexName: string, value: IDBValidKey): Promise<T[]> {
  const db = await openDB();
  const transaction = db.transaction(storeName, "readonly");
  return (await requestValue<T[]>(transaction.objectStore(storeName).index(indexName).getAll(value))) || [];
}

export async function listPortfolios<T = AnyRecord>(): Promise<T[]> {
  return getAll<T>(PORTFOLIO_STORE);
}

export async function listBuildings<T = AnyRecord>(portfolioId?: string): Promise<T[]> {
  return portfolioId ? getAllByIndex<T>(BUILDING_STORE, "portfolioId", portfolioId) : getAll<T>(BUILDING_STORE);
}

export async function listUnitsByBuilding<T = AnyRecord>(buildingId: string): Promise<T[]> {
  return getAllByIndex<T>(UNIT_STORE, "buildingId", buildingId);
}

export async function listTenanciesByBuilding<T = AnyRecord>(buildingId: string): Promise<T[]> {
  return getAllByIndex<T>(TENANCY_STORE, "buildingId", buildingId);
}

export async function listTenanciesByUnit<T = AnyRecord>(unitId: string): Promise<T[]> {
  return getAllByIndex<T>(TENANCY_STORE, "unitId", unitId);
}

export async function getProjectionMeta(): Promise<PortfolioProjectionMeta | null> {
  const db = await openDB();
  const transaction = db.transaction(REPOSITORY_META_STORE, "readonly");
  const result = await requestValue<PortfolioProjectionMeta | undefined>(
    transaction.objectStore(REPOSITORY_META_STORE).get(PORTFOLIO_PROJECTION_ID)
  );
  return result ?? null;
}

export async function getBuildingGraph(buildingId: string): Promise<{
  building: AnyRecord | null;
  units: AnyRecord[];
  tenancies: AnyRecord[];
}> {
  const db = await openDB();
  const transaction = db.transaction([BUILDING_STORE, UNIT_STORE, TENANCY_STORE], "readonly");
  const buildingRequest = transaction.objectStore(BUILDING_STORE).get(buildingId);
  const unitsRequest = transaction.objectStore(UNIT_STORE).index("buildingId").getAll(buildingId);
  const tenanciesRequest = transaction.objectStore(TENANCY_STORE).index("buildingId").getAll(buildingId);
  const [building, units, tenancies] = await Promise.all([
    requestValue<AnyRecord | undefined>(buildingRequest),
    requestValue<AnyRecord[]>(unitsRequest),
    requestValue<AnyRecord[]>(tenanciesRequest)
  ]);
  return { building: building ?? null, units: units || [], tenancies: tenancies || [] };
}
