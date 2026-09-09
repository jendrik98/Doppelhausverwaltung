type AnyRecord = Record<string, any>;

declare const AppApplication: {
  createBuildingInPortfolio: (state: AnyRecord, id: string, input: AnyRecord) => AnyRecord;
  updateBuildingInPortfolio: (state: AnyRecord, id: string, input: AnyRecord) => AnyRecord;
};
declare const AppPresentation: {
  createPresentationWorkspace: (state: AnyRecord, buildingId?: string) => AnyRecord;
  createPortfolioAdministrationModel: (state: AnyRecord, buildingId?: string) => AnyRecord;
  resolveActiveBuildingId: (state: AnyRecord, buildingId?: string) => string;
};
declare const $: (id: string) => HTMLElement | null;
declare const esc: (value: unknown) => string;
declare const formField: (options: AnyRecord) => string;
declare const modal: (title: string, html: string, onReady?: () => void) => void;
declare const closeModal: (force?: boolean) => boolean;
declare const uid: () => string;
declare const cloneState: <T>(value: T) => T;
declare const repairDomainState: (value: AnyRecord) => AnyRecord;
declare const persist: (action?: string | null, detail?: string | null) => Promise<boolean>;
declare const projectActiveState: (master: AnyRecord, requested?: string) => AnyRecord;
declare const render: () => void;
declare let portfolioState: AnyRecord;
declare let activeBuildingId: string;
declare let state: AnyRecord;
declare let LAST_STABLE_STATE: AnyRecord | null;

const element = <T extends HTMLElement>(id: string): T | null => $(id) as T | null;

