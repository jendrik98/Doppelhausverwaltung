type Tab = { id: string; label: string; icon?: string };
type RouteLabels = Record<string, string>;
type Defaults = Record<string, string>;
type Subs = Record<string, string>;

export const NAV_MEMORY_KEY = "mietverwaltung_navigation_v1";

const DEEP_LABELS: Record<string, string> = {
  object: "Objekt & Einheiten",
  property: "Objektdaten",
  units: "Einheiten",
  infrastructure: "Zähler & Behälter",
  lifecycle: "Mietkonto & Verlauf",
  water: "Kaltwasser",
  archive: "Jahresarchiv",
  smart: "Assistent",
  sources: "Kostenquellen",
  positions: "Kostenpositionen",
  assessment: "Grundbesitzabgaben",
  lease: "Mietvertrag",
  calculation: "Berechnung",
  workflow: "Abschluss",
  cashflow: "Konto & Buchungen",
  reconciliation: "Zahlungen zuordnen",
  finance: "Hauskosten",
  analytics: "Jahresvergleich",
  tasks: "Erinnerungen",
  legal: "Recht & Regeln",
  security: "Geräteschutz",
  backup: "Datensicherung",
  recovery: "Sicherungspunkte",
  audit: "Änderungsverlauf",
  diagnostics: "App-Prüfung"
};

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
}[char] || char));

export function parseNavigationMemory(raw: string | null, defaults: Defaults, routeLabels: RouteLabels): Subs {
  const result: Subs = { ...defaults };
  if (!raw) return result;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return result;
    for (const [route, sub] of Object.entries(parsed)) {
      if (route !== "home" && routeLabels[route] && typeof sub === "string" && sub.trim()) result[route] = sub;
    }
  } catch {}
  return result;
}

export function serializeNavigationMemory(subs: Subs, routeLabels: RouteLabels): string {
  const persisted: Subs = {};
  for (const [route, sub] of Object.entries(subs || {})) {
    if (route !== "home" && routeLabels[route] && typeof sub === "string" && sub.trim()) persisted[route] = sub;
  }
  return JSON.stringify(persisted);
}

export function loadRememberedSubs(defaults: Defaults, routeLabels: RouteLabels): Subs {
  try { return parseNavigationMemory(localStorage.getItem(NAV_MEMORY_KEY), defaults, routeLabels); }
  catch { return { ...defaults }; }
}

export function rememberSubs(subs: Subs, routeLabels: RouteLabels): void {
  try { localStorage.setItem(NAV_MEMORY_KEY, serializeNavigationMemory(subs, routeLabels)); }
  catch {}
}

export function rememberedTopSub(route: string, subs: Subs, defaults: Defaults): string {
  return String(subs?.[route] || defaults?.[route] || "");
}

export function workspaceTrailLabels(title: string, tabs: Tab[], visible: string, actual = visible): string[] {
  const visibleLabel = tabs.find(tab => tab.id === visible)?.label || visible || "Überblick";
  const labels = [title, visibleLabel];
  const deepLabel = DEEP_LABELS[actual] || actual;
  if (actual && actual !== visible && deepLabel && deepLabel !== visibleLabel) labels.push(deepLabel);
  return labels;
}

export function workspaceHeader(
  group: string,
  eyebrow: string,
  title: string,
  description: string,
  tabs: Tab[],
  visible: string,
  actual = visible
): string {
  const trail = workspaceTrailLabels(title, tabs, visible, actual);
  const buttons = tabs.map(tab => `<button type="button" data-workspace-sub="${esc(tab.id)}" class="${tab.id === visible ? "active" : ""}" ${tab.id === visible ? 'aria-current="page"' : ""}>${tab.icon ? `<span class="nav-symbol" aria-hidden="true">${tab.icon}</span>` : ""}<span>${esc(tab.label)}</span></button>`).join("");
  const options = tabs.map(tab => `<option value="${esc(tab.id)}" ${tab.id === visible ? "selected" : ""}>${esc(tab.label)}</option>`).join("");
  return `<section class="workspace" data-workspace-group="${esc(group)}">
    <div class="section-head workspace-head"><div><p class="eyebrow">${esc(eyebrow)}</p><h2>${esc(title)}</h2><p class="muted">${esc(description)}</p></div></div>
    <nav class="workspace-trail" aria-label="Aktueller Bereich">${trail.map((label,index)=>`<span ${index === trail.length - 1 ? 'aria-current="page"' : ""}>${esc(label)}</span>`).join('<b aria-hidden="true">›</b>')}</nav>
    <div class="workspace-layout">
      <aside class="workspace-sidebar" aria-label="${esc(title)} Navigation">
        <p class="workspace-nav-title">Bereiche</p>
        ${buttons}
      </aside>
      <div class="workspace-content">
        <nav class="workspace-mobile-tabs" aria-label="${esc(title)} Bereiche">${buttons}</nav>
        <select id="workspaceSelect" class="workspace-select-compat" aria-hidden="true" tabindex="-1">${options}</select>
        <div id="workspaceBody"></div>
      </div>
    </div>
  </section>`;
}

export function bindWorkspaceTabs(group: string, onNavigate: (group: string, id: string) => void): void {
  document.querySelectorAll<HTMLElement>("[data-workspace-sub]").forEach(button => {
    button.onclick = () => onNavigate(group, String(button.dataset.workspaceSub || ""));
  });
  const picker = document.getElementById("workspaceSelect") as HTMLSelectElement | null;
  if (picker) picker.onchange = () => onNavigate(group, picker.value);
}
