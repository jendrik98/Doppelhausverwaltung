declare const APP_VERSION: string;
declare const MAX_ERROR_LOG: number;
declare const SCHEMA_VERSION: number;
declare let state: any;

declare function validateState(value: any): { errors: string[]; warnings?: string[] };
declare function settlementConsumption(currentState: any, settlement: any): any;
declare function normalizeState(value: any): any;
declare function migrateDomainState(value: any): any;
declare function ensureDefaultMeters(value: any): void;
declare function ensureTraceShape(value: any): any;
declare function uid(): string;
declare const AppLifecycleLedger: {
ensureLifecycleState: (value: any) => any;
validateLifecycleState: (value: any) => { errors: string[]; warnings: string[] };
};
declare const AppPortfolioModel: {
  ensurePortfolioModel: (value: any) => any;
  validatePortfolioModel: (value: any) => { errors: string[]; warnings: string[] };
};

export function cloneState<T>(value: T): T {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function uniqueIds(items: any[], label: string, issues: { errors: string[] }): void {
  const seen = new Set<string>();
  for (const item of items || []) {
    if (!item?.id) {
      issues.errors.push(`${label}: Datensatz ohne ID`);
      continue;
    }
    if (seen.has(item.id)) issues.errors.push(`${label}: doppelte ID ${item.id}`);
    seen.add(item.id);
  }
}

export function validateDomainState(value: any): { errors: string[]; warnings: string[] } {
  const issues = { errors: [] as string[], warnings: [] as string[] };
  const base = validateState(value);
  issues.errors.push(...base.errors);
  if (!value || typeof value !== "object") return issues;

  const portfolioIssues = AppPortfolioModel.validatePortfolioModel(value);
  issues.errors.push(...portfolioIssues.errors);
  issues.warnings.push(...portfolioIssues.warnings);
  const lifecycleIssues = AppLifecycleLedger.validateLifecycleState(value);
  issues.errors.push(...lifecycleIssues.errors);
  issues.warnings.push(...lifecycleIssues.warnings);

  for (const [key, label] of [
    ["units", "Einheiten"],
    ["leases", "Mietverträge"],
    ["sources", "Quellen"],
    ["costPositions", "Kostenpositionen"],
    ["meters", "Zähler"],
    ["waterSettlements", "Wasserperioden"],
    ["containers", "Behälter"],
    ["tasks", "Aufgaben"],
    ["payments", "Zahlungen"],
    ["billingSnapshots", "Snapshots"],
    ["rentAllocations", "Mietkonto-Zuordnungen"],
    ["meterReplacements", "Zählerwechsel"],
    ] as const) {
    uniqueIds(value[key], label, issues);
  }

  const sourceIds = new Set((value.sources || []).map((item: any) => item.id));
  const meterIds = new Set((value.meters || []).map((item: any) => item.id));

  for (const position of value.costPositions || []) {
    if (!position.label) issues.errors.push(`Kostenposition ${position.id}: Bezeichnung fehlt`);
    if (Number(position.amount) < 0) issues.errors.push(`Kostenposition ${position.label}: negativer Betrag`);
    if (position.serviceStart && position.serviceEnd && position.serviceEnd < position.serviceStart) {
      issues.errors.push(`Kostenposition ${position.label}: Leistungszeitraum ungültig`);
    }
    if (
      position.sourceId &&
      !sourceIds.has(position.sourceId) &&
      !String(position.sourceId).startsWith("legacy-")
    ) {
      issues.warnings.push(`Kostenposition ${position.label}: Quelle nicht mehr vorhanden`);
    }
    if (!["house", "owner", "rental", "review"].includes(position.assignment)) {
      issues.errors.push(`Kostenposition ${position.label}: ungültige Zuordnung`);
    }
  }

  for (const settlement of value.waterSettlements || []) {
    if (!meterIds.has(settlement.mainMeterId) || !meterIds.has(settlement.ownerMeterId)) {
      issues.errors.push(`Wasserperiode ${settlement.periodYear}: Zählerreferenz fehlt`);
    }
    const consumption = settlementConsumption(value, settlement);
    if (consumption && !consumption.valid) {
      issues.errors.push(`Wasserperiode ${settlement.periodYear}: unplausible Verbräuche`);
    }
  }

  for (const lease of value.leases || []) {
    if (lease.start && lease.end && lease.end < lease.start) {
      issues.errors.push("Mietvertrag: Enddatum liegt vor Beginn");
    }
    if (Number(lease.rent || 0) < 0 || Number(lease.advance || 0) < 0) {
      issues.errors.push("Mietvertrag: negativer Betrag");
    }
  }

  const ownerUnits = (value.units || []).filter((unit: any) => unit.type == "owner").length;
  const rentalUnits = (value.units || []).filter((unit: any) => unit.type == "rental").length;
  if (ownerUnits > 1) issues.warnings.push("Mehr als eine Eigennutzungs-Einheit hinterlegt");
  if (rentalUnits > 1) issues.warnings.push("Mehr als eine Mietwohnung hinterlegt");
  return issues;
}

export function repairDomainState(value: any): any {
  let repaired = normalizeState(value);
  repaired = migrateDomainState(repaired);
  ensureDefaultMeters(repaired);
  repaired = AppPortfolioModel.ensurePortfolioModel(repaired);
  repaired = AppLifecycleLedger.ensureLifecycleState(repaired);
  for (const meter of repaired.meters || []) {
    meter.readings = Array.isArray(meter.readings) ? meter.readings : [];
    const seen = new Set<string>();
    meter.readings = meter.readings
      .filter((reading: any) => {
        const key = `${reading.date}|${Number(reading.value)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a: any, b: any) => (a.date || "").localeCompare(b.date || ""));
  }
  repaired.schemaVersion = SCHEMA_VERSION;
  repaired.meta.appVersion = APP_VERSION;
  repaired.meta.revision = Number(repaired.meta.revision || 0);
  repaired.meta.errorLog = Array.isArray(repaired.meta.errorLog) ? repaired.meta.errorLog : [];
  return typeof ensureTraceShape === "function" ? ensureTraceShape(repaired) : repaired;
}

export function recordClientError(context: string, error: any): void {
  try {
    const entry = {
      id: uid(),
      at: new Date().toISOString(),
      context,
      message: String(error?.message || error),
      stack: String(error?.stack || "").slice(0, 3000),
    };
    state.meta.errorLog = Array.isArray(state.meta.errorLog) ? state.meta.errorLog : [];
    state.meta.errorLog.unshift(entry);
    state.meta.errorLog = state.meta.errorLog.slice(0, MAX_ERROR_LOG);
  } catch {}
}

export function integritySummary(value: any): {
  ok: boolean;
  errors: string[];
  warnings: string[];
  revision: number;
} {
  const validation = validateDomainState(value);
  return {
    ok: validation.errors.length === 0,
    errors: validation.errors,
    warnings: validation.warnings,
    revision: Number(value.meta?.revision || 0),
  };
}

export async function sha256Text(text: string): Promise<string> {
  if (!crypto?.subtle) return "";
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function stableJSON(value: any): string {
  const sort = (input: any): any =>
    Array.isArray(input)
      ? input.map(sort)
      : input && typeof input === "object"
        ? Object.fromEntries(Object.keys(input).sort().map((key) => [key, sort(input[key])]))
        : input;
  return JSON.stringify(sort(value));
}

export async function finalizeSnapshotIntegrity(snapshot: any): Promise<any> {
  snapshot.integrityHash = await sha256Text(stableJSON({ ...snapshot, integrityHash: undefined }));
  return snapshot;
}

export async function blobSha256(blob: Blob): Promise<string> {
  if (!crypto?.subtle) return "";
  const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function documentFingerprint(pages: Array<{ blob: Blob }>): Promise<string> {
  const hashes: string[] = [];
  for (const page of pages || []) hashes.push(await blobSha256(page.blob));
  return sha256Text(hashes.join("|"));
}

export function reconciliationSummary(currentState: any): { rows: any[]; unmatchedPayments: any[] } {
  const positionPaid = new Map<string, number>();
  for (const payment of currentState.payments || []) {
    if (!payment.positionId) continue;
    positionPaid.set(
      payment.positionId,
      (positionPaid.get(payment.positionId) || 0) +
        (payment.direction == "outflow" ? Number(payment.amount || 0) : -Number(payment.amount || 0)),
    );
  }
  const rows = (currentState.costPositions || [])
    .filter((position: any) => position.confirmed)
    .map((position: any) => ({
      position,
      paid: positionPaid.get(position.id) || 0,
      difference: Number(position.amount || 0) - (positionPaid.get(position.id) || 0),
    }));
  return {
    rows,
    unmatchedPayments: (currentState.payments || []).filter(
      (payment: any) => !payment.positionId && !payment.sourceId,
    ),
  };
}
