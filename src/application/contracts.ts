export const APPLICATION_VERSION = 1;

export type AnyRecord = Record<string, any>;

export interface ApplicationContext {
  portfolioId: string;
  buildingId: string;
  unitId: string;
  tenancyId: string;
}

export interface ValidationResult {
  errors: string[];
  warnings?: string[];
}

export interface CommandOptions {
  auditText?: string | null;
  restorePoint?: boolean;
  allowCrossBuilding?: boolean;
}

export interface CommandBusPorts {
  getState: () => AnyRecord;
  setState: (value: AnyRecord) => void;
  getLastStableState?: () => AnyRecord | null;
  setLastStableState?: (value: AnyRecord) => void;
  cloneState: <T>(value: T) => T;
  repairState: (value: AnyRecord) => AnyRecord;
  validateState: (value: AnyRecord) => ValidationResult;
  persist: (action?: string | null, detail?: string | null) => Promise<boolean>;
  recordError: (context: string, error: unknown) => void;
  createRestorePoint: (label: string) => unknown;
  uid: () => string;
  now?: () => string;
}

export interface LifecyclePorts {
  readStateRecord: () => Promise<{ data?: AnyRecord } | null>;
  saveState: (state: AnyRecord) => Promise<void>;
  createEmptyState: () => AnyRecord;
  repairState: (value: AnyRecord) => AnyRecord;
  validateState: (value: AnyRecord) => ValidationResult;
}
