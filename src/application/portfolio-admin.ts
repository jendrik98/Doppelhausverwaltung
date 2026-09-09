import { validateArea, validateIsoDate, validateMoney, validateYear } from "../core/validation";
import { ensurePortfolioModel, validatePortfolioModel } from "../domain/portfolio-model";

type AnyRecord = Record<string, any>;

export const PORTFOLIO_ADMIN_VERSION = 1;

export interface BuildingAdminInput {
  name: string;
  address?: string;
  totalArea: number | string;
  year?: number | string;
  billingTakeoverDate?: string;
  predecessorBillingEnd?: string;
  repayment?: number | string;
  fixed?: number | string;
}

interface NormalizedBuildingAdminInput {
  name: string;
  address: string;
  totalArea: number;
  year: number | "";
  billingTakeoverDate: string;
  predecessorBillingEnd: string;
  repayment: number;
  fixed: number;
}

const clone = <T>(value: T): T => {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
};

function normalizeBuildingInput(input: BuildingAdminInput): NormalizedBuildingAdminInput {
  const name = String(input?.name || "").trim();
  if (!name) throw new Error("Gebäudename fehlt.");

  const area = validateArea(input?.totalArea);
  if (!area.ok || area.value == null) throw new Error(area.message || "Gesamtwohnfläche ist ungültig.");

  const yearText = String(input?.year ?? "").trim();
  let year: number | "" = "";
  if (yearText) {
    const checkedYear = validateYear(yearText);
    if (!checkedYear.ok || checkedYear.value == null) throw new Error(checkedYear.message || "Baujahr ist ungültig.");
    year = checkedYear.value;
  }

  const billingTakeoverDate = String(input?.billingTakeoverDate || "").trim();
  const predecessorBillingEnd = String(input?.predecessorBillingEnd || "").trim();
  for (const [label, value] of [["Übernahmedatum", billingTakeoverDate], ["Voreigentümer-Ende", predecessorBillingEnd]] as const) {
    const checked = validateIsoDate(value);
    if (!checked.ok) throw new Error(`${label}: ${checked.message || "Datum ist ungültig."}`);
  }
  if (billingTakeoverDate && predecessorBillingEnd && predecessorBillingEnd >= billingTakeoverDate) {
    throw new Error("Der Abrechnungszeitraum des Voreigentümers muss vor der eigenen Übernahme enden.");
  }

  const repaymentCheck = validateMoney(input?.repayment ?? 0, { min: 0 });
  const fixedCheck = validateMoney(input?.fixed ?? 0, { min: 0 });
  if (!repaymentCheck.ok) throw new Error(repaymentCheck.message || "Hausrate ist ungültig.");
  if (!fixedCheck.ok) throw new Error(fixedCheck.message || "Feste Hauskosten sind ungültig.");

  return {
    name,
    address: String(input?.address || "").trim(),
    totalArea: area.value,
    year,
    billingTakeoverDate,
    predecessorBillingEnd,
    repayment: Number(repaymentCheck.value || 0),
    fixed: Number(fixedCheck.value || 0)
  };
}

function checkedState(value: AnyRecord): AnyRecord {
  const state = ensurePortfolioModel(value);
  const check = validatePortfolioModel(state);
  if (check.errors.length) throw new Error(check.errors.join(" · "));
  return state;
}

export function createBuildingInPortfolio(value: AnyRecord, id: string, input: BuildingAdminInput): AnyRecord {
  const state = ensurePortfolioModel(clone(value || {}));
  const buildingId = String(id || "").trim();
  if (!buildingId) throw new Error("Gebäude-ID fehlt.");
  if (state.buildings.some((item: AnyRecord) => String(item?.id || "") === buildingId)) {
    throw new Error("Diese Gebäude-ID existiert bereits.");
  }
  const data = normalizeBuildingInput(input);
  const portfolioId = String(state?.meta?.primaryPortfolioId || state.portfolios?.[0]?.id || "");
  if (!portfolioId) throw new Error("Primäres Portfolio fehlt.");

  state.buildings.push({
    id: buildingId,
    portfolioId,
    name: data.name,
    address: data.address,
    totalArea: data.totalArea,
    year: data.year,
    billingTakeoverDate: data.billingTakeoverDate,
    predecessorBillingEnd: data.predecessorBillingEnd,
    finance: { repayment: data.repayment, fixed: data.fixed },
    source: "portfolio-admin"
  });
  return checkedState(state);
}

export function updateBuildingInPortfolio(value: AnyRecord, buildingId: string, input: BuildingAdminInput): AnyRecord {
  const state = ensurePortfolioModel(clone(value || {}));
  const id = String(buildingId || "").trim();
  const index = state.buildings.findIndex((item: AnyRecord) => String(item?.id || "") === id);
  if (index < 0) throw new Error("Gebäude wurde nicht gefunden.");
  const data = normalizeBuildingInput(input);
  const prior = state.buildings[index];
  state.buildings[index] = {
    ...prior,
    id: prior.id,
    portfolioId: prior.portfolioId,
    name: data.name,
    address: data.address,
    totalArea: data.totalArea,
    year: data.year,
    billingTakeoverDate: data.billingTakeoverDate,
    predecessorBillingEnd: data.predecessorBillingEnd,
    finance: { ...(prior.finance || {}), repayment: data.repayment, fixed: data.fixed }
  };

  if (id === String(state?.meta?.primaryBuildingId || "")) {
    state.property = {
      ...(state.property || {}),
      name: data.name,
      address: data.address,
      totalArea: data.totalArea,
      year: data.year,
      billingTakeoverDate: data.billingTakeoverDate,
      predecessorBillingEnd: data.predecessorBillingEnd
    };
    state.finance = { ...(state.finance || {}), repayment: data.repayment, fixed: data.fixed };
  }
  return checkedState(state);
}
