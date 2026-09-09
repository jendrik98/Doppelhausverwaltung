import type { AnyRecord, ApplicationContext } from "./contracts";
import { resolveApplicationContext } from "./context";

function records(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter((item): item is AnyRecord => !!item && typeof item === "object") : [];
}

function scoped(items: AnyRecord[], buildingId: string): AnyRecord[] {
  return buildingId ? items.filter((item) => String(item.buildingId || "") === buildingId) : items.slice();
}

export interface BuildingWorkspace {
  context: ApplicationContext;
  building: AnyRecord | null;
  units: AnyRecord[];
  tenancies: AnyRecord[];
  sources: AnyRecord[];
  costPositions: AnyRecord[];
  meters: AnyRecord[];
  waterSettlements: AnyRecord[];
  tasks: AnyRecord[];
  payments: AnyRecord[];
  billingWorkflows: AnyRecord[];
  billingSnapshots: AnyRecord[];
  containers: AnyRecord[];
  water: AnyRecord[];
}

export function queryBuildingWorkspace(state: AnyRecord, requested: Partial<ApplicationContext> = {}): BuildingWorkspace {
  const context = resolveApplicationContext(state, "query.buildingWorkspace", requested as AnyRecord);
  const buildingId = context.buildingId;
  const building = records(state.buildings).find((item) => String(item.id || "") === buildingId) || null;
  return {
    context,
    building,
    units: scoped(records(state.units), buildingId),
    tenancies: scoped(records(state.leases), buildingId),
    sources: scoped(records(state.sources), buildingId),
    costPositions: scoped(records(state.costPositions), buildingId),
    meters: scoped(records(state.meters), buildingId),
    waterSettlements: scoped(records(state.waterSettlements), buildingId),
    tasks: scoped(records(state.tasks), buildingId),
    payments: scoped(records(state.payments), buildingId),
    billingWorkflows: scoped(records(state.billingWorkflows), buildingId),
    billingSnapshots: scoped(records(state.billingSnapshots), buildingId),
    containers: scoped(records(state.containers), buildingId),
    water: scoped(records(state.water), buildingId)
  };
}

export function portfolioNavigation(state: AnyRecord, portfolioId = ""): {
  portfolio: AnyRecord | null;
  buildings: AnyRecord[];
  activeBuildingId: string;
  showBuildingSelector: boolean;
} {
  const activePortfolioId = portfolioId || String(state?.meta?.primaryPortfolioId || state?.portfolios?.[0]?.id || "");
  const portfolio = records(state.portfolios).find((item) => String(item.id || "") === activePortfolioId) || null;
  const buildings = records(state.buildings).filter((item) => !activePortfolioId || String(item.portfolioId || "") === activePortfolioId);
  const activeBuildingId = String(state?.meta?.primaryBuildingId || buildings[0]?.id || "");
  return { portfolio, buildings, activeBuildingId, showBuildingSelector: buildings.length > 1 };
}

export function reconciliationSummary(state: AnyRecord, requested: Partial<ApplicationContext> = {}): {
  context: ApplicationContext;
  rows: Array<{ position: AnyRecord; paid: number; difference: number }>;
  unmatchedPayments: AnyRecord[];
} {
  const workspace = queryBuildingWorkspace(state, requested);
  const positionPaid = new Map<string, number>();
  for (const payment of workspace.payments) {
    if (!payment.positionId) continue;
    const key = String(payment.positionId);
    positionPaid.set(
      key,
      (positionPaid.get(key) || 0) + (payment.direction === "outflow" ? Number(payment.amount || 0) : -Number(payment.amount || 0))
    );
  }
  const rows = workspace.costPositions
    .filter((position) => position.confirmed)
    .map((position) => ({
      position,
      paid: positionPaid.get(String(position.id)) || 0,
      difference: Number(position.amount || 0) - (positionPaid.get(String(position.id)) || 0)
    }));
  return {
    context: workspace.context,
    rows,
    unmatchedPayments: workspace.payments.filter((payment) => !payment.positionId && !payment.sourceId)
  };
}

function isoToday(): string {
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

function billingTarget(year: number): string {
  return `${year + 1}-03-31`;
}

function normalizeTitle(value: unknown): string {
  return String(value || "").trim().toLocaleLowerCase("de-DE").replace(/\s+/g, " ");
}

export function queryTaskList(
  state: AnyRecord,
  requested: Partial<ApplicationContext> = {},
  today = isoToday()
): AnyRecord[] {
  const workspace = queryBuildingWorkspace(state, requested);
  const out: AnyRecord[] = [];
  const seen = new Set<string>();
  const push = (task: AnyRecord) => {
    if (!task?.due || !task?.title) return;
    const key = `${task.due}|${normalizeTitle(task.title)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ ...task, buildingId: task.buildingId || workspace.context.buildingId });
  };

  for (const source of workspace.sources) {
    for (const due of Array.isArray(source.dueDates) ? source.dueDates : []) {
      push({
        id: `source-${source.id}-${due}`,
        title: `Fälligkeit: ${source.name || "Kostenquelle"}`,
        due,
        lead: 14,
        origin: "source",
        sourceId: source.id,
        buildingId: workspace.context.buildingId
      });
    }
  }

  for (const task of workspace.tasks) push(task);

  const year = Number(today.slice(0, 4));
  const snapshotYears = new Set(workspace.billingSnapshots.map((item) => Number(item.periodYear)).filter(Number.isFinite));
  for (let y = year - 3; y <= year; y++) {
    const end = `${y}-12-31`;
    if (end >= today || snapshotYears.has(y)) continue;
    push({
      id: `billing-${workspace.context.buildingId}-${y}`,
      title: `Endabrechnung ${y} fertigstellen`,
      due: billingTarget(y),
      lead: 30,
      origin: "billing",
      periodYear: y,
      buildingId: workspace.context.buildingId
    });
  }

  return out.sort((a, b) => String(a.due || "").localeCompare(String(b.due || "")));
}
