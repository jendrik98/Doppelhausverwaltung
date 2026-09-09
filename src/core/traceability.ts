declare const TRACE_VERSION: number;
declare const COMMAND_VERSION: number;
declare const SCHEMA_VERSION: number;
declare const APP_VERSION: string;
declare let state: any;
declare let LAST_STABLE_STATE: any;

declare function uid(): string;
declare function cloneState<T>(value: T): T;
declare function repairDomainState(value: any): any;
declare function validateDomainState(value: any): { errors: string[]; warnings: string[] };
declare function saveState(value: any): Promise<void>;
declare function fullPortfolioState(): any;
declare function applyRestoredPortfolioState(value: any): void;
declare function persist(action?: string | null, detail?: string | null): Promise<boolean>;
declare function recordClientError(context: string, error: any): void;
declare function billingReadiness(currentState: any, year: number): any[];
declare function billingAnalysis(currentState: any, year: number): any;
declare function settlementConsumption(currentState: any, settlement: any): any;
declare function settlementByPeriod(currentState: any, year: number): any;
declare function positionToEvents(currentState: any, position: any, year: number): any[];
declare function smartToday(): string;

export function ensureTraceShape(value: any): any {
  value.meta = value.meta || {};
  value.meta.traceVersion = TRACE_VERSION;
  value.meta.importHistory = Array.isArray(value.meta.importHistory) ? value.meta.importHistory : [];
  value.meta.commandVersion = COMMAND_VERSION;
  value.meta.commandLog = Array.isArray(value.meta.commandLog) ? value.meta.commandLog : [];
  value.meta.restorePoints = Array.isArray(value.meta.restorePoints) ? value.meta.restorePoints : [];
  for (const position of value.costPositions || []) {
    position.provenance = position.provenance || {
      origin: position.origin || "manual",
      documentId: position.documentId || "",
      sourceId: position.sourceId || "",
      evidence: "",
      confidence: null,
      confirmedAt: position.confirmed ? new Date().toISOString() : null,
      confirmedBy: "local-user",
    };
  }
  return value;
}

export function provenanceLabel(position: any): string {
  const origin = position?.provenance?.origin || position?.origin || "manual";
  return origin == "document"
    ? "aus Dokument"
    : origin == "migration"
      ? "übernommen"
      : origin == "photo"
        ? "aus Foto"
        : origin == "assessment"
          ? "aus Bescheid"
          : "manuell";
}

export function createRestorePoint(label: string): any {
  const snapshot = cloneState(fullPortfolioState());
  delete snapshot.meta.restorePoints;
  const point = {
    id: uid(),
    at: new Date().toISOString(),
    label,
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    state: snapshot,
  };
  state.meta.restorePoints.unshift(point);
  state.meta.restorePoints = state.meta.restorePoints.slice(0, 5);
  return point;
}

export async function restoreFromPoint(id: string): Promise<boolean> {
  const point = (state.meta?.restorePoints || []).find((item: any) => item.id === id);
  if (!point) throw new Error("Sicherungspunkt nicht gefunden.");
  const current = cloneState(fullPortfolioState());
  const currentSnapshot = cloneState(current);
  delete currentSnapshot.meta.restorePoints;
  const undo = {
    id: uid(),
    at: new Date().toISOString(),
    label: "Vor Wiederherstellung",
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    state: currentSnapshot,
  };
  const restored = ensureTraceShape(repairDomainState(cloneState(point.state)));
  restored.meta.restorePoints = [undo, ...(restored.meta.restorePoints || [])].slice(0, 5);
  try {
    await saveState(restored);
    applyRestoredPortfolioState(restored);
    return true;
  } catch (error) {
    applyRestoredPortfolioState(current);
    throw error;
  }
}

export function commandResult(ok: boolean, message = "", data: any = null): {
  ok: boolean;
  message: string;
  data: any;
} {
  return { ok, message, data };
}

type CommandOptions = { auditText?: string | null; restorePoint?: boolean };

declare function applicationExecuteCommand(
  type: string,
  payload: any,
  handler: (payload: any) => any | Promise<any>,
  options?: CommandOptions,
): Promise<{ ok: boolean; message: string; data: any }>;

