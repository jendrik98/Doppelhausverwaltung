import type { LifecyclePorts } from "./contracts";
import { resolveApplicationContext } from "./context";

export async function loadApplicationState(ports: LifecyclePorts): Promise<{
  state: Record<string, any>;
  created: boolean;
  context: ReturnType<typeof resolveApplicationContext>;
}> {
  const record = await ports.readStateRecord();
  const created = !record?.data;
  const repaired = ports.repairState(record?.data || ports.createEmptyState());
  const validation = ports.validateState(repaired);
  if (validation.errors.length) {
    throw new Error(`Application-Start: ${validation.errors.join(" · ")}`);
  }
  await ports.saveState(repaired);
  return {
    state: repaired,
    created,
    context: resolveApplicationContext(repaired, "application.start", {})
  };
}
