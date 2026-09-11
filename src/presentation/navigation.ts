export const ROUTE_LABELS = {
  home: "Start",
  rental: "Vermietung",
  data: "Haus",
  owner: "Finanzen",
  more: "Mehr"
} as const;

export type TopRoute = keyof typeof ROUTE_LABELS;

export const DEFAULT_SUB: Record<Exclude<TopRoute, "home">, string> = {
  data: "overview",
  rental: "overview",
  owner: "payments",
  more: "protection"
};

export const SUB_PARENT: Record<string, Record<string, string>> = {
  data: {
    object: "overview",
    property: "overview",
    units: "overview",
    infrastructure: "overview",
    sources: "costs",
    positions: "costs",
    assessment: "costs"
  },
  rental: {
    lease: "overview",
    lifecycle: "overview",
    water: "billing",
    calculation: "billing",
    workflow: "billing"
  },
  owner: {
    overview: "payments",
    cashflow: "payments",
    reconciliation: "payments",
    finance: "planning",
    analytics: "planning",
    tasks: "planning"
  },
  more: {
    overview: "app",
    smart: "app",
    archive: "app",
    legal: "app",
    security: "protection",
    backup: "protection",
    recovery: "protection",
    audit: "app",
    diagnostics: "app"
  }
};

export function normalizeSub(routeName: string, subName: string): string {
  if (!subName) return DEFAULT_SUB[routeName as keyof typeof DEFAULT_SUB] || "";
  return subName;
}

export function visibleSub(routeName: string, subName: string): string {
  return SUB_PARENT[routeName]?.[subName]
    || subName
    || DEFAULT_SUB[routeName as keyof typeof DEFAULT_SUB]
    || "";
}

export function parseRouteHash(hash: string): { route: TopRoute; sub: string } {
  const raw = decodeURIComponent(String(hash || "").replace(/^#/, "")).trim();
  const parts = raw.split("/").filter(Boolean);
  const route = Object.prototype.hasOwnProperty.call(ROUTE_LABELS, parts[0])
    ? parts[0] as TopRoute
    : "home";
  const sub = route === "home"
    ? ""
    : normalizeSub(route, parts[1] || DEFAULT_SUB[route as keyof typeof DEFAULT_SUB]);
  return { route, sub };
}

export function routeHash(route: string, sub: string | null = null): string {
  const safeRoute: TopRoute = Object.prototype.hasOwnProperty.call(ROUTE_LABELS, route)
    ? route as TopRoute
    : "home";
  if (safeRoute === "home") return "#home";
  return `#${safeRoute}/${encodeURIComponent(sub || DEFAULT_SUB[safeRoute as keyof typeof DEFAULT_SUB])}`;
}
