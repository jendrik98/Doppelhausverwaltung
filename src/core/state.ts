import { dateOnlyAddDays } from "./date";
export { localDateISO, dateOnlyAddDays, localMonthEndISO } from "./date";

export const SCHEMA_VERSION = 15;

type Dict = Record<string, any>;

const ARRAY_KEYS = [
  "portfolios",
  "buildings",
  "units",
  "leases",
  "sources",
  "costPositions",
  "meters",
  "waterSettlements",
  "containers",
  "water",
  "tasks",
  "billingWorkflows",
  "billingSnapshots",
  "payments",
  "audit"
] as const;

export interface AppState {
  schemaVersion: number;
  meta: Dict;
  property: Dict;
  correspondence: Dict;
  portfolios: any[];
  buildings: any[];
  units: any[];
  leases: any[];
  sources: any[];
  costPositions: any[];
  meters: any[];
  waterSettlements: any[];
  containers: any[];
  water: any[];
  tasks: any[];
  finance: Dict;
  billingWorkflows: any[];
  billingSnapshots: any[];
  payments: any[];
  audit: any[];
  [key: string]: any;
}

export interface StateValidationResult {
  ok: boolean;
  errors: string[];
}

export function createEmptyState(): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: {
      appVersion: "18.0.0",
      createdAt: new Date().toISOString(),
      migratedFrom: null,
      revision: 0,
      lastSavedAt: null,
      lastBackupAt: null,
      lastIntegrityCheckAt: null,
      errorLog: [],
      v17: {
        integrated: true,
        profileSchema: 3,
        waterModule: 3,
        utilityProfile: {
          coldWater: "landlord",
          heating: "tenant",
          hotWater: "tenant",
          electricity: "tenant",
          gas: "tenant"
        }
      }
    },
    property: { name: "", address: "", totalArea: 0, year: "" },
    correspondence: {
      landlordName: "",
      landlordAddress: "",
      iban: "",
      paymentReference: "",
      contact: ""
    },
    portfolios: [],
    buildings: [],
    units: [],
    leases: [],
    sources: [],
    costPositions: [],
    meters: [],
    waterSettlements: [],
    containers: [],
    water: [],
    tasks: [],
    finance: { repayment: 900, fixed: 0 },
    billingWorkflows: [],
    billingSnapshots: [],
    payments: [],
    audit: []
  };
}

export function validateState(value: unknown): StateValidationResult {
  const errors: string[] = [];
  if (!value || typeof value !== "object") {
    return { ok: false, errors: ["State fehlt"] };
  }

  const state = value as Dict;
  if (!Number.isInteger(state.schemaVersion)) errors.push("schemaVersion fehlt");
  if (!state.property || typeof state.property !== "object") errors.push("property fehlt");

  for (const key of ARRAY_KEYS) {
    if (!Array.isArray(state[key])) errors.push(`${key} ist kein Array`);
  }

  if (!state.finance || typeof state.finance !== "object") errors.push("finance fehlt");
  return { ok: errors.length === 0, errors };
}

export function normalizeState(value: unknown): AppState {
  const state = value && typeof value === "object" ? (value as Dict) : {};
  const base = createEmptyState();
  const out = { ...base, ...state } as AppState;

  out.property = { ...base.property, ...(state.property || {}) };
  out.property.billingTakeoverDate =
    out.property.billingTakeoverDate || out.property.ownershipEffective || "";

  if (out.property.billingTakeoverDate && !out.property.predecessorBillingEnd) {
    out.property.predecessorBillingEnd = dateOnlyAddDays(
      out.property.billingTakeoverDate,
      -1
    );
  }

  out.correspondence = { ...base.correspondence, ...(state.correspondence || {}) };
  out.finance = { ...base.finance, ...(state.finance || {}) };

  for (const key of ARRAY_KEYS) {
    out[key] = Array.isArray(state[key]) ? state[key] : [];
  }

  out.schemaVersion = SCHEMA_VERSION;
  out.meta = { ...base.meta, ...(state.meta || {}), appVersion: "18.0.0" };
  out.meta.v17 = {
    ...base.meta.v17,
    ...(state.meta?.v17 || {}),
    integrated: true,
    profileSchema: 3,
    waterModule: 3,
    utilityProfile: {
      coldWater: "landlord",
      heating: "tenant",
      hotWater: "tenant",
      electricity: "tenant",
      gas: "tenant"
    }
  };
  out.meta.revision = Number(out.meta.revision || 0);
  out.meta.errorLog = Array.isArray(out.meta.errorLog) ? out.meta.errorLog : [];

  return out;
}