function activateBuilding(next: string): void {
  activeBuildingId = AppPresentation.resolveActiveBuildingId(portfolioState, next);
  state = projectActiveState(portfolioState, activeBuildingId);
  LAST_STABLE_STATE = cloneState(state);
  render();
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

async function persistPortfolioMutation(next: AnyRecord, action: string, detail: string, targetBuildingId: string): Promise<boolean> {
  const previousPortfolio = cloneState(portfolioState);
  const previousState = cloneState(state);
  const previousActive = activeBuildingId;
  const previousStable = LAST_STABLE_STATE ? cloneState(LAST_STABLE_STATE) : null;
  portfolioState = repairDomainState(next);
  activeBuildingId = AppPresentation.resolveActiveBuildingId(portfolioState, targetBuildingId || previousActive);
  state = projectActiveState(portfolioState, activeBuildingId);
  const ok = await persist(action, detail);
  if (!ok) {
    portfolioState = previousPortfolio;
    state = previousState;
    activeBuildingId = previousActive;
    LAST_STABLE_STATE = previousStable;
    render();
  }
  return ok;
}

export function renderBuildingSwitcher(): void {
  const wrap = element<HTMLElement>("buildingSwitchWrap");
  const select = element<HTMLSelectElement>("buildingSelect");
  if (!wrap || !select) return;
  const model = AppPresentation.createPresentationWorkspace(portfolioState, activeBuildingId);
  wrap.classList.toggle("hidden", !model.showBuildingSelector);
  if (!model.showBuildingSelector) {
    select.innerHTML = "";
    return;
  }
  select.innerHTML = model.buildings
    .map((item: AnyRecord) => `<option value="${esc(item.id)}" ${item.active ? "selected" : ""}>${esc(item.name)}</option>`)
    .join("");
  select.onchange = () => {
    const next = select.value;
    if (next === activeBuildingId) return;
    if (!closeModal(false)) {
      select.value = activeBuildingId;
      return;
    }
    activateBuilding(next);
  };
}

function buildingInput(form: HTMLFormElement): AnyRecord {
  const values = Object.fromEntries(new FormData(form));
  return {
    name: String(values.name || "").trim(),
    address: String(values.address || "").trim(),
    totalArea: String(values.totalArea || "").trim(),
    year: String(values.year || "").trim(),
    billingTakeoverDate: String(values.billingTakeoverDate || "").trim(),
    predecessorBillingEnd: String(values.predecessorBillingEnd || "").trim(),
    repayment: String(values.repayment || "0").trim(),
    fixed: String(values.fixed || "0").trim()
  };
}

function openBuildingEditor(buildingId = ""): void {
  const master = portfolioState;
  const existing = (master.buildings || []).find((item: AnyRecord) => String(item.id || "") === buildingId) || null;
  const finance = existing?.finance || {};
  modal(existing ? "Gebäude bearbeiten" : "Gebäude hinzufügen", `<form id="buildingAdminForm" class="form-grid">
    ${formField({ name: "name", label: "Gebäudename", value: existing?.name || "", placeholder: "z. B. Haus B" })}
    ${formField({ name: "address", label: "Adresse", value: existing?.address || "", placeholder: "Straße, Hausnummer, Ort", full: true })}
    ${formField({ name: "totalArea", label: "Gesamtwohnfläche m²", type: "number", step: "0.01", min: 0, value: existing?.totalArea || "" })}
    ${formField({ name: "year", label: "Baujahr", type: "number", min: 1800, value: existing?.year || "" })}
    ${formField({ name: "billingTakeoverDate", label: "Abrechnung übernommen am", type: "date", value: existing?.billingTakeoverDate || "" })}
    ${formField({ name: "predecessorBillingEnd", label: "Voreigentümer rechnet bis", type: "date", value: existing?.predecessorBillingEnd || "" })}
    ${formField({ name: "repayment", label: "Hausrate € / Monat", type: "number", step: "0.01", min: 0, value: finance.repayment ?? 0 })}
    ${formField({ name: "fixed", label: "Feste Hauskosten € / Monat", type: "number", step: "0.01", min: 0, value: finance.fixed ?? 0 })}
    <div class="full form-actions"><button class="primary">${existing ? "Gebäude speichern" : "Gebäude anlegen"}</button></div>
  </form>`, () => {
    const form = element<HTMLFormElement>("buildingAdminForm");
    if (!form) return;
    form.onsubmit = async (event) => {
      event.preventDefault();
      const input = buildingInput(form);
      try {
        const targetId = existing ? String(existing.id) : uid();
        const next = existing
          ? AppApplication.updateBuildingInPortfolio(portfolioState, targetId, input)
          : AppApplication.createBuildingInPortfolio(portfolioState, targetId, input);
        const targetBuildingId = existing ? activeBuildingId : targetId;
        const ok = await persistPortfolioMutation(
          next,
          existing ? "Gebäude geändert" : "Gebäude angelegt",
          input.name,
          targetBuildingId
        );
        if (!ok) return;
        closeModal(true);
        render();
      } catch (error: any) {
        alert(String(error?.message || error));
      }
    };
  });
}

export function openBuildingManager(): void {
  const model = AppPresentation.createPortfolioAdministrationModel(portfolioState, activeBuildingId);
  modal("Gebäude verwalten", `<div class="card">
    <div class="row between"><div><p class="eyebrow">${esc(model.portfolioName)}</p><h3>Gebäude im Portfolio</h3><p class="muted">Das Primärgebäude bleibt fachlich unverändert. „Öffnen“ wechselt nur den aktuellen Arbeitsbereich.</p></div><button id="addBuildingAdmin" class="primary">Gebäude hinzufügen</button></div>
  </div>
  ${model.buildings.map((item: AnyRecord) => `<div class="item"><div class="row between"><div><div class="item-title-row"><h3>${esc(item.name)}</h3>${item.primary ? '<span class="pill good">Primär</span>' : ''}${item.active ? '<span class="pill">Aktiv</span>' : ''}</div><p>${esc(item.address || "Adresse fehlt")}</p><small>${Number(item.totalArea || 0).toLocaleString("de-DE")} m²${item.year ? ` · Baujahr ${esc(item.year)}` : ""} · ${item.counts.units} Einheiten · ${item.counts.tenancies} Mietverhältnisse</small></div><div class="item-actions"><button class="secondary" data-building-open="${esc(item.id)}">Öffnen</button><button class="secondary" data-building-edit="${esc(item.id)}">Bearbeiten</button></div></div></div>`).join("")}`, () => {
    const add = element<HTMLButtonElement>("addBuildingAdmin");
    if (add) add.onclick = () => openBuildingEditor();
    document.querySelectorAll<HTMLElement>("[data-building-open]").forEach((button) => {
      button.onclick = () => {
        const id = button.dataset.buildingOpen || "";
        closeModal(true);
        activateBuilding(id);
      };
    });
    document.querySelectorAll<HTMLElement>("[data-building-edit]").forEach((button) => {
      button.onclick = () => openBuildingEditor(button.dataset.buildingEdit || "");
    });
  });
}
