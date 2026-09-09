import { APPLICATION_VERSION, type AnyRecord, type CommandBusPorts, type CommandOptions } from "./contracts";
import { assertBuildingScopedMutation, assertContextIntegrity, resolveApplicationContext } from "./context";

export function commandResult(ok: boolean, message = "", data: any = null): {
  ok: boolean;
  message: string;
  data: any;
} {
  return { ok, message, data };
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

export function createCommandBus(ports: CommandBusPorts): {
  executeCommand: (
    type: string,
    payload: AnyRecord,
    handler: (payload: AnyRecord, context: ReturnType<typeof resolveApplicationContext>) => any | Promise<any>,
    options?: CommandOptions
  ) => Promise<{ ok: boolean; message: string; data: any }>;
} {
  const now = ports.now || (() => new Date().toISOString());

  const executeCommand = async (
    type: string,
    payload: AnyRecord,
    handler: (payload: AnyRecord, context: ReturnType<typeof resolveApplicationContext>) => any | Promise<any>,
    { auditText = null, restorePoint = false, allowCrossBuilding = false }: CommandOptions = {}
  ): Promise<{ ok: boolean; message: string; data: any }> => {
    if (restorePoint) ports.createRestorePoint(`Vor ${type}`);
    const before = ports.cloneState(ports.getState());
    const contextBefore = resolveApplicationContext(before, type, payload || {});

    try {
      const result = await handler(payload || {}, contextBefore);
      const repaired = ports.repairState(ports.getState());
      ports.setState(repaired);

      const contextAfter = resolveApplicationContext(repaired, type, payload || {});
      assertContextIntegrity(repaired, contextAfter);
      if (!allowCrossBuilding) assertBuildingScopedMutation(before, repaired, contextAfter);

      const check = ports.validateState(repaired);
      if (check.errors.length) throw new Error(check.errors.join(" · "));

      repaired.meta = repaired.meta || {};
      repaired.meta.commandLog = Array.isArray(repaired.meta.commandLog) ? repaired.meta.commandLog : [];
      repaired.meta.commandLog.unshift({
        id: ports.uid(),
        at: now(),
        type,
        applicationVersion: APPLICATION_VERSION,
        context: contextAfter,
        payloadSummary: safeCommandSummary(payload),
        revisionBefore: Number(before.meta?.revision || 0),
        revisionAfter: Number(before.meta?.revision || 0) + 1
      });
      repaired.meta.commandLog = repaired.meta.commandLog.slice(0, 250);

      const saved = await ports.persist(auditText || type, safeCommandSummary(payload));
      if (!saved) throw new Error("Speichern fehlgeschlagen.");
      return commandResult(true, "Gespeichert", result);
    } catch (error: any) {
      ports.setState(before);
      ports.setLastStableState?.(ports.cloneState(before));
      ports.recordError(`application-command:${type}`, error);
      return commandResult(false, String(error?.message || error));
    }
  };

  return { executeCommand };
}