export async function executeCommand(
  type: string,
  payload: any,
  handler: (payload: any) => any | Promise<any>,
  { auditText = null, restorePoint = false }: CommandOptions = {},
): Promise<{ ok: boolean; message: string; data: any }> {
  return applicationExecuteCommand(type, payload, handler, { auditText, restorePoint });
}

export function safeCommandSummary(payload: any): string {
  if (payload == null) return "";
  if (typeof payload === "string") return payload.slice(0, 180);
  const out: Record<string, any> = {};
  for (const key of Object.keys(payload)) {
    if (/blob|pages|text|image/i.test(key)) continue;
    const value = payload[key];
    out[key] = typeof value === "string" ? value.slice(0, 120) : value;
  }
  try {
    return JSON.stringify(out);
  } catch {
    return "Command";
  }
}

export function documentWorkflowState(document: any): "new" | "review" | "done" {
  const analysis = document.analysis || {};
  const fields = analysis.fields || {};
  if (analysis.status == "error") return "review";
  if (analysis.status != "done") return "new";
  const proposals = fields.positionProposals || [];
  if (proposals.length && !analysis.acceptedAt) return "review";
  if (document.sourceId || analysis.acceptedAt) return "done";
  return "review";
}

export function documentWorkflowLabel(document: any): string {
  const workflowState = documentWorkflowState(document);
  return workflowState == "new" ? "Neu" : workflowState == "review" ? "Prüfen" : "Erledigt";
}

export function documentsByWorkflow(documents: any[]): { new: any[]; review: any[]; done: any[] } {
  return {
    new: documents.filter((document) => documentWorkflowState(document) == "new"),
    review: documents.filter((document) => documentWorkflowState(document) == "review"),
    done: documents.filter((document) => documentWorkflowState(document) == "done"),
  };
}

export function traceForPosition(currentState: any, position: any): any {
  const source = (currentState.sources || []).find((item: any) => item.id === position.sourceId) || null;
  const documentId =
    position.provenance?.documentId || position.documentId || source?.sourceDocumentId || "";
  return {
    position,
    source,
    documentId,
    origin: provenanceLabel(position),
    evidence: position.provenance?.evidence || "",
    confidence: position.provenance?.confidence,
    confirmedAt: position.provenance?.confirmedAt || null,
  };
}

export function billingClosureChecklist(currentState: any, year: number): any {
  const readiness = billingReadiness(currentState, year);
  const analysis = billingAnalysis(currentState, year);
  const lease = currentState.leases?.[0] || null;
  const relevant = analysis.events || [];
  const waterNeeded = relevant.some((event: any) => event.category == "water");
  const waterOK =
    !waterNeeded || !!settlementConsumption(currentState, settlementByPeriod(currentState, year))?.valid;
  const allConfirmed = (currentState.costPositions || [])
    .filter((position: any) => positionToEvents(currentState, position, year).length)
    .every((position: any) => position.confirmed);
  const allAssigned = analysis.unresolved.length === 0;
  const periodEnded = !!analysis.period?.end && smartToday() > analysis.period.end;
  const advanceOK = lease
    ? Number(lease.advance || 0) <= 0 || Number(analysis.advanceEvidence?.recognizedPayments || 0) > 0
    : false;
  const noErrors = readiness.every((item: any) => item.ok);
  const points = [
    { id: "period", label: "Abrechnungsperiode und Mietvertrag vorhanden", ok: !!lease },
    { id: "periodComplete", label: "Abrechnungsperiode vollständig beendet", ok: periodEnded },
    { id: "costs", label: "Alle relevanten Kostenpositionen bestätigt", ok: allConfirmed && relevant.length > 0 },
    { id: "assignment", label: "Alle Umlageentscheidungen geklärt", ok: allAssigned },
    { id: "water", label: "Verbrauchsdaten vollständig", ok: waterOK },
    { id: "advance", label: "Vorauszahlungen ermittelt", ok: advanceOK },
    { id: "readiness", label: "Datenqualitätsprüfung ohne offene Pflichtpunkte", ok: noErrors },
  ];
  return { points, ok: points.every((item) => item.ok), analysis };
}

export function snapshotVerification(snapshot: any): { status: string; label: string } {
  if (!snapshot?.integrityHash) return { status: "unknown", label: "Keine Prüfsumme" };
  return { status: "stored", label: `SHA-256 ${String(snapshot.integrityHash).slice(0, 12)}…` };
}
