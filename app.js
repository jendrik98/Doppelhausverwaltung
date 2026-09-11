(async function(){
"use strict";
try{


/* ===== compiled src/core/validation.ts ===== */
"use strict";
var AppValidation = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/core/validation.ts
  var validation_exports = {};
  __export(validation_exports, {
    normalizeIban: () => normalizeIban,
    parseGermanNumber: () => parseGermanNumber,
    validateArea: () => validateArea,
    validateDateRange: () => validateDateRange,
    validateEmail: () => validateEmail,
    validateIban: () => validateIban,
    validateIsoDate: () => validateIsoDate,
    validateMeterReading: () => validateMeterReading,
    validateMoney: () => validateMoney,
    validatePositiveNumber: () => validatePositiveNumber,
    validatePostalCodeDE: () => validatePostalCodeDE,
    validateYear: () => validateYear
  });
  var valid = (value) => ({ ok: true, level: "ok", value });
  var invalid = (message) => ({ ok: false, level: "error", message });
  function normalizeIban(input) {
    return String(input ?? "").replace(/\s+/g, "").toUpperCase();
  }
  function validateIban(input, required = false) {
    const iban = normalizeIban(input);
    if (!iban) return required ? invalid("IBAN fehlt.") : valid("");
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) {
      return invalid("Die IBAN hat kein gültiges Format.");
    }
    if (iban.length < 15 || iban.length > 34) {
      return invalid("Die IBAN hat eine unplausible Länge.");
    }
    if (iban.startsWith("DE") && iban.length !== 22) {
      return invalid("Eine deutsche IBAN muss 22 Stellen haben.");
    }
    const rearranged = iban.slice(4) + iban.slice(0, 4);
    let remainder = 0;
    for (const ch of rearranged) {
      const digits = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
      for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
    }
    return remainder === 1 ? valid(iban) : invalid("Die Prüfsumme der IBAN ist ungültig.");
  }
  function parseGermanNumber(input) {
    let text = String(input ?? "").trim().replace(/\s+/g, "");
    if (!text) return null;
    if (text.includes(",") && text.includes(".")) {
      if (text.lastIndexOf(",") > text.lastIndexOf(".")) text = text.replace(/\./g, "").replace(",", ".");
      else text = text.replace(/,/g, "");
    } else if (text.includes(",")) {
      text = text.replace(",", ".");
    }
    if (!/^-?\d+(?:\.\d+)?$/.test(text)) return null;
    const value = Number(text);
    return Number.isFinite(value) ? value : null;
  }
  function validateMoney(input, options = {}) {
    const text = String(input ?? "").trim();
    if (!text) return options.required ? invalid("Betrag fehlt.") : valid(null);
    const value = parseGermanNumber(text);
    if (value === null) return invalid("Der Betrag ist keine gültige Zahl.");
    if (options.min !== void 0 && value < options.min) return invalid(`Der Betrag muss mindestens ${options.min} sein.`);
    if (options.max !== void 0 && value > options.max) return invalid(`Der Betrag darf höchstens ${options.max} sein.`);
    return valid(value);
  }
  function validatePositiveNumber(input, label, allowZero = false) {
    const value = parseGermanNumber(input);
    if (value === null) return invalid(`${label} ist keine gültige Zahl.`);
    if (allowZero ? value < 0 : value <= 0) return invalid(`${label} muss ${allowZero ? "mindestens 0" : "größer als 0"} sein.`);
    return valid(value);
  }
  function validateArea(input) {
    const result = validatePositiveNumber(input, "Wohnfläche");
    if (!result.ok) return result;
    if ((result.value ?? 0) > 1e4) return invalid("Die Wohnfläche ist unplausibel groß.");
    return result;
  }
  function validateYear(input, min = 1800, max = (/* @__PURE__ */ new Date()).getFullYear() + 5) {
    const value = Number(input);
    if (!Number.isInteger(value)) return invalid("Das Jahr ist ungültig.");
    if (value < min || value > max) return invalid(`Das Jahr muss zwischen ${min} und ${max} liegen.`);
    return valid(value);
  }
  function validateIsoDate(input, required = false) {
    const value = String(input ?? "").trim();
    if (!value) return required ? invalid("Datum fehlt.") : valid("");
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return invalid("Das Datum hat kein gültiges Format.");
    const [, y, m, d] = match;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    const same = date.getUTCFullYear() === Number(y) && date.getUTCMonth() + 1 === Number(m) && date.getUTCDate() === Number(d);
    return same ? valid(value) : invalid("Das Datum existiert nicht.");
  }
  function validateDateRange(start, end) {
    const a = validateIsoDate(start, true);
    if (!a.ok) return invalid(`Startdatum: ${a.message}`);
    const b = validateIsoDate(end, true);
    if (!b.ok) return invalid(`Enddatum: ${b.message}`);
    if (start > end) return invalid("Das Enddatum liegt vor dem Startdatum.");
    return valid({ start, end });
  }
  function validateMeterReading(input, previous) {
    const current = parseGermanNumber(input);
    if (current === null || current < 0) return invalid("Der Zählerstand ist ungültig.");
    if (previous !== void 0 && current < previous) {
      return {
        ok: true,
        level: "warning",
        value: current,
        message: "Der neue Zählerstand ist kleiner als der vorherige. Bitte Zählerwechsel oder Eingabe prüfen."
      };
    }
    return valid(current);
  }
  function validateEmail(input, required = false) {
    const value = String(input ?? "").trim();
    if (!value) return required ? invalid("E-Mail-Adresse fehlt.") : valid("");
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? valid(value) : invalid("Die E-Mail-Adresse ist ungültig.");
  }
  function validatePostalCodeDE(input, required = false) {
    const value = String(input ?? "").trim();
    if (!value) return required ? invalid("Postleitzahl fehlt.") : valid("");
    return /^\d{5}$/.test(value) ? valid(value) : invalid("Eine deutsche Postleitzahl muss aus 5 Ziffern bestehen.");
  }
  return __toCommonJS(validation_exports);
})();


/* ===== compiled src/core/feedback.ts ===== */
"use strict";
var AppFeedback = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/core/feedback.ts
  var feedback_exports = {};
  __export(feedback_exports, {
    showToast: () => showToast
  });
  function showToast(message, options = {}) {
    const kind = options.kind ?? "success";
    const timeoutMs = options.timeoutMs ?? 2600;
    let region = document.getElementById("app-feedback-region");
    if (!region) {
      region = document.createElement("div");
      region.id = "app-feedback-region";
      region.setAttribute("aria-live", kind === "error" ? "assertive" : "polite");
      region.setAttribute("aria-atomic", "true");
      document.body.appendChild(region);
    }
    const toast = document.createElement("div");
    toast.className = `app-toast app-toast-${kind}`;
    toast.setAttribute("role", kind === "error" ? "alert" : "status");
    toast.textContent = message;
    region.appendChild(toast);
    window.setTimeout(() => {
      toast.classList.add("is-leaving");
      window.setTimeout(() => toast.remove(), 180);
    }, timeoutMs);
  }
  return __toCommonJS(feedback_exports);
})();


/* ===== compiled src/core/state.ts ===== */
"use strict";
var AppState = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/core/state.ts
  var state_exports = {};
  __export(state_exports, {
    SCHEMA_VERSION: () => SCHEMA_VERSION,
    createEmptyState: () => createEmptyState,
    dateOnlyAddDays: () => dateOnlyAddDays,
    localDateISO: () => localDateISO,
    localMonthEndISO: () => localMonthEndISO,
    normalizeState: () => normalizeState,
    validateState: () => validateState
  });

  // src/core/date.ts
  function localDateISO(date = /* @__PURE__ */ new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  function dateOnlyAddDays(value, days) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return "";
    const date = new Date(
      Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]) + Number(days || 0)
      )
    );
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  }
  function localMonthEndISO(date) {
    return localDateISO(new Date(date.getFullYear(), date.getMonth() + 1, 0));
  }

  // src/core/state.ts
  var SCHEMA_VERSION = 15;
  var ARRAY_KEYS = [
    "portfolios",
    "buildings",
    "units",
    "leases",
    "sources",
    "costPositions",
    "meters",
    "waterSettlements",
    "containers",
    "water",
    "tasks",
    "billingWorkflows",
    "billingSnapshots",
    "rentAllocations",
    "meterReplacements",
    "payments",
    "audit"
  ];
  function createEmptyState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      meta: {
        appVersion: "18.0.0",
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        migratedFrom: null,
        revision: 0,
        lastSavedAt: null,
        lastBackupAt: null,
        lastIntegrityCheckAt: null,
        errorLog: [],
        v17: {
          integrated: true,
          profileSchema: 3,
          waterModule: 3,
          utilityProfile: {
            coldWater: "landlord",
            heating: "tenant",
            hotWater: "tenant",
            electricity: "tenant",
            gas: "tenant"
          }
        }
      },
      property: { name: "", address: "", totalArea: 0, year: "" },
      correspondence: {
        landlordName: "",
        landlordAddress: "",
        iban: "",
        paymentReference: "",
        contact: ""
      },
      portfolios: [],
      buildings: [],
      units: [],
      leases: [],
      sources: [],
      costPositions: [],
      meters: [],
      waterSettlements: [],
      containers: [],
      water: [],
      tasks: [],
      finance: { repayment: 900, fixed: 0 },
      billingWorkflows: [],
      billingSnapshots: [],
      rentAllocations: [],
      meterReplacements: [],
      payments: [],
      audit: []
    };
  }
  function validateState(value) {
    const errors = [];
    if (!value || typeof value !== "object") {
      return { ok: false, errors: ["State fehlt"] };
    }
    const state = value;
    if (!Number.isInteger(state.schemaVersion)) errors.push("schemaVersion fehlt");
    if (!state.property || typeof state.property !== "object") errors.push("property fehlt");
    for (const key of ARRAY_KEYS) {
      if (!Array.isArray(state[key])) errors.push(`${key} ist kein Array`);
    }
    if (!state.finance || typeof state.finance !== "object") errors.push("finance fehlt");
    return { ok: errors.length === 0, errors };
  }
  function normalizeState(value) {
    const state = value && typeof value === "object" ? value : {};
    const base = createEmptyState();
    const out = { ...base, ...state };
    out.property = { ...base.property, ...state.property || {} };
    out.property.billingTakeoverDate = out.property.billingTakeoverDate || out.property.ownershipEffective || "";
    if (out.property.billingTakeoverDate && !out.property.predecessorBillingEnd) {
      out.property.predecessorBillingEnd = dateOnlyAddDays(
        out.property.billingTakeoverDate,
        -1
      );
    }
    out.correspondence = { ...base.correspondence, ...state.correspondence || {} };
    out.finance = { ...base.finance, ...state.finance || {} };
    for (const key of ARRAY_KEYS) {
      out[key] = Array.isArray(state[key]) ? state[key] : [];
    }
    out.schemaVersion = SCHEMA_VERSION;
    out.meta = { ...base.meta, ...state.meta || {}, appVersion: "18.0.0" };
    out.meta.v17 = {
      ...base.meta.v17,
      ...state.meta?.v17 || {},
      integrated: true,
      profileSchema: 3,
      waterModule: 3,
      utilityProfile: {
        coldWater: "landlord",
        heating: "tenant",
        hotWater: "tenant",
        electricity: "tenant",
        gas: "tenant"
      }
    };
    out.meta.revision = Number(out.meta.revision || 0);
    out.meta.errorLog = Array.isArray(out.meta.errorLog) ? out.meta.errorLog : [];
    return out;
  }
  return __toCommonJS(state_exports);
})();


/* ===== compiled src/domain/portfolio-model.ts ===== */
"use strict";
var AppPortfolioModel = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/domain/portfolio-model.ts
  var portfolio_model_exports = {};
  __export(portfolio_model_exports, {
    DEFAULT_BUILDING_ID: () => DEFAULT_BUILDING_ID,
    DEFAULT_PORTFOLIO_ID: () => DEFAULT_PORTFOLIO_ID,
    PORTFOLIO_MODEL_VERSION: () => PORTFOLIO_MODEL_VERSION,
    ensurePortfolioModel: () => ensurePortfolioModel,
    portfolioSummary: () => portfolioSummary,
    validatePortfolioModel: () => validatePortfolioModel
  });
  var PORTFOLIO_MODEL_VERSION = 2;
  var DEFAULT_PORTFOLIO_ID = "portfolio-main";
  var DEFAULT_BUILDING_ID = "building-main";
  function array(value) {
    return Array.isArray(value) ? value : [];
  }
  function uniqueFallbackId(prefix, index, used) {
    let candidate = `${prefix}-${index + 1}`;
    let suffix = index + 1;
    while (used.has(candidate)) candidate = `${prefix}-${++suffix}`;
    used.add(candidate);
    return candidate;
  }
  function ensureIds(items, prefix) {
    const used = new Set(items.map((item) => String(item?.id || "")).filter(Boolean));
    items.forEach((item, index) => {
      if (!item || typeof item !== "object") return;
      if (!item.id) item.id = uniqueFallbackId(prefix, index, used);
    });
  }
  function firstByType(units, type, buildingId) {
    return units.find((unit) => unit?.type === type && (!buildingId || unit.buildingId === buildingId)) || null;
  }
  function mapById(items) {
    return new Map(items.filter((item) => item?.id).map((item) => [String(item.id), item]));
  }
  function linkedBuildingId(item, refs) {
    for (const ref of refs) {
      for (const key of ["unitId", "leaseId", "positionId", "sourceId", "meterId", "mainMeterId", "ownerMeterId", "oldMeterId", "newMeterId"]) {
        const linked = item?.[key] ? ref.get(String(item[key])) : null;
        if (linked?.buildingId) return String(linked.buildingId);
      }
    }
    return "";
  }
  function ensurePortfolioModel(value) {
    const state = value && typeof value === "object" ? value : {};
    state.meta = state.meta && typeof state.meta === "object" ? state.meta : {};
    state.property = state.property && typeof state.property === "object" ? state.property : {};
    for (const key of [
      "portfolios",
      "buildings",
      "units",
      "leases",
      "meters",
      "sources",
      "costPositions",
      "tasks",
      "payments",
      "waterSettlements",
      "billingWorkflows",
      "billingSnapshots",
      "rentAllocations",
      "meterReplacements",
      "containers",
      "water"
    ]) state[key] = array(state[key]);
    ensureIds(state.portfolios, "portfolio");
    ensureIds(state.buildings, "building");
    ensureIds(state.units, "unit");
    ensureIds(state.leases, "tenancy");
    let primaryPortfolio = state.portfolios.find((item) => item.id === state.meta.primaryPortfolioId) || state.portfolios[0];
    if (!primaryPortfolio) {
      primaryPortfolio = {
        id: DEFAULT_PORTFOLIO_ID,
        name: "Privatbestand",
        kind: "private",
        createdAt: state.meta.createdAt || ""
      };
      state.portfolios.push(primaryPortfolio);
    }
    primaryPortfolio.name = primaryPortfolio.name || "Privatbestand";
    primaryPortfolio.kind = primaryPortfolio.kind || "private";
    state.meta.primaryPortfolioId = primaryPortfolio.id;
    const portfolioIds = new Set(state.portfolios.map((item) => String(item.id)));
    for (const building of state.buildings) {
      if (!portfolioIds.has(String(building.portfolioId || ""))) building.portfolioId = primaryPortfolio.id;
    }
    let primaryBuilding = state.buildings.find((item) => item.id === state.meta.primaryBuildingId) || state.buildings[0];
    if (!primaryBuilding) {
      primaryBuilding = {
        id: DEFAULT_BUILDING_ID,
        portfolioId: primaryPortfolio.id,
        name: state.property.name || "Doppelhaus",
        address: state.property.address || "",
        totalArea: Number(state.property.totalArea || 0),
        year: state.property.year || "",
        source: "legacy-property"
      };
      state.buildings.push(primaryBuilding);
    }
    if (!portfolioIds.has(String(primaryBuilding.portfolioId || ""))) primaryBuilding.portfolioId = primaryPortfolio.id;
    state.meta.primaryBuildingId = primaryBuilding.id;
    primaryBuilding.name = state.property.name || primaryBuilding.name || "Doppelhaus";
    primaryBuilding.address = state.property.address || primaryBuilding.address || "";
    primaryBuilding.totalArea = Number(state.property.totalArea || primaryBuilding.totalArea || 0);
    primaryBuilding.year = state.property.year || primaryBuilding.year || "";
    primaryBuilding.billingTakeoverDate = state.property.billingTakeoverDate || primaryBuilding.billingTakeoverDate || "";
    primaryBuilding.predecessorBillingEnd = state.property.predecessorBillingEnd || primaryBuilding.predecessorBillingEnd || "";
    const buildingIds = new Set(state.buildings.map((item) => String(item.id)));
    for (const unit of state.units) {
      if (!buildingIds.has(String(unit.buildingId || ""))) unit.buildingId = primaryBuilding.id;
    }
    const unitById = mapById(state.units);
    const unitIds = new Set(unitById.keys());
    const primaryRental = firstByType(state.units, "rental", primaryBuilding.id) || firstByType(state.units, "rental") || state.units[0] || null;
    for (const lease of state.leases) {
      if (!unitIds.has(String(lease.unitId || ""))) lease.unitId = primaryRental?.id || "";
      const linkedUnit = unitById.get(String(lease.unitId || ""));
      lease.buildingId = linkedUnit?.buildingId || primaryBuilding.id;
    }
    const leaseById = mapById(state.leases);
    const ownerUnitFor = (buildingId) => firstByType(state.units, "owner", buildingId) || (buildingId === primaryBuilding.id ? firstByType(state.units, "owner") : null);
    for (const meter of state.meters) {
      const linkedUnit = unitById.get(String(meter.unitId || ""));
      if (!buildingIds.has(String(meter.buildingId || ""))) meter.buildingId = linkedUnit?.buildingId || primaryBuilding.id;
      if (meter.role === "ownerWater" && !linkedUnit) {
        const ownerUnit = ownerUnitFor(String(meter.buildingId));
        if (ownerUnit) meter.unitId = ownerUnit.id;
      }
      if (meter.unitId && !unitIds.has(String(meter.unitId))) delete meter.unitId;
    }
    const meterById = mapById(state.meters);
    for (const source of state.sources) {
      if (!buildingIds.has(String(source.buildingId || ""))) source.buildingId = primaryBuilding.id;
    }
    const sourceById = mapById(state.sources);
    for (const position of state.costPositions) {
      const linkedSource = sourceById.get(String(position.sourceId || ""));
      if (!buildingIds.has(String(position.buildingId || ""))) position.buildingId = linkedSource?.buildingId || primaryBuilding.id;
    }
    const positionById = mapById(state.costPositions);
    for (const settlement of state.waterSettlements) {
      const mainMeter = meterById.get(String(settlement.mainMeterId || ""));
      const ownerMeter = meterById.get(String(settlement.ownerMeterId || ""));
      if (!buildingIds.has(String(settlement.buildingId || ""))) {
        settlement.buildingId = mainMeter?.buildingId || ownerMeter?.buildingId || primaryBuilding.id;
      }
    }
    const refs = [unitById, leaseById, positionById, sourceById, meterById];
    for (const key of ["tasks", "payments"]) {
      for (const item of state[key]) {
        if (!buildingIds.has(String(item.buildingId || ""))) item.buildingId = linkedBuildingId(item, refs) || primaryBuilding.id;
        const linkedLease = leaseById.get(String(item.leaseId || ""));
        if (linkedLease && !unitIds.has(String(item.unitId || ""))) item.unitId = linkedLease.unitId || "";
      }
    }
    for (const key of ["billingWorkflows", "billingSnapshots", "rentAllocations", "meterReplacements", "containers", "water"]) {
      for (const item of state[key]) {
        if (item && typeof item === "object" && !buildingIds.has(String(item.buildingId || ""))) {
          item.buildingId = linkedBuildingId(item, refs) || primaryBuilding.id;
        }
      }
    }
    if (Number(state.meta.portfolioModelVersion || 0) < PORTFOLIO_MODEL_VERSION) {
      state.meta.portfolioModelMigratedAt = (/* @__PURE__ */ new Date()).toISOString();
    }
    state.meta.portfolioModelVersion = PORTFOLIO_MODEL_VERSION;
    return state;
  }
  function validatePortfolioModel(value) {
    const errors = [];
    const warnings = [];
    if (!value || typeof value !== "object") return { errors: ["Portfolio-Modell fehlt"], warnings };
    const portfolios = array(value.portfolios);
    const buildings = array(value.buildings);
    const units = array(value.units);
    const leases = array(value.leases);
    if (!portfolios.length) errors.push("Portfolio-Modell: kein Portfolio vorhanden");
    if (!buildings.length) errors.push("Portfolio-Modell: kein Gebäude vorhanden");
    const unique = (items, label) => {
      const ids = /* @__PURE__ */ new Set();
      for (const item of items) {
        if (!item?.id) {
          errors.push(`${label}: Datensatz ohne ID`);
          continue;
        }
        const id = String(item.id);
        if (ids.has(id)) errors.push(`${label}: doppelte ID ${id}`);
        ids.add(id);
      }
      return ids;
    };
    const portfolioIds = unique(portfolios, "Portfolios");
    const buildingIds = unique(buildings, "Gebäude");
    const unitIds = unique(units, "Einheiten");
    unique(leases, "Mietverhältnisse");
    const unitById = mapById(units);
    const leaseById = mapById(leases);
    const sourceById = mapById(array(value.sources));
    const positionById = mapById(array(value.costPositions));
    const meterById = mapById(array(value.meters));
    for (const building of buildings) {
      if (!portfolioIds.has(String(building.portfolioId || ""))) errors.push(`Gebäude ${building.id}: Portfolio-Referenz fehlt`);
    }
    for (const unit of units) {
      if (!buildingIds.has(String(unit.buildingId || ""))) errors.push(`Einheit ${unit.id}: Gebäude-Referenz fehlt`);
    }
    for (const lease of leases) {
      const linkedUnit = unitById.get(String(lease.unitId || ""));
      if (units.length && !linkedUnit) errors.push(`Mietverhältnis ${lease.id}: Einheit-Referenz fehlt`);
      if (!units.length && !lease.unitId) warnings.push(`Mietverhältnis ${lease.id}: noch keiner Einheit zugeordnet`);
      if (!buildingIds.has(String(lease.buildingId || ""))) errors.push(`Mietverhältnis ${lease.id}: Gebäude-Referenz fehlt`);
      if (linkedUnit && lease.buildingId !== linkedUnit.buildingId) errors.push(`Mietverhältnis ${lease.id}: Gebäude und Einheit widersprechen sich`);
    }
    for (const meter of array(value.meters)) {
      if (!buildingIds.has(String(meter.buildingId || ""))) errors.push(`Zähler ${meter.id || "?"}: Gebäude-Referenz fehlt`);
      const linkedUnit = meter.unitId ? unitById.get(String(meter.unitId)) : null;
      if (meter.unitId && !linkedUnit) errors.push(`Zähler ${meter.id || "?"}: Einheit-Referenz fehlt`);
      if (linkedUnit && meter.buildingId !== linkedUnit.buildingId) errors.push(`Zähler ${meter.id || "?"}: Gebäude und Einheit widersprechen sich`);
    }
    for (const source of array(value.sources)) {
      if (!buildingIds.has(String(source.buildingId || ""))) errors.push(`Quelle ${source.id || "?"}: Gebäude-Referenz fehlt`);
    }
    for (const position of array(value.costPositions)) {
      if (!buildingIds.has(String(position.buildingId || ""))) errors.push(`Kostenposition ${position.id || "?"}: Gebäude-Referenz fehlt`);
      const source = position.sourceId ? sourceById.get(String(position.sourceId)) : null;
      if (source && source.buildingId !== position.buildingId) errors.push(`Kostenposition ${position.id || "?"}: Quelle gehört zu anderem Gebäude`);
    }
    for (const payment of array(value.payments)) {
      if (!buildingIds.has(String(payment.buildingId || ""))) errors.push(`Zahlung ${payment.id || "?"}: Gebäude-Referenz fehlt`);
      const linked = payment.positionId ? positionById.get(String(payment.positionId)) : payment.sourceId ? sourceById.get(String(payment.sourceId)) : payment.leaseId ? leaseById.get(String(payment.leaseId)) : payment.unitId ? unitById.get(String(payment.unitId)) : null;
      if (linked?.buildingId && linked.buildingId !== payment.buildingId) errors.push(`Zahlung ${payment.id || "?"}: Referenz gehört zu anderem Gebäude`);
    }
    for (const settlement of array(value.waterSettlements)) {
      if (!buildingIds.has(String(settlement.buildingId || ""))) errors.push(`Wasserperiode ${settlement.id || settlement.periodYear || "?"}: Gebäude-Referenz fehlt`);
      for (const key of ["mainMeterId", "ownerMeterId"]) {
        const meter = settlement[key] ? meterById.get(String(settlement[key])) : null;
        if (meter?.buildingId && meter.buildingId !== settlement.buildingId) errors.push(`Wasserperiode ${settlement.id || settlement.periodYear || "?"}: Zähler gehört zu anderem Gebäude`);
      }
    }
    for (const [key, label] of [
      ["tasks", "Aufgaben"],
      ["billingWorkflows", "Abrechnungsworkflows"],
      ["billingSnapshots", "Snapshots"],
      ["rentAllocations", "Mietkonto-Zuordnungen"],
      ["meterReplacements", "Zählerwechsel"],
      ["containers", "Behälter"],
      ["water", "Wasserdaten"]
    ]) {
      for (const item of array(value[key])) {
        if (!buildingIds.has(String(item?.buildingId || ""))) errors.push(`${label} ${item?.id || "?"}: Gebäude-Referenz fehlt`);
      }
    }
    if (value.meta?.primaryPortfolioId && !portfolioIds.has(String(value.meta.primaryPortfolioId))) {
      errors.push("Portfolio-Modell: primäres Portfolio ist ungültig");
    }
    if (value.meta?.primaryBuildingId && !buildingIds.has(String(value.meta.primaryBuildingId))) {
      errors.push("Portfolio-Modell: primäres Gebäude ist ungültig");
    }
    return { errors, warnings };
  }
  function portfolioSummary(value) {
    return {
      portfolios: array(value?.portfolios).length,
      buildings: array(value?.buildings).length,
      units: array(value?.units).length,
      tenancies: array(value?.leases).length,
      primaryPortfolioId: String(value?.meta?.primaryPortfolioId || ""),
      primaryBuildingId: String(value?.meta?.primaryBuildingId || "")
    };
  }
  return __toCommonJS(portfolio_model_exports);
})();


/* ===== compiled src/domain/lifecycle-ledger.ts ===== */
"use strict";
var AppLifecycleLedger = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/domain/lifecycle-ledger.ts
  var lifecycle_ledger_exports = {};
  __export(lifecycle_ledger_exports, {
    LIFECYCLE_LEDGER_VERSION: () => LIFECYCLE_LEDGER_VERSION,
    activeLeaseAt: () => activeLeaseAt,
    actualAdvanceFromLedger: () => actualAdvanceFromLedger,
    addLeaseTerm: () => addLeaseTerm,
    allocationsForLeaseMonth: () => allocationsForLeaseMonth,
    autoAllocationProposal: () => autoAllocationProposal,
    billingRevisionHistory: () => billingRevisionHistory,
    createTenancy: () => createTenancy,
    daysInclusive: () => daysInclusive,
    decorateSnapshotRevision: () => decorateSnapshotRevision,
    ensureLeaseTerms: () => ensureLeaseTerms,
    ensureLifecycleState: () => ensureLifecycleState,
    latestSnapshotFor: () => latestSnapshotFor,
    leaseBillingAnalysis: () => leaseBillingAnalysis,
    leaseChargeForMonth: () => leaseChargeForMonth,
    leaseOverlapsYear: () => leaseOverlapsYear,
    leaseTermAt: () => leaseTermAt,
    leaseWaterConsumption: () => leaseWaterConsumption,
    leasesForBillingYear: () => leasesForBillingYear,
    leasesForUnit: () => leasesForUnit,
    ledgerRow: () => ledgerRow,
    lifecycleAlerts: () => lifecycleAlerts,
    maxDate: () => maxDate,
    meterChain: () => meterChain,
    minDate: () => minDate,
    monthEnd: () => monthEnd,
    monthRange: () => monthRange,
    monthStart: () => monthStart,
    nextSnapshotVersion: () => nextSnapshotVersion,
    paymentAllocations: () => paymentAllocations,
    periodOverlap: () => periodOverlap,
    recordHandover: () => recordHandover,
    recordMeterReplacement: () => recordMeterReplacement,
    rentLedger: () => rentLedger,
    replacePaymentAllocations: () => replacePaymentAllocations,
    replacementsInPeriod: () => replacementsInPeriod,
    roleConsumptionBetween: () => roleConsumptionBetween,
    splitAllocation: () => splitAllocation,
    updateTenancyEnd: () => updateTenancyEnd,
    validateLifecycleState: () => validateLifecycleState,
    waterConsumptionBetween: () => waterConsumptionBetween
  });
  var LIFECYCLE_LEDGER_VERSION = 1;
  var arr = (v) => Array.isArray(v) ? v : [];
  var num = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
  var id = (prefix = "id") => globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  var dateOk = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
  var monthOk = (v) => /^\d{4}-\d{2}$/.test(String(v || ""));
  var dayValue = (v) => {
    const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
  };
  var daysInclusive = (a, b) => {
    const x = dayValue(a), y = dayValue(b);
    return Number.isFinite(x) && Number.isFinite(y) && y >= x ? Math.round((y - x) / 864e5) + 1 : 0;
  };
  var maxDate = (a, b) => !a ? b : !b ? a : a > b ? a : b;
  var minDate = (a, b) => !a ? b : !b ? a : a < b ? a : b;
  var monthStart = (month) => `${month}-01`;
  function monthEnd(month) {
    const [y, m] = month.split("-").map(Number);
    return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
  }
  function monthRange(startMonth, endMonth) {
    if (!monthOk(startMonth) || !monthOk(endMonth) || endMonth < startMonth) return [];
    const out = [];
    let [y, m] = startMonth.split("-").map(Number);
    while (`${y}-${String(m).padStart(2, "0")}` <= endMonth && out.length < 600) {
      out.push(`${y}-${String(m).padStart(2, "0")}`);
      m++;
      if (m === 13) {
        m = 1;
        y++;
      }
    }
    return out;
  }
  function periodOverlap(start, end, otherStart, otherEnd) {
    const s = maxDate(start, otherStart), e = minDate(end, otherEnd);
    return s && e && s <= e ? { start: s, end: e, days: daysInclusive(s, e) } : null;
  }
  function ensureLeaseTerms(lease) {
    lease.terms = arr(lease.terms);
    if (!lease.terms.length && dateOk(lease.start)) lease.terms.push({ id: id("term"), effectiveFrom: lease.start, rent: num(lease.rent), advance: num(lease.advance), reason: "Migration aus Vertragsstammdaten" });
    lease.terms = lease.terms.filter((t) => dateOk(t.effectiveFrom)).map((t) => ({ id: t.id || id("term"), effectiveFrom: t.effectiveFrom, rent: Math.max(0, num(t.rent)), advance: Math.max(0, num(t.advance)), reason: String(t.reason || "") })).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
    const latest = lease.terms.at(-1);
    if (latest) {
      lease.rent = latest.rent;
      lease.advance = latest.advance;
    }
    lease.handover = lease.handover && typeof lease.handover === "object" ? lease.handover : {};
    return lease;
  }
  function ensureLifecycleState(state) {
    state.meta = state.meta && typeof state.meta === "object" ? state.meta : {};
    const previousVersion = Number(state.meta.lifecycleLedgerVersion || 0);
    state.leases = arr(state.leases);
    state.payments = arr(state.payments);
    state.meters = arr(state.meters);
    state.billingSnapshots = arr(state.billingSnapshots);
    state.rentAllocations = arr(state.rentAllocations);
    state.meterReplacements = arr(state.meterReplacements);
    state.units = arr(state.units);
    for (const lease of state.leases) ensureLeaseTerms(lease);
    for (const a of state.rentAllocations) {
      a.id = a.id || id("alloc");
      a.total = num(a.total || num(a.rentAmount) + num(a.advanceAmount));
      a.rentAmount = num(a.rentAmount);
      a.advanceAmount = num(a.advanceAmount);
      a.sign = a.sign === -1 ? -1 : 1;
    }
    if (previousVersion < LIFECYCLE_LEDGER_VERSION) {
      migrateLegacyRentAllocations(state);
      state.meta.lifecycleLedgerMigratedAt = (/* @__PURE__ */ new Date()).toISOString();
    }
    state.meta.lifecycleLedgerVersion = LIFECYCLE_LEDGER_VERSION;
    return state;
  }
  function legacyPaymentMatchesLease(payment, lease) {
    if (String(payment.leaseId || "") === String(lease.id || "")) return true;
    const label = normalize(String(payment.label || "")), tenant = normalize(String(lease.tenantName || ""));
    return /\bmiete\b|mietzahlung|monatsmiete|betriebskosten|nebenkosten|\bbk\b/.test(label) || !!(tenant && label.includes(tenant));
  }
  function migrateLegacyRentAllocations(state) {
    if (state.rentAllocations.length) return;
    for (const payment of state.payments.filter((p) => p.direction === "income" && num(p.amount) > 0).sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))) {
      const date = String(payment.date || "").slice(0, 10);
      if (!dateOk(date)) continue;
      const explicit = payment.leaseId ? state.leases.find((l) => String(l.id || "") === String(payment.leaseId)) : null;
      const active = state.leases.filter((l) => (!l.start || l.start <= date) && (!l.end || l.end >= date));
      const lease = explicit || (active.length === 1 ? active[0] : active.find((l) => legacyPaymentMatchesLease(payment, l)));
      if (!lease || !legacyPaymentMatchesLease(payment, lease)) continue;
      const month = date.slice(0, 7), charge = leaseChargeForMonth(lease, month), applied = Math.min(num(payment.amount), num(charge.total));
      if (applied <= 5e-3) continue;
      const split = splitAllocation(applied, charge);
      state.rentAllocations.push({ id: id("alloc"), buildingId: lease.buildingId || payment.buildingId || "", leaseId: lease.id, paymentId: payment.id, month, rentAmount: split.rentAmount, advanceAmount: split.advanceAmount, total: split.total, sign: 1, kind: "payment", origin: "legacy-payment-migration", confidence: legacyPaymentMatchesLease(payment, lease) ? 90 : 70, createdAt: (/* @__PURE__ */ new Date()).toISOString() });
      payment.leaseId = payment.leaseId || lease.id;
    }
  }
  function leaseTermAt(lease, date) {
    ensureLeaseTerms(lease);
    return lease.terms.filter((t) => t.effectiveFrom <= date).at(-1) || lease.terms[0] || { rent: num(lease.rent), advance: num(lease.advance), effectiveFrom: lease.start || date };
  }
  function leasesForUnit(state, unitId) {
    return arr(state.leases).filter((l) => String(l.unitId || "") === String(unitId || "")).sort((a, b) => String(a.start || "").localeCompare(String(b.start || "")));
  }
  function activeLeaseAt(state, date, unitId = "") {
    return arr(state.leases).find((l) => (!unitId || String(l.unitId || "") === unitId) && (!l.start || l.start <= date) && (!l.end || l.end >= date)) || null;
  }
  function leaseOverlapsYear(lease, year) {
    const ps = `${year}-01-01`, pe = `${year}-12-31`;
    return !!periodOverlap(lease.start || ps, lease.end || pe, ps, pe);
  }
  function leasesForBillingYear(state, year, buildingId = "") {
    return arr(state.leases).filter((l) => (!buildingId || String(l.buildingId || "") === buildingId) && leaseOverlapsYear(l, year)).sort((a, b) => String(a.start || "").localeCompare(String(b.start || "")));
  }
  function leaseChargeForMonth(lease, month) {
    if (!monthOk(month)) return { month, leaseId: lease.id, rent: 0, advance: 0, total: 0, activeDays: 0, monthDays: 0 };
    ensureLeaseTerms(lease);
    const ms = monthStart(month), me = monthEnd(month), active = periodOverlap(lease.start || ms, lease.end || me, ms, me), monthDays = daysInclusive(ms, me);
    if (!active) return { month, leaseId: lease.id, rent: 0, advance: 0, total: 0, activeDays: 0, monthDays };
    const boundaries = /* @__PURE__ */ new Set([active.start]);
    for (const term of lease.terms) if (term.effectiveFrom > active.start && term.effectiveFrom <= active.end) boundaries.add(term.effectiveFrom);
    const starts = [...boundaries].sort(), parts = [];
    let rent = 0, advance = 0;
    for (let i = 0; i < starts.length; i++) {
      const start = starts[i], next = starts[i + 1], end = next ? new Date(dayValue(next) - 864e5).toISOString().slice(0, 10) : active.end, days = daysInclusive(start, end), term = leaseTermAt(lease, start), factor = days / monthDays;
      rent += num(term.rent) * factor;
      advance += num(term.advance) * factor;
      parts.push({ start, end, days, rent: num(term.rent) * factor, advance: num(term.advance) * factor, termId: term.id });
    }
    return { month, leaseId: lease.id, rent, advance, total: rent + advance, activeDays: active.days, monthDays, parts };
  }
  function allocationSigned(a) {
    return (a.sign === -1 ? -1 : 1) * num(a.total || num(a.rentAmount) + num(a.advanceAmount));
  }
  function allocationsForLeaseMonth(state, leaseId, month) {
    return arr(state.rentAllocations).filter((a) => String(a.leaseId || "") === leaseId && a.month === month);
  }
  function ledgerRow(state, lease, month) {
    const charge = leaseChargeForMonth(lease, month), allocations = allocationsForLeaseMonth(state, String(lease.id), month), paid = allocations.reduce((s, a) => s + allocationSigned(a), 0), advancePaid = allocations.reduce((s, a) => s + (a.sign === -1 ? -1 : 1) * num(a.advanceAmount), 0), difference = paid - charge.total;
    return { ...charge, tenantName: lease.tenantName || "", allocations, paid, advancePaid, difference, status: charge.total <= 5e-3 ? "none" : difference >= -0.01 ? difference > 0.01 ? "overpaid" : "paid" : paid > 0.01 ? "partial" : "missing" };
  }
  function rentLedger(state, { buildingId = "", leaseId = "", startMonth = "", endMonth = "" } = {}) {
    ensureLifecycleState(state);
    const now = /* @__PURE__ */ new Date(), end = endMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`, start = startMonth || (() => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })(), months = monthRange(start, end), leases = state.leases.filter((l) => (!buildingId || String(l.buildingId || "") === buildingId) && (!leaseId || String(l.id || "") === leaseId)), rows = [];
    for (const lease of leases) for (const month of months) {
      const row = ledgerRow(state, lease, month);
      if (row.status !== "none") rows.push(row);
    }
    const open = rows.reduce((s, r) => s + Math.max(0, -r.difference), 0), credit = rows.reduce((s, r) => s + Math.max(0, r.difference), 0), expected = rows.reduce((s, r) => s + r.total, 0), paid = rows.reduce((s, r) => s + r.paid, 0);
    return { rows, expected, paid, open, credit, startMonth: start, endMonth: end };
  }
  function splitAllocation(total, charge) {
    const signed = Math.max(0, num(total)), rent = Math.min(signed, Math.max(0, num(charge.rent))), advance = Math.min(Math.max(0, signed - rent), Math.max(0, num(charge.advance)));
    return { rentAmount: rent, advanceAmount: advance, total: rent + advance, unapplied: Math.max(0, signed - rent - advance) };
  }
  function paymentAllocations(state, paymentId) {
    return arr(state.rentAllocations).filter((a) => String(a.paymentId || "") === String(paymentId || ""));
  }
  function replacePaymentAllocations(state, paymentId, items) {
    ensureLifecycleState(state);
    const payment = state.payments.find((p) => String(p.id || "") === String(paymentId || ""));
    if (!payment) throw new Error("Zahlung fehlt.");
    const sign = payment.kind === "rent-reversal" || payment.rentReversal === true ? -1 : 1, amount = Math.max(0, num(payment.amount));
    let sum = 0;
    const out = [];
    for (const raw of items || []) {
      const lease = state.leases.find((l) => String(l.id || "") === String(raw.leaseId || payment.leaseId || ""));
      if (!lease) throw new Error("Mietverhältnis für Zahlungszuordnung fehlt.");
      if (!monthOk(raw.month)) throw new Error("Monat der Zahlungszuordnung ist ungültig.");
      const charge = leaseChargeForMonth(lease, raw.month), requested = Math.max(0, num(raw.total));
      const split = raw.rentAmount != null || raw.advanceAmount != null ? { rentAmount: Math.max(0, num(raw.rentAmount)), advanceAmount: Math.max(0, num(raw.advanceAmount)), total: Math.max(0, num(raw.rentAmount)) + Math.max(0, num(raw.advanceAmount)), unapplied: 0 } : splitAllocation(requested, charge);
      sum += split.total;
      out.push({ id: id("alloc"), buildingId: lease.buildingId || payment.buildingId || "", leaseId: lease.id, paymentId: payment.id, month: raw.month, rentAmount: split.rentAmount, advanceAmount: split.advanceAmount, total: split.total, sign, kind: sign < 0 ? "reversal" : "payment", createdAt: (/* @__PURE__ */ new Date()).toISOString() });
    }
    if (sum > amount + 0.01) throw new Error("Zugeordneter Betrag ist höher als die Buchung.");
    state.rentAllocations = state.rentAllocations.filter((a) => String(a.paymentId || "") !== String(payment.id)).concat(out);
    payment.leaseId = out[0]?.leaseId || payment.leaseId || "";
    payment.kind = sign < 0 ? "rent-reversal" : "rent";
    return { allocations: out, allocated: sum, unallocated: Math.max(0, amount - sum) };
  }
  function autoAllocationProposal(state, paymentId) {
    ensureLifecycleState(state);
    const p = state.payments.find((x) => String(x.id || "") === String(paymentId || ""));
    if (!p || p.direction !== "income") return [];
    const date = String(p.date || "").slice(0, 10), lease = state.leases.find((l) => String(l.id || "") === String(p.leaseId || "")) || activeLeaseAt(state, date) || state.leases.find((l) => normalize(String(p.label || "")).includes(normalize(String(l.tenantName || ""))));
    if (!lease) return [];
    const targetMonth = date.slice(0, 7), months = monthRange(lease.start?.slice(0, 7) || targetMonth, targetMonth), rows = months.map((m) => ledgerRow(state, lease, m)).filter((r) => r.difference < -0.01), out = [];
    let remaining = Math.max(0, num(p.amount));
    for (const row of rows) {
      if (remaining <= 5e-3) break;
      const need = Math.min(remaining, -row.difference), split = splitAllocation(need, { rent: Math.max(0, row.rent - Math.max(0, row.paid)), advance: row.advance });
      out.push({ leaseId: lease.id, month: row.month, ...split, total: need });
      remaining -= need;
    }
    if (!out.length && remaining > 5e-3) out.push({ leaseId: lease.id, month: targetMonth, ...splitAllocation(remaining, leaseChargeForMonth(lease, targetMonth)), total: remaining });
    return out;
  }
  function normalize(v) {
    return String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  }
  function actualAdvanceFromLedger(state, lease, periodStart, periodEnd) {
    ensureLifecycleState(state);
    const rows = arr(state.rentAllocations).filter((a) => String(a.leaseId || "") === String(lease?.id || "") && monthOk(a.month) && periodOverlap(monthStart(a.month), monthEnd(a.month), periodStart, periodEnd)), recognizedPayments = new Set(rows.map((a) => a.paymentId).filter(Boolean));
    return { amount: rows.reduce((s, a) => s + (a.sign === -1 ? -1 : 1) * num(a.advanceAmount), 0), recognizedPayments: recognizedPayments.size, source: "ledger", allocationCount: rows.length };
  }
  function createTenancy(state, payload) {
    ensureLifecycleState(state);
    if (!dateOk(payload.start)) throw new Error("Vertragsbeginn fehlt.");
    const unit = state.units.find((u) => String(u.id || "") === String(payload.unitId || ""));
    if (!unit) throw new Error("Mietwohnung fehlt.");
    const end = payload.end || "9999-12-31";
    for (const other of state.leases) {
      if (String(other.unitId || "") !== String(unit.id) || String(other.id || "") === String(payload.id || "")) continue;
      const overlap = periodOverlap(payload.start, end, other.start || "0001-01-01", other.end || "9999-12-31");
      if (overlap) throw new Error(`Mietverhältnisse überschneiden sich ab ${overlap.start}.`);
    }
    const lease = { id: payload.id || id("lease"), buildingId: unit.buildingId, unitId: unit.id, tenantName: String(payload.tenantName || "").trim(), tenantAddress: String(payload.tenantAddress || "").trim(), start: payload.start, end: payload.end || "", rent: Math.max(0, num(payload.rent)), advance: Math.max(0, num(payload.advance)), note: String(payload.note || "").trim(), terms: [], handover: {} };
    ensureLeaseTerms(lease);
    state.leases.push(lease);
    return lease;
  }
  function updateTenancyEnd(state, leaseId, end, note = "") {
    ensureLifecycleState(state);
    const lease = state.leases.find((l) => String(l.id || "") === String(leaseId));
    if (!lease) throw new Error("Mietverhältnis fehlt.");
    if (end && (!dateOk(end) || end < lease.start)) throw new Error("Vertragsende ist ungültig.");
    lease.end = end || "";
    if (note) lease.note = [lease.note, note].filter(Boolean).join(" · ");
    return lease;
  }
  function addLeaseTerm(state, leaseId, payload) {
    ensureLifecycleState(state);
    const lease = state.leases.find((l) => String(l.id || "") === String(leaseId));
    if (!lease) throw new Error("Mietverhältnis fehlt.");
    const effectiveFrom = String(payload.effectiveFrom || "");
    if (!dateOk(effectiveFrom) || effectiveFrom < lease.start || lease.end && effectiveFrom > lease.end) throw new Error("Stichtag der Vertragsänderung liegt außerhalb des Mietverhältnisses.");
    ensureLeaseTerms(lease);
    const existing = lease.terms.find((t) => t.effectiveFrom === effectiveFrom), term = { id: existing?.id || id("term"), effectiveFrom, rent: Math.max(0, num(payload.rent)), advance: Math.max(0, num(payload.advance)), reason: String(payload.reason || "Vertragsänderung").trim() };
    if (existing) Object.assign(existing, term);
    else lease.terms.push(term);
    ensureLeaseTerms(lease);
    return term;
  }
  function meterForRoleAt(state, role, date, buildingId = "") {
    return state.meters.filter((m) => m.role === role && (!buildingId || String(m.buildingId || "") === buildingId) && (!m.installedAt || m.installedAt <= date) && (!m.removedAt || m.removedAt >= date)).sort((a, b) => String(b.installedAt || "").localeCompare(String(a.installedAt || "")))[0] || null;
  }
  function exactReading(meter, date) {
    return arr(meter?.readings).find((r) => r.date === date) || null;
  }
  function addReading(meter, date, value, origin) {
    meter.readings = arr(meter.readings);
    const existing = exactReading(meter, date);
    if (existing) {
      existing.value = value;
      existing.origin = origin;
      return existing;
    }
    const r = { id: id("reading"), date, value: num(value), origin, synthetic: false, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
    meter.readings.push(r);
    meter.readings.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return r;
  }
  function recordHandover(state, leaseId, payload) {
    ensureLifecycleState(state);
    const lease = state.leases.find((l) => String(l.id || "") === String(leaseId));
    if (!lease) throw new Error("Mietverhältnis fehlt.");
    const kind = payload.kind === "move-out" ? "moveOut" : "moveIn", date = String(payload.date || "");
    if (!dateOk(date)) throw new Error("Übergabedatum fehlt.");
    if (kind === "moveIn" && lease.start && date !== lease.start) throw new Error("Einzugsübergabe muss am Vertragsbeginn liegen.");
    if (kind === "moveOut" && lease.end && date !== lease.end) throw new Error("Auszugsübergabe muss am Vertragsende liegen.");
    const readings = [];
    for (const x of arr(payload.readings)) {
      if (x.value == null || x.value === "") continue;
      const meter = x.meterId ? state.meters.find((m) => String(m.id) === String(x.meterId)) : meterForRoleAt(state, String(x.role || ""), date, String(lease.buildingId || ""));
      if (!meter) continue;
      const reading = addReading(meter, date, num(x.value), "handover");
      readings.push({ meterId: meter.id, role: meter.role, readingId: reading.id, value: reading.value });
    }
    const persons = Math.max(0, num(payload.persons)), unit = state.units.find((u) => String(u.id || "") === String(lease.unitId || ""));
    if (unit && payload.persons !== void 0 && payload.persons !== null && payload.persons !== "") {
      unit.occupancy = arr(unit.occupancy);
      if (kind === "moveIn") {
        for (const o of unit.occupancy) if (!o.to && o.from && o.from < date) o.to = new Date(dayValue(date) - 864e5).toISOString().slice(0, 10);
        const existing = unit.occupancy.find((o) => o.from === date);
        if (existing) existing.count = persons;
        else unit.occupancy.push({ from: date, to: "", count: persons });
      } else {
        const active = unit.occupancy.filter((o) => (!o.from || o.from <= date) && (!o.to || o.to >= date)).sort((a, b) => String(b.from || "").localeCompare(String(a.from || "")))[0];
        if (active) active.to = date;
      }
      unit.occupancy.sort((a, b) => String(a.from || "").localeCompare(String(b.from || "")));
    }
    lease.handover = lease.handover || {};
    lease.handover[kind] = { date, persons, readings, note: String(payload.note || ""), createdAt: (/* @__PURE__ */ new Date()).toISOString() };
    return lease.handover[kind];
  }
  function recordMeterReplacement(state, payload) {
    ensureLifecycleState(state);
    const old = state.meters.find((m) => String(m.id || "") === String(payload.oldMeterId || ""));
    if (!old) throw new Error("Ausgebauter Zähler fehlt.");
    const date = String(payload.date || "");
    if (!dateOk(date)) throw new Error("Wechseldatum fehlt.");
    if (old.removedAt && old.removedAt < date) throw new Error("Zähler war zu diesem Datum bereits ausgebaut.");
    const closing = addReading(old, date, num(payload.oldValue), "meter-replacement-close");
    old.removedAt = date;
    const fresh = { id: id("meter"), buildingId: old.buildingId, unitId: old.unitId || "", role: old.role, name: String(payload.name || old.name || "Zähler"), number: String(payload.newNumber || "").trim(), unit: old.unit || "m³", installedAt: date, removedAt: "", predecessorMeterId: old.id, readings: [] };
    const opening = addReading(fresh, date, num(payload.newValue), "meter-replacement-open");
    old.successorMeterId = fresh.id;
    state.meters.push(fresh);
    const event = { id: id("replacement"), buildingId: old.buildingId, role: old.role, date, oldMeterId: old.id, newMeterId: fresh.id, oldReadingId: closing.id, newReadingId: opening.id, reason: String(payload.reason || "Zählerwechsel"), createdAt: (/* @__PURE__ */ new Date()).toISOString() };
    state.meterReplacements.push(event);
    return { event, oldMeter: old, newMeter: fresh };
  }
  function meterChain(state, role, buildingId = "") {
    return state.meters.filter((m) => m.role === role && (!buildingId || String(m.buildingId || "") === buildingId)).sort((a, b) => String(a.installedAt || "0001-01-01").localeCompare(String(b.installedAt || "0001-01-01")));
  }
  function roleConsumptionBetween(state, role, start, end, buildingId = "") {
    ensureLifecycleState(state);
    if (!dateOk(start) || !dateOk(end) || end < start) return { valid: false, total: 0, segments: [], missing: [start, end] };
    const segments = [], missing = [];
    for (const meter of meterChain(state, role, buildingId)) {
      const seg = periodOverlap(start, end, meter.installedAt || start, meter.removedAt || end);
      if (!seg) continue;
      const sr = exactReading(meter, seg.start), er = exactReading(meter, seg.end);
      if (!sr) missing.push(`${meter.id}:${seg.start}`);
      if (!er) missing.push(`${meter.id}:${seg.end}`);
      if (sr && er) {
        const delta = num(er.value) - num(sr.value);
        segments.push({ meterId: meter.id, start: seg.start, end: seg.end, startReadingId: sr.id, endReadingId: er.id, startValue: num(sr.value), endValue: num(er.value), delta });
      }
    }
    const total = segments.reduce((s, x) => s + x.delta, 0), valid = segments.length > 0 && !missing.length && segments.every((x) => x.delta >= 0);
    return { valid, total, segments, missing: [...new Set(missing)] };
  }
  function waterConsumptionBetween(state, start, end, buildingId = "") {
    const main = roleConsumptionBetween(state, "mainWater", start, end, buildingId), owner = roleConsumptionBetween(state, "ownerWater", start, end, buildingId), tenant = main.total - owner.total;
    return { house: main.total, owner: owner.total, tenant, share: main.total > 0 ? tenant / main.total : 0, mainSegments: main.segments, ownerSegments: owner.segments, missing: [...main.missing, ...owner.missing], valid: main.valid && owner.valid && tenant >= 0 };
  }
  function replacementsInPeriod(state, start, end, buildingId = "") {
    return arr(state.meterReplacements).filter((r) => (!buildingId || String(r.buildingId || "") === buildingId) && r.date >= start && r.date <= end);
  }
  function leaseWaterConsumption(state, lease, year) {
    const ps = `${year}-01-01`, pe = `${year}-12-31`, ov = periodOverlap(lease.start || ps, lease.end || pe, ps, pe);
    return ov ? waterConsumptionBetween(state, ov.start, ov.end, String(lease.buildingId || "")) : { valid: false, house: 0, owner: 0, tenant: 0, share: 0, missing: [] };
  }
  function leaseBillingAnalysis(state, base, year, leaseId) {
    ensureLifecycleState(state);
    const lease = state.leases.find((l) => String(l.id || "") === String(leaseId || ""));
    if (!lease) throw new Error("Mietverhältnis für Abrechnung fehlt.");
    const ps = base?.period?.start || `${year}-01-01`, pe = base?.period?.end || `${year}-12-31`, leasePeriod = periodOverlap(lease.start || ps, lease.end || pe, ps, pe);
    if (!leasePeriod) return { ...base, lease, leaseId: lease.id, events: [], tenantCosts: 0, advances: 0, result: 0, unresolved: [{ id: "lease-period", reason: "Mietverhältnis liegt außerhalb der Periode." }] };
    const fullDays = daysInclusive(ps, pe), leaseDays = leasePeriod.days, water = waterConsumptionBetween(state, leasePeriod.start, leasePeriod.end, String(lease.buildingId || "")), wholeWater = waterConsumptionBetween(state, ps, pe, String(lease.buildingId || ""));
    const yearLeases = leasesForBillingYear(state, year, String(lease.buildingId || ""));
    const leasePersons = (l) => Math.max(0, num(l.handover?.moveIn?.persons || 1));
    const events = arr(base?.events).map((e) => {
      const eventPeriod = periodOverlap(maxDate(ps, e.serviceStart || ps), minDate(pe, e.serviceEnd || pe), ps, pe), leaseEvent = eventPeriod ? periodOverlap(eventPeriod.start, eventPeriod.end, leasePeriod.start, leasePeriod.end) : null;
      let factor = eventPeriod?.days ? num(leaseEvent?.days) / eventPeriod.days : fullDays ? leaseDays / fullDays : 0;
      if (e.decision?.rule === "persons" && eventPeriod) {
        const weighted = yearLeases.map((l) => {
          const ov = periodOverlap(l.start || eventPeriod.start, l.end || eventPeriod.end, eventPeriod.start, eventPeriod.end);
          return { id: l.id, value: num(ov?.days) * leasePersons(l) };
        }), den = weighted.reduce((sum, x) => sum + x.value, 0), mine = weighted.find((x) => String(x.id) === String(lease.id))?.value || 0;
        factor = den > 0 ? mine / den : factor;
      }
      if (e.decision?.rule === "consumption") {
        factor = wholeWater.valid && wholeWater.tenant > 0 && water.valid ? water.tenant / wholeWater.tenant : 0;
      }
      const tenantAmount = num(e.tenantAmount) * factor;
      return { ...e, tenantAmount, lifecycleFactor: factor, leaseId: lease.id, leasePeriod: { ...leasePeriod }, lifecycleWater: e.decision?.rule === "consumption" ? water : null };
    });
    const unresolved = arr(base?.unresolved).slice();
    if (arr(base?.events).some((e) => e.decision?.rule === "consumption") && !water.valid) unresolved.push({ id: "lease-water", reason: "Übergabe-/Zählerstände für den Mietzeitraum sind nicht vollständig.", missing: water.missing });
    const ledger = actualAdvanceFromLedger(state, lease, leasePeriod.start, leasePeriod.end), legacyFallback = !ledger.allocationCount && yearLeases.length === 1 ? num(base?.advances) : 0, advances = ledger.allocationCount ? ledger.amount : legacyFallback;
    if (!ledger.allocationCount && yearLeases.length > 1) unresolved.push({ id: "lease-ledger", reason: "Bei mehreren Mietverhältnissen müssen die Vorauszahlungen im Mietkonto zugeordnet sein." });
    const tenantCosts = events.reduce((s, e) => s + num(e.tenantAmount), 0);
    return { ...base, lease, leaseId: lease.id, leasePeriod, events, unresolved, tenantCosts, advances, advanceEvidence: ledger, result: tenantCosts - advances, waterConsumption: water };
  }
  function latestSnapshotFor(state, periodYear, leaseId = "") {
    return arr(state.billingSnapshots).filter((s) => Number(s.periodYear) === Number(periodYear) && (!leaseId || String(s.leaseId || s.lease?.id || "") === String(leaseId))).sort((a, b) => Number(b.version || 1) - Number(a.version || 1) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0] || null;
  }
  function nextSnapshotVersion(state, periodYear, leaseId = "") {
    return Number(latestSnapshotFor(state, periodYear, leaseId)?.version || 0) + 1;
  }
  function decorateSnapshotRevision(state, snapshot, { leaseId = "", correctionReason = "", supersedesSnapshotId = "" } = {}) {
    const actualLeaseId = leaseId || snapshot.leaseId || snapshot.lease?.id || "", prior = supersedesSnapshotId ? state.billingSnapshots.find((s) => String(s.id) === String(supersedesSnapshotId)) : latestSnapshotFor(state, Number(snapshot.periodYear), actualLeaseId), version = prior ? Number(prior.version || 1) + 1 : 1;
    return { ...snapshot, leaseId: actualLeaseId, statementId: snapshot.statementId || `${snapshot.buildingId || "building"}:${snapshot.periodYear}:${actualLeaseId || "lease"}`, version, supersedesSnapshotId: prior?.id || "", correctionReason: version > 1 ? String(correctionReason || "").trim() : "", revisionCreatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  }
  function billingRevisionHistory(state, periodYear, leaseId = "") {
    return arr(state.billingSnapshots).filter((s) => Number(s.periodYear) === Number(periodYear) && (!leaseId || String(s.leaseId || s.lease?.id || "") === String(leaseId))).sort((a, b) => Number(a.version || 1) - Number(b.version || 1));
  }
  function lifecycleAlerts(state, buildingId = "", today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)) {
    ensureLifecycleState(state);
    const out = [], leases = state.leases.filter((l) => !buildingId || String(l.buildingId || "") === buildingId);
    for (const lease of leases) {
      if (lease.start <= today && (!lease.end || lease.end >= today) && !lease.handover?.moveIn) out.push({ id: `handover-in-${lease.id}`, severity: "warn", title: "Einzugsübergabe fehlt", detail: `${lease.tenantName || "Mietverhältnis"}: Übergabestand zum ${lease.start} erfassen.`, route: "rental", sub: "lifecycle", leaseId: lease.id });
      if (lease.end && lease.end <= today && !lease.handover?.moveOut) out.push({ id: `handover-out-${lease.id}`, severity: "warn", title: "Auszugsübergabe fehlt", detail: `${lease.tenantName || "Mietverhältnis"}: Schlussablesung zum ${lease.end} erfassen.`, route: "rental", sub: "lifecycle", leaseId: lease.id });
    }
    const ledger = rentLedger(state, { buildingId });
    for (const row of ledger.rows.filter((r) => ["missing", "partial"].includes(r.status) && monthEnd(r.month) < today).slice(-6)) out.push({ id: `rent-${row.leaseId}-${row.month}`, severity: "warn", title: `Mietkonto ${row.month} offen`, detail: `${row.tenantName || "Mietverhältnis"}: ${Math.abs(row.difference).toFixed(2)} € offen.`, route: "rental", sub: "lifecycle", leaseId: row.leaseId });
    return out;
  }
  function validateLifecycleState(state) {
    ensureLifecycleState(state);
    const errors = [], warnings = [];
    const leaseIds = new Set(state.leases.map((l) => String(l.id || ""))), paymentIds = new Set(state.payments.map((p) => String(p.id || ""))), meterIds = new Set(state.meters.map((m) => String(m.id || "")));
    for (const unit of state.units) {
      const leases = leasesForUnit(state, String(unit.id || ""));
      for (let i = 1; i < leases.length; i++) {
        const a = leases[i - 1], b = leases[i], ov = periodOverlap(a.start || "0001-01-01", a.end || "9999-12-31", b.start || "0001-01-01", b.end || "9999-12-31");
        if (ov) errors.push(`Mietverhältnisse ${a.id}/${b.id} überschneiden sich ab ${ov.start}`);
      }
    }
    for (const lease of state.leases) {
      if (!dateOk(lease.start)) warnings.push(`Mietverhältnis ${lease.id}: historischer Vertragsbeginn fehlt`);
      ensureLeaseTerms(lease);
      const seen = /* @__PURE__ */ new Set();
      for (const term of lease.terms) {
        if (seen.has(term.effectiveFrom)) errors.push(`Mietverhältnis ${lease.id}: doppelter Vertragsstichtag ${term.effectiveFrom}`);
        seen.add(term.effectiveFrom);
      }
    }
    for (const a of state.rentAllocations) {
      if (!leaseIds.has(String(a.leaseId || ""))) errors.push(`Mietzuordnung ${a.id}: Mietverhältnis fehlt`);
      if (!paymentIds.has(String(a.paymentId || ""))) errors.push(`Mietzuordnung ${a.id}: Zahlung fehlt`);
      if (!monthOk(a.month)) errors.push(`Mietzuordnung ${a.id}: Monat ungültig`);
      if (num(a.rentAmount) < 0 || num(a.advanceAmount) < 0) errors.push(`Mietzuordnung ${a.id}: negativer Teilbetrag`);
    }
    for (const r of state.meterReplacements) {
      if (!meterIds.has(String(r.oldMeterId || "")) || !meterIds.has(String(r.newMeterId || ""))) errors.push(`Zählerwechsel ${r.id}: Zählerreferenz fehlt`);
      if (!dateOk(r.date)) errors.push(`Zählerwechsel ${r.id}: Datum ungültig`);
    }
    for (const s of state.billingSnapshots) {
      if (Number(s.version || 1) > 1 && !String(s.correctionReason || "").trim()) warnings.push(`Abrechnung ${s.id}: Korrekturgrund fehlt`);
    }
    return { errors, warnings };
  }
  return __toCommonJS(lifecycle_ledger_exports);
})();


/* ===== compiled src/infrastructure/portfolio-repository.ts ===== */
"use strict";
var AppPortfolioRepository = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/infrastructure/portfolio-repository.ts
  var portfolio_repository_exports = {};
  __export(portfolio_repository_exports, {
    PORTFOLIO_PROJECTION_ID: () => PORTFOLIO_PROJECTION_ID,
    PORTFOLIO_REPOSITORY_VERSION: () => PORTFOLIO_REPOSITORY_VERSION,
    getBuildingGraph: () => getBuildingGraph,
    getProjectionMeta: () => getProjectionMeta,
    listBuildings: () => listBuildings,
    listPortfolios: () => listPortfolios,
    listTenanciesByBuilding: () => listTenanciesByBuilding,
    listTenanciesByUnit: () => listTenanciesByUnit,
    listUnitsByBuilding: () => listUnitsByBuilding,
    projectPortfolioState: () => projectPortfolioState,
    readStateRecord: () => readStateRecord2,
    saveState: () => saveState,
    validatePortfolioProjection: () => validatePortfolioProjection
  });

  // src/core/persistence.ts
  var DB_NAME = "mietverwaltung-v6";
  var DB_VERSION = 3;
  var STATE_ID = "main";
  var STATE_STORE = "state";
  var DOCS_STORE = "docs";
  var PORTFOLIO_STORE = "portfolios";
  var BUILDING_STORE = "buildings";
  var UNIT_STORE = "units";
  var TENANCY_STORE = "tenancies";
  var REPOSITORY_META_STORE = "repositoryMeta";
  function requestValue(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB-Transaktion abgebrochen"));
    });
  }
  function ensureStore(db, transaction, name, indexes = []) {
    const store = db.objectStoreNames.contains(name) ? transaction.objectStore(name) : db.createObjectStore(name, { keyPath: "id" });
    for (const index of indexes) {
      if (!store.indexNames.contains(index.name)) store.createIndex(index.name, index.keyPath, { unique: false });
    }
    return store;
  }
  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        const transaction = request.transaction;
        if (!transaction) throw new Error("IndexedDB-Upgrade ohne Transaktion");
        ensureStore(db, transaction, STATE_STORE);
        ensureStore(db, transaction, DOCS_STORE);
        ensureStore(db, transaction, PORTFOLIO_STORE);
        ensureStore(db, transaction, BUILDING_STORE, [{ name: "portfolioId", keyPath: "portfolioId" }]);
        ensureStore(db, transaction, UNIT_STORE, [{ name: "buildingId", keyPath: "buildingId" }]);
        ensureStore(db, transaction, TENANCY_STORE, [
          { name: "buildingId", keyPath: "buildingId" },
          { name: "unitId", keyPath: "unitId" }
        ]);
        ensureStore(db, transaction, REPOSITORY_META_STORE);
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onblocked = () => reject(new Error("IndexedDB-Upgrade wird durch einen älteren geöffneten App-Tab blockiert"));
      request.onerror = () => reject(request.error);
    });
  }
  async function readStateRecord() {
    const db = await openDB();
    const transaction = db.transaction(STATE_STORE, "readonly");
    const request = transaction.objectStore(STATE_STORE).get(STATE_ID);
    const record = await requestValue(request);
    return record ?? null;
  }

  // src/infrastructure/portfolio-repository.ts
  var PORTFOLIO_REPOSITORY_VERSION = 1;
  var PORTFOLIO_PROJECTION_ID = "portfolio-projection";
  function records(value) {
    return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
  }
  function projectPortfolioState(state) {
    return {
      portfolios: records(state?.portfolios),
      buildings: records(state?.buildings),
      units: records(state?.units),
      tenancies: records(state?.leases)
    };
  }
  function validatePortfolioProjection(projection) {
    const errors = [];
    const unique = (items, label) => {
      const ids = /* @__PURE__ */ new Set();
      for (const item of items) {
        const id = String(item?.id || "");
        if (!id) {
          errors.push(`${label}: ID fehlt`);
          continue;
        }
        if (ids.has(id)) errors.push(`${label}: doppelte ID ${id}`);
        ids.add(id);
      }
      return ids;
    };
    const portfolioIds = unique(projection.portfolios, "Portfolio");
    const buildingIds = unique(projection.buildings, "Gebäude");
    const unitIds = unique(projection.units, "Einheit");
    unique(projection.tenancies, "Mietverhältnis");
    const unitById = new Map(projection.units.map((unit) => [String(unit.id), unit]));
    for (const building of projection.buildings) {
      if (!portfolioIds.has(String(building.portfolioId || ""))) errors.push(`Gebäude ${building.id}: Portfolio fehlt`);
    }
    for (const unit of projection.units) {
      if (!buildingIds.has(String(unit.buildingId || ""))) errors.push(`Einheit ${unit.id}: Gebäude fehlt`);
    }
    for (const tenancy of projection.tenancies) {
      const unitId = String(tenancy.unitId || "");
      const unit = unitById.get(unitId);
      if (!unitIds.has(unitId) || !unit) errors.push(`Mietverhältnis ${tenancy.id}: Einheit fehlt`);
      if (!buildingIds.has(String(tenancy.buildingId || ""))) errors.push(`Mietverhältnis ${tenancy.id}: Gebäude fehlt`);
      if (unit && unit.buildingId !== tenancy.buildingId) errors.push(`Mietverhältnis ${tenancy.id}: Gebäude/Einheit inkonsistent`);
    }
    return errors;
  }
  function projectionMeta(state, projection) {
    return {
      id: PORTFOLIO_PROJECTION_ID,
      repositoryVersion: PORTFOLIO_REPOSITORY_VERSION,
      revision: Number(state?.meta?.revision || 0),
      schemaVersion: Number(state?.schemaVersion || 0),
      portfolioModelVersion: Number(state?.meta?.portfolioModelVersion || 0),
      counts: {
        portfolios: projection.portfolios.length,
        buildings: projection.buildings.length,
        units: projection.units.length,
        tenancies: projection.tenancies.length
      },
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  async function readStateRecord2() {
    return readStateRecord();
  }
  async function saveState(state) {
    const projection = projectPortfolioState(state);
    const errors = validatePortfolioProjection(projection);
    if (errors.length) throw new Error(`Portfolio-Persistenz: ${errors.join(" · ")}`);
    const db = await openDB();
    const transaction = db.transaction(
      [STATE_STORE, PORTFOLIO_STORE, BUILDING_STORE, UNIT_STORE, TENANCY_STORE, REPOSITORY_META_STORE],
      "readwrite"
    );
    transaction.objectStore(STATE_STORE).put({ id: STATE_ID, data: state });
    const portfolioStore = transaction.objectStore(PORTFOLIO_STORE);
    const buildingStore = transaction.objectStore(BUILDING_STORE);
    const unitStore = transaction.objectStore(UNIT_STORE);
    const tenancyStore = transaction.objectStore(TENANCY_STORE);
    portfolioStore.clear();
    buildingStore.clear();
    unitStore.clear();
    tenancyStore.clear();
    for (const item of projection.portfolios) portfolioStore.put(item);
    for (const item of projection.buildings) buildingStore.put(item);
    for (const item of projection.units) unitStore.put(item);
    for (const item of projection.tenancies) tenancyStore.put(item);
    transaction.objectStore(REPOSITORY_META_STORE).put(projectionMeta(state, projection));
    await transactionDone(transaction);
  }
  async function getAll(storeName) {
    const db = await openDB();
    const transaction = db.transaction(storeName, "readonly");
    return await requestValue(transaction.objectStore(storeName).getAll()) || [];
  }
  async function getAllByIndex(storeName, indexName, value) {
    const db = await openDB();
    const transaction = db.transaction(storeName, "readonly");
    return await requestValue(transaction.objectStore(storeName).index(indexName).getAll(value)) || [];
  }
  async function listPortfolios() {
    return getAll(PORTFOLIO_STORE);
  }
  async function listBuildings(portfolioId) {
    return portfolioId ? getAllByIndex(BUILDING_STORE, "portfolioId", portfolioId) : getAll(BUILDING_STORE);
  }
  async function listUnitsByBuilding(buildingId) {
    return getAllByIndex(UNIT_STORE, "buildingId", buildingId);
  }
  async function listTenanciesByBuilding(buildingId) {
    return getAllByIndex(TENANCY_STORE, "buildingId", buildingId);
  }
  async function listTenanciesByUnit(unitId) {
    return getAllByIndex(TENANCY_STORE, "unitId", unitId);
  }
  async function getProjectionMeta() {
    const db = await openDB();
    const transaction = db.transaction(REPOSITORY_META_STORE, "readonly");
    const result = await requestValue(
      transaction.objectStore(REPOSITORY_META_STORE).get(PORTFOLIO_PROJECTION_ID)
    );
    return result ?? null;
  }
  async function getBuildingGraph(buildingId) {
    const db = await openDB();
    const transaction = db.transaction([BUILDING_STORE, UNIT_STORE, TENANCY_STORE], "readonly");
    const buildingRequest = transaction.objectStore(BUILDING_STORE).get(buildingId);
    const unitsRequest = transaction.objectStore(UNIT_STORE).index("buildingId").getAll(buildingId);
    const tenanciesRequest = transaction.objectStore(TENANCY_STORE).index("buildingId").getAll(buildingId);
    const [building, units, tenancies] = await Promise.all([
      requestValue(buildingRequest),
      requestValue(unitsRequest),
      requestValue(tenanciesRequest)
    ]);
    return { building: building ?? null, units: units || [], tenancies: tenancies || [] };
  }
  return __toCommonJS(portfolio_repository_exports);
})();


/* ===== compiled src/application/index.ts ===== */
"use strict";
var AppApplication = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/application/index.ts
  var index_exports = {};
  __export(index_exports, {
    APPLICATION_VERSION: () => APPLICATION_VERSION,
    PORTFOLIO_ADMIN_VERSION: () => PORTFOLIO_ADMIN_VERSION,
    RENTAL_LIFECYCLE_APPLICATION_VERSION: () => RENTAL_LIFECYCLE_APPLICATION_VERSION,
    addLeaseTermCommand: () => addLeaseTermCommand,
    allocateRentPaymentCommand: () => allocateRentPaymentCommand,
    assertBuildingScopedMutation: () => assertBuildingScopedMutation,
    assertContextIntegrity: () => assertContextIntegrity,
    buildingScopedCollections: () => buildingScopedCollections,
    closeTenancyCommand: () => closeTenancyCommand,
    commandResult: () => commandResult,
    createBuildingInPortfolio: () => createBuildingInPortfolio,
    createCommandBus: () => createCommandBus,
    createRentReversalCommand: () => createRentReversalCommand,
    createTenancyCommand: () => createTenancyCommand,
    lifecycleWorkspaceModel: () => lifecycleWorkspaceModel,
    loadApplicationState: () => loadApplicationState,
    portfolioNavigation: () => portfolioNavigation,
    queryBuildingWorkspace: () => queryBuildingWorkspace,
    queryTaskList: () => queryTaskList,
    reconciliationSummary: () => reconciliationSummary,
    recordHandoverCommand: () => recordHandoverCommand,
    recordMeterReplacementCommand: () => recordMeterReplacementCommand,
    resolveApplicationContext: () => resolveApplicationContext,
    safeCommandSummary: () => safeCommandSummary,
    updateBuildingInPortfolio: () => updateBuildingInPortfolio
  });

  // src/application/contracts.ts
  var APPLICATION_VERSION = 1;

  // src/application/context.ts
  var BUILDING_SCOPED_COLLECTIONS = [
    "units",
    "leases",
    "sources",
    "costPositions",
    "meters",
    "waterSettlements",
    "tasks",
    "payments",
    "billingWorkflows",
    "billingSnapshots",
    "rentAllocations",
    "meterReplacements",
    "containers",
    "water"
  ];
  function records(value) {
    return Array.isArray(value) ? value.filter((item) => !!item && typeof item === "object") : [];
  }
  function byId(state, collection, id) {
    if (!id) return null;
    const key = String(id);
    return records(state?.[collection]).find((item) => String(item.id || "") === key) || null;
  }
  function recordBuildingId(state, collection, id) {
    return String(byId(state, collection, id)?.buildingId || "");
  }
  function inferBuildingFromPayload(state, type, payload) {
    if (payload.buildingId) return String(payload.buildingId);
    const directRefs = [
      ["unitId", "units"],
      ["tenancyId", "leases"],
      ["leaseId", "leases"],
      ["sourceId", "sources"],
      ["positionId", "costPositions"],
      ["meterId", "meters"],
      ["paymentId", "payments"]
    ];
    for (const [key, collection] of directRefs) {
      const buildingId = recordBuildingId(state, collection, payload[key]);
      if (buildingId) return buildingId;
    }
    if (payload.id) {
      const typeCollection = type.startsWith("unit.") ? "units" : type.startsWith("tenancy.") || type.startsWith("lease.") ? "leases" : type.startsWith("source.") ? "sources" : type.startsWith("costPosition.") ? "costPositions" : type.startsWith("meter.") ? "meters" : type.startsWith("payment.") ? "payments" : "";
      if (typeCollection) {
        const buildingId = recordBuildingId(state, typeCollection, payload.id);
        if (buildingId) return buildingId;
      }
    }
    return "";
  }
  function resolveApplicationContext(state, type = "", payload = {}) {
    const buildings = records(state?.buildings);
    const units = records(state?.units);
    const leases = records(state?.leases);
    let buildingId = inferBuildingFromPayload(state, type, payload) || String(state?.meta?.primaryBuildingId || buildings[0]?.id || "");
    let unitId = String(payload.unitId || "");
    let tenancyId = String(payload.tenancyId || payload.leaseId || "");
    if (!unitId && tenancyId) unitId = String(byId(state, "leases", tenancyId)?.unitId || "");
    if (!tenancyId && payload.paymentId) {
      const payment = byId(state, "payments", payload.paymentId);
      tenancyId = String(payment?.tenancyId || payment?.leaseId || "");
      unitId ||= String(payment?.unitId || "");
    }
    if (!unitId && payload.id && (type.startsWith("tenancy.") || type.startsWith("lease."))) {
      unitId = String(byId(state, "leases", payload.id)?.unitId || "");
      tenancyId ||= String(payload.id);
    }
    const unit = units.find((item) => String(item.id || "") === unitId) || null;
    const tenancy = leases.find((item) => String(item.id || "") === tenancyId) || null;
    if (!buildingId) buildingId = String(unit?.buildingId || tenancy?.buildingId || "");
    if (!unitId && tenancy?.unitId) unitId = String(tenancy.unitId);
    const building = buildings.find((item) => String(item.id || "") === buildingId) || null;
    const portfolioId = String(payload.portfolioId || building?.portfolioId || state?.meta?.primaryPortfolioId || state?.portfolios?.[0]?.id || "");
    return { portfolioId, buildingId, unitId, tenancyId };
  }
  function assertContextIntegrity(state, context) {
    const buildings = records(state?.buildings);
    const building = buildings.find((item) => String(item.id || "") === context.buildingId) || null;
    if (context.buildingId && !building) throw new Error(`Application-Kontext: Gebäude ${context.buildingId} fehlt`);
    if (building && context.portfolioId && String(building.portfolioId || "") !== context.portfolioId) {
      throw new Error("Application-Kontext: Gebäude gehört zu einem anderen Portfolio");
    }
    if (context.unitId) {
      const unit = byId(state, "units", context.unitId);
      if (!unit) throw new Error(`Application-Kontext: Einheit ${context.unitId} fehlt`);
      if (context.buildingId && String(unit.buildingId || "") !== context.buildingId) {
        throw new Error("Application-Kontext: Einheit gehört zu einem anderen Gebäude");
      }
    }
    if (context.tenancyId) {
      const tenancy = byId(state, "leases", context.tenancyId);
      if (!tenancy) throw new Error(`Application-Kontext: Mietverhältnis ${context.tenancyId} fehlt`);
      if (context.buildingId && String(tenancy.buildingId || "") !== context.buildingId) {
        throw new Error("Application-Kontext: Mietverhältnis gehört zu einem anderen Gebäude");
      }
      if (context.unitId && tenancy.unitId && String(tenancy.unitId) !== context.unitId) {
        throw new Error("Application-Kontext: Mietverhältnis gehört zu einer anderen Einheit");
      }
    }
  }
  function changedRecords(before, after, collection) {
    const beforeItems = records(before?.[collection]);
    const afterItems = records(after?.[collection]);
    const prior = new Map(beforeItems.map((item) => [String(item.id || ""), JSON.stringify(item)]));
    const afterIds = new Set(afterItems.map((item) => String(item.id || "")));
    const changed = afterItems.filter((item) => {
      const id = String(item.id || "");
      return !id || prior.get(id) !== JSON.stringify(item);
    });
    const deleted = beforeItems.filter((item) => item.id && !afterIds.has(String(item.id)));
    return [...changed, ...deleted];
  }
  function assertBuildingScopedMutation(before, after, context) {
    if (!context.buildingId) return;
    for (const collection of BUILDING_SCOPED_COLLECTIONS) {
      for (const record of changedRecords(before, after, collection)) {
        const buildingId = String(record.buildingId || "");
        if (buildingId && buildingId !== context.buildingId) {
          throw new Error(`Application-Scope: ${collection}/${record.id || "?"} gehört zu ${buildingId} statt ${context.buildingId}`);
        }
      }
    }
  }
  function buildingScopedCollections() {
    return BUILDING_SCOPED_COLLECTIONS;
  }

  // src/application/queries.ts
  function records2(value) {
    return Array.isArray(value) ? value.filter((item) => !!item && typeof item === "object") : [];
  }
  function scoped(items, buildingId) {
    return buildingId ? items.filter((item) => String(item.buildingId || "") === buildingId) : items.slice();
  }
  function queryBuildingWorkspace(state, requested = {}) {
    const context = resolveApplicationContext(state, "query.buildingWorkspace", requested);
    const buildingId = context.buildingId;
    const building = records2(state.buildings).find((item) => String(item.id || "") === buildingId) || null;
    return {
      context,
      building,
      units: scoped(records2(state.units), buildingId),
      tenancies: scoped(records2(state.leases), buildingId),
      sources: scoped(records2(state.sources), buildingId),
      costPositions: scoped(records2(state.costPositions), buildingId),
      meters: scoped(records2(state.meters), buildingId),
      waterSettlements: scoped(records2(state.waterSettlements), buildingId),
      tasks: scoped(records2(state.tasks), buildingId),
      payments: scoped(records2(state.payments), buildingId),
      billingWorkflows: scoped(records2(state.billingWorkflows), buildingId),
      billingSnapshots: scoped(records2(state.billingSnapshots), buildingId),
      rentAllocations: scoped(records2(state.rentAllocations), buildingId),
      meterReplacements: scoped(records2(state.meterReplacements), buildingId),
      containers: scoped(records2(state.containers), buildingId),
      water: scoped(records2(state.water), buildingId)
    };
  }
  function portfolioNavigation(state, portfolioId = "") {
    const activePortfolioId = portfolioId || String(state?.meta?.primaryPortfolioId || state?.portfolios?.[0]?.id || "");
    const portfolio = records2(state.portfolios).find((item) => String(item.id || "") === activePortfolioId) || null;
    const buildings = records2(state.buildings).filter((item) => !activePortfolioId || String(item.portfolioId || "") === activePortfolioId);
    const activeBuildingId = String(state?.meta?.primaryBuildingId || buildings[0]?.id || "");
    return { portfolio, buildings, activeBuildingId, showBuildingSelector: buildings.length > 1 };
  }
  function reconciliationSummary(state, requested = {}) {
    const workspace = queryBuildingWorkspace(state, requested);
    const positionPaid = /* @__PURE__ */ new Map();
    for (const payment of workspace.payments) {
      if (!payment.positionId) continue;
      const key = String(payment.positionId);
      positionPaid.set(
        key,
        (positionPaid.get(key) || 0) + (payment.direction === "outflow" ? Number(payment.amount || 0) : -Number(payment.amount || 0))
      );
    }
    const rows = workspace.costPositions.filter((position) => position.confirmed).map((position) => ({
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
  function isoToday() {
    const d = /* @__PURE__ */ new Date();
    const offset = d.getTimezoneOffset() * 6e4;
    return new Date(d.getTime() - offset).toISOString().slice(0, 10);
  }
  function billingTarget(year) {
    return `${year + 1}-03-31`;
  }
  function germanDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}.${match[2]}.${match[1]}` : String(value || "");
  }
  function billingPeriodForWorkspace(state, workspace, year) {
    const startOfYear = `${year}-01-01`;
    const end = `${year}-12-31`;
    const primaryBuildingId = String(state?.meta?.primaryBuildingId || "");
    const buildingTakeover = String(
      workspace.building?.billingTakeoverDate || workspace.building?.ownershipEffective || ""
    );
    const propertyTakeover = workspace.context.buildingId === primaryBuildingId ? String(state?.property?.billingTakeoverDate || state?.property?.ownershipEffective || "") : "";
    const takeover = buildingTakeover || propertyTakeover;
    if (takeover && takeover > end) return { active: false, start: startOfYear, end, label: "" };
    const start = takeover && takeover > startOfYear ? takeover : startOfYear;
    return {
      active: true,
      start,
      end,
      label: `${germanDate(start)} – ${germanDate(end)}`
    };
  }
  function normalizeTitle(value) {
    return String(value || "").trim().toLocaleLowerCase("de-DE").replace(/\s+/g, " ");
  }
  function queryTaskList(state, requested = {}, today = isoToday()) {
    const workspace = queryBuildingWorkspace(state, requested);
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    const push = (task) => {
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
      const period = billingPeriodForWorkspace(state, workspace, y);
      if (!period.active || period.end >= today || snapshotYears.has(y)) continue;
      push({
        id: `billing-${workspace.context.buildingId}-${y}`,
        title: `Endabrechnung ${period.label} fertigstellen`,
        due: billingTarget(y),
        lead: 30,
        origin: "billing",
        periodYear: y,
        buildingId: workspace.context.buildingId
      });
    }
    return out.sort((a, b) => String(a.due || "").localeCompare(String(b.due || "")));
  }

  // src/application/lifecycle.ts
  async function loadApplicationState(ports) {
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

  // src/application/command-bus.ts
  function commandResult(ok, message = "", data = null) {
    return { ok, message, data };
  }
  function safeCommandSummary(payload) {
    if (payload == null) return "";
    if (typeof payload === "string") return payload.slice(0, 180);
    const out = {};
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
  function createCommandBus(ports) {
    const now = ports.now || (() => (/* @__PURE__ */ new Date()).toISOString());
    const executeCommand = async (type, payload, handler, { auditText = null, restorePoint = false, allowCrossBuilding = false } = {}) => {
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
      } catch (error) {
        ports.setState(before);
        ports.setLastStableState?.(ports.cloneState(before));
        ports.recordError(`application-command:${type}`, error);
        return commandResult(false, String(error?.message || error));
      }
    };
    return { executeCommand };
  }

  // src/core/validation.ts
  var valid = (value) => ({ ok: true, level: "ok", value });
  var invalid = (message) => ({ ok: false, level: "error", message });
  function parseGermanNumber(input) {
    let text = String(input ?? "").trim().replace(/\s+/g, "");
    if (!text) return null;
    if (text.includes(",") && text.includes(".")) {
      if (text.lastIndexOf(",") > text.lastIndexOf(".")) text = text.replace(/\./g, "").replace(",", ".");
      else text = text.replace(/,/g, "");
    } else if (text.includes(",")) {
      text = text.replace(",", ".");
    }
    if (!/^-?\d+(?:\.\d+)?$/.test(text)) return null;
    const value = Number(text);
    return Number.isFinite(value) ? value : null;
  }
  function validateMoney(input, options = {}) {
    const text = String(input ?? "").trim();
    if (!text) return options.required ? invalid("Betrag fehlt.") : valid(null);
    const value = parseGermanNumber(text);
    if (value === null) return invalid("Der Betrag ist keine gültige Zahl.");
    if (options.min !== void 0 && value < options.min) return invalid(`Der Betrag muss mindestens ${options.min} sein.`);
    if (options.max !== void 0 && value > options.max) return invalid(`Der Betrag darf höchstens ${options.max} sein.`);
    return valid(value);
  }
  function validatePositiveNumber(input, label, allowZero = false) {
    const value = parseGermanNumber(input);
    if (value === null) return invalid(`${label} ist keine gültige Zahl.`);
    if (allowZero ? value < 0 : value <= 0) return invalid(`${label} muss ${allowZero ? "mindestens 0" : "größer als 0"} sein.`);
    return valid(value);
  }
  function validateArea(input) {
    const result = validatePositiveNumber(input, "Wohnfläche");
    if (!result.ok) return result;
    if ((result.value ?? 0) > 1e4) return invalid("Die Wohnfläche ist unplausibel groß.");
    return result;
  }
  function validateYear(input, min = 1800, max = (/* @__PURE__ */ new Date()).getFullYear() + 5) {
    const value = Number(input);
    if (!Number.isInteger(value)) return invalid("Das Jahr ist ungültig.");
    if (value < min || value > max) return invalid(`Das Jahr muss zwischen ${min} und ${max} liegen.`);
    return valid(value);
  }
  function validateIsoDate(input, required = false) {
    const value = String(input ?? "").trim();
    if (!value) return required ? invalid("Datum fehlt.") : valid("");
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return invalid("Das Datum hat kein gültiges Format.");
    const [, y, m, d] = match;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    const same = date.getUTCFullYear() === Number(y) && date.getUTCMonth() + 1 === Number(m) && date.getUTCDate() === Number(d);
    return same ? valid(value) : invalid("Das Datum existiert nicht.");
  }

  // src/domain/portfolio-model.ts
  var PORTFOLIO_MODEL_VERSION = 2;
  var DEFAULT_PORTFOLIO_ID = "portfolio-main";
  var DEFAULT_BUILDING_ID = "building-main";
  function array(value) {
    return Array.isArray(value) ? value : [];
  }
  function uniqueFallbackId(prefix, index, used) {
    let candidate = `${prefix}-${index + 1}`;
    let suffix = index + 1;
    while (used.has(candidate)) candidate = `${prefix}-${++suffix}`;
    used.add(candidate);
    return candidate;
  }
  function ensureIds(items, prefix) {
    const used = new Set(items.map((item) => String(item?.id || "")).filter(Boolean));
    items.forEach((item, index) => {
      if (!item || typeof item !== "object") return;
      if (!item.id) item.id = uniqueFallbackId(prefix, index, used);
    });
  }
  function firstByType(units, type, buildingId) {
    return units.find((unit) => unit?.type === type && (!buildingId || unit.buildingId === buildingId)) || null;
  }
  function mapById(items) {
    return new Map(items.filter((item) => item?.id).map((item) => [String(item.id), item]));
  }
  function linkedBuildingId(item, refs) {
    for (const ref of refs) {
      for (const key of ["unitId", "leaseId", "positionId", "sourceId", "meterId", "mainMeterId", "ownerMeterId", "oldMeterId", "newMeterId"]) {
        const linked = item?.[key] ? ref.get(String(item[key])) : null;
        if (linked?.buildingId) return String(linked.buildingId);
      }
    }
    return "";
  }
  function ensurePortfolioModel(value) {
    const state = value && typeof value === "object" ? value : {};
    state.meta = state.meta && typeof state.meta === "object" ? state.meta : {};
    state.property = state.property && typeof state.property === "object" ? state.property : {};
    for (const key of [
      "portfolios",
      "buildings",
      "units",
      "leases",
      "meters",
      "sources",
      "costPositions",
      "tasks",
      "payments",
      "waterSettlements",
      "billingWorkflows",
      "billingSnapshots",
      "rentAllocations",
      "meterReplacements",
      "containers",
      "water"
    ]) state[key] = array(state[key]);
    ensureIds(state.portfolios, "portfolio");
    ensureIds(state.buildings, "building");
    ensureIds(state.units, "unit");
    ensureIds(state.leases, "tenancy");
    let primaryPortfolio = state.portfolios.find((item) => item.id === state.meta.primaryPortfolioId) || state.portfolios[0];
    if (!primaryPortfolio) {
      primaryPortfolio = {
        id: DEFAULT_PORTFOLIO_ID,
        name: "Privatbestand",
        kind: "private",
        createdAt: state.meta.createdAt || ""
      };
      state.portfolios.push(primaryPortfolio);
    }
    primaryPortfolio.name = primaryPortfolio.name || "Privatbestand";
    primaryPortfolio.kind = primaryPortfolio.kind || "private";
    state.meta.primaryPortfolioId = primaryPortfolio.id;
    const portfolioIds = new Set(state.portfolios.map((item) => String(item.id)));
    for (const building of state.buildings) {
      if (!portfolioIds.has(String(building.portfolioId || ""))) building.portfolioId = primaryPortfolio.id;
    }
    let primaryBuilding = state.buildings.find((item) => item.id === state.meta.primaryBuildingId) || state.buildings[0];
    if (!primaryBuilding) {
      primaryBuilding = {
        id: DEFAULT_BUILDING_ID,
        portfolioId: primaryPortfolio.id,
        name: state.property.name || "Doppelhaus",
        address: state.property.address || "",
        totalArea: Number(state.property.totalArea || 0),
        year: state.property.year || "",
        source: "legacy-property"
      };
      state.buildings.push(primaryBuilding);
    }
    if (!portfolioIds.has(String(primaryBuilding.portfolioId || ""))) primaryBuilding.portfolioId = primaryPortfolio.id;
    state.meta.primaryBuildingId = primaryBuilding.id;
    primaryBuilding.name = state.property.name || primaryBuilding.name || "Doppelhaus";
    primaryBuilding.address = state.property.address || primaryBuilding.address || "";
    primaryBuilding.totalArea = Number(state.property.totalArea || primaryBuilding.totalArea || 0);
    primaryBuilding.year = state.property.year || primaryBuilding.year || "";
    primaryBuilding.billingTakeoverDate = state.property.billingTakeoverDate || primaryBuilding.billingTakeoverDate || "";
    primaryBuilding.predecessorBillingEnd = state.property.predecessorBillingEnd || primaryBuilding.predecessorBillingEnd || "";
    const buildingIds = new Set(state.buildings.map((item) => String(item.id)));
    for (const unit of state.units) {
      if (!buildingIds.has(String(unit.buildingId || ""))) unit.buildingId = primaryBuilding.id;
    }
    const unitById = mapById(state.units);
    const unitIds = new Set(unitById.keys());
    const primaryRental = firstByType(state.units, "rental", primaryBuilding.id) || firstByType(state.units, "rental") || state.units[0] || null;
    for (const lease of state.leases) {
      if (!unitIds.has(String(lease.unitId || ""))) lease.unitId = primaryRental?.id || "";
      const linkedUnit = unitById.get(String(lease.unitId || ""));
      lease.buildingId = linkedUnit?.buildingId || primaryBuilding.id;
    }
    const leaseById = mapById(state.leases);
    const ownerUnitFor = (buildingId) => firstByType(state.units, "owner", buildingId) || (buildingId === primaryBuilding.id ? firstByType(state.units, "owner") : null);
    for (const meter of state.meters) {
      const linkedUnit = unitById.get(String(meter.unitId || ""));
      if (!buildingIds.has(String(meter.buildingId || ""))) meter.buildingId = linkedUnit?.buildingId || primaryBuilding.id;
      if (meter.role === "ownerWater" && !linkedUnit) {
        const ownerUnit = ownerUnitFor(String(meter.buildingId));
        if (ownerUnit) meter.unitId = ownerUnit.id;
      }
      if (meter.unitId && !unitIds.has(String(meter.unitId))) delete meter.unitId;
    }
    const meterById = mapById(state.meters);
    for (const source of state.sources) {
      if (!buildingIds.has(String(source.buildingId || ""))) source.buildingId = primaryBuilding.id;
    }
    const sourceById = mapById(state.sources);
    for (const position of state.costPositions) {
      const linkedSource = sourceById.get(String(position.sourceId || ""));
      if (!buildingIds.has(String(position.buildingId || ""))) position.buildingId = linkedSource?.buildingId || primaryBuilding.id;
    }
    const positionById = mapById(state.costPositions);
    for (const settlement of state.waterSettlements) {
      const mainMeter = meterById.get(String(settlement.mainMeterId || ""));
      const ownerMeter = meterById.get(String(settlement.ownerMeterId || ""));
      if (!buildingIds.has(String(settlement.buildingId || ""))) {
        settlement.buildingId = mainMeter?.buildingId || ownerMeter?.buildingId || primaryBuilding.id;
      }
    }
    const refs = [unitById, leaseById, positionById, sourceById, meterById];
    for (const key of ["tasks", "payments"]) {
      for (const item of state[key]) {
        if (!buildingIds.has(String(item.buildingId || ""))) item.buildingId = linkedBuildingId(item, refs) || primaryBuilding.id;
        const linkedLease = leaseById.get(String(item.leaseId || ""));
        if (linkedLease && !unitIds.has(String(item.unitId || ""))) item.unitId = linkedLease.unitId || "";
      }
    }
    for (const key of ["billingWorkflows", "billingSnapshots", "rentAllocations", "meterReplacements", "containers", "water"]) {
      for (const item of state[key]) {
        if (item && typeof item === "object" && !buildingIds.has(String(item.buildingId || ""))) {
          item.buildingId = linkedBuildingId(item, refs) || primaryBuilding.id;
        }
      }
    }
    if (Number(state.meta.portfolioModelVersion || 0) < PORTFOLIO_MODEL_VERSION) {
      state.meta.portfolioModelMigratedAt = (/* @__PURE__ */ new Date()).toISOString();
    }
    state.meta.portfolioModelVersion = PORTFOLIO_MODEL_VERSION;
    return state;
  }
  function validatePortfolioModel(value) {
    const errors = [];
    const warnings = [];
    if (!value || typeof value !== "object") return { errors: ["Portfolio-Modell fehlt"], warnings };
    const portfolios = array(value.portfolios);
    const buildings = array(value.buildings);
    const units = array(value.units);
    const leases = array(value.leases);
    if (!portfolios.length) errors.push("Portfolio-Modell: kein Portfolio vorhanden");
    if (!buildings.length) errors.push("Portfolio-Modell: kein Gebäude vorhanden");
    const unique = (items, label) => {
      const ids = /* @__PURE__ */ new Set();
      for (const item of items) {
        if (!item?.id) {
          errors.push(`${label}: Datensatz ohne ID`);
          continue;
        }
        const id = String(item.id);
        if (ids.has(id)) errors.push(`${label}: doppelte ID ${id}`);
        ids.add(id);
      }
      return ids;
    };
    const portfolioIds = unique(portfolios, "Portfolios");
    const buildingIds = unique(buildings, "Gebäude");
    const unitIds = unique(units, "Einheiten");
    unique(leases, "Mietverhältnisse");
    const unitById = mapById(units);
    const leaseById = mapById(leases);
    const sourceById = mapById(array(value.sources));
    const positionById = mapById(array(value.costPositions));
    const meterById = mapById(array(value.meters));
    for (const building of buildings) {
      if (!portfolioIds.has(String(building.portfolioId || ""))) errors.push(`Gebäude ${building.id}: Portfolio-Referenz fehlt`);
    }
    for (const unit of units) {
      if (!buildingIds.has(String(unit.buildingId || ""))) errors.push(`Einheit ${unit.id}: Gebäude-Referenz fehlt`);
    }
    for (const lease of leases) {
      const linkedUnit = unitById.get(String(lease.unitId || ""));
      if (units.length && !linkedUnit) errors.push(`Mietverhältnis ${lease.id}: Einheit-Referenz fehlt`);
      if (!units.length && !lease.unitId) warnings.push(`Mietverhältnis ${lease.id}: noch keiner Einheit zugeordnet`);
      if (!buildingIds.has(String(lease.buildingId || ""))) errors.push(`Mietverhältnis ${lease.id}: Gebäude-Referenz fehlt`);
      if (linkedUnit && lease.buildingId !== linkedUnit.buildingId) errors.push(`Mietverhältnis ${lease.id}: Gebäude und Einheit widersprechen sich`);
    }
    for (const meter of array(value.meters)) {
      if (!buildingIds.has(String(meter.buildingId || ""))) errors.push(`Zähler ${meter.id || "?"}: Gebäude-Referenz fehlt`);
      const linkedUnit = meter.unitId ? unitById.get(String(meter.unitId)) : null;
      if (meter.unitId && !linkedUnit) errors.push(`Zähler ${meter.id || "?"}: Einheit-Referenz fehlt`);
      if (linkedUnit && meter.buildingId !== linkedUnit.buildingId) errors.push(`Zähler ${meter.id || "?"}: Gebäude und Einheit widersprechen sich`);
    }
    for (const source of array(value.sources)) {
      if (!buildingIds.has(String(source.buildingId || ""))) errors.push(`Quelle ${source.id || "?"}: Gebäude-Referenz fehlt`);
    }
    for (const position of array(value.costPositions)) {
      if (!buildingIds.has(String(position.buildingId || ""))) errors.push(`Kostenposition ${position.id || "?"}: Gebäude-Referenz fehlt`);
      const source = position.sourceId ? sourceById.get(String(position.sourceId)) : null;
      if (source && source.buildingId !== position.buildingId) errors.push(`Kostenposition ${position.id || "?"}: Quelle gehört zu anderem Gebäude`);
    }
    for (const payment of array(value.payments)) {
      if (!buildingIds.has(String(payment.buildingId || ""))) errors.push(`Zahlung ${payment.id || "?"}: Gebäude-Referenz fehlt`);
      const linked = payment.positionId ? positionById.get(String(payment.positionId)) : payment.sourceId ? sourceById.get(String(payment.sourceId)) : payment.leaseId ? leaseById.get(String(payment.leaseId)) : payment.unitId ? unitById.get(String(payment.unitId)) : null;
      if (linked?.buildingId && linked.buildingId !== payment.buildingId) errors.push(`Zahlung ${payment.id || "?"}: Referenz gehört zu anderem Gebäude`);
    }
    for (const settlement of array(value.waterSettlements)) {
      if (!buildingIds.has(String(settlement.buildingId || ""))) errors.push(`Wasserperiode ${settlement.id || settlement.periodYear || "?"}: Gebäude-Referenz fehlt`);
      for (const key of ["mainMeterId", "ownerMeterId"]) {
        const meter = settlement[key] ? meterById.get(String(settlement[key])) : null;
        if (meter?.buildingId && meter.buildingId !== settlement.buildingId) errors.push(`Wasserperiode ${settlement.id || settlement.periodYear || "?"}: Zähler gehört zu anderem Gebäude`);
      }
    }
    for (const [key, label] of [
      ["tasks", "Aufgaben"],
      ["billingWorkflows", "Abrechnungsworkflows"],
      ["billingSnapshots", "Snapshots"],
      ["rentAllocations", "Mietkonto-Zuordnungen"],
      ["meterReplacements", "Zählerwechsel"],
      ["containers", "Behälter"],
      ["water", "Wasserdaten"]
    ]) {
      for (const item of array(value[key])) {
        if (!buildingIds.has(String(item?.buildingId || ""))) errors.push(`${label} ${item?.id || "?"}: Gebäude-Referenz fehlt`);
      }
    }
    if (value.meta?.primaryPortfolioId && !portfolioIds.has(String(value.meta.primaryPortfolioId))) {
      errors.push("Portfolio-Modell: primäres Portfolio ist ungültig");
    }
    if (value.meta?.primaryBuildingId && !buildingIds.has(String(value.meta.primaryBuildingId))) {
      errors.push("Portfolio-Modell: primäres Gebäude ist ungültig");
    }
    return { errors, warnings };
  }

  // src/application/portfolio-admin.ts
  var PORTFOLIO_ADMIN_VERSION = 1;
  var clone = (value) => {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  };
  function normalizeBuildingInput(input) {
    const name = String(input?.name || "").trim();
    if (!name) throw new Error("Gebäudename fehlt.");
    const area = validateArea(input?.totalArea);
    if (!area.ok || area.value == null) throw new Error(area.message || "Gesamtwohnfläche ist ungültig.");
    const yearText = String(input?.year ?? "").trim();
    let year = "";
    if (yearText) {
      const checkedYear = validateYear(yearText);
      if (!checkedYear.ok || checkedYear.value == null) throw new Error(checkedYear.message || "Baujahr ist ungültig.");
      year = checkedYear.value;
    }
    const billingTakeoverDate = String(input?.billingTakeoverDate || "").trim();
    const predecessorBillingEnd = String(input?.predecessorBillingEnd || "").trim();
    for (const [label, value] of [["Übernahmedatum", billingTakeoverDate], ["Voreigentümer-Ende", predecessorBillingEnd]]) {
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
  function checkedState(value) {
    const state = ensurePortfolioModel(value);
    const check = validatePortfolioModel(state);
    if (check.errors.length) throw new Error(check.errors.join(" · "));
    return state;
  }
  function createBuildingInPortfolio(value, id, input) {
    const state = ensurePortfolioModel(clone(value || {}));
    const buildingId = String(id || "").trim();
    if (!buildingId) throw new Error("Gebäude-ID fehlt.");
    if (state.buildings.some((item) => String(item?.id || "") === buildingId)) {
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
  function updateBuildingInPortfolio(value, buildingId, input) {
    const state = ensurePortfolioModel(clone(value || {}));
    const id = String(buildingId || "").trim();
    const index = state.buildings.findIndex((item) => String(item?.id || "") === id);
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
      finance: { ...prior.finance || {}, repayment: data.repayment, fixed: data.fixed }
    };
    if (id === String(state?.meta?.primaryBuildingId || "")) {
      state.property = {
        ...state.property || {},
        name: data.name,
        address: data.address,
        totalArea: data.totalArea,
        year: data.year,
        billingTakeoverDate: data.billingTakeoverDate,
        predecessorBillingEnd: data.predecessorBillingEnd
      };
      state.finance = { ...state.finance || {}, repayment: data.repayment, fixed: data.fixed };
    }
    return checkedState(state);
  }

  // src/application/rental-lifecycle.ts
  var uid = (prefix = "id") => globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  var RENTAL_LIFECYCLE_APPLICATION_VERSION = 1;
  function lifecycleWorkspaceModel(state, context = {}, today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)) {
    AppLifecycleLedger.ensureLifecycleState(state);
    const buildingId = String(context.buildingId || state?.meta?.primaryBuildingId || "");
    const leases = (state.leases || []).filter((l) => !buildingId || String(l.buildingId || "") === buildingId).sort((a, b) => String(b.start || "").localeCompare(String(a.start || "")));
    const active = leases.find((l) => (!l.start || l.start <= today) && (!l.end || l.end >= today)) || null;
    const ledger = AppLifecycleLedger.rentLedger(state, { buildingId });
    const replacements = (state.meterReplacements || []).filter((r) => !buildingId || String(r.buildingId || "") === buildingId).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    const alerts = AppLifecycleLedger.lifecycleAlerts(state, buildingId, today);
    const snapshots = (state.billingSnapshots || []).filter((s) => !buildingId || String(s.buildingId || "") === buildingId).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return { buildingId, leases, active, ledger, replacements, alerts, snapshots };
  }
  function createTenancyCommand(state, payload, context = {}) {
    AppLifecycleLedger.ensureLifecycleState(state);
    const unitId = String(payload.unitId || context.unitId || state.units?.find((u) => u.type === "rental" && (!context.buildingId || u.buildingId === context.buildingId))?.id || "");
    return AppLifecycleLedger.createTenancy(state, { ...payload, unitId });
  }
  function addLeaseTermCommand(state, payload) {
    return AppLifecycleLedger.addLeaseTerm(state, String(payload.leaseId || payload.id || ""), payload);
  }
  function closeTenancyCommand(state, payload) {
    return AppLifecycleLedger.updateTenancyEnd(state, String(payload.leaseId || payload.id || ""), String(payload.end || ""), String(payload.note || ""));
  }
  function recordHandoverCommand(state, payload) {
    return AppLifecycleLedger.recordHandover(state, String(payload.leaseId || ""), payload);
  }
  function allocateRentPaymentCommand(state, payload) {
    return AppLifecycleLedger.replacePaymentAllocations(state, String(payload.paymentId || ""), payload.allocations || []);
  }
  function recordMeterReplacementCommand(state, payload) {
    return AppLifecycleLedger.recordMeterReplacement(state, payload);
  }
  function createRentReversalCommand(state, payload, context = {}) {
    AppLifecycleLedger.ensureLifecycleState(state);
    const original = state.payments?.find((p) => String(p.id || "") === String(payload.paymentId || payload.originalPaymentId || ""));
    if (!original) throw new Error("Ursprüngliche Mietzahlung fehlt.");
    const prior = AppLifecycleLedger.paymentAllocations(state, original.id);
    if (!prior.length) throw new Error("Die ursprüngliche Zahlung ist noch keinem Mietmonat zugeordnet.");
    const requested = payload.amount == null ? Number(original.amount || 0) : Number(payload.amount || 0);
    if (!(requested > 0)) throw new Error("Rücklastschriftbetrag ist ungültig.");
    const reversal = { id: uid("payment"), buildingId: original.buildingId || context.buildingId || "", unitId: original.unitId || "", leaseId: original.leaseId || prior[0]?.leaseId || "", direction: "outflow", kind: "rent-reversal", rentReversal: true, reversesPaymentId: original.id, date: String(payload.date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)), amount: requested, label: String(payload.label || `Rücklastschrift ${original.label || "Mietzahlung"}`), createdAt: (/* @__PURE__ */ new Date()).toISOString() };
    state.payments.push(reversal);
    let remaining = requested;
    const allocations = [];
    for (const a of prior) {
      if (remaining <= 5e-3) break;
      const max = Number(a.total || 0), part = Math.min(remaining, max), ratio = max > 0 ? part / max : 0;
      allocations.push({ leaseId: a.leaseId, month: a.month, rentAmount: Number(a.rentAmount || 0) * ratio, advanceAmount: Number(a.advanceAmount || 0) * ratio, total: part });
      remaining -= part;
    }
    AppLifecycleLedger.replacePaymentAllocations(state, reversal.id, allocations);
    return reversal;
  }
  return __toCommonJS(index_exports);
})();


/* ===== compiled src/presentation/index.ts ===== */
"use strict";
var AppPresentation = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/presentation/index.ts
  var index_exports = {};
  __export(index_exports, {
    ACTIVE_BUILDING_STORAGE_KEY: () => ACTIVE_BUILDING_STORAGE_KEY,
    DEFAULT_SUB: () => DEFAULT_SUB,
    PORTFOLIO_ADMIN_PRESENTATION_VERSION: () => PORTFOLIO_ADMIN_PRESENTATION_VERSION,
    PRESENTATION_VERSION: () => PRESENTATION_VERSION,
    ROUTE_LABELS: () => ROUTE_LABELS,
    SUB_PARENT: () => SUB_PARENT,
    createPortfolioAdministrationModel: () => createPortfolioAdministrationModel,
    createPresentationWorkspace: () => createPresentationWorkspace,
    mergeStateFromBuilding: () => mergeStateFromBuilding,
    normalizeSub: () => normalizeSub,
    parseRouteHash: () => parseRouteHash,
    projectStateForBuilding: () => projectStateForBuilding,
    resolveActiveBuildingId: () => resolveActiveBuildingId,
    routeHash: () => routeHash,
    visibleSub: () => visibleSub
  });

  // src/presentation/navigation.ts
  var ROUTE_LABELS = {
    home: "Start",
    rental: "Vermietung",
    data: "Haus",
    owner: "Finanzen",
    more: "Mehr"
  };
  var DEFAULT_SUB = {
    data: "overview",
    rental: "overview",
    owner: "overview",
    more: "smart"
  };
  var SUB_PARENT = {
    data: { object: "overview", property: "overview", units: "overview", sources: "costs", positions: "costs", assessment: "costs" },
    rental: { lease: "overview", calculation: "billing", workflow: "billing" },
    owner: { tasks: "overview", cashflow: "payments", reconciliation: "payments", finance: "planning", analytics: "planning" },
    more: { overview: "smart", legal: "app", security: "protection", backup: "protection", recovery: "protection", audit: "app", diagnostics: "app" }
  };
  function normalizeSub(routeName, subName) {
    if (!subName) return DEFAULT_SUB[routeName] || "";
    if (routeName === "more" && subName === "overview") return "smart";
    if (routeName === "rental" && (subName === "calculation" || subName === "workflow")) return subName;
    return subName;
  }
  function visibleSub(routeName, subName) {
    return SUB_PARENT[routeName]?.[subName] || subName || DEFAULT_SUB[routeName] || "";
  }
  function parseRouteHash(hash) {
    const raw = decodeURIComponent(String(hash || "").replace(/^#/, "")).trim();
    const parts = raw.split("/").filter(Boolean);
    const route = Object.prototype.hasOwnProperty.call(ROUTE_LABELS, parts[0]) ? parts[0] : "home";
    const sub = route === "home" ? "" : normalizeSub(route, parts[1] || DEFAULT_SUB[route]);
    return { route, sub };
  }
  function routeHash(route, sub = null) {
    const safeRoute = Object.prototype.hasOwnProperty.call(ROUTE_LABELS, route) ? route : "home";
    if (safeRoute === "home") return "#home";
    return `#${safeRoute}/${encodeURIComponent(sub || DEFAULT_SUB[safeRoute])}`;
  }

  // src/application/context.ts
  var BUILDING_SCOPED_COLLECTIONS = [
    "units",
    "leases",
    "sources",
    "costPositions",
    "meters",
    "waterSettlements",
    "tasks",
    "payments",
    "billingWorkflows",
    "billingSnapshots",
    "rentAllocations",
    "meterReplacements",
    "containers",
    "water"
  ];
  function records(value) {
    return Array.isArray(value) ? value.filter((item) => !!item && typeof item === "object") : [];
  }
  function byId(state, collection, id) {
    if (!id) return null;
    const key = String(id);
    return records(state?.[collection]).find((item) => String(item.id || "") === key) || null;
  }
  function recordBuildingId(state, collection, id) {
    return String(byId(state, collection, id)?.buildingId || "");
  }
  function inferBuildingFromPayload(state, type, payload) {
    if (payload.buildingId) return String(payload.buildingId);
    const directRefs = [
      ["unitId", "units"],
      ["tenancyId", "leases"],
      ["leaseId", "leases"],
      ["sourceId", "sources"],
      ["positionId", "costPositions"],
      ["meterId", "meters"],
      ["paymentId", "payments"]
    ];
    for (const [key, collection] of directRefs) {
      const buildingId = recordBuildingId(state, collection, payload[key]);
      if (buildingId) return buildingId;
    }
    if (payload.id) {
      const typeCollection = type.startsWith("unit.") ? "units" : type.startsWith("tenancy.") || type.startsWith("lease.") ? "leases" : type.startsWith("source.") ? "sources" : type.startsWith("costPosition.") ? "costPositions" : type.startsWith("meter.") ? "meters" : type.startsWith("payment.") ? "payments" : "";
      if (typeCollection) {
        const buildingId = recordBuildingId(state, typeCollection, payload.id);
        if (buildingId) return buildingId;
      }
    }
    return "";
  }
  function resolveApplicationContext(state, type = "", payload = {}) {
    const buildings = records(state?.buildings);
    const units = records(state?.units);
    const leases = records(state?.leases);
    let buildingId = inferBuildingFromPayload(state, type, payload) || String(state?.meta?.primaryBuildingId || buildings[0]?.id || "");
    let unitId = String(payload.unitId || "");
    let tenancyId = String(payload.tenancyId || payload.leaseId || "");
    if (!unitId && tenancyId) unitId = String(byId(state, "leases", tenancyId)?.unitId || "");
    if (!tenancyId && payload.paymentId) {
      const payment = byId(state, "payments", payload.paymentId);
      tenancyId = String(payment?.tenancyId || payment?.leaseId || "");
      unitId ||= String(payment?.unitId || "");
    }
    if (!unitId && payload.id && (type.startsWith("tenancy.") || type.startsWith("lease."))) {
      unitId = String(byId(state, "leases", payload.id)?.unitId || "");
      tenancyId ||= String(payload.id);
    }
    const unit = units.find((item) => String(item.id || "") === unitId) || null;
    const tenancy = leases.find((item) => String(item.id || "") === tenancyId) || null;
    if (!buildingId) buildingId = String(unit?.buildingId || tenancy?.buildingId || "");
    if (!unitId && tenancy?.unitId) unitId = String(tenancy.unitId);
    const building = buildings.find((item) => String(item.id || "") === buildingId) || null;
    const portfolioId = String(payload.portfolioId || building?.portfolioId || state?.meta?.primaryPortfolioId || state?.portfolios?.[0]?.id || "");
    return { portfolioId, buildingId, unitId, tenancyId };
  }
  function buildingScopedCollections() {
    return BUILDING_SCOPED_COLLECTIONS;
  }

  // src/application/queries.ts
  function records2(value) {
    return Array.isArray(value) ? value.filter((item) => !!item && typeof item === "object") : [];
  }
  function scoped(items, buildingId) {
    return buildingId ? items.filter((item) => String(item.buildingId || "") === buildingId) : items.slice();
  }
  function queryBuildingWorkspace(state, requested = {}) {
    const context = resolveApplicationContext(state, "query.buildingWorkspace", requested);
    const buildingId = context.buildingId;
    const building = records2(state.buildings).find((item) => String(item.id || "") === buildingId) || null;
    return {
      context,
      building,
      units: scoped(records2(state.units), buildingId),
      tenancies: scoped(records2(state.leases), buildingId),
      sources: scoped(records2(state.sources), buildingId),
      costPositions: scoped(records2(state.costPositions), buildingId),
      meters: scoped(records2(state.meters), buildingId),
      waterSettlements: scoped(records2(state.waterSettlements), buildingId),
      tasks: scoped(records2(state.tasks), buildingId),
      payments: scoped(records2(state.payments), buildingId),
      billingWorkflows: scoped(records2(state.billingWorkflows), buildingId),
      billingSnapshots: scoped(records2(state.billingSnapshots), buildingId),
      rentAllocations: scoped(records2(state.rentAllocations), buildingId),
      meterReplacements: scoped(records2(state.meterReplacements), buildingId),
      containers: scoped(records2(state.containers), buildingId),
      water: scoped(records2(state.water), buildingId)
    };
  }
  function portfolioNavigation(state, portfolioId = "") {
    const activePortfolioId = portfolioId || String(state?.meta?.primaryPortfolioId || state?.portfolios?.[0]?.id || "");
    const portfolio = records2(state.portfolios).find((item) => String(item.id || "") === activePortfolioId) || null;
    const buildings = records2(state.buildings).filter((item) => !activePortfolioId || String(item.portfolioId || "") === activePortfolioId);
    const activeBuildingId = String(state?.meta?.primaryBuildingId || buildings[0]?.id || "");
    return { portfolio, buildings, activeBuildingId, showBuildingSelector: buildings.length > 1 };
  }
  function isoToday() {
    const d = /* @__PURE__ */ new Date();
    const offset = d.getTimezoneOffset() * 6e4;
    return new Date(d.getTime() - offset).toISOString().slice(0, 10);
  }
  function billingTarget(year) {
    return `${year + 1}-03-31`;
  }
  function germanDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}.${match[2]}.${match[1]}` : String(value || "");
  }
  function billingPeriodForWorkspace(state, workspace, year) {
    const startOfYear = `${year}-01-01`;
    const end = `${year}-12-31`;
    const primaryBuildingId = String(state?.meta?.primaryBuildingId || "");
    const buildingTakeover = String(
      workspace.building?.billingTakeoverDate || workspace.building?.ownershipEffective || ""
    );
    const propertyTakeover = workspace.context.buildingId === primaryBuildingId ? String(state?.property?.billingTakeoverDate || state?.property?.ownershipEffective || "") : "";
    const takeover = buildingTakeover || propertyTakeover;
    if (takeover && takeover > end) return { active: false, start: startOfYear, end, label: "" };
    const start = takeover && takeover > startOfYear ? takeover : startOfYear;
    return {
      active: true,
      start,
      end,
      label: `${germanDate(start)} – ${germanDate(end)}`
    };
  }
  function normalizeTitle(value) {
    return String(value || "").trim().toLocaleLowerCase("de-DE").replace(/\s+/g, " ");
  }
  function queryTaskList(state, requested = {}, today = isoToday()) {
    const workspace = queryBuildingWorkspace(state, requested);
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    const push = (task) => {
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
      const period = billingPeriodForWorkspace(state, workspace, y);
      if (!period.active || period.end >= today || snapshotYears.has(y)) continue;
      push({
        id: `billing-${workspace.context.buildingId}-${y}`,
        title: `Endabrechnung ${period.label} fertigstellen`,
        due: billingTarget(y),
        lead: 30,
        origin: "billing",
        periodYear: y,
        buildingId: workspace.context.buildingId
      });
    }
    return out.sort((a, b) => String(a.due || "").localeCompare(String(b.due || "")));
  }

  // src/presentation/building-workspace.ts
  var PRESENTATION_VERSION = 1;
  var ACTIVE_BUILDING_STORAGE_KEY = "mietverwaltung-active-building-v1";
  var clone = (value) => {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  };
  var records3 = (value) => Array.isArray(value) ? value.filter((item) => !!item && typeof item === "object") : [];
  function recordBelongsToBuilding(item, buildingId, primaryBuildingId) {
    const itemBuildingId = String(item?.buildingId || "");
    return itemBuildingId ? itemBuildingId === buildingId : buildingId === primaryBuildingId;
  }
  function resolveActiveBuildingId(state, requestedBuildingId = "") {
    const nav = portfolioNavigation(state);
    const requested = String(requestedBuildingId || "");
    if (requested && nav.buildings.some((item) => String(item.id || "") === requested)) return requested;
    return String(nav.activeBuildingId || nav.buildings[0]?.id || "");
  }
  function createPresentationWorkspace(state, requestedBuildingId = "") {
    const nav = portfolioNavigation(state);
    const activeBuildingId = resolveActiveBuildingId(state, requestedBuildingId);
    const workspace = queryBuildingWorkspace(state, { buildingId: activeBuildingId });
    const active = nav.buildings.find((item) => String(item.id || "") === activeBuildingId) || workspace.building;
    const tasks = queryTaskList(state, { buildingId: activeBuildingId });
    return {
      portfolioId: String(nav.portfolio?.id || ""),
      portfolioName: String(nav.portfolio?.name || "Portfolio"),
      activeBuildingId,
      activeBuildingName: String(active?.name || active?.address || "Gebäude"),
      showBuildingSelector: nav.showBuildingSelector,
      buildings: nav.buildings.map((item) => ({
        id: String(item.id || ""),
        name: String(item.name || item.address || "Gebäude"),
        address: String(item.address || ""),
        active: String(item.id || "") === activeBuildingId
      })),
      counts: {
        units: workspace.units.length,
        tenancies: workspace.tenancies.length,
        sources: workspace.sources.length,
        costPositions: workspace.costPositions.length,
        meters: workspace.meters.length,
        tasks: tasks.length,
        payments: workspace.payments.length
      }
    };
  }
  function projectStateForBuilding(masterState, requestedBuildingId = "") {
    const master = clone(masterState || {});
    const activeBuildingId = resolveActiveBuildingId(master, requestedBuildingId);
    if (!activeBuildingId) return master;
    const primaryBuildingId = String(master?.meta?.primaryBuildingId || activeBuildingId);
    const activeBuilding = records3(master.buildings).find((item) => String(item.id || "") === activeBuildingId) || null;
    const projected = clone(master);
    for (const key of buildingScopedCollections()) {
      projected[key] = records3(master[key]).filter((item) => recordBelongsToBuilding(item, activeBuildingId, primaryBuildingId)).map((item) => ({ ...clone(item), buildingId: String(item.buildingId || activeBuildingId) }));
    }
    projected.documentsCache = [];
    projected.meta = {
      ...projected.meta || {},
      primaryBuildingId: activeBuildingId,
      presentationBuildingId: activeBuildingId
    };
    projected.property = {
      ...projected.property || {},
      name: String(activeBuilding?.name || ""),
      address: String(activeBuilding?.address || ""),
      totalArea: Number(activeBuilding?.totalArea || 0),
      year: activeBuilding?.year || "",
      billingTakeoverDate: activeBuilding?.billingTakeoverDate || "",
      predecessorBillingEnd: activeBuilding?.predecessorBillingEnd || ""
    };
    if (activeBuilding?.finance && typeof activeBuilding.finance === "object") {
      projected.finance = clone(activeBuilding.finance);
    } else if (activeBuildingId !== primaryBuildingId) {
      projected.finance = { repayment: 0, fixed: 0 };
    }
    return projected;
  }
  function mergeStateFromBuilding(masterState, scopedState, requestedBuildingId = "") {
    const master = clone(masterState || {});
    const scoped2 = clone(scopedState || {});
    const activeBuildingId = resolveActiveBuildingId(
      master,
      requestedBuildingId || scoped2?.meta?.presentationBuildingId || scoped2?.meta?.primaryBuildingId
    );
    if (!activeBuildingId) return scoped2;
    const primaryBuildingId = String(master?.meta?.primaryBuildingId || activeBuildingId);
    const scopedKeys = new Set(buildingScopedCollections());
    const result = clone(master);
    for (const key of scopedKeys) {
      const keep = records3(master[key]).filter(
        (item) => !recordBelongsToBuilding(item, activeBuildingId, primaryBuildingId)
      );
      const changed = records3(scoped2[key]).map((item) => ({
        ...clone(item),
        buildingId: String(item.buildingId || activeBuildingId)
      }));
      result[key] = [...keep, ...changed];
    }
    for (const [key, value] of Object.entries(scoped2)) {
      if (scopedKeys.has(key)) continue;
      if (["property", "finance", "portfolios", "buildings", "documentsCache"].includes(key)) continue;
      result[key] = clone(value);
    }
    result.portfolios = clone(master.portfolios || []);
    result.buildings = clone(master.buildings || []);
    result.documentsCache = [];
    const scopedBuilding = records3(scoped2.buildings).find((item) => String(item.id || "") === activeBuildingId) || {};
    const index = records3(result.buildings).findIndex((item) => String(item.id || "") === activeBuildingId);
    if (index >= 0) {
      const prior = result.buildings[index];
      result.buildings[index] = {
        ...prior,
        ...clone(scopedBuilding),
        id: prior.id,
        portfolioId: prior.portfolioId,
        name: String(scoped2?.property?.name || scopedBuilding.name || prior.name || "Gebäude"),
        address: String(scoped2?.property?.address ?? scopedBuilding.address ?? prior.address ?? ""),
        totalArea: Number(scoped2?.property?.totalArea ?? scopedBuilding.totalArea ?? prior.totalArea ?? 0),
        year: scoped2?.property?.year ?? scopedBuilding.year ?? prior.year ?? "",
        billingTakeoverDate: scoped2?.property?.billingTakeoverDate ?? scopedBuilding.billingTakeoverDate ?? prior.billingTakeoverDate ?? "",
        predecessorBillingEnd: scoped2?.property?.predecessorBillingEnd ?? scopedBuilding.predecessorBillingEnd ?? prior.predecessorBillingEnd ?? "",
        finance: clone(scoped2.finance || prior.finance || { repayment: 0, fixed: 0 })
      };
    }
    result.meta = { ...result.meta || {} };
    result.meta.primaryBuildingId = primaryBuildingId;
    result.meta.primaryPortfolioId = String(master?.meta?.primaryPortfolioId || result.meta.primaryPortfolioId || "");
    delete result.meta.presentationBuildingId;
    if (activeBuildingId === primaryBuildingId) {
      result.property = clone(scoped2.property || master.property || {});
      result.finance = clone(scoped2.finance || master.finance || {});
    } else {
      result.property = clone(master.property || {});
      result.finance = clone(master.finance || {});
    }
    return result;
  }

  // src/presentation/portfolio-administration.ts
  var PORTFOLIO_ADMIN_PRESENTATION_VERSION = 1;
  function createPortfolioAdministrationModel(state, activeBuildingId = "") {
    const nav = portfolioNavigation(state);
    const primaryBuildingId = String(state?.meta?.primaryBuildingId || nav.buildings[0]?.id || "");
    const active = String(activeBuildingId || nav.activeBuildingId || primaryBuildingId);
    return {
      portfolioId: String(nav.portfolio?.id || ""),
      portfolioName: String(nav.portfolio?.name || "Privatbestand"),
      activeBuildingId: active,
      primaryBuildingId,
      buildings: nav.buildings.map((building) => {
        const id = String(building.id || "");
        const workspace = queryBuildingWorkspace(state, { buildingId: id });
        return {
          id,
          name: String(building.name || building.address || "Gebäude"),
          address: String(building.address || ""),
          totalArea: Number(building.totalArea || 0),
          year: String(building.year || ""),
          primary: id === primaryBuildingId,
          active: id === active,
          counts: {
            units: workspace.units.length,
            tenancies: workspace.tenancies.length,
            meters: workspace.meters.length,
            sources: workspace.sources.length,
            costPositions: workspace.costPositions.length,
            payments: workspace.payments.length
          }
        };
      })
    };
  }
  return __toCommonJS(index_exports);
})();


/* ===== compiled src/core/persistence.ts ===== */
"use strict";
var AppPersistence = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/core/persistence.ts
  var persistence_exports = {};
  __export(persistence_exports, {
    BUILDING_STORE: () => BUILDING_STORE,
    DB_NAME: () => DB_NAME,
    DB_VERSION: () => DB_VERSION,
    DOCS_STORE: () => DOCS_STORE,
    PORTFOLIO_STORE: () => PORTFOLIO_STORE,
    REPOSITORY_META_STORE: () => REPOSITORY_META_STORE,
    STATE_ID: () => STATE_ID,
    STATE_STORE: () => STATE_STORE,
    TENANCY_STORE: () => TENANCY_STORE,
    UNIT_STORE: () => UNIT_STORE,
    addDocument: () => addDocument,
    deleteDocument: () => deleteDocument,
    getDocument: () => getDocument,
    listDocuments: () => listDocuments,
    openDB: () => openDB,
    readStateRecord: () => readStateRecord,
    replaceDocuments: () => replaceDocuments,
    requestValue: () => requestValue,
    saveState: () => saveState,
    transactionDone: () => transactionDone,
    updateDocument: () => updateDocument
  });
  var DB_NAME = "mietverwaltung-v6";
  var DB_VERSION = 3;
  var STATE_ID = "main";
  var STATE_STORE = "state";
  var DOCS_STORE = "docs";
  var PORTFOLIO_STORE = "portfolios";
  var BUILDING_STORE = "buildings";
  var UNIT_STORE = "units";
  var TENANCY_STORE = "tenancies";
  var REPOSITORY_META_STORE = "repositoryMeta";
  function requestValue(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB-Transaktion abgebrochen"));
    });
  }
  function ensureStore(db, transaction, name, indexes = []) {
    const store = db.objectStoreNames.contains(name) ? transaction.objectStore(name) : db.createObjectStore(name, { keyPath: "id" });
    for (const index of indexes) {
      if (!store.indexNames.contains(index.name)) store.createIndex(index.name, index.keyPath, { unique: false });
    }
    return store;
  }
  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        const transaction = request.transaction;
        if (!transaction) throw new Error("IndexedDB-Upgrade ohne Transaktion");
        ensureStore(db, transaction, STATE_STORE);
        ensureStore(db, transaction, DOCS_STORE);
        ensureStore(db, transaction, PORTFOLIO_STORE);
        ensureStore(db, transaction, BUILDING_STORE, [{ name: "portfolioId", keyPath: "portfolioId" }]);
        ensureStore(db, transaction, UNIT_STORE, [{ name: "buildingId", keyPath: "buildingId" }]);
        ensureStore(db, transaction, TENANCY_STORE, [
          { name: "buildingId", keyPath: "buildingId" },
          { name: "unitId", keyPath: "unitId" }
        ]);
        ensureStore(db, transaction, REPOSITORY_META_STORE);
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onblocked = () => reject(new Error("IndexedDB-Upgrade wird durch einen älteren geöffneten App-Tab blockiert"));
      request.onerror = () => reject(request.error);
    });
  }
  async function readStateRecord() {
    const db = await openDB();
    const transaction = db.transaction(STATE_STORE, "readonly");
    const request = transaction.objectStore(STATE_STORE).get(STATE_ID);
    const record = await requestValue(request);
    return record ?? null;
  }
  async function saveState(state) {
    const db = await openDB();
    const transaction = db.transaction(STATE_STORE, "readwrite");
    transaction.objectStore(STATE_STORE).put({ id: STATE_ID, data: state });
    await transactionDone(transaction);
  }
  async function addDocument(document) {
    const db = await openDB();
    const transaction = db.transaction(DOCS_STORE, "readwrite");
    transaction.objectStore(DOCS_STORE).put(document);
    await transactionDone(transaction);
  }
  async function getDocument(id) {
    const db = await openDB();
    const transaction = db.transaction(DOCS_STORE, "readonly");
    const request = transaction.objectStore(DOCS_STORE).get(id);
    const document = await requestValue(request);
    return document ?? null;
  }
  async function listDocuments() {
    const db = await openDB();
    const transaction = db.transaction(DOCS_STORE, "readonly");
    const request = transaction.objectStore(DOCS_STORE).getAll();
    const documents = await requestValue(request);
    return documents ?? [];
  }
  async function deleteDocument(id) {
    const db = await openDB();
    const transaction = db.transaction(DOCS_STORE, "readwrite");
    transaction.objectStore(DOCS_STORE).delete(id);
    await transactionDone(transaction);
  }
  async function updateDocument(document) {
    const db = await openDB();
    const transaction = db.transaction(DOCS_STORE, "readwrite");
    transaction.objectStore(DOCS_STORE).put(document);
    await transactionDone(transaction);
  }
  async function replaceDocuments(documents) {
    const db = await openDB();
    const transaction = db.transaction(DOCS_STORE, "readwrite");
    const store = transaction.objectStore(DOCS_STORE);
    store.clear();
    for (const document of documents) store.put(document);
    await transactionDone(transaction);
  }
  return __toCommonJS(persistence_exports);
})();


/* ===== compiled src/core/auth.ts ===== */
"use strict";
var AppAuth = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/core/auth.ts
  var auth_exports = {};
  __export(auth_exports, {
    authCredentialId: () => authCredentialId,
    authEnabled: () => authEnabled,
    authenticate: () => authenticate,
    disableAuth: () => disableAuth,
    registerDevice: () => registerDevice
  });
  var SEC_KEY = "mietverwaltung_webauthn";
  function randomBytes(length) {
    return crypto.getRandomValues(new Uint8Array(new ArrayBuffer(length)));
  }
  function toBase64Url(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function fromBase64Url(value) {
    let normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    while (normalized.length % 4) normalized += "=";
    const binary = atob(normalized);
    const bytes = new Uint8Array(new ArrayBuffer(binary.length));
    for (let index = 0; index < binary.length; index++) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }
  function authCredentialId() {
    return localStorage.getItem(SEC_KEY) || "";
  }
  function authEnabled() {
    return authCredentialId().length > 0;
  }
  async function registerDevice() {
    if (!window.PublicKeyCredential || !navigator.credentials) {
      throw new Error("Geräteauthentifizierung nicht unterstützt");
    }
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: randomBytes(32),
        rp: { name: "Mietverwaltung" },
        user: {
          id: randomBytes(16),
          name: "private-user",
          displayName: "Mietverwaltung"
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 }
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required"
        },
        timeout: 6e4,
        attestation: "none"
      }
    });
    if (!(credential instanceof PublicKeyCredential)) {
      throw new Error("Geräteauthentifizierung konnte nicht eingerichtet werden");
    }
    localStorage.setItem(SEC_KEY, toBase64Url(new Uint8Array(credential.rawId)));
  }
  async function authenticate() {
    const id = authCredentialId();
    if (!id) return true;
    if (!window.PublicKeyCredential || !navigator.credentials) return false;
    try {
      await navigator.credentials.get({
        publicKey: {
          challenge: randomBytes(32),
          allowCredentials: [{ id: fromBase64Url(id), type: "public-key" }],
          userVerification: "required",
          timeout: 6e4
        }
      });
      return true;
    } catch {
      return false;
    }
  }
  function disableAuth() {
    localStorage.removeItem(SEC_KEY);
  }
  return __toCommonJS(auth_exports);
})();


/* ===== compiled src/core/integrity.ts ===== */
"use strict";
var AppIntegrity = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/core/integrity.ts
  var integrity_exports = {};
  __export(integrity_exports, {
    blobSha256: () => blobSha256,
    cloneState: () => cloneState,
    documentFingerprint: () => documentFingerprint,
    finalizeSnapshotIntegrity: () => finalizeSnapshotIntegrity,
    integritySummary: () => integritySummary,
    reconciliationSummary: () => reconciliationSummary,
    recordClientError: () => recordClientError,
    repairDomainState: () => repairDomainState,
    sha256Text: () => sha256Text,
    stableJSON: () => stableJSON,
    validateDomainState: () => validateDomainState
  });
  function cloneState(value) {
    return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  }
  function uniqueIds(items, label, issues) {
    const seen = /* @__PURE__ */ new Set();
    for (const item of items || []) {
      if (!item?.id) {
        issues.errors.push(`${label}: Datensatz ohne ID`);
        continue;
      }
      if (seen.has(item.id)) issues.errors.push(`${label}: doppelte ID ${item.id}`);
      seen.add(item.id);
    }
  }
  function validateDomainState(value) {
    const issues = { errors: [], warnings: [] };
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
      ["meterReplacements", "Zählerwechsel"]
    ]) {
      uniqueIds(value[key], label, issues);
    }
    const sourceIds = new Set((value.sources || []).map((item) => item.id));
    const meterIds = new Set((value.meters || []).map((item) => item.id));
    for (const position of value.costPositions || []) {
      if (!position.label) issues.errors.push(`Kostenposition ${position.id}: Bezeichnung fehlt`);
      if (Number(position.amount) < 0) issues.errors.push(`Kostenposition ${position.label}: negativer Betrag`);
      if (position.serviceStart && position.serviceEnd && position.serviceEnd < position.serviceStart) {
        issues.errors.push(`Kostenposition ${position.label}: Leistungszeitraum ungültig`);
      }
      if (position.sourceId && !sourceIds.has(position.sourceId) && !String(position.sourceId).startsWith("legacy-")) {
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
    const ownerUnits = (value.units || []).filter((unit) => unit.type == "owner").length;
    const rentalUnits = (value.units || []).filter((unit) => unit.type == "rental").length;
    if (ownerUnits > 1) issues.warnings.push("Mehr als eine Eigennutzungs-Einheit hinterlegt");
    if (rentalUnits > 1) issues.warnings.push("Mehr als eine Mietwohnung hinterlegt");
    return issues;
  }
  function repairDomainState(value) {
    let repaired = normalizeState(value);
    repaired = migrateDomainState(repaired);
    ensureDefaultMeters(repaired);
    repaired = AppPortfolioModel.ensurePortfolioModel(repaired);
    repaired = AppLifecycleLedger.ensureLifecycleState(repaired);
    for (const meter of repaired.meters || []) {
      meter.readings = Array.isArray(meter.readings) ? meter.readings : [];
      const seen = /* @__PURE__ */ new Set();
      meter.readings = meter.readings.filter((reading) => {
        const key = `${reading.date}|${Number(reading.value)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    }
    repaired.schemaVersion = SCHEMA_VERSION;
    repaired.meta.appVersion = APP_VERSION;
    repaired.meta.revision = Number(repaired.meta.revision || 0);
    repaired.meta.errorLog = Array.isArray(repaired.meta.errorLog) ? repaired.meta.errorLog : [];
    return typeof ensureTraceShape === "function" ? ensureTraceShape(repaired) : repaired;
  }
  function recordClientError(context, error) {
    try {
      const entry = {
        id: uid(),
        at: (/* @__PURE__ */ new Date()).toISOString(),
        context,
        message: String(error?.message || error),
        stack: String(error?.stack || "").slice(0, 3e3)
      };
      state.meta.errorLog = Array.isArray(state.meta.errorLog) ? state.meta.errorLog : [];
      state.meta.errorLog.unshift(entry);
      state.meta.errorLog = state.meta.errorLog.slice(0, MAX_ERROR_LOG);
    } catch {
    }
  }
  function integritySummary(value) {
    const validation = validateDomainState(value);
    return {
      ok: validation.errors.length === 0,
      errors: validation.errors,
      warnings: validation.warnings,
      revision: Number(value.meta?.revision || 0)
    };
  }
  async function sha256Text(text) {
    if (!crypto?.subtle) return "";
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  function stableJSON(value) {
    const sort = (input) => Array.isArray(input) ? input.map(sort) : input && typeof input === "object" ? Object.fromEntries(Object.keys(input).sort().map((key) => [key, sort(input[key])])) : input;
    return JSON.stringify(sort(value));
  }
  async function finalizeSnapshotIntegrity(snapshot) {
    snapshot.integrityHash = await sha256Text(stableJSON({ ...snapshot, integrityHash: void 0 }));
    return snapshot;
  }
  async function blobSha256(blob) {
    if (!crypto?.subtle) return "";
    const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  async function documentFingerprint(pages) {
    const hashes = [];
    for (const page of pages || []) hashes.push(await blobSha256(page.blob));
    return sha256Text(hashes.join("|"));
  }
  function reconciliationSummary(currentState) {
    const positionPaid = /* @__PURE__ */ new Map();
    for (const payment of currentState.payments || []) {
      if (!payment.positionId) continue;
      positionPaid.set(
        payment.positionId,
        (positionPaid.get(payment.positionId) || 0) + (payment.direction == "outflow" ? Number(payment.amount || 0) : -Number(payment.amount || 0))
      );
    }
    const rows = (currentState.costPositions || []).filter((position) => position.confirmed).map((position) => ({
      position,
      paid: positionPaid.get(position.id) || 0,
      difference: Number(position.amount || 0) - (positionPaid.get(position.id) || 0)
    }));
    return {
      rows,
      unmatchedPayments: (currentState.payments || []).filter(
        (payment) => !payment.positionId && !payment.sourceId
      )
    };
  }
  return __toCommonJS(integrity_exports);
})();


/* ===== compiled src/core/traceability.ts ===== */
"use strict";
var AppTraceability = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/core/traceability.ts
  var traceability_exports = {};
  __export(traceability_exports, {
    billingClosureChecklist: () => billingClosureChecklist,
    commandResult: () => commandResult,
    createRestorePoint: () => createRestorePoint,
    documentWorkflowLabel: () => documentWorkflowLabel,
    documentWorkflowState: () => documentWorkflowState,
    documentsByWorkflow: () => documentsByWorkflow,
    ensureTraceShape: () => ensureTraceShape,
    executeCommand: () => executeCommand,
    provenanceLabel: () => provenanceLabel,
    restoreFromPoint: () => restoreFromPoint,
    safeCommandSummary: () => safeCommandSummary,
    snapshotVerification: () => snapshotVerification,
    traceForPosition: () => traceForPosition
  });
  function ensureTraceShape(value) {
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
        confirmedAt: position.confirmed ? (/* @__PURE__ */ new Date()).toISOString() : null,
        confirmedBy: "local-user"
      };
    }
    return value;
  }
  function provenanceLabel(position) {
    const origin = position?.provenance?.origin || position?.origin || "manual";
    return origin == "document" ? "aus Dokument" : origin == "migration" ? "übernommen" : origin == "photo" ? "aus Foto" : origin == "assessment" ? "aus Bescheid" : "manuell";
  }
  function createRestorePoint(label) {
    const snapshot = cloneState(fullPortfolioState());
    delete snapshot.meta.restorePoints;
    const point = {
      id: uid(),
      at: (/* @__PURE__ */ new Date()).toISOString(),
      label,
      schemaVersion: SCHEMA_VERSION,
      appVersion: APP_VERSION,
      state: snapshot
    };
    state.meta.restorePoints.unshift(point);
    state.meta.restorePoints = state.meta.restorePoints.slice(0, 5);
    return point;
  }
  async function restoreFromPoint(id) {
    const point = (state.meta?.restorePoints || []).find((item) => item.id === id);
    if (!point) throw new Error("Sicherungspunkt nicht gefunden.");
    const current = cloneState(fullPortfolioState());
    const currentSnapshot = cloneState(current);
    delete currentSnapshot.meta.restorePoints;
    const undo = {
      id: uid(),
      at: (/* @__PURE__ */ new Date()).toISOString(),
      label: "Vor Wiederherstellung",
      schemaVersion: SCHEMA_VERSION,
      appVersion: APP_VERSION,
      state: currentSnapshot
    };
    const restored = ensureTraceShape(repairDomainState(cloneState(point.state)));
    restored.meta.restorePoints = [undo, ...restored.meta.restorePoints || []].slice(0, 5);
    try {
      await saveState(restored);
      applyRestoredPortfolioState(restored);
      return true;
    } catch (error) {
      applyRestoredPortfolioState(current);
      throw error;
    }
  }
  function commandResult(ok, message = "", data = null) {
    return { ok, message, data };
  }
  async function executeCommand(type, payload, handler, { auditText = null, restorePoint = false } = {}) {
    return applicationExecuteCommand(type, payload, handler, { auditText, restorePoint });
  }
  function safeCommandSummary(payload) {
    if (payload == null) return "";
    if (typeof payload === "string") return payload.slice(0, 180);
    const out = {};
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
  function documentWorkflowState(document) {
    const analysis = document.analysis || {};
    const fields = analysis.fields || {};
    if (analysis.status == "error") return "review";
    if (analysis.status != "done") return "new";
    const proposals = fields.positionProposals || [];
    if (proposals.length && !analysis.acceptedAt) return "review";
    if (document.sourceId || analysis.acceptedAt) return "done";
    return "review";
  }
  function documentWorkflowLabel(document) {
    const workflowState = documentWorkflowState(document);
    return workflowState == "new" ? "Neu" : workflowState == "review" ? "Prüfen" : "Erledigt";
  }
  function documentsByWorkflow(documents) {
    return {
      new: documents.filter((document) => documentWorkflowState(document) == "new"),
      review: documents.filter((document) => documentWorkflowState(document) == "review"),
      done: documents.filter((document) => documentWorkflowState(document) == "done")
    };
  }
  function traceForPosition(currentState, position) {
    const source = (currentState.sources || []).find((item) => item.id === position.sourceId) || null;
    const documentId = position.provenance?.documentId || position.documentId || source?.sourceDocumentId || "";
    return {
      position,
      source,
      documentId,
      origin: provenanceLabel(position),
      evidence: position.provenance?.evidence || "",
      confidence: position.provenance?.confidence,
      confirmedAt: position.provenance?.confirmedAt || null
    };
  }
  function billingClosureChecklist(currentState, year) {
    const readiness = billingReadiness(currentState, year);
    const analysis = billingAnalysis(currentState, year);
    const lease = currentState.leases?.[0] || null;
    const relevant = analysis.events || [];
    const waterNeeded = relevant.some((event) => event.category == "water");
    const waterOK = !waterNeeded || !!settlementConsumption(currentState, settlementByPeriod(currentState, year))?.valid;
    const allConfirmed = (currentState.costPositions || []).filter((position) => positionToEvents(currentState, position, year).length).every((position) => position.confirmed);
    const allAssigned = analysis.unresolved.length === 0;
    const periodEnded = !!analysis.period?.end && smartToday() > analysis.period.end;
    const advanceOK = lease ? Number(lease.advance || 0) <= 0 || Number(analysis.advanceEvidence?.recognizedPayments || 0) > 0 : false;
    const noErrors = readiness.every((item) => item.ok);
    const points = [
      { id: "period", label: "Abrechnungsperiode und Mietvertrag vorhanden", ok: !!lease },
      { id: "periodComplete", label: "Abrechnungsperiode vollständig beendet", ok: periodEnded },
      { id: "costs", label: "Alle relevanten Kostenpositionen bestätigt", ok: allConfirmed && relevant.length > 0 },
      { id: "assignment", label: "Alle Umlageentscheidungen geklärt", ok: allAssigned },
      { id: "water", label: "Verbrauchsdaten vollständig", ok: waterOK },
      { id: "advance", label: "Vorauszahlungen ermittelt", ok: advanceOK },
      { id: "readiness", label: "Datenqualitätsprüfung ohne offene Pflichtpunkte", ok: noErrors }
    ];
    return { points, ok: points.every((item) => item.ok), analysis };
  }
  function snapshotVerification(snapshot) {
    if (!snapshot?.integrityHash) return { status: "unknown", label: "Keine Prüfsumme" };
    return { status: "stored", label: `SHA-256 ${String(snapshot.integrityHash).slice(0, 12)}…` };
  }
  return __toCommonJS(traceability_exports);
})();


/* ===== compiled src/domain/meter-parsing.ts ===== */
"use strict";
var AppMeterParsing = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/domain/meter-parsing.ts
  var meter_parsing_exports = {};
  __export(meter_parsing_exports, {
    detectedMeterSerialCandidates: () => detectedMeterSerialCandidates,
    editDistance: () => editDistance,
    meterNumberComparable: () => meterNumberComparable,
    meterNumberSimilarity: () => meterNumberSimilarity,
    meterNumericInterpretations: () => meterNumericInterpretations,
    meterReadingCandidates: () => meterReadingCandidates,
    normalizeMeterNumber: () => normalizeMeterNumber,
    parseMeterReadingValue: () => parseMeterReadingValue
  });
  function normalizeMeterNumber(value) {
    return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }
  function parseMeterReadingValue(value) {
    let text = String(value || "").trim().replace(/\s/g, "");
    if (!text) return null;
    if (text.includes(",") && text.includes(".")) {
      if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
        text = text.replace(/\./g, "").replace(",", ".");
      } else {
        text = text.replace(/,/g, "");
      }
    } else if (text.includes(",")) {
      text = text.replace(",", ".");
    }
    text = text.replace(/[^\d.]/g, "");
    if (!/^\d+(?:\.\d{1,4})?$/.test(text)) return null;
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
  }
  function meterNumericInterpretations(raw) {
    const clean = String(raw || "").replace(/\s/g, "").replace(/O/gi, "0").replace(/[Il|]/g, "1");
    const out = [];
    const direct = parseMeterReadingValue(clean);
    if (direct != null) {
      out.push({
        value: direct,
        mode: "direkt",
        bonus: /[.,]/.test(clean) ? 0.12 : 0
      });
    }
    const digits = clean.replace(/\D/g, "");
    if (/^\d{4,9}$/.test(digits) && !/[.,]/.test(clean)) {
      for (const decimals of [3, 2, 1, 4]) {
        if (digits.length <= decimals) continue;
        const number = Number(
          `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}`
        );
        if (Number.isFinite(number)) {
          out.push({
            value: number,
            mode: `${decimals} Nachkommastellen ergänzt`,
            bonus: decimals === 3 ? 0.08 : decimals === 2 ? 0.04 : 0
          });
        }
      }
    }
    const seen = /* @__PURE__ */ new Set();
    return out.filter((item) => {
      const key = item.value.toFixed(4);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function meterReadingCandidates(text, source = "ocr", baseScore = 0.55) {
    const lines = String(text || "").split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
    const out = [];
    for (const line of lines) {
      const low = line.toLowerCase();
      const context = /zählerstand|zaehlerstand|stand|m³|m3|kubik|verbrauch/.test(low);
      const regex = /\d(?:[\d\s.,]{1,12}\d)?/g;
      for (const match of line.matchAll(regex)) {
        const raw = match[0].trim();
        const digits = raw.replace(/\D/g, "");
        if (digits.length < 2 || digits.length > 10) continue;
        for (const interpretation of meterNumericInterpretations(raw)) {
          const score = baseScore + (context ? 0.16 : 0) + (/[.,]/.test(raw) ? 0.08 : 0) + (interpretation.bonus || 0);
          out.push({
            raw,
            value: interpretation.value,
            line,
            score: Math.min(0.96, score),
            source,
            interpretation: interpretation.mode
          });
        }
      }
    }
    return out;
  }
  function detectedMeterSerialCandidates(text) {
    const lines = String(text || "").split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
    const out = [];
    for (const line of lines) {
      const low = line.toLowerCase();
      const context = /zähler|zaehler|nummer|nr\.|serial|serien/.test(low);
      for (const match of line.matchAll(/\b[A-Z0-9][A-Z0-9\-\/]{5,17}\b/gi)) {
        const normalized = normalizeMeterNumber(match[0]);
        if (normalized.length < 6 || /^\d{1,6}$/.test(normalized)) continue;
        out.push({
          raw: match[0],
          normalized,
          line,
          score: context ? 0.9 : 0.45
        });
      }
    }
    return out.sort((a, b) => b.score - a.score);
  }
  function meterNumberComparable(value) {
    return normalizeMeterNumber(value).replace(/[OQ]/g, "0").replace(/[IL]/g, "1").replace(/S/g, "5").replace(/B/g, "8");
  }
  function editDistance(aValue, bValue) {
    const a = String(aValue);
    const b = String(bValue);
    const row = Array(b.length + 1).fill(0).map((_, index) => index);
    for (let i = 1; i <= a.length; i++) {
      let previous = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const old = row[j];
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + cost);
        previous = old;
      }
    }
    return row[b.length];
  }
  function meterNumberSimilarity(a, b) {
    const left = meterNumberComparable(a);
    const right = meterNumberComparable(b);
    if (!left || !right) return 0;
    if (left.includes(right) || right.includes(left)) return 0.99;
    return 1 - editDistance(left, right) / Math.max(left.length, right.length);
  }
  return __toCommonJS(meter_parsing_exports);
})();


/* ===== compiled src/domain/property-domain.ts ===== */
"use strict";
var AppPropertyDomain = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/domain/property-domain.ts
  var property_domain_exports = {};
  __export(property_domain_exports, {
    addMeterReading: () => addMeterReading,
    allocateCostPosition: () => allocateCostPosition,
    analyzeMeterOCRText: () => analyzeMeterOCRText,
    centralBillingAnalysis: () => centralBillingAnalysis,
    ensureDefaultMeters: () => ensureDefaultMeters,
    latestMeterReading: () => latestMeterReading,
    matchMeterFromOCR: () => matchMeterFromOCR,
    meterById: () => meterById,
    meterCandidateHistoryScore: () => meterCandidateHistoryScore,
    meterReadingPlausibility: () => meterReadingPlausibility,
    migrateDomainState: () => migrateDomainState,
    positionById: () => positionById,
    positionDefaults: () => positionDefaults,
    positionToEvents: () => positionToEvents,
    rankMeterCandidates: () => rankMeterCandidates,
    readingById: () => readingById,
    replaceAssessmentPositions: () => replaceAssessmentPositions,
    settlementByPeriod: () => settlementByPeriod,
    settlementConsumption: () => settlementConsumption,
    sourcePositions: () => sourcePositions,
    syncSimpleSourcePosition: () => syncSimpleSourcePosition
  });
  function positionDefaults(p = {}) {
    return {
      id: p.id || uid(),
      sourceId: p.sourceId || "",
      documentId: p.documentId || "",
      label: p.label || "Kostenposition",
      category: p.category || "other",
      amount: Number(p.amount || 0),
      interval: p.interval || "once",
      serviceStart: p.serviceStart || "",
      serviceEnd: p.serviceEnd || "",
      assignment: p.assignment || "house",
      agreement: p.agreement || "auto",
      confirmed: p.confirmed !== false,
      origin: p.origin || "manual",
      details: { quantity: null, unit: "", rate: null, vatRate: null, net: null, gross: null, ...p.details || {} },
      decisionHistory: Array.isArray(p.decisionHistory) ? p.decisionHistory : [],
      createdAt: p.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
      provenance: p.provenance || { origin: p.origin || "manual", documentId: p.documentId || "", sourceId: p.sourceId || "", evidence: "", confidence: null, confirmedAt: p.confirmed !== false ? (/* @__PURE__ */ new Date()).toISOString() : null, confirmedBy: "local-user" }
    };
  }
  function sourcePositions(state, sourceId) {
    return (state.costPositions || []).filter((p) => p.sourceId === sourceId);
  }
  function positionById(state, id) {
    return (state.costPositions || []).find((p) => p.id === id);
  }
  function migrateDomainState(state) {
    state.costPositions = Array.isArray(state.costPositions) ? state.costPositions.map(positionDefaults) : [];
    state.meters = Array.isArray(state.meters) ? state.meters : [];
    state.waterSettlements = Array.isArray(state.waterSettlements) ? state.waterSettlements : [];
    state.containers = Array.isArray(state.containers) ? state.containers : [];
    state.meta = state.meta || {};
    if (Number(state.meta.domainVersion || 0) >= DOMAIN_VERSION) return state;
    const existingKeys = new Set(state.costPositions.map((p) => `${p.sourceId}|${p.label}|${p.serviceStart}|${p.serviceEnd}`));
    for (const s of state.sources || []) {
      if (s.kind === "assessment") {
        for (const li of s.items || []) {
          const p = positionDefaults({
            sourceId: s.id,
            documentId: s.sourceDocumentId || "",
            label: li.label || category(li.category).label,
            category: li.category,
            amount: li.amount,
            interval: "once",
            serviceStart: s.serviceStart || `${s.year}-01-01`,
            serviceEnd: s.serviceEnd || `${s.year}-12-31`,
            assignment: li.assignment || "house",
            agreement: li.agreement || "auto",
            origin: "migration"
          });
          const k = `${p.sourceId}|${p.label}|${p.serviceStart}|${p.serviceEnd}`;
          if (!existingKeys.has(k)) {
            state.costPositions.push(p);
            existingKeys.add(k);
          }
        }
        if (Number(s.waterCanalReference || 0) > 0) {
          const p = positionDefaults({
            sourceId: s.id,
            documentId: s.sourceDocumentId || "",
            label: "Wasser/Kanal",
            category: "water",
            amount: Number(s.waterCanalReference),
            interval: "once",
            serviceStart: s.serviceStart || `${s.year}-01-01`,
            serviceEnd: s.serviceEnd || `${s.year}-12-31`,
            assignment: "house",
            agreement: "auto",
            origin: "migration",
            details: { note: "Aus früheren Daten übernommen" }
          });
          const k = `${p.sourceId}|${p.label}|${p.serviceStart}|${p.serviceEnd}`;
          if (!existingKeys.has(k)) {
            state.costPositions.push(p);
            existingKeys.add(k);
          }
        }
      } else {
        const p = positionDefaults({
          sourceId: s.id,
          documentId: s.sourceDocumentId || "",
          label: s.name || category(s.category).label,
          category: s.category || "other",
          amount: s.amount,
          interval: s.interval || "once",
          serviceStart: s.serviceStart || "",
          serviceEnd: s.serviceEnd || "",
          assignment: s.assignment || "house",
          agreement: s.agreement || "auto",
          origin: "migration",
          details: { note: s.note || "" }
        });
        const k = `${p.sourceId}|${p.label}|${p.serviceStart}|${p.serviceEnd}`;
        if (!existingKeys.has(k)) {
          state.costPositions.push(p);
          existingKeys.add(k);
        }
      }
    }
    ensureDefaultMeters(state);
    if (!state.waterSettlements.length && Array.isArray(state.water)) {
      for (const w of state.water) {
        const py = Number(w.periodYear ?? w.year);
        if (!py) continue;
        const main = state.meters.find((m) => m.role === "mainWater"), owner = state.meters.find((m) => m.role === "ownerWater");
        const ps = periodStart(py), pe = periodEnd(py);
        const mainStart = addMeterReading(main, ps, 0, "migration", true);
        const mainEnd = addMeterReading(main, pe, Number(w.houseConsumption || 0), "migration", true);
        const ownerStart = addMeterReading(owner, ps, Number(w.ownerStart || 0), "migration", true);
        const ownerEnd = addMeterReading(owner, pe, Number(w.ownerEnd || 0), "migration", true);
        state.waterSettlements.push({
          id: w.id || uid(),
          periodYear: py,
          mainMeterId: main.id,
          ownerMeterId: owner.id,
          mainStartReadingId: mainStart.id,
          mainEndReadingId: mainEnd.id,
          ownerStartReadingId: ownerStart.id,
          ownerEndReadingId: ownerEnd.id,
          migrated: true
        });
        if (Number(w.totalCost || 0) > 0 && !state.costPositions.some((p) => p.category === "water" && p.serviceStart === ps && p.serviceEnd === pe)) {
          state.costPositions.push(positionDefaults({
            sourceId: "legacy-water-" + py,
            label: "Kaltwasser / Kanal",
            category: "water",
            amount: Number(w.totalCost),
            serviceStart: ps,
            serviceEnd: pe,
            assignment: "house",
            agreement: "auto",
            origin: "migration"
          }));
        }
      }
    }
    state.meta.domainVersion = DOMAIN_VERSION;
    state.meta.domainMigratedAt = (/* @__PURE__ */ new Date()).toISOString();
    return state;
  }
  function ensureDefaultMeters(state) {
    state.meters = Array.isArray(state.meters) ? state.meters : [];
    let main = state.meters.find((m) => m.role === "mainWater");
    let owner = state.meters.find((m) => m.role === "ownerWater");
    if (!main) {
      main = { id: uid(), role: "mainWater", name: "Hauptwasserzähler", number: "", unit: "m³", readings: [] };
      state.meters.push(main);
    }
    if (!owner) {
      owner = { id: uid(), role: "ownerWater", name: "Zwischenzähler Eigennutzung", number: "", unit: "m³", readings: [] };
      state.meters.push(owner);
    }
    main.readings = Array.isArray(main.readings) ? main.readings : [];
    owner.readings = Array.isArray(owner.readings) ? owner.readings : [];
    return { main, owner };
  }
  function meterById(state, id) {
    return (state.meters || []).find((m) => m.id === id);
  }
  function readingById(meter, id) {
    return (meter?.readings || []).find((r) => r.id === id);
  }
  function addMeterReading(meter, date, value, origin = "manual", synthetic = false) {
    const same = (meter.readings || []).find((r2) => r2.date === date && Number(r2.value) === Number(value));
    if (same) return same;
    const r = { id: uid(), date, value: Number(value), origin, synthetic, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
    meter.readings.push(r);
    meter.readings.sort((a, b) => a.date.localeCompare(b.date));
    return r;
  }
  var {
    normalizeMeterNumber,
    parseMeterReadingValue,
    meterNumericInterpretations,
    meterReadingCandidates,
    detectedMeterSerialCandidates,
    meterNumberComparable,
    editDistance,
    meterNumberSimilarity
  } = AppMeterParsing;
  function matchMeterFromOCR(s, text, preferredMeterId = "") {
    const meters = s.meters || [];
    if (preferredMeterId) {
      const preferred = meters.find((m) => m.id === preferredMeterId);
      if (preferred) return { meter: preferred, confidence: 1, reason: "Aufnahme direkt an diesem Zähler gestartet" };
    }
    const serials = detectedMeterSerialCandidates(text), matches = [];
    for (const m of meters) {
      if (!m.number) continue;
      const best = serials.map((c) => ({ candidate: c, similarity: meterNumberSimilarity(c.raw, m.number) })).sort((a, b) => b.similarity - a.similarity)[0];
      if (best?.similarity >= 0.78) matches.push({ meter: m, confidence: Math.min(0.98, 0.62 + best.similarity * 0.36), reason: best.similarity > 0.96 ? "gespeicherte Zählernummer erkannt" : "Zählernummer trotz kleiner OCR-Abweichung wiedererkannt" });
    }
    matches.sort((a, b) => b.confidence - a.confidence);
    if (matches.length === 1 || matches[0]?.confidence - (matches[1]?.confidence || 0) > 0.08) return matches[0] || { meter: null, confidence: 0, reason: "keine gespeicherte Zählernummer erkannt" };
    return { meter: null, confidence: 0, reason: matches.length ? "mehrere Zähler ähnlich erkannt" : "keine gespeicherte Zählernummer erkannt" };
  }
  function meterCandidateHistoryScore(meter, date, value) {
    if (!meter || value == null) return 0;
    const prev = (meter.readings || []).filter((r) => r.date <= date).sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
    if (!prev) return 0;
    const diff = Number(value) - Number(prev.value);
    if (diff < 0) return -0.42;
    let score = diff < 1 ? 0.12 : diff < 50 ? 0.2 : diff < 250 ? 0.08 : -0.24;
    const trend = meterTrend(meter), last = trend.segments?.at(-1);
    if (last && prev.date < date) {
      const days = Math.max(1, calendarDayDiff(prev.date, date)), expected = Math.max(1e-3, last.perDay * days), ratio = diff / expected;
      if (ratio >= 0.25 && ratio <= 4) score += 0.14;
      else if (ratio > 12) score -= 0.18;
    }
    return score;
  }
  function rankMeterCandidates(s, meterId, date, candidates) {
    const meter = meterById(s, meterId), groups = /* @__PURE__ */ new Map();
    for (const c of candidates || []) {
      if (c.value < 0 || c.value > 1e6) continue;
      const key = Number(c.value).toFixed(4), g = groups.get(key) || { ...c, consensus: 0, sources: /* @__PURE__ */ new Set(), score: 0 };
      g.consensus++;
      g.sources.add(c.source);
      g.score = Math.max(g.score, Number(c.score || 0));
      groups.set(key, g);
    }
    return [...groups.values()].map((g) => {
      let score = g.score + Math.min(0.16, (g.consensus - 1) * 0.055) + meterCandidateHistoryScore(meter, date, g.value);
      if (g.sources.size >= 2) score += 0.05;
      return { ...g, source: [...g.sources].join(" + "), score: Math.max(0.01, Math.min(0.995, score)) };
    }).sort((a, b) => b.score - a.score);
  }
  function analyzeMeterOCRText(s, text, preferredMeterId = "", extraCandidates = [], date = smartToday()) {
    const assignment = matchMeterFromOCR(s, text, preferredMeterId), base = meterReadingCandidates(text, "Vollbild", 0.48), serials = detectedMeterSerialCandidates(text), meterId = assignment.meter?.id || preferredMeterId || "", ranked = rankMeterCandidates(s, meterId, date, [...base, ...extraCandidates]), chosen = ranked[0] || null;
    return { meterId, meterName: assignment.meter?.name || meterById(s, preferredMeterId)?.name || "", assignmentConfidence: assignment.confidence || 0, assignmentReason: assignment.reason, reading: chosen?.value ?? null, readingRaw: chosen?.raw || "", readingConfidence: chosen?.score || 0, readingEvidence: chosen?.line || "", serialCandidate: serials[0]?.raw || "", serialConfidence: serials[0]?.score || 0, candidates: ranked.slice(0, 10), text: String(text || "") };
  }
  function latestMeterReading(meter) {
    return (meter?.readings || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0] || null;
  }
  function meterReadingPlausibility(meter, date, value) {
    const all = (meter?.readings || []).filter((r) => r.date <= date).sort((a, b) => (b.date || "").localeCompare(a.date || "")), prev = all[0];
    if (!prev) return { ok: true, message: "Keine frühere Ablesung zum Vergleich vorhanden." };
    if (Number(value) < Number(prev.value)) return { ok: false, message: `Der neue Stand ${value} liegt unter der letzten Ablesung ${prev.value} vom ${prev.date}. Zählerwechsel oder OCR-Fehler prüfen.` };
    return { ok: true, message: `Letzte Ablesung ${prev.value} am ${prev.date}; Differenz ${(Number(value) - Number(prev.value)).toFixed(3)} ${meter.unit || ""}.` };
  }
  function settlementByPeriod(state, year) {
    return (state.waterSettlements || []).find((w) => Number(w.periodYear) === Number(year));
  }
  function settlementConsumption(state, settlement) {
    if (!settlement) return null;
    const main = meterById(state, settlement.mainMeterId), owner = meterById(state, settlement.ownerMeterId);
    const bp = Number.isInteger(Number(settlement.periodYear)) ? billingPeriodInfo(state, Number(settlement.periodYear)) : null;
    const buildingId = String(settlement.buildingId || main?.buildingId || owner?.buildingId || state?.meta?.primaryBuildingId || "");
    if (bp && AppLifecycleLedger.replacementsInPeriod(state, bp.start, bp.end, buildingId).length) {
      const chained = AppLifecycleLedger.waterConsumptionBetween(state, bp.start, bp.end, buildingId);
      return { ...chained, periodAligned: true, valid: !!chained.valid };
    }
    const ms = readingById(main, settlement.mainStartReadingId), me = readingById(main, settlement.mainEndReadingId);
    const os = readingById(owner, settlement.ownerStartReadingId), oe = readingById(owner, settlement.ownerEndReadingId);
    if (!ms || !me || !os || !oe) return null;
    const house = Number(me.value) - Number(ms.value), own = Number(oe.value) - Number(os.value), tenant = house - own;
    const periodAligned = !bp || ms.date === bp.start && os.date === bp.start && me.date === bp.end && oe.date === bp.end;
    return {
      house,
      owner: own,
      tenant,
      share: house > 0 ? tenant / house : 0,
      periodAligned,
      valid: house >= 0 && own >= 0 && tenant >= 0 && periodAligned
    };
  }
  function positionToEvents(s, position, periodYear) {
    const p = positionDefaults(position), bp = billingPeriodInfo(s, periodYear);
    if (!p.confirmed || !bp.active) return [];
    const ps = bp.start, pe = bp.end, start = p.serviceStart || ps, end = p.serviceEnd || pe;
    const ov = overlapDays(start, end, ps, pe);
    if (!ov) return [];
    const factor = ov / daysInclusive(start, end);
    let amount = Number(p.amount || 0);
    if (p.interval === "monthly") amount = amount * 12 * factor;
    else if (p.interval === "quarterly") amount = amount * 4 * factor;
    else if (p.interval === "yearly") amount = amount * factor;
    else amount = amount * factor;
    return [{
      positionId: p.id,
      sourceId: p.sourceId,
      documentId: p.documentId,
      label: p.label,
      category: p.category,
      amount,
      assignment: p.assignment,
      agreement: p.agreement,
      serviceStart: start,
      serviceEnd: end,
      details: p.details
    }];
  }
  function allocateCostPosition(s, event, periodYear) {
    const settlement = settlementByPeriod(s, periodYear), cons = settlementConsumption(s, settlement), bp = billingPeriodInfo(s, periodYear);
    const hasConsumption = event.category === "water" && !!cons?.valid;
    let decision = event.assignment === "review" ? { status: "check", billable: true, rule: "manual", reason: "Zuordnung muss bestätigt werden.", basis: "Dokument-/Objektzuordnung" } : legalDecision(event, { hasConsumption, assignment: event.assignment, agreement: event.agreement });
    let share = 0;
    const area = shares(s, bp.start).area;
    if (decision.rule === "area") share = area;
    else if (decision.rule === "persons") share = personShareForPeriod(s, bp.start, bp.end);
    else if (decision.rule === "rental") share = 1;
    else if (decision.rule === "owner") share = 0;
    else if (decision.rule === "consumption" && cons?.valid) share = cons.share;
    return { ...event, decision, tenantShare: share, tenantAmount: Number(event.amount || 0) * share };
  }
  function centralBillingAnalysis(s, periodYear) {
    const bp = billingPeriodInfo(s, periodYear);
    const events = bp.active ? (s.costPositions || []).flatMap((p) => positionToEvents(s, p, periodYear)).map((e) => allocateCostPosition(s, e, periodYear)) : [];
    const unresolved = events.filter((e) => e.decision.status === "check" || e.decision.rule === "manual");
    const tenantCosts = events.reduce((sum, e) => sum + Number(e.tenantAmount || 0), 0);
    const lease = (s.leases || []).find((l) => (!l.start || l.start <= bp.end) && (!l.end || l.end >= bp.start)) || s.leases[0], advanceEvidence = actualAdvanceEvidenceInPeriod(s, lease, periodYear), advances = advanceEvidence.amount;
    return { events, unresolved, tenantCosts, advances, advanceEvidence, result: tenantCosts - advances, lease, period: bp };
  }
  function syncSimpleSourcePosition(state, source) {
    if (!source || source.kind === "assessment") return;
    let p = (state.costPositions || []).find((x) => x.sourceId === source.id && x.origin !== "document");
    const data = positionDefaults({
      ...p || {},
      sourceId: source.id,
      label: source.name || "Kostenquelle",
      category: source.category || "other",
      amount: Number(source.amount || 0),
      interval: source.interval || "once",
      serviceStart: source.serviceStart || "",
      serviceEnd: source.serviceEnd || "",
      assignment: source.assignment || "house",
      agreement: source.agreement || "auto",
      confirmed: true,
      origin: p?.origin || "manual",
      details: { ...p?.details || {}, note: source.note || "" }
    });
    if (p) Object.assign(p, data);
    else state.costPositions.push(data);
  }
  function replaceAssessmentPositions(state, source, positions) {
    const keep = (state.costPositions || []).filter((p) => p.sourceId !== source.id);
    state.costPositions = keep.concat((positions || []).map((p) => positionDefaults({
      ...p,
      sourceId: source.id,
      documentId: source.sourceDocumentId || p.documentId || "",
      serviceStart: p.serviceStart || source.serviceStart,
      serviceEnd: p.serviceEnd || source.serviceEnd,
      confirmed: true
    })));
  }
  return __toCommonJS(property_domain_exports);
})();


/* ===== compiled src/domain/legal-rules.ts ===== */
"use strict";
var AppLegalRules = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/domain/legal-rules.ts
  var legal_rules_exports = {};
  __export(legal_rules_exports, {
    CATEGORIES: () => CATEGORIES,
    LAW_DATE: () => LAW_DATE,
    LEGAL_SOURCES: () => LEGAL_SOURCES,
    category: () => category,
    legalDecision: () => legalDecision,
    loadLegalPack: () => loadLegalPack
  });
  var LAW_DATE = "2026-09-05";
  var LEGAL_SOURCES = [
    { name: "§ 556 BGB", url: "https://www.gesetze-im-internet.de/bgb/__556.html", purpose: "Betriebskosten, Abrechnung, Frist, Belegeinsicht" },
    { name: "§ 556a BGB", url: "https://www.gesetze-im-internet.de/bgb/__556a.html", purpose: "Abrechnungsmaßstab" },
    { name: "§ 556b BGB", url: "https://www.gesetze-im-internet.de/bgb/__556b.html", purpose: "Regelfälligkeit der Miete" },
    { name: "§ 560 BGB", url: "https://www.gesetze-im-internet.de/bgb/__560.html", purpose: "Anpassung von Vorauszahlungen" },
    { name: "BetrKV", url: "https://www.gesetze-im-internet.de/betrkv/", purpose: "Umlagefähige Betriebskosten" }
  ];
  var CATEGORIES = {
    propertyTax: { label: "Grundsteuer B", billable: true, basis: "§ 2 Nr. 1 BetrKV", defaultRule: "area" },
    rainwater: { label: "Niederschlagswasser", billable: true, basis: "§ 2 Nr. 3 BetrKV", defaultRule: "area" },
    street: { label: "Straßenreinigung / Winterdienst", billable: true, basis: "§ 2 Nr. 8 BetrKV", defaultRule: "area" },
    waste: { label: "Abfall", billable: true, basis: "§ 2 Nr. 8 BetrKV", defaultRule: "area" },
    insurance: { label: "Gebäudeversicherung", billable: true, basis: "§ 2 BetrKV", defaultRule: "area" },
    chimney: { label: "Schornsteinfeger", billable: true, basis: "§ 2 BetrKV", defaultRule: "area" },
    water: { label: "Kaltwasser / Kanal", billable: true, basis: "§ 2 Nr. 2/3 BetrKV", defaultRule: "consumption" },
    garden: { label: "Gartenpflege", billable: true, basis: "§ 2 BetrKV", defaultRule: "area" },
    cleaning: { label: "Gebäudereinigung", billable: true, basis: "§ 2 BetrKV", defaultRule: "area" },
    other: { label: "Sonstige Betriebskosten", billable: "check", basis: "§ 2 Nr. 17 BetrKV", defaultRule: "area" },
    admin: { label: "Verwaltungskosten", billable: false, basis: "§ 1 Abs. 2 Nr. 1 BetrKV", defaultRule: "owner" },
    repair: { label: "Instandhaltung / Reparatur", billable: false, basis: "§ 1 Abs. 2 Nr. 2 BetrKV", defaultRule: "owner" },
    internet: { label: "Internet Eigennutzung", billable: false, basis: "private Kosten", defaultRule: "owner" },
    broadcasting: { label: "Rundfunkbeitrag", billable: false, basis: "private Kosten", defaultRule: "owner" },
    financing: { label: "Hausfinanzierung", billable: false, basis: "keine Betriebskosten", defaultRule: "owner" }
  };
  function category(id) {
    return ACTIVE_LEGAL_PACK?.categories?.[id] || CATEGORIES[id] || { label: id, billable: "check", basis: "manuell prüfen", defaultRule: "area" };
  }
  async function loadLegalPack() {
    try {
      const r = await fetch("./legal-rules.json?ts=" + Date.now(), { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const p = await r.json();
      if (p?.schema !== "mietverwaltung-legal-pack-v1" || !p.categories) throw new Error("Ungültiges Regelpaket");
      ACTIVE_LEGAL_PACK = p;
      return p;
    } catch (e) {
      console.warn("Regelpaket-Fallback aktiv", e);
      return null;
    }
  }
  function legalDecision(source, { hasConsumption = false, assignment = "house", agreement = "auto" } = {}) {
    const c = category(source.category);
    if (c.billable === false) return { status: "blocked", billable: false, rule: "owner", reason: "Diese Kostenart ist nicht auf die Mieterin umlagefähig.", basis: c.basis };
    if (assignment === "owner") return { status: "ok", billable: false, rule: "owner", reason: "Die Kostenquelle ist ausschließlich der Eigennutzung zugeordnet.", basis: "Objektzuordnung" };
    if (assignment === "rental") return { status: "ok", billable: true, rule: "rental", reason: "Die Kostenquelle betrifft ausschließlich die Mietwohnung.", basis: "Direktzuordnung" };
    if (c.billable === "check") return { status: "check", billable: true, rule: agreement === "persons" ? "persons" : "area", reason: "Sonstige Betriebskosten müssen im konkreten Vertrag ausreichend erfasst sein.", basis: c.basis };
    if (hasConsumption || c.defaultRule === "consumption") return { status: "ok", billable: true, rule: "consumption", reason: "Der Verbrauch wird erfasst; daher wird verbrauchsbezogen verteilt.", basis: `${c.basis}; § 556a Abs. 1 BGB` };
    if (agreement === "persons") return { status: "ok", billable: true, rule: "persons", reason: "Personenschlüssel wurde als Vertragsvorgabe hinterlegt.", basis: "vertragliche Vereinbarung / § 556a BGB" };
    if (agreement === "area" || agreement === "auto") return { status: "ok", billable: true, rule: "area", reason: "Wohnfläche ist der hinterlegte bzw. gesetzliche Standardmaßstab.", basis: `${c.basis}; § 556a BGB` };
    return { status: "check", billable: true, rule: "manual", reason: "Individuelle Verteilung muss geprüft werden.", basis: c.basis };
  }
  return __toCommonJS(legal_rules_exports);
})();


/* ===== compiled src/domain/billing-domain.ts ===== */
"use strict";
var AppBillingDomain = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/domain/billing-domain.ts
  var billing_domain_exports = {};
  __export(billing_domain_exports, {
    actualAdvanceEvidenceInPeriod: () => actualAdvanceEvidenceInPeriod,
    actualAdvanceInPeriod: () => actualAdvanceInPeriod,
    actualCashflowByMonth: () => actualCashflowByMonth,
    agreementLabel: () => agreementLabel,
    assignmentLabel: () => assignmentLabel,
    billingAnalysis: () => billingAnalysis,
    billingPeriodContext: () => billingPeriodContext,
    billingPeriodInfo: () => billingPeriodInfo,
    billingPeriodLabel: () => billingPeriodLabel,
    billingPeriodStart: () => billingPeriodStart,
    billingReadiness: () => billingReadiness,
    billingSelectableYears: () => billingSelectableYears,
    billingTakeoverDate: () => billingTakeoverDate,
    calendarDayDiff: () => calendarDayDiff,
    confidencePercent: () => confidencePercent,
    createBillingSnapshot: () => createBillingSnapshot,
    currentPeriodYear: () => currentPeriodYear,
    currentPersons: () => currentPersons,
    dateDE: () => dateDE,
    dateOnlyUtcValue: () => dateOnlyUtcValue,
    daysInclusive: () => daysInclusive,
    euro: () => euro,
    intervalLabel: () => intervalLabel,
    monthlyAdvanceInPeriod: () => monthlyAdvanceInPeriod,
    overlapDays: () => overlapDays,
    paymentAdvanceForLease: () => paymentAdvanceForLease,
    paymentMonthKey: () => paymentMonthKey,
    percent: () => percent,
    periodBillingTarget: () => periodBillingTarget,
    periodBillingTargetISO: () => periodBillingTargetISO,
    periodDeadline: () => periodDeadline,
    periodDeadlineISO: () => periodDeadlineISO,
    periodEnd: () => periodEnd,
    periodLabel: () => periodLabel,
    periodStart: () => periodStart,
    personDays: () => personDays,
    personShareForPeriod: () => personShareForPeriod,
    preferredBillingYear: () => preferredBillingYear,
    selectedBillingYear: () => selectedBillingYear,
    shares: () => shares,
    snapshotFor: () => snapshotFor,
    uid: () => uid,
    unitByType: () => unitByType
  });
  var euro = (n) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(n) || 0);
  var dateDE = (d) => {
    if (!d) return "–";
    const x = /* @__PURE__ */ new Date(String(d).slice(0, 10) + "T00:00:00");
    return Number.isNaN(x.getTime()) ? String(d) : x.toLocaleDateString("de-DE");
  };
  var intervalLabel = (v) => ({ once: "einmalig", monthly: "monatlich", quarterly: "vierteljährlich", yearly: "jährlich" })[String(v)] || v || "–";
  var assignmentLabel = (v) => ({ house: "gesamtes Haus", owner: "nur Eigennutzung", rental: "nur Mietwohnung", review: "noch prüfen" })[String(v)] || v || "–";
  var agreementLabel = (v) => ({ auto: "automatischer Standard", area: "Wohnfläche", persons: "Personen", manual: "individuell prüfen", consumption: "Verbrauch", rental: "direkt Mietwohnung", owner: "Eigennutzung" })[String(v)] || v || "–";
  var confidencePercent = (v) => {
    const n = Number(v || 0);
    return Math.max(0, Math.min(100, n <= 1 ? n * 100 : n));
  };
  var percent = (n) => new Intl.NumberFormat("de-DE", { style: "percent", maximumFractionDigits: 1 }).format(Number(n) || 0);
  var uid = () => crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random();
  var periodStart = (y) => `${y}-01-01`;
  var periodEnd = (y) => `${y}-12-31`;
  var periodLabel = (y) => `01.01.${y} – 31.12.${y}`;
  var periodBillingTargetISO = (y) => `${y + 1}-03-31`;
  var periodBillingTarget = (y) => dateDE(periodBillingTargetISO(y));
  var periodDeadlineISO = (y) => `${y + 1}-12-31`;
  var periodDeadline = (y) => dateDE(periodDeadlineISO(y));
  function currentPeriodYear() {
    return (/* @__PURE__ */ new Date()).getFullYear();
  }
  function preferredBillingYear() {
    const d = /* @__PURE__ */ new Date(), y = d.getFullYear();
    return d.getMonth() <= 2 ? y - 1 : y;
  }
  function billingSelectableYears(s = state) {
    const years = /* @__PURE__ */ new Set([preferredBillingYear(), currentPeriodYear()]);
    for (const snap of s.billingSnapshots || []) if (Number.isInteger(Number(snap.periodYear))) years.add(Number(snap.periodYear));
    for (const sett of s.waterSettlements || []) if (Number.isInteger(Number(sett.periodYear))) years.add(Number(sett.periodYear));
    for (const pos of s.costPositions || []) {
      const d = String(pos.serviceStart || pos.serviceEnd || "").slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        const [yy] = d.split("-").map(Number);
        years.add(yy);
      }
    }
    const takeover = billingTakeoverDate(s);
    if (/^\d{4}-\d{2}-\d{2}$/.test(takeover)) {
      const [yy] = takeover.split("-").map(Number), first = yy, last = currentPeriodYear();
      for (let y = first; y <= last && y < first + 60; y++) if (billingPeriodInfo(s, y).active) years.add(y);
    } else years.add(currentPeriodYear() - 1);
    return [...years].filter((y) => Number.isInteger(y) && y > 1900 && billingPeriodInfo(s, y).active).sort((a, b) => b - a);
  }
  function selectedBillingYear(s = state) {
    const options = billingSelectableYears(s), saved = Number(sessionStorage.getItem("billingSelectedYear")), preferred = preferredBillingYear();
    if (options.includes(saved)) return saved;
    if (options.includes(preferred)) return preferred;
    return options[0] ?? currentPeriodYear();
  }
  function billingTakeoverDate(s = state) {
    return String(s?.property?.billingTakeoverDate || s?.property?.ownershipEffective || "");
  }
  function billingPeriodInfo(s, year) {
    const nominalStart = periodStart(year), end = periodEnd(year), takeover = billingTakeoverDate(s);
    let start = nominalStart, active = true, isTakeoverPeriod = false;
    if (takeover) {
      if (takeover > end) active = false;
      else if (takeover > nominalStart) {
        start = takeover;
        isTakeoverPeriod = true;
      }
    }
    const predecessorEnd = s?.property?.predecessorBillingEnd || (takeover ? dateOnlyAddDays(takeover, -1) : "");
    return {
      year,
      start,
      end,
      nominalStart,
      takeover,
      predecessorEnd,
      active,
      isTakeoverPeriod,
      days: active ? daysInclusive(start, end) : 0,
      nominalDays: daysInclusive(nominalStart, end)
    };
  }
  function billingPeriodStart(s, year) {
    return billingPeriodInfo(s, year).start;
  }
  function billingPeriodLabel(s, year) {
    const p = billingPeriodInfo(s, year), f = (d) => d ? (/* @__PURE__ */ new Date(d + "T00:00:00")).toLocaleDateString("de-DE") : "–";
    return `${f(p.start)} – ${f(p.end)}`;
  }
  function billingPeriodContext(s, year) {
    const p = billingPeriodInfo(s, year);
    if (!p.active) return { kind: "before-takeover", message: "Diese Periode liegt vollständig vor der Verwaltungsübernahme." };
    if (p.isTakeoverPeriod) return { kind: "takeover", message: `Erste eigene Abrechnungsperiode ab ${(/* @__PURE__ */ new Date(p.start + "T00:00:00")).toLocaleDateString("de-DE")}. Der Voreigentümer rechnet bis ${(/* @__PURE__ */ new Date(p.predecessorEnd + "T00:00:00")).toLocaleDateString("de-DE")} selbst ab.` };
    return { kind: "annual", message: "Reguläre jährliche Abrechnungsperiode 01.01.–31.12." };
  }
  function dateOnlyUtcValue(v) {
    const m = String(v || "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return NaN;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  function calendarDayDiff(start, end) {
    const a = dateOnlyUtcValue(start), b = dateOnlyUtcValue(end);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
    return Math.round((b - a) / 864e5);
  }
  function overlapDays(aStart, aEnd, bStart, bEnd) {
    const s = aStart > bStart ? aStart : bStart, e = aEnd < bEnd ? aEnd : bEnd;
    if (!s || !e || s > e) return 0;
    return daysInclusive(s, e);
  }
  function daysInclusive(start, end) {
    const d = calendarDayDiff(start, end);
    return Number.isFinite(d) && d >= 0 ? d + 1 : 0;
  }
  function unitByType(state2, type) {
    return state2.units.find((u) => u.type === type);
  }
  function currentPersons(unit, date = localDateISO()) {
    const h = (unit?.occupancy || []).filter((x) => (!x.from || x.from <= date) && (!x.to || x.to >= date)).sort((a, b) => (b.from || "").localeCompare(a.from || ""));
    return h.length ? Number(h[0].count) || 0 : 0;
  }
  function shares(state2, date) {
    const owner = unitByType(state2, "owner"), rental = unitByType(state2, "rental");
    const totalArea = Number(state2.property.totalArea) || state2.units.reduce((s, u) => s + Number(u.area || 0), 0);
    const area = totalArea ? Number(rental?.area || 0) / totalArea : 0;
    const op = currentPersons(owner, date), rp = currentPersons(rental, date), pt = op + rp;
    return { area, persons: pt ? rp / pt : 0, ownerPersons: op, rentalPersons: rp };
  }
  function personDays(unit, start, end) {
    return (unit?.occupancy || []).reduce((sum, o) => {
      const os = o.from || start, oe = o.to || end, days = overlapDays(os, oe, start, end);
      return sum + days * Number(o.count || 0);
    }, 0);
  }
  function personShareForPeriod(state2, start, end) {
    const owner = unitByType(state2, "owner"), rental = unitByType(state2, "rental"), op = personDays(owner, start, end), rp = personDays(rental, start, end), total = op + rp;
    return total ? rp / total : 0;
  }
  function monthlyAdvanceInPeriod(s, lease, periodYear) {
    if (!lease) return 0;
    const bp = billingPeriodInfo(s, periodYear);
    if (!bp.active) return 0;
    const ps = bp.start, pe = bp.end, ls = lease.start || ps, le = lease.end || pe;
    let total = 0, [y, m] = ps.slice(0, 7).split("-").map(Number);
    const endMonth = pe.slice(0, 7), pad = (n) => String(n).padStart(2, "0");
    while (`${y}-${pad(m)}` <= endMonth) {
      const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const ms = `${y}-${pad(m)}-01`, me = `${y}-${pad(m)}-${pad(days)}`, start = ls > ms ? ls : ms, end = le < me ? le : me;
      if (start <= end) {
        const active = daysInclusive(start, end);
        total += Number(lease.advance || 0) * (active / days);
      }
      m++;
      if (m === 13) {
        m = 1;
        y++;
      }
    }
    return total;
  }
  function paymentAdvanceForLease(payment, lease) {
    if (!payment || payment.direction !== "income" || !lease) return { recognized: false, amount: 0 };
    if (payment.leaseId && lease.id && payment.leaseId !== lease.id) return { recognized: false, amount: 0 };
    const amount = Number(payment.amount || 0), rent = Number(lease.rent || 0), advance = Number(lease.advance || 0);
    if (!Number.isFinite(amount) || amount < 0) return { recognized: false, amount: 0 };
    const label = normalizeLabelText(payment.label || ""), tenant = normalizeLabelText(lease.tenantName || "");
    const looksRent = /\bmiete\b|mietzahlung|monatsmiete/.test(label) || tenant && label.includes(tenant);
    const looksAdvance = /betriebskosten|nebenkosten|vorauszahlung|\bbk\b|abschlag/.test(label);
    if (payment.advanceAmount !== void 0 && payment.advanceAmount !== null && payment.advanceAmount !== "") {
      const explicit = Number(payment.advanceAmount);
      return { recognized: looksRent || looksAdvance || !!payment.leaseId, amount: Number.isFinite(explicit) ? Math.max(0, explicit) : 0 };
    }
    if (looksAdvance && !looksRent && advance > 0 && amount <= advance * 1.5 + 0.01) return { recognized: true, amount: Math.max(0, amount) };
    if (!looksRent) return { recognized: false, amount: 0 };
    return { recognized: true, amount: Math.max(0, Math.min(advance, amount - rent)) };
  }
  function actualAdvanceEvidenceInPeriod(s, lease, periodYear) {
    if (!lease) return { amount: 0, recognizedPayments: 0 };
    const bp = billingPeriodInfo(s, periodYear);
    if (!bp.active) return { amount: 0, recognizedPayments: 0 };
    const ledger = AppLifecycleLedger.actualAdvanceFromLedger(s, lease, bp.start, bp.end);
    if (Number(ledger.allocationCount || 0) > 0) return ledger;
    const start = lease.start && lease.start > bp.start ? lease.start : bp.start, end = lease.end && lease.end < bp.end ? lease.end : bp.end;
    let amount = 0, recognizedPayments = 0;
    for (const payment of s.payments || []) {
      const date = String(payment.date || "").slice(0, 10);
      if (!date || date < start || date > end) continue;
      const part = paymentAdvanceForLease(payment, lease);
      if (!part.recognized) continue;
      recognizedPayments++;
      amount += Number(part.amount || 0);
    }
    return { amount, recognizedPayments };
  }
  function actualAdvanceInPeriod(s, lease, periodYear) {
    return actualAdvanceEvidenceInPeriod(s, lease, periodYear).amount;
  }
  function billingAnalysis(state2, periodYear) {
    return centralBillingAnalysis(state2, periodYear);
  }
  function billingReadiness(s, periodYear) {
    const analysis = billingAnalysis(s, periodYear), bp = billingPeriodInfo(s, periodYear);
    const relevant = (s.costPositions || []).some((p) => p.confirmed && positionToEvents(s, p, periodYear).length > 0);
    const waterPositions = (s.costPositions || []).some((p) => p.confirmed && p.category === "water" && positionToEvents(s, p, periodYear).length > 0);
    const settlement = settlementByPeriod(s, periodYear), cons = settlementConsumption(s, settlement);
    return [
      { id: "period", ok: bp.active, label: "Abrechnungsperiode liegt vor der Verwaltungsübernahme", route: "data", sub: "property" },
      { id: "objectName", ok: !!s.property.name, label: "Objektname fehlt", route: "data", sub: "property" },
      { id: "totalArea", ok: Number(s.property.totalArea) > 0, label: "Gesamtwohnfläche fehlt", route: "data", sub: "property" },
      { id: "ownerUnit", ok: !!unitByType(s, "owner"), label: "Eigennutzungs-Einheit fehlt", route: "data", sub: "units" },
      { id: "rentalUnit", ok: !!unitByType(s, "rental"), label: "Mietwohnung fehlt", route: "data", sub: "units" },
      { id: "lease", ok: !!s.leases.length, label: "Mietvertrag fehlt", route: "rental", sub: "overview" },
      { id: "positions", ok: relevant, label: "Keine bestätigte Kostenposition für diese Abrechnungsperiode", route: "data", sub: "positions" },
      { id: "water", ok: !waterPositions || !!cons?.valid, label: "Wasserzähler / Verbrauchsdaten fehlen", route: "rental", sub: "water" },
      { id: "allocation", ok: analysis.unresolved.length === 0, label: "Ungeklärte Umlageentscheidungen", route: "data", sub: "positions" }
    ];
  }
  function paymentMonthKey(date) {
    return String(date || "").slice(0, 7);
  }
  function actualCashflowByMonth(state2, months = 12) {
    const rows = [], now = /* @__PURE__ */ new Date();
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1), key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const income = (state2.payments || []).filter((p) => p.direction === "income" && paymentMonthKey(p.date) === key).reduce((s, p) => s + Number(p.amount || 0), 0);
      const outflow = (state2.payments || []).filter((p) => p.direction === "outflow" && paymentMonthKey(p.date) === key).reduce((s, p) => s + Number(p.amount || 0), 0);
      rows.push({ key, label: d.toLocaleDateString("de-DE", { month: "short", year: "2-digit" }), income, outflow, net: income - outflow });
    }
    return rows;
  }
  function snapshotFor(state2, periodYear, leaseId = "") {
    return AppLifecycleLedger.latestSnapshotFor(state2, periodYear, leaseId);
  }
  function createBillingSnapshot(state2, periodYear, options = {}) {
    const base = billingAnalysis(state2, periodYear), leaseId = String(options.leaseId || "");
    const analysis = leaseId ? AppLifecycleLedger.leaseBillingAnalysis(state2, base, periodYear, leaseId) : base;
    const waterConsumption = analysis.waterConsumption || settlementConsumption(state2, settlementByPeriod(state2, periodYear));
    const snapshot = {
      id: uid(),
      buildingId: String(analysis.lease?.buildingId || state2.meta?.primaryBuildingId || ""),
      leaseId,
      periodYear: Number(periodYear),
      period: structuredClone(analysis.period),
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      legalPackVersion: ACTIVE_LEGAL_PACK?.version || "Fallback",
      legalEffectiveDate: ACTIVE_LEGAL_PACK?.effectiveDate || LAW_DATE,
      domainVersion: DOMAIN_VERSION,
      schemaVersion: SCHEMA_VERSION,
      property: structuredClone(state2.property),
      correspondence: structuredClone(state2.correspondence || {}),
      units: structuredClone(state2.units),
      lease: structuredClone(analysis.lease || null),
      events: structuredClone(analysis.events),
      waterConsumption: structuredClone(waterConsumption || null),
      allocationBases: { totalArea: Number(state2.property?.totalArea || 0), rentalArea: Number(unitByType(state2, "rental")?.area || 0) },
      unresolved: structuredClone(analysis.unresolved),
      tenantCosts: Number(analysis.tenantCosts || 0),
      advances: Number(analysis.advances || 0),
      result: Number(analysis.result || 0),
      frozen: true
    };
    return AppLifecycleLedger.decorateSnapshotRevision(state2, snapshot, options);
  }
  return __toCommonJS(billing_domain_exports);
})();


/* ===== compiled src/domain/intelligence.ts ===== */
"use strict";
var AppIntelligence = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/domain/intelligence.ts
  var intelligence_exports = {};
  __export(intelligence_exports, {
    INTELLIGENCE_VERSION: () => INTELLIGENCE_VERSION,
    billingRecipient: () => billingRecipient,
    daysDistance: () => daysDistance,
    documentConfidenceSummary: () => documentConfidenceSummary,
    dueDatesForPosition: () => dueDatesForPosition,
    extractDocumentIntelligence: () => extractDocumentIntelligence,
    forecastSignals: () => forecastSignals,
    formatBillingRuleDetails: () => formatBillingRuleDetails,
    formatRuleForReport: () => formatRuleForReport,
    generateProfessionalBillingPDF: () => generateProfessionalBillingPDF,
    intelligentForecast: () => intelligentForecast,
    normalizeLabelText: () => normalizeLabelText,
    paymentMatchScore: () => paymentMatchScore,
    paymentMatchSuggestions: () => paymentMatchSuggestions,
    positionMonthlyEquivalent: () => positionMonthlyEquivalent,
    predictedMonth: () => predictedMonth,
    splitAddressLines: () => splitAddressLines,
    tokenSimilarity: () => tokenSimilarity,
    validateDocumentTotals: () => validateDocumentTotals
  });
  var INTELLIGENCE_VERSION = 1;
  function normalizeLabelText(v) {
    return String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  }
  function tokenSimilarity(a, b) {
    const A = new Set(normalizeLabelText(a).split(/\s+/).filter(Boolean)), B = new Set(normalizeLabelText(b).split(/\s+/).filter(Boolean));
    if (!A.size || !B.size) return 0;
    let hit = 0;
    for (const x of A) if (B.has(x)) hit++;
    return hit / Math.max(A.size, B.size);
  }
  function daysDistance(a, b) {
    if (!a || !b) return 9999;
    const d = calendarDayDiff(a, b);
    return Number.isFinite(d) ? Math.abs(d) : 9999;
  }
  function dueDatesForPosition(state, p) {
    const s = (state.sources || []).find((x) => x.id === p.sourceId);
    return Array.isArray(s?.dueDates) ? s.dueDates : [];
  }
  function paymentMatchScore(state, payment, position) {
    if (payment.direction !== "outflow") return { score: 0, reasons: [] };
    let score = 0, reasons = [];
    const amountDiff = Math.abs(Number(payment.amount || 0) - Number(position.amount || 0));
    const amountBase = Math.max(1, Number(position.amount || 0));
    const rel = amountDiff / amountBase;
    if (rel < 5e-3) {
      score += 55;
      reasons.push("Betrag stimmt praktisch exakt");
    } else if (rel < 0.03) {
      score += 42;
      reasons.push("Betrag sehr ähnlich");
    } else if (rel < 0.1) {
      score += 20;
      reasons.push("Betrag im plausiblen Bereich");
    }
    const label = tokenSimilarity(payment.label, position.label);
    score += Math.round(label * 25);
    if (label > 0.45) reasons.push("Bezeichnung passt");
    const dues = dueDatesForPosition(state, position);
    if (dues.length) {
      const dd = Math.min(...dues.map((d) => daysDistance(payment.date, d)));
      if (dd <= 2) {
        score += 18;
        reasons.push("Zahlungsdatum nahe Fälligkeit");
      } else if (dd <= 14) {
        score += 10;
        reasons.push("Zahlungsdatum im Fälligkeitsfenster");
      }
    } else if (position.serviceEnd) {
      const dd = daysDistance(payment.date, position.serviceEnd);
      if (dd <= 45) {
        score += 5;
        reasons.push("Datum nahe Leistungszeitraum");
      }
    }
    const src = (state.sources || []).find((s) => s.id === position.sourceId);
    if (src && tokenSimilarity(payment.label, src.name) > 0.35) {
      score += 12;
      reasons.push("Quelle passt zur Buchungsbezeichnung");
    }
    return { score: Math.min(100, score), reasons };
  }
  function paymentMatchSuggestions(state, payment, limit = 5) {
    return (state.costPositions || []).filter((p) => p.confirmed).map((p) => ({ position: p, ...paymentMatchScore(state, payment, p) })).filter((x) => x.score >= 25).sort((a, b) => b.score - a.score).slice(0, limit);
  }
  function positionMonthlyEquivalent(p, monthStart, monthEnd) {
    const start = p.serviceStart || monthStart, end = p.serviceEnd || monthEnd;
    const ov = overlapDays(start, end, monthStart, monthEnd);
    if (!ov) return 0;
    const factor = ov / daysInclusive(start, end), a = Number(p.amount || 0);
    if (p.interval === "monthly") return a * (ov / daysInclusive(monthStart, monthEnd));
    if (p.interval === "quarterly") return a * 4 * factor;
    if (p.interval === "yearly") return a * factor;
    return a * factor;
  }
  function predictedMonth(state, date) {
    const ms = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`, me = localMonthEndISO(date), key = ms.slice(0, 7);
    let rentalIncome = 0;
    for (const l of state.leases || []) {
      const active = (!l.start || l.start <= me) && (!l.end || l.end >= ms);
      if (active) rentalIncome += Number(l.rent || 0) + Number(l.advance || 0);
    }
    let propertyCosts = Number(state.finance.repayment || 0) + Number(state.finance.fixed || 0);
    const costBreakdown = [];
    for (const p of state.costPositions || []) {
      if (!p.confirmed || p.assignment === "rental") continue;
      const amt = positionMonthlyEquivalent(p, ms, me);
      if (amt) {
        propertyCosts += amt;
        costBreakdown.push({ label: p.label, amount: amt });
      }
    }
    const historic = (state.payments || []).filter((p) => p.direction === "outflow" && paymentMonthKey(p.date) === key).reduce((s, p) => s + Number(p.amount || 0), 0);
    return { key, label: date.toLocaleDateString("de-DE", { month: "short", year: "2-digit" }), income: rentalIncome, outflow: propertyCosts, net: rentalIncome - propertyCosts, actualOutflow: historic, costBreakdown };
  }
  function intelligentForecast(state, months = 12) {
    const now = /* @__PURE__ */ new Date(), rows = [];
    for (let i = 0; i < months; i++) rows.push(predictedMonth(state, new Date(now.getFullYear(), now.getMonth() + i, 1)));
    return rows;
  }
  function forecastSignals(state) {
    const rows = intelligentForecast(state, 12), out = [];
    const worst = rows.slice().sort((a, b) => a.net - b.net)[0];
    if (worst && worst.net < 0) out.push({ severity: "warn", text: `Schwächster prognostizierter Monat: ${worst.label} mit ${euro(worst.net)}.` });
    const total = rows.reduce((s, r) => s + r.net, 0);
    out.push({ severity: total >= 0 ? "good" : "warn", text: `Prognostizierter 12-Monats-Saldo: ${euro(total)}.` });
    const pending = (state.payments || []).filter((p) => p.direction === "outflow" && !p.positionId).length;
    if (pending) out.push({ severity: "warn", text: `${pending} Ausgabe(n) warten auf automatische oder manuelle Zuordnung.` });
    return out;
  }
  function extractDocumentIntelligence(text, baseFields = {}) {
    const lines = String(text || "").split(/\r?\n/).map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean), low = String(text || "").toLowerCase();
    const moneyMatches = [...String(text || "").matchAll(/\b(\d{1,6}(?:\.\d{3})*,\d{2})\s*€?/g)].map((m) => parseMoney(m[1])).filter((x) => x >= 0);
    const issuerLine = lines.find((l) => /(stadt|gemeinde|versicherung|werke|wasser|entsorgung|rechnung|bescheid)/i.test(l) && l.length < 100) || lines[0] || "";
    const refLine = lines.find((l) => /(aktenzeichen|kassenzeichen|kundennummer|rechnungsnummer|bescheidnummer|zeichen)/i.test(l)) || "";
    const ref = (refLine.match(/[A-Z0-9][A-Z0-9\-\/.]{4,}/i) || [])[0] || "";
    const totalLine = lines.slice().reverse().find((l) => /(gesamtsumme|gesamtbetrag|summe neu|zahlbetrag|zu zahlen|endbetrag)/i.test(l)) || "";
    const totalVals = [...totalLine.matchAll(/(\d{1,6}(?:\.\d{3})*,\d{2})/g)].map((m) => parseMoney(m[1]));
    const total = totalVals.length ? totalVals[totalVals.length - 1] : moneyMatches.length ? Math.max(...moneyMatches) : 0;
    const vatLines = lines.filter((l) => /(ust|umsatzsteuer|mwst)/i.test(l));
    const vatAmounts = vatLines.flatMap((l) => [...l.matchAll(/(\d{1,6}(?:\.\d{3})*,\d{2})/g)].map((m) => parseMoney(m[1])));
    const due = extractDueDates(text);
    const propertyTaxDeferred = /grundsteuer.*(?:erst|ab).*januar.*folgejahr|erwerber.*erst.*januar.*folgejahr/i.test(low);
    return {
      issuer: issuerLine.slice(0, 120),
      reference: ref,
      total,
      vatAmount: vatAmounts.length ? vatAmounts[vatAmounts.length - 1] : 0,
      dueDates: due,
      documentFamily: /grundbesitzabgaben/i.test(low) ? "municipal_assessment" : /rechnung/i.test(low) ? "invoice" : /versicherung/i.test(low) ? "insurance" : baseFields.kind || "document",
      propertyTaxDeferred,
      anomalies: []
    };
  }
  function validateDocumentTotals(fields) {
    const proposals = fields.positionProposals || [], sum = proposals.reduce((s, p) => s + Number(p.amount || 0), 0), total = Number(fields.intelligence?.total || 0), issues = [];
    if (total > 0 && sum > 0) {
      const diff = Math.abs(total - sum);
      if (diff > 0.02) issues.push({ severity: diff / total > 0.1 ? "warn" : "info", message: `Erkannte Einzelpositionen ${euro(sum)} weichen vom erkannten Gesamtbetrag ${euro(total)} um ${euro(diff)} ab.` });
    }
    if (fields.intelligence?.propertyTaxDeferred) issues.push({ severity: "info", message: "Hinweis auf verschobenen Beginn der Grundsteuer erkannt; Grundsteuer für den aktuellen Teilzeitraum nicht automatisch ergänzen." });
    if (!(fields.dueDates || []).length && !(fields.intelligence?.dueDates || []).length) issues.push({ severity: "info", message: "Kein eindeutiger Fälligkeitstermin erkannt." });
    return issues;
  }
  function documentConfidenceSummary(fields) {
    const ps = fields.positionProposals || [];
    if (!ps.length) return 0;
    return ps.reduce((s, p) => s + Number(p.confidence || 0), 0) / ps.length;
  }
  function billingRecipient(lease) {
    return { name: lease?.tenantName || "", address: lease?.tenantAddress || "" };
  }
  function splitAddressLines(s) {
    return String(s || "").split(/\n|,\s*(?=\d{5}\s)/).map((x) => x.trim()).filter(Boolean);
  }
  function formatRuleForReport(e) {
    if (e.decision?.rule === "area") return `Wohnfläche (${percent(e.tenantShare)})`;
    if (e.decision?.rule === "consumption") return `Verbrauch (${percent(e.tenantShare)})`;
    if (e.decision?.rule === "rental") return "direkt Mietwohnung";
    if (e.decision?.rule === "persons") return `Personen (${percent(e.tenantShare)})`;
    return e.decision?.rule || "individuell";
  }
  function formatBillingRuleDetails(e, { property = {}, units = [], waterConsumption = null, allocationBases = null } = {}) {
    const share = Number(e.tenantShare || 0), fmt = (v, d = 0) => Number(v || 0).toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
    if (e.decision?.rule === "consumption") {
      const house = Number(waterConsumption?.house ?? e.details?.quantity), tenant = Number(waterConsumption?.tenant ?? (Number.isFinite(house) ? house * share : NaN));
      if (Number.isFinite(house) && house > 0 && Number.isFinite(tenant)) return `Verbrauch ${fmt(tenant, 3)} m³ von ${fmt(house, 3)} m³ (${percent(share)})`;
    }
    if (e.decision?.rule === "area") {
      const total = Number((allocationBases?.totalArea ?? property?.totalArea) || 0), rental = Number((allocationBases?.rentalArea ?? units.find((u) => u.type === "rental")?.area) || 0);
      if (total > 0 && rental >= 0) return `Wohnfläche ${fmt(rental, 0)} m² von ${fmt(total, 0)} m² (${percent(share)})`;
    }
    return formatRuleForReport(e);
  }
  async function generateProfessionalBillingPDF(state, year, snapshot = null) {
    const jsPDF = await loadJSPDF(), a = snapshot || billingAnalysis(state, year), lease = snapshot?.lease || state.leases?.[0], recipient = billingRecipient(lease), sender = snapshot?.correspondence || state.correspondence || {}, property = snapshot?.property || state.property, units = snapshot?.units || state.units || [], waterConsumption = snapshot?.waterConsumption || settlementConsumption(state, settlementByPeriod(state, year)), reportCtx = { property, units, waterConsumption, allocationBases: snapshot?.allocationBases || null };
    const doc = new jsPDF({ unit: "mm", format: "a4" }), W = 210, M = 18;
    let y = 18;
    const txt = (t, x, yy, size = 10, style = "normal") => {
      doc.setFont("helvetica", style);
      doc.setFontSize(size);
      doc.text(String(t || ""), x, yy);
    };
    const euroPdf = (n) => Number(n || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
    txt(sender.landlordName || "Vermieter", M, y, 11, "bold");
    y += 5;
    for (const l of splitAddressLines(sender.landlordAddress || property.address || "")) {
      txt(l, M, y, 9);
      y += 4;
    }
    if (sender.contact) {
      txt(sender.contact, M, y, 8);
      y += 4;
    }
    y = 18;
    txt((/* @__PURE__ */ new Date()).toLocaleDateString("de-DE"), W - M, y, 9, "normal");
    doc.setTextColor(0);
    y = 42;
    if (recipient.name) {
      txt(recipient.name, M, y, 10, "bold");
      y += 5;
    }
    for (const l of splitAddressLines(recipient.address || property.address || "")) {
      txt(l, M, y, 10);
      y += 5;
    }
    y = Math.max(y + 8, 68);
    txt("Betriebskostenabrechnung", M, y, 16, "bold");
    y += 7;
    txt(`Abrechnungszeitraum: ${billingPeriodLabel(state, year)}`, M, y, 10);
    y += 5;
    txt(`Mietobjekt: ${property.name || property.address || "Mietobjekt"}`, M, y, 10);
    y += 9;
    doc.setDrawColor(190);
    doc.line(M, y, W - M, y);
    y += 7;
    txt("Kostenaufstellung", M, y, 11, "bold");
    y += 6;
    txt("Kostenart", M, y, 8, "bold");
    txt("Gesamt", 112, y, 8, "bold");
    txt("Umlage", 140, y, 8, "bold");
    txt("Ihr Anteil", W - M, y, 8, "bold");
    y += 4;
    doc.line(M, y, W - M, y);
    y += 5;
    const events = a.events || [];
    for (const e of events) {
      if (y > 255) {
        doc.addPage();
        y = 18;
      }
      const label = String(e.label || "").slice(0, 48);
      txt(label, M, y, 8);
      txt(euroPdf(e.amount), 112, y, 8);
      txt(formatBillingRuleDetails(e, reportCtx), 140, y, 6);
      doc.text(euroPdf(e.tenantAmount), W - M, y, { align: "right" });
      y += 5;
    }
    y += 2;
    doc.line(M, y, W - M, y);
    y += 7;
    txt("Anteilige Betriebskosten", M, y, 10, "bold");
    doc.text(euroPdf(a.tenantCosts), W - M, y, { align: "right" });
    y += 6;
    txt("Abzüglich geleistete Vorauszahlungen", M, y, 10);
    doc.text("− " + euroPdf(a.advances), W - M, y, { align: "right" });
    y += 6;
    doc.line(112, y, W - M, y);
    y += 7;
    const result = Number(a.result || 0), title = result >= 0 ? "Nachzahlung" : "Guthaben";
    txt(title, M, y, 12, "bold");
    doc.text(euroPdf(Math.abs(result)), W - M, y, { align: "right" });
    y += 10;
    if (result > 0 && sender.iban) {
      txt(`Bitte überweisen Sie den Betrag auf ${sender.iban}${sender.paymentReference ? ` unter Angabe „${sender.paymentReference}“` : ""}.`, M, y, 9);
      y += 6;
    } else if (result < 0) {
      txt("Das Guthaben ist in der Abrechnung ausgewiesen und kann entsprechend ausgeglichen werden.", M, y, 9);
      y += 6;
    }
    txt("Die zugrunde liegenden Kostenpositionen und Verteilungsmaßstäbe sind oben einzeln dargestellt.", M, y, 8);
    y += 5;
    txt("Belegeinsicht wird auf Verlangen ermöglicht (§ 556 Abs. 4 BGB).", M, y, 8);
    y += 5;
    txt("Die zugehörigen Herkunftsnachweise sind in der App dokumentiert.", M, y, 8);
    y += 5;
    if (sender.contact) {
      txt(`Kontakt für Rückfragen: ${sender.contact}`, M, y, 8);
      y += 5;
    }
    y += 5;
    txt("Mit freundlichen Grüßen", M, y, 9);
    y += 10;
    txt(sender.landlordName || "Vermieter", M, y, 9);
    doc.setFontSize(7);
    doc.text(`Erstellt am ${(/* @__PURE__ */ new Date()).toLocaleDateString("de-DE")}`, M, 290);
    if (snapshot?.integrityHash) doc.text(`Snapshot ${String(snapshot.integrityHash).slice(0, 20)}…`, W - M, 290, { align: "right" });
    return doc;
  }
  return __toCommonJS(intelligence_exports);
})();


/* ===== compiled src/domain/quality.ts ===== */
"use strict";
var AppQuality = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/domain/quality.ts
  var quality_exports = {};
  __export(quality_exports, {
    QUALITY_VERSION: () => QUALITY_VERSION,
    annualComparison: () => annualComparison,
    bankHeaderIndex: () => bankHeaderIndex,
    bankImportPreview: () => bankImportPreview,
    categoryLabel: () => categoryLabel,
    costTrendAlerts: () => costTrendAlerts,
    csvDetectDelimiter: () => csvDetectDelimiter,
    csvRows: () => csvRows,
    dataQualityScore: () => dataQualityScore,
    detectRentPayment: () => detectRentPayment,
    meterAnomalies: () => meterAnomalies,
    meterTrend: () => meterTrend,
    parseBankCSV: () => parseBankCSV,
    parseFlexibleDate: () => parseFlexibleDate,
    parseGermanNumber: () => parseGermanNumber,
    paymentFingerprint: () => paymentFingerprint,
    periodCategoryTotals: () => periodCategoryTotals
  });
  var QUALITY_VERSION = 1;
  function parseGermanNumber(v) {
    let s = String(v ?? "").trim().replace(/\s/g, "").replace(/[€EUR]/gi, "");
    if (!s) return null;
    const neg = /^\(.*\)$/.test(s);
    s = s.replace(/[()]/g, "");
    if (s.includes(",") && s.includes(".")) {
      if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
      else s = s.replace(/,/g, "");
    } else if (s.includes(",")) s = s.replace(",", ".");
    s = s.replace(/[^\d.+-]/g, "");
    const n = Number(s);
    return Number.isFinite(n) ? neg ? -Math.abs(n) : n : null;
  }
  function parseFlexibleDate(v) {
    const s = String(v || "").trim();
    if (!s) return "";
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
    m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
    if (m) {
      let y = Number(m[3]);
      if (y < 100) y += 2e3;
      return `${y}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
    }
    ;
    return "";
  }
  function csvDetectDelimiter(text) {
    const first = String(text || "").split(/\r?\n/).slice(0, 5).join("\n"), candidates = [";", ",", "	"];
    return candidates.map((d) => ({ d, n: (first.match(new RegExp(d === "	" ? "\\t" : d === ";" ? ";" : ",", "g")) || []).length })).sort((a, b) => b.n - a.n)[0]?.d || ";";
  }
  function csvRows(text, delimiter) {
    const rows = [];
    let row = [], cell = "", quoted = false;
    for (let i = 0; i < String(text).length; i++) {
      const ch = text[i], nx = text[i + 1];
      if (ch === '"' && quoted && nx === '"') {
        cell += '"';
        i++;
        continue;
      }
      if (ch === '"') {
        quoted = !quoted;
        continue;
      }
      if (ch === delimiter && !quoted) {
        row.push(cell);
        cell = "";
        continue;
      }
      if ((ch === "\n" || ch === "\r") && !quoted) {
        if (ch === "\r" && nx === "\n") i++;
        row.push(cell);
        if (row.some((x) => String(x).trim() !== "")) rows.push(row);
        row = [];
        cell = "";
        continue;
      }
      cell += ch;
    }
    row.push(cell);
    if (row.some((x) => String(x).trim() !== "")) rows.push(row);
    return rows;
  }
  function bankHeaderIndex(headers, patterns) {
    const hs = headers.map(normalizeLabelText);
    for (const p of patterns) {
      const i = hs.findIndex((h) => p.test(h));
      if (i >= 0) return i;
    }
    return -1;
  }
  function parseBankCSV(text) {
    const delimiter = csvDetectDelimiter(text), rows = csvRows(text, delimiter);
    if (rows.length < 2) throw new Error("Die CSV-Datei enthält keine Buchungen.");
    const h = rows[0], dateIdx = bankHeaderIndex(h, [/buchungstag/, /wertstellung/, /^datum$/, /date/]), amountIdx = bankHeaderIndex(h, [/^betrag/, /umsatz/, /amount/]), debitIdx = bankHeaderIndex(h, [/soll/, /debit/]), creditIdx = bankHeaderIndex(h, [/haben/, /credit/]), textIdx = bankHeaderIndex(h, [/verwendungszweck/, /buchungstext/, /beschreibung/, /umsatztext/, /purpose/, /description/]), nameIdx = bankHeaderIndex(h, [/zahlungspflichtiger/, /zahlungsempfanger/, /auftraggeber/, /empfanger/, /^name$/]);
    if (dateIdx < 0 || amountIdx < 0 && debitIdx < 0 && creditIdx < 0) throw new Error("Datum oder Betragsspalte konnte nicht erkannt werden.");
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i], date = parseFlexibleDate(r[dateIdx]);
      if (!date) continue;
      let amount = amountIdx >= 0 ? parseGermanNumber(r[amountIdx]) : null;
      if ((amount == null || amount === 0) && debitIdx >= 0) {
        const d = parseGermanNumber(r[debitIdx]);
        if (d != null && d !== 0) amount = -Math.abs(d);
      }
      if ((amount == null || amount === 0) && creditIdx >= 0) {
        const c = parseGermanNumber(r[creditIdx]);
        if (c != null && c !== 0) amount = Math.abs(c);
      }
      if (amount == null || amount === 0) continue;
      const label = [nameIdx >= 0 ? r[nameIdx] : "", textIdx >= 0 ? r[textIdx] : ""].filter(Boolean).join(" · ").trim() || "Kontobuchung";
      out.push({ date, amount: Math.abs(amount), direction: amount < 0 ? "outflow" : "income", label, rawRow: i + 1 });
    }
    return { delimiter, headers: h, rows: out };
  }
  function paymentFingerprint(p) {
    return `${p.date}|${p.direction}|${Number(p.amount || 0).toFixed(2)}|${normalizeLabelText(p.label).slice(0, 80)}`;
  }
  function detectRentPayment(state, payment) {
    if (payment.direction !== "income") return null;
    let best = null;
    for (const l of state.leases || []) {
      for (const c of [{ kind: "Gesamtmiete", value: Number(l.rent || 0) + Number(l.advance || 0) }, { kind: "Kaltmiete", value: Number(l.rent || 0) }].filter((x) => x.value > 0)) {
        const diff = Math.abs(Number(payment.amount) - c.value);
        let score = diff < 0.01 ? 80 : diff / Math.max(1, c.value) < 0.03 ? 55 : 0;
        const tenant = normalizeLabelText(l.tenantName || "");
        if (tenant && normalizeLabelText(payment.label).includes(tenant)) score += 20;
        if (score > Number(best?.score || 0)) best = { leaseId: l.id, kind: c.kind, expected: c.value, score: Math.min(100, score) };
      }
    }
    return best && best.score >= 55 ? best : null;
  }
  function bankImportPreview(state, parsed) {
    const existing = new Set((state.payments || []).map(paymentFingerprint));
    return parsed.rows.map((r) => ({ ...r, duplicate: existing.has(paymentFingerprint(r)), rentMatch: detectRentPayment(state, r) }));
  }
  function categoryLabel(k) {
    return category(k)?.label || String(k || "Sonstige");
  }
  function periodCategoryTotals(state, year) {
    const a = billingAnalysis(state, year), map = /* @__PURE__ */ new Map();
    for (const e of a.events || []) {
      const cat = e.category || positionById(state, e.positionId)?.category || "other", prev = map.get(cat) || { category: cat, total: 0, tenant: 0, count: 0 };
      prev.total += Number(e.amount || 0);
      prev.tenant += Number(e.tenantAmount || 0);
      prev.count++;
      map.set(cat, prev);
    }
    return [...map.values()];
  }
  function annualComparison(s, year) {
    const current = periodCategoryTotals(s, year), prior = periodCategoryTotals(s, year - 1), keys = /* @__PURE__ */ new Set([...current.map((x) => x.category), ...prior.map((x) => x.category)]), cp = billingPeriodInfo(s, year), pp = billingPeriodInfo(s, year - 1);
    return [...keys].map((k) => {
      const c = current.find((x) => x.category === k) || { total: 0, tenant: 0 }, p = prior.find((x) => x.category === k) || { total: 0, tenant: 0 }, comparable = cp.days === cp.nominalDays && pp.days === pp.nominalDays;
      return { category: k, current: c.total, prior: p.total, tenantCurrent: c.tenant, change: c.total - p.total, pct: comparable && p.total ? (c.total - p.total) / p.total : null, comparable, currentPartial: cp.days !== cp.nominalDays, priorPartial: pp.days !== pp.nominalDays };
    }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  }
  function costTrendAlerts(s, year) {
    return annualComparison(s, year).filter((x) => x.comparable && x.prior > 0 && x.current > 0 && x.pct != null && Math.abs(x.pct) >= 0.15).map((x) => ({ severity: x.pct > 0.25 ? "warn" : "info", text: `${categoryLabel(x.category)}: ${x.pct >= 0 ? "+" : ""}${Math.round(x.pct * 100)} % gegenüber ${billingPeriodLabel(s, year - 1)} (${euro(x.prior)} → ${euro(x.current)}).` }));
  }
  function meterTrend(meter) {
    const r = (meter?.readings || []).filter((x) => x.date && Number.isFinite(Number(x.value))).slice().sort((a, b) => a.date.localeCompare(b.date)), segments = [];
    for (let i = 1; i < r.length; i++) {
      const days = daysInclusive(r[i - 1].date, r[i].date) - 1, delta = Number(r[i].value) - Number(r[i - 1].value);
      if (days > 0 && delta >= 0) segments.push({ from: r[i - 1], to: r[i], days, delta, perDay: delta / days, per30: delta / days * 30 });
    }
    const avg = segments.length ? segments.reduce((s, x) => s + x.perDay, 0) / segments.length : 0;
    return { segments, avgPerDay: avg, avgPer30: avg * 30 };
  }
  function meterAnomalies(meter) {
    const t = meterTrend(meter);
    if (t.segments.length < 2) return [];
    const baseline = t.segments.slice(0, -1).reduce((s, x) => s + x.perDay, 0) / Math.max(1, t.segments.length - 1), last = t.segments.at(-1), out = [];
    if (baseline > 0 && last.perDay > baseline * 1.75 && last.delta > 1) out.push({ severity: "warn", text: `${meter.name}: letzter Verbrauch liegt ${Math.round((last.perDay / baseline - 1) * 100)} % über dem bisherigen Tagesmittel.` });
    return out;
  }
  function dataQualityScore(state) {
    const integrity = integritySummary(state), checks = billingReadiness(state, currentPeriodYear()), openDocs = (state.documentsCache || []).filter((d) => documentWorkflowState(d) !== "done").length;
    const matchable = (state.payments || []).filter((p) => p.direction === "outflow" && !p.positionId && paymentMatchSuggestions(state, p, 1)[0]?.score >= 45).length;
    let score = 100;
    score -= integrity.errors.length * 20;
    score -= integrity.warnings.length * 4;
    score -= checks.filter((x) => !x.ok).length * 7;
    score -= Math.min(15, openDocs * 3);
    score -= Math.min(10, matchable * 2);
    return Math.max(0, Math.round(score));
  }
  return __toCommonJS(quality_exports);
})();


/* ===== compiled src/domain/smart-engine.ts ===== */
"use strict";
var AppSmartEngine = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/domain/smart-engine.ts
  var smart_engine_exports = {};
  __export(smart_engine_exports, {
    SMART_ENGINE_VERSION: () => SMART_ENGINE_VERSION,
    activeLeaseInMonth: () => activeLeaseInMonth,
    billingProjection: () => billingProjection,
    latestBillingSnapshot: () => latestBillingSnapshot,
    rentMonitor: () => rentMonitor,
    rentMonthStatus: () => rentMonthStatus,
    rentStatusLabel: () => rentStatusLabel,
    smartMonthKey: () => smartMonthKey,
    smartMonthOffset: () => smartMonthOffset,
    smartMonthRange: () => smartMonthRange,
    smartToday: () => smartToday
  });
  var SMART_ENGINE_VERSION = 1;
  function smartToday() {
    return localDateISO();
  }
  function smartMonthKey(d = /* @__PURE__ */ new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  function smartMonthOffset(offset) {
    const d = /* @__PURE__ */ new Date(), x = new Date(d.getFullYear(), d.getMonth() + offset, 1);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
  }
  function smartMonthRange(key) {
    const [y, m] = String(key).split("-").map(Number), start = `${y}-${String(m).padStart(2, "0")}-01`, end = new Date(y, m, 0).toISOString().slice(0, 10);
    return { start, end };
  }
  function activeLeaseInMonth(lease, key) {
    const { start, end } = smartMonthRange(key);
    return !!lease && (!lease.start || lease.start <= end) && (!lease.end || lease.end >= start);
  }
  function rentMonthStatus(state, key = smartMonthKey()) {
    AppLifecycleLedger.ensureLifecycleState(state);
    const lease = (state.leases || []).find((l) => activeLeaseInMonth(l, key));
    if (!lease) return { key, status: "none", expected: 0, paid: 0, confidence: 0, payments: [] };
    const row = AppLifecycleLedger.ledgerRow(state, lease, key), paymentIds = new Set((row.allocations || []).map((a) => a.paymentId));
    return { key, lease, expected: row.total, paid: row.paid, difference: row.difference, status: row.status === "overpaid" ? "over" : row.status, confidence: (row.allocations || []).length ? 100 : 0, payments: (state.payments || []).filter((p) => paymentIds.has(p.id)) };
  }
  function rentMonitor(state, months = 8) {
    return Array.from({ length: months }, (_, i) => rentMonthStatus(state, smartMonthOffset(-i)));
  }
  function rentStatusLabel(s) {
    return s.status === "paid" ? "vollständig erkannt" : s.status === "partial" ? "teilweise erkannt" : s.status === "over" ? "über Soll erkannt" : s.status === "missing" ? "noch nicht erkannt" : "kein aktiver Mietvertrag";
  }
  function latestBillingSnapshot(state) {
    return (state.billingSnapshots || []).slice().sort((a, b) => Number(b.periodYear) - Number(a.periodYear) || Number(b.version || 1) - Number(a.version || 1) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0] || null;
  }
  function billingProjection(s, year = currentPeriodYear()) {
    const current = billingAnalysis(s, year), cur = periodCategoryTotals(s, year), prior = periodCategoryTotals(s, year - 1), pp = billingPeriodInfo(s, year - 1), currentCats = new Set(cur.filter((x) => x.total > 0).map((x) => x.category)), factor = pp.active && pp.days > 0 ? pp.nominalDays / pp.days : 1;
    const missing = prior.filter((x) => x.total > 0 && !currentCats.has(x.category)).map((x) => ({ ...x, estimatedTenant: Number(x.tenant || 0) * (pp.days < pp.nominalDays ? factor : 1), annualized: pp.days < pp.nominalDays }));
    const estimatedMissingTenant = missing.reduce((sum, x) => sum + Number(x.estimatedTenant || 0), 0), projectedTenantCosts = Number(current.tenantCosts || 0) + estimatedMissingTenant, projectedResult = projectedTenantCosts - Number(current.advances || 0);
    const priorCats = prior.filter((x) => x.total > 0).length, matched = prior.filter((x) => currentCats.has(x.category)).length;
    let confidence = priorCats ? Math.round(55 + 40 * (matched / priorCats)) : Math.min(55, 25 + (current.events || []).length * 5);
    if (pp.days < pp.nominalDays && missing.length) confidence = Math.max(35, confidence - 15);
    return { year, knownTenantCosts: Number(current.tenantCosts || 0), estimatedMissingTenant, projectedTenantCosts, advances: Number(current.advances || 0), projectedResult, missingCategories: missing, confidence: Math.max(20, Math.min(95, confidence)), period: current.period };
  }
  return __toCommonJS(smart_engine_exports);
})();


/* ===== compiled src/domain/v18-assistant.ts ===== */
"use strict";
var AppV18Assistant = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/domain/v18-assistant.ts
  var v18_assistant_exports = {};
  __export(v18_assistant_exports, {
    DECISION_UI_VERSION: () => DECISION_UI_VERSION,
    V18_ASSISTANT_VERSION: () => V18_ASSISTANT_VERSION,
    V18_EXPECTED_BILLING_CATEGORIES: () => V18_EXPECTED_BILLING_CATEGORIES,
    advanceAdjustmentSuggestion: () => advanceAdjustmentSuggestion,
    billingDeadlineInsights: () => billingDeadlineInsights,
    bindV18AssistantActions: () => bindV18AssistantActions,
    cleanProposalLabel: () => cleanProposalLabel,
    confidenceBand: () => confidenceBand,
    decisionActionLabel: () => decisionActionLabel,
    decisionKind: () => decisionKind,
    decisionSeverityWeight: () => decisionSeverityWeight,
    decisionWhyHTML: () => decisionWhyHTML,
    enrichDocumentProposalsSmart: () => enrichDocumentProposalsSmart,
    historicalAssignmentPrediction: () => historicalAssignmentPrediction,
    medianValue: () => medianValue,
    qualityBand: () => qualityBand,
    rentAttentionDay: () => rentAttentionDay,
    robustMeterAnomalies: () => robustMeterAnomalies,
    smartAnswer: () => smartAnswer,
    smartClassifyCostText: () => smartClassifyCostText,
    smartDataAnomalies: () => smartDataAnomalies,
    smartDecisionQueue: () => smartDecisionQueue,
    smartDocumentSummary: () => smartDocumentSummary,
    smartGenericPositionProposals: () => smartGenericPositionProposals,
    smartInsights: () => smartInsights,
    smartPaymentPlan: () => smartPaymentPlan,
    smartPaymentSuggestions: () => smartPaymentSuggestions,
    smartSummaryText: () => smartSummaryText,
    smartTaskSuggestions: () => smartTaskSuggestions,
    sourceExpectedAmounts: () => sourceExpectedAmounts,
    sourcePaymentMatchScore: () => sourcePaymentMatchScore,
    v18BackupStatus: () => v18BackupStatus,
    v18BillingAssistant: () => v18BillingAssistant,
    v18BillingAssistantHTML: () => v18BillingAssistantHTML,
    v18CategoryForecast: () => v18CategoryForecast,
    v18StatusClass: () => v18StatusClass,
    v18StatusLabel: () => v18StatusLabel,
    v18StatusWeight: () => v18StatusWeight
  });
  var V18_ASSISTANT_VERSION = 1;
  var V18_EXPECTED_BILLING_CATEGORIES = [
    { category: "propertyTax", label: "Grundsteuer", route: "data", sub: "positions" },
    { category: "rainwater", label: "Niederschlagswasser", route: "data", sub: "positions" },
    { category: "street", label: "Straßenreinigung / Winterdienst", route: "data", sub: "positions" },
    { category: "waste", label: "Abfall", route: "data", sub: "positions" },
    { category: "insurance", label: "Gebäudeversicherung", route: "data", sub: "positions" },
    { category: "water", label: "Kaltwasser / Kanal", route: "rental", sub: "water" }
  ];
  function v18CategoryForecast(s, year, def) {
    const cp = billingPeriodInfo(s, year), current = periodCategoryTotals(s, year).find((x) => x.category === def.category), water = def.category === "water" ? settlementConsumption(s, settlementByPeriod(s, year)) : null;
    if (current?.total > 0) {
      if (def.category === "water" && !water?.valid) return { ...def, status: "open", amount: 0, knownTotal: Number(current.total || 0), detail: "Kosten sind vorhanden, aber vollständige Verbrauchsdaten fehlen." };
      return { ...def, status: "known", amount: Number(current.tenant || 0), knownTotal: Number(current.total || 0), detail: "Bestätigte Daten dieser Abrechnungsperiode." };
    }
    const prior = periodCategoryTotals(s, year - 1).find((x) => x.category === def.category), pp = billingPeriodInfo(s, year - 1);
    if (prior?.total > 0 && pp.active && pp.days > 0) {
      const currentFull = cp.active && !cp.isTakeoverPeriod && cp.days === cp.nominalDays;
      const priorFull = pp.active && !pp.isTakeoverPeriod && pp.days === pp.nominalDays;
      const scale = currentFull && priorFull ? 1 : cp.days > 0 ? cp.days / pp.days : 1;
      const amount = Number(prior.tenant || 0) * scale;
      const detail = currentFull && priorFull ? `Aus ${billingPeriodLabel(s, year - 1)} als Jahresvergleich übernommen.` : `Aus ${billingPeriodLabel(s, year - 1)} zeitanteilig auf die aktuelle Teilperiode hochgerechnet.`;
      return { ...def, status: "estimated", amount, knownTotal: 0, detail };
    }
    return { ...def, status: "open", amount: 0, knownTotal: 0, detail: "Noch kein aktueller oder ausreichend vergleichbarer historischer Wert vorhanden." };
  }
  function v18BackupStatus(s) {
    const at = s.meta?.lastBackupAt || "", age = at ? Math.max(0, calendarDayDiff(String(at).slice(0, 10), smartToday())) : null;
    if (age == null) return { status: "open", label: "Noch kein Backup", detail: "Noch keine verschlüsselte Vollsicherung dokumentiert.", age: null, route: "more", sub: "backup" };
    if (age > 30) return { status: "open", label: "Backup überfällig", detail: `Letzte verschlüsselte Sicherung vor ${age} Tagen.`, age, route: "more", sub: "backup" };
    return { status: "known", label: "Backup aktuell", detail: `Letzte verschlüsselte Sicherung vor ${age} Tagen.`, age, route: "more", sub: "backup" };
  }
  function v18StatusWeight(status) {
    return status === "known" ? 1 : status === "estimated" ? 0.5 : 0;
  }
  function v18StatusLabel(status) {
    return status === "known" ? "Bekannt" : status === "estimated" ? "Geschätzt" : "Offen";
  }
  function v18StatusClass(status) {
    return status === "known" ? "good" : status === "estimated" ? "warn" : "bad";
  }
  function v18BillingAssistant(s, year = preferredBillingYear()) {
    const period = billingPeriodInfo(s, year), analysis = billingAnalysis(s, year), lease = analysis.lease || s.leases?.[0] || null, owner = unitByType(s, "owner"), rental = unitByType(s, "rental"), rows = V18_EXPECTED_BILLING_CATEGORIES.map((d) => v18CategoryForecast(s, year, d));
    const leaseItem = { id: "lease", label: "Mietvertrag", status: lease ? "known" : "open", detail: lease ? `${euro(lease.rent)} Kaltmiete · ${euro(lease.advance)} BK-Vorauszahlung` : "Mietvertrag fehlt.", route: "rental", sub: "overview" };
    const areaOK = Number(s.property?.totalArea || 0) > 0 && Number(rental?.area || 0) > 0 && Number(owner?.area || 0) > 0;
    const areaItem = { id: "area", label: "Wohnflächen", status: areaOK ? "known" : "open", detail: areaOK ? `${rental.area} m² Mietwohnung von ${s.property.totalArea} m² gesamt` : "Wohnflächen sind noch nicht vollständig.", route: "data", sub: "object" };
    const correspondenceOK = !!String(s.correspondence?.landlordName || "").trim() && !!String(s.correspondence?.landlordAddress || s.property?.address || "").trim();
    const correspondenceItem = { id: "correspondence", label: "Absenderdaten", status: correspondenceOK ? "known" : "open", detail: correspondenceOK ? "Für die spätere PDF vorhanden." : "Absenderdaten für die Endabrechnung ergänzen.", route: "data", sub: "object" };
    const evidence = lease ? actualAdvanceEvidenceInPeriod(s, lease, year) : { amount: 0, recognizedPayments: 0 }, scheduled = lease ? monthlyAdvanceInPeriod(s, lease, year) : 0, periodEnded = !!period.end && smartToday() > period.end;
    const advanceStatus = Number(evidence.recognizedPayments || 0) > 0 ? "known" : lease && Number(lease.advance || 0) > 0 && !periodEnded ? "estimated" : "open";
    const advanceItem = { id: "advances", label: "Vorauszahlungen", status: advanceStatus, detail: advanceStatus === "known" ? `${evidence.recognizedPayments} Zahlung(en) erkannt · bisher ${euro(evidence.amount)}` : advanceStatus === "estimated" ? `Vertraglich geplant: ${euro(scheduled)}` : "Keine belastbare Vorauszahlungsbasis.", route: "owner", sub: "cashflow" };
    const checklist = [leaseItem, areaItem, correspondenceItem, ...rows, advanceItem], score = Math.round(100 * checklist.reduce((sum, x) => sum + v18StatusWeight(x.status), 0) / Math.max(1, checklist.length));
    const estimatedTenant = rows.filter((x) => x.status === "estimated").reduce((sum, x) => sum + Number(x.amount || 0), 0), knownTenant = Number(analysis.tenantCosts || 0), projectedTenantCosts = knownTenant + estimatedTenant;
    const projectedAdvances = periodEnded ? Number(analysis.advances || 0) : Math.max(Number(analysis.advances || 0), Number(scheduled || 0)), projectedResult = projectedTenantCosts - projectedAdvances;
    const openItems = checklist.filter((x) => x.status === "open"), estimatedItems = checklist.filter((x) => x.status === "estimated"), knownItems = checklist.filter((x) => x.status === "known"), backup = v18BackupStatus(s);
    let confidence = Math.round(100 * (knownItems.length + 0.55 * estimatedItems.length) / Math.max(1, checklist.length));
    if (openItems.length) confidence -= Math.min(20, openItems.length * 3);
    confidence = Math.max(20, Math.min(96, confidence));
    const label = score >= 90 ? "Fast fertig" : score >= 75 ? "Gut vorbereitet" : score >= 50 ? "Im Aufbau" : "Noch unvollständig";
    return { year, period, analysis, rows, checklist, score, label, confidence, knownTenant, estimatedTenant, projectedTenantCosts, actualAdvances: Number(analysis.advances || 0), scheduledAdvances: Number(scheduled || 0), projectedAdvances, projectedResult, openItems, estimatedItems, knownItems, backup, periodEnded };
  }
  function v18BillingAssistantHTML(s, year, { compact = false } = {}) {
    const m = v18BillingAssistant(s, year), cb = confidenceBand(m.confidence), resultLabel = m.projectedResult >= 0 ? "voraussichtliche Nachzahlung" : "voraussichtliches Guthaben", problem = m.openItems.length + m.estimatedItems.length;
    if (compact) {
      const next = [...m.openItems, ...m.estimatedItems].slice(0, 3);
      return `<section id="v18BillingAssistant" class="card"><div class="card-head"><div><p class="eyebrow">ABRECHNUNGSASSISTENT</p><h3>${m.score}% vorbereitet · ${esc(m.label)}</h3><p class="muted">${esc(billingPeriodLabel(s, year))}</p></div><span class="confidence confidence-${cb.id}">${esc(cb.short)}</span></div>
      <div class="storage-meter" aria-label="Vorbereitungsgrad"><span style="width:${m.score}%"></span></div>
      <div class="grid cards"><article class="card metric-card"><span>Bekannte Kosten</span><strong>${euro(m.knownTenant)}</strong></article><article class="card metric-card"><span>Geschätzt</span><strong>${euro(m.estimatedTenant)}</strong></article><article class="card metric-card"><span>Prognose</span><strong>${euro(Math.abs(m.projectedResult))}</strong><small>${resultLabel}</small></article></div>
      ${next.length ? `<div class="card"><strong>${problem} Punkt(e) noch nicht endgültig</strong>${next.map((x) => `<div class="fact-row"><span>${esc(x.label)}</span><strong>${v18StatusLabel(x.status)}</strong></div>`).join("")}</div>` : `<div class="legal-ok">✓ Alle für die Prognose erwarteten Daten sind vorhanden.</div>`}
      <div class="${m.backup.status === "known" ? "legal-ok" : "legal-warn"}"><strong>${esc(m.backup.label)}</strong><br>${esc(m.backup.detail)}</div>
      <button class="primary wide" data-v18-go="rental|billing">Abrechnung vorbereiten</button></section>`;
    }
    return `<section id="v18BillingAssistantFull" class="card"><div class="card-head"><div><p class="eyebrow">ABRECHNUNGSASSISTENT</p><h3>${m.score}% vorbereitet · ${esc(m.label)}</h3><p class="muted">Planungsansicht für ${esc(billingPeriodLabel(s, year))}. Schätzwerte werden niemals automatisch in die endgültige Abrechnung übernommen.</p></div><span class="confidence confidence-${cb.id}">${esc(cb.label)} · ${m.confidence}%</span></div>
    <div class="storage-meter" aria-label="Vorbereitungsgrad"><span style="width:${m.score}%"></span></div>
    <div class="grid cards">
      <article class="card metric-card"><span>Bekannte Kosten</span><strong>${euro(m.knownTenant)}</strong><small>abrechnungswirksam</small></article>
      <article class="card metric-card"><span>Geschätzte Ergänzung</span><strong>${euro(m.estimatedTenant)}</strong><small>nur Prognose</small></article>
      <article class="card metric-card"><span>Geplante Vorauszahlungen</span><strong>${euro(m.projectedAdvances)}</strong><small>bisher tatsächlich ${euro(m.actualAdvances)}</small></article>
      <article class="card metric-card"><span>Prognose</span><strong>${euro(Math.abs(m.projectedResult))}</strong><small>${resultLabel}</small></article>
    </div>
    <div class="tablewrap"><table class="costtable"><thead><tr><th>Baustein</th><th>Status</th><th>Prognoseanteil</th><th>Nächster Schritt</th></tr></thead><tbody>
      ${m.checklist.map((x) => `<tr ${x.category ? `data-v18-category="${x.category}"` : ""}><td><strong>${esc(x.label)}</strong><br><small>${esc(x.detail || "")}</small></td><td><span class="pill ${v18StatusClass(x.status)}">${v18StatusLabel(x.status)}</span></td><td>${x.category && x.status !== "open" ? euro(x.amount) : "–"}</td><td>${x.status === "known" ? "✓" : `<button class="secondary compact" data-v18-go="${x.route}|${x.sub}">${x.status === "estimated" ? "Aktualisieren" : "Erfassen"}</button>`}</td></tr>`).join("")}
    </tbody></table></div>
    <div class="${m.backup.status === "known" ? "legal-ok" : "legal-warn"}"><strong>${esc(m.backup.label)}</strong><br>${esc(m.backup.detail)} ${m.backup.status !== "known" ? `<button class="linkbutton" data-v18-go="more|backup">Sicherung öffnen</button>` : ""}</div>
    <div class="info"><strong>Trennung von Prognose und Abrechnung:</strong> Nur bestätigte Kosten, echte Zählerdaten und tatsächlich geleistete Vorauszahlungen fließen in Abschluss, Snapshot und PDF ein. Gelbe Schätzwerte dienen ausschließlich der Planung.</div>
  </section>`;
  }
  function bindV18AssistantActions(root = document) {
    root.querySelectorAll("[data-v18-go]").forEach((b) => b.onclick = () => {
      const [r, s] = String(b.dataset.v18Go || "").split("|");
      if (r) go(r, s || DEFAULT_SUB[r]);
    });
  }
  function advanceAdjustmentSuggestion(state) {
    const snap = latestBillingSnapshot(state), lease = state.leases?.[0];
    if (!snap || !lease || Number(lease.advance || 0) <= 0) return null;
    const basisLease = snap.lease || lease, months = monthlyAdvanceInPeriod(state, { ...basisLease, advance: 1 }, Number(snap.periodYear));
    if (months <= 0) return null;
    const recommended = Number(snap.tenantCosts || 0) / months, current = Number(lease.advance || 0), diff = recommended - current;
    return { periodYear: snap.periodYear, current, recommended, diff, relative: current ? diff / current : 0, material: Math.abs(diff) >= 5 && Math.abs(diff / current) >= 0.05, basis: "Rechnerischer Richtwert aus der letzten abgeschlossenen Abrechnung; eine Anpassung nach einer Abrechnung ist nach § 560 Abs. 4 BGB grundsätzlich möglich, die angemessene Höhe ist im Einzelfall zu prüfen." };
  }
  function billingDeadlineInsights(state) {
    const out = [], today = smartToday(), cy = currentPeriodYear(), lease = state.leases?.[0];
    for (let y = cy - 4; y <= cy; y++) {
      const p = billingPeriodInfo(state, y);
      if (!lease || !p.active || snapshotFor(state, y) || p.end >= today) continue;
      const leaseStart = lease.start || p.start, leaseEnd = lease.end || p.end;
      if (leaseStart > p.end || leaseEnd < p.start) continue;
      const target = periodBillingTargetISO(y), legal = periodDeadlineISO(y), targetDays = calendarDayDiff(today, target), legalDays = calendarDayDiff(today, legal);
      if (targetDays >= 0 && targetDays <= 120) {
        out.push({ id: `target-${y}`, severity: targetDays <= 30 ? "warn" : "info", title: `Endabrechnung ${billingPeriodLabel(state, y)} vorbereiten`, detail: `Eigene Zielfrist: ${(/* @__PURE__ */ new Date(target + "T00:00:00")).toLocaleDateString("de-DE")} · noch ${targetDays} Tage.`, why: "Eigene Arbeitszielfrist", confidence: 100, route: "rental", sub: "billing" });
      } else if (targetDays < 0 && legalDays >= 0) {
        out.push({ id: `target-${y}`, severity: "warn", title: `Eigene Zielfrist für ${billingPeriodLabel(state, y)} überschritten`, detail: `Die Endabrechnung sollte bis ${(/* @__PURE__ */ new Date(target + "T00:00:00")).toLocaleDateString("de-DE")} fertig sein. Die gesetzliche Abrechnungsfrist läuft bis ${(/* @__PURE__ */ new Date(legal + "T00:00:00")).toLocaleDateString("de-DE")}.`, why: "Interne Zielfrist; gesetzliche Frist separat", confidence: 100, route: "rental", sub: "billing" });
      } else if (legalDays < 0) {
        out.push({ id: `deadline-${y}`, severity: "bad", title: `Gesetzliche Abrechnungsfrist ${billingPeriodLabel(state, y)} überschritten`, detail: `Die reguläre Frist endete am ${(/* @__PURE__ */ new Date(legal + "T00:00:00")).toLocaleDateString("de-DE")}.`, why: "§ 556 Abs. 3 BGB", confidence: 100, route: "rental", sub: "billing" });
      }
    }
    return out;
  }
  function sourceExpectedAmounts(state, source) {
    const vals = [];
    if (Number(source?.amount || 0) > 0) vals.push(Number(source.amount));
    const ps = sourcePositions(state, source?.id).filter((p) => p.confirmed), sum = ps.reduce((s, p) => s + Number(p.amount || 0), 0);
    if (sum > 0) vals.push(sum);
    return [...new Set(vals.map((x) => Number(x.toFixed(2))))];
  }
  function sourcePaymentMatchScore(state, payment, source) {
    if (payment.direction !== "outflow") return { score: 0, reasons: [] };
    let score = 0, reasons = [], expected = sourceExpectedAmounts(state, source);
    if (expected.length) {
      const best = Math.min(...expected.map((a) => Math.abs(Number(payment.amount || 0) - a) / Math.max(1, a)));
      if (best < 5e-3) {
        score += 58;
        reasons.push("Betrag passt zur Kostenquelle");
      } else if (best < 0.03) {
        score += 42;
        reasons.push("Betrag ist sehr ähnlich");
      } else if (best < 0.1) {
        score += 18;
        reasons.push("Betrag ist plausibel");
      }
    }
    const sim = tokenSimilarity(payment.label, source.name || "");
    score += Math.round(sim * 25);
    if (sim > 0.4) reasons.push("Buchungstext passt zur Quelle");
    const dues = Array.isArray(source.dueDates) ? source.dueDates : [];
    if (dues.length) {
      const dd = Math.min(...dues.map((d) => daysDistance(payment.date, d)));
      if (dd <= 2) {
        score += 17;
        reasons.push("Datum passt zur Fälligkeit");
      } else if (dd <= 14) {
        score += 9;
        reasons.push("Datum liegt im Fälligkeitsfenster");
      }
    }
    return { score: Math.min(100, score), reasons };
  }
  function smartPaymentSuggestions(state, payment, limit = 5) {
    const pos = paymentMatchSuggestions(state, payment, limit).map((x) => ({ type: "position", target: x.position, score: x.score, reasons: x.reasons }));
    const src = (state.sources || []).map((s) => ({ type: "source", target: s, ...sourcePaymentMatchScore(state, payment, s) })).filter((x) => x.score >= 35);
    return [...pos, ...src].sort((a, b) => b.score - a.score).slice(0, limit);
  }
  function smartPaymentPlan(state) {
    const candidates = (state.payments || []).filter((p) => p.direction === "outflow" && !p.positionId && !p.sourceId).map((payment) => ({ payment, suggestions: smartPaymentSuggestions(state, payment, 4) })).filter((x) => x.suggestions.length);
    candidates.sort((a, b) => (b.suggestions[0]?.score || 0) - (a.suggestions[0]?.score || 0));
    const reservedPositions = /* @__PURE__ */ new Set(), out = [];
    for (const x of candidates) {
      const suggestions = x.suggestions.filter((s) => s.type !== "position" || !reservedPositions.has(s.target.id));
      const best = suggestions[0];
      if (!best || best.score < 45) continue;
      if (best.type === "position") reservedPositions.add(best.target.id);
      out.push({ ...x, suggestions });
    }
    return out;
  }
  function medianValue(values) {
    const a = values.filter(Number.isFinite).slice().sort((x, y) => x - y);
    if (!a.length) return 0;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }
  function robustMeterAnomalies(meter) {
    const t = meterTrend(meter), segs = t.segments;
    if (segs.length < 3) return meterAnomalies(meter);
    const hist = segs.slice(0, -1).map((x) => x.perDay), med = medianValue(hist), dev = medianValue(hist.map((x) => Math.abs(x - med))), last = segs.at(-1), out = [];
    const threshold = med + Math.max(med * 0.65, dev * 4);
    if (med > 0 && last.perDay > threshold && last.delta > 1) out.push({ severity: "warn", text: `${meter.name}: der jüngste Verbrauch liegt deutlich über dem robusten bisherigen Niveau (${last.per30.toFixed(2)} statt etwa ${(med * 30).toFixed(2)} ${meter.unit || ""} je 30 Tage).`, confidence: Math.min(99, Math.round(70 + (last.perDay / Math.max(threshold, 1e-4) - 1) * 20)) });
    return out;
  }
  function smartDataAnomalies(state) {
    const out = [], positions = state.costPositions || [], groups = /* @__PURE__ */ new Map();
    for (const p of positions) {
      const k = `${normalizeLabelText(p.label)}|${Number(p.amount || 0).toFixed(2)}|${p.serviceStart}|${p.serviceEnd}|${p.assignment}`;
      const a = groups.get(k) || [];
      a.push(p);
      groups.set(k, a);
    }
    for (const a of groups.values()) if (a.length > 1) out.push({ id: `dup-pos-${a[0].id}`, severity: "warn", title: "Mögliche doppelte Kostenposition", detail: `${a[0].label} · ${euro(a[0].amount)} ist ${a.length}-mal mit gleichem Zeitraum und gleicher Zuordnung vorhanden.`, why: "Duplikatprüfung", confidence: 96, route: "data", sub: "positions" });
    const payGroups = /* @__PURE__ */ new Map();
    for (const p of state.payments || []) {
      const k = paymentFingerprint(p), a = payGroups.get(k) || [];
      a.push(p);
      payGroups.set(k, a);
    }
    for (const a of payGroups.values()) if (a.length > 1) out.push({ id: `dup-pay-${a[0].id}`, severity: "warn", title: "Mögliche doppelte Zahlung", detail: `${a[0].date} · ${euro(a[0].amount)} · ${a[0].label}`, why: "Import-/Buchungsprüfung", confidence: 94, route: "owner", sub: "cashflow" });
    for (const m of state.meters || []) {
      const r = (m.readings || []).slice().sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      for (let i = 1; i < r.length; i++) if (Number(r[i].value) < Number(r[i - 1].value) && !r[i].synthetic) out.push({ id: `meter-drop-${m.id}-${r[i].id}`, severity: "warn", title: `Zählerstand bei ${m.name} gesunken`, detail: `${r[i - 1].value} → ${r[i].value} am ${r[i].date}. Zählerwechsel oder Eingabefehler prüfen.`, why: "Plausibilitätsprüfung", confidence: 98, route: "data", sub: "infrastructure" });
      for (const a of robustMeterAnomalies(m)) out.push({ id: `meter-spike-${m.id}`, severity: "warn", title: "Ungewöhnlicher Verbrauch", detail: a.text, why: "Robuste Verbrauchsanalyse", confidence: a.confidence || 80, route: "owner", sub: "analytics" });
    }
    return out;
  }
  function historicalAssignmentPrediction(state, label, categoryId) {
    const nl = normalizeLabelText(label), candidates = (state.costPositions || []).filter((p) => p.confirmed && p.assignment !== "review" && (p.category === categoryId || tokenSimilarity(p.label, label) > 0.65));
    if (!candidates.length) return null;
    const counts = {};
    for (const p of candidates) counts[p.assignment] = (counts[p.assignment] || 0) + 1;
    const [assignment, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return { assignment, confidence: Math.round(100 * count / candidates.length), samples: candidates.length };
  }
  function smartClassifyCostText(text) {
    const s = normalizeLabelText(text);
    const defs = [
      { category: "repair", rx: /reparatur|instandsetzung|instandhaltung|sanierung|ersatzteil|defekt|erneuerung/, confidence: 0.96, reason: "Hinweis auf Instandhaltung/Reparatur" },
      { category: "admin", rx: /verwaltung|verwalter|buchfuhrung|kontofuhrung|geschaftsfuhrung/, confidence: 0.94, reason: "Hinweis auf Verwaltungskosten" },
      { category: "propertyTax", rx: /grundsteuer|grundbesitzabgabe.*steuer/, confidence: 0.98, reason: "Grundsteuer erkannt" },
      { category: "rainwater", rx: /niederschlagswasser|regenwasser/, confidence: 0.97, reason: "Niederschlagswasser erkannt" },
      { category: "water", rx: /schmutzwasser|frischwasser|wasserverbrauch|wasserversorgung|kanal|abwasser|grundgebuhr wasser/, confidence: 0.94, reason: "Wasser/Kanal erkannt" },
      { category: "waste", rx: /restmull|restmuell|bioabfall|biomull|biomuell|papier.*tonne|abfall|mullabfuhr|muellabfuhr/, confidence: 0.94, reason: "Abfallkosten erkannt" },
      { category: "street", rx: /strassenreinigung|straßenreinigung|winterdienst|schneeraum|schneeräum/, confidence: 0.94, reason: "Straßenreinigung/Winterdienst erkannt" },
      { category: "insurance", rx: /gebaudeversicherung|gebäudeversicherung|sachversicherung|haftpflicht.*gebaude|haftpflicht.*gebäude/, confidence: 0.91, reason: "Gebäudeversicherung erkannt" },
      { category: "chimney", rx: /schornsteinfeger|kehrgebuhr|kehrgebühr|feuerstattenschau|feuerstättenschau/, confidence: 0.94, reason: "Schornsteinfeger erkannt" },
      { category: "garden", rx: /gartenpflege|grunpflege|grünpflege|rasenpflege|heckenschnitt/, confidence: 0.88, reason: "Gartenpflege erkannt" },
      { category: "cleaning", rx: /gebaudereinigung|gebäudereinigung|treppenhausreinigung|ungeziefer|schadlingsbekampfung|schädlingsbekämpfung/, confidence: 0.88, reason: "Gebäudereinigung erkannt" }
    ];
    for (const d of defs) if (d.rx.test(s)) return d;
    return { category: "other", confidence: 0.28, reason: "Keine eindeutige Kostenart erkannt" };
  }
  function cleanProposalLabel(line, categoryId) {
    let x = String(line || "").replace(/\b\d{1,6}(?:\.\d{3})*,\d{2}\s*€?/g, "").replace(/\s{2,}/g, " ").replace(/[·;:,\-–]+$/, "").trim();
    if (x.length < 4 || x.length > 80) x = category(categoryId).label;
    return x;
  }
  function smartGenericPositionProposals(state, text, fields) {
    const lines = String(text || "").split(/\r?\n/).map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean), out = [];
    const start = fields.serviceStart || `${fields.year || (/* @__PURE__ */ new Date()).getFullYear()}-01-01`, end = fields.serviceEnd || `${fields.year || (/* @__PURE__ */ new Date()).getFullYear()}-12-31`;
    for (const line of lines) {
      if (/gesamtsumme|gesamtbetrag|summe neu|zahlbetrag|zu zahlen|endbetrag|umsatzsteuer|mwst|ust\b/i.test(line)) continue;
      const cls = smartClassifyCostText(line);
      if (cls.confidence < 0.78) continue;
      const ms = [...line.matchAll(/(\d{1,6}(?:\.\d{3})*,\d{2})\s*€?/g)];
      if (!ms.length) continue;
      const amount = parseMoney(ms.at(-1)[1]);
      if (!(amount > 0)) continue;
      const label = cleanProposalLabel(line, cls.category), hist = historicalAssignmentPrediction(state, label, cls.category);
      let assignment = hist?.confidence >= 70 ? hist.assignment : ["repair", "admin"].includes(cls.category) ? "owner" : cls.category === "waste" ? "review" : "house";
      out.push({ id: uid(), label, category: cls.category, amount, serviceStart: start, serviceEnd: end, assignment, agreement: "auto", confidence: Math.min(0.96, cls.confidence * (hist?.confidence >= 70 ? 1 : 0.96)), evidence: line, confirmed: false, smartReason: hist?.confidence >= 70 ? `${cls.reason}; Zuordnung aus ${hist.samples} früheren Position(en) gelernt` : cls.reason });
    }
    return out;
  }
  function enrichDocumentProposalsSmart(state, text, fields, base) {
    const out = (base || []).slice(), generic = smartGenericPositionProposals(state, text, fields);
    for (const p of generic) {
      const duplicate = out.some((x) => tokenSimilarity(x.label, p.label) > 0.78 && Math.abs(Number(x.amount) - Number(p.amount)) < 0.02);
      if (!duplicate) out.push(p);
    }
    return out.slice(0, 30);
  }
  function smartDocumentSummary(state, text, fields) {
    const cls = smartClassifyCostText(text), issuer = fields.intelligence?.issuer || "", sourceMatches = (state.sources || []).map((s) => ({ source: s, score: tokenSimilarity(issuer, s.name || "") })).filter((x) => x.score > 0.32).sort((a, b) => b.score - a.score);
    const warnings = [];
    if (["repair", "admin"].includes(cls.category)) warnings.push(`Die Dokumentanalyse erkennt wahrscheinlich ${category(cls.category).label}. Diese Kostenart wird nicht automatisch auf die Mieterin umgelegt.`);
    if ((fields.positionProposals || []).some((p) => p.assignment === "review")) warnings.push("Mindestens eine Kostenposition benötigt eine ausdrückliche Zuordnungsentscheidung.");
    return { category: cls.category, categoryConfidence: Math.round(cls.confidence * 100), reason: cls.reason, sourceId: sourceMatches[0]?.source.id || "", sourceName: sourceMatches[0]?.source.name || "", sourceConfidence: sourceMatches[0] ? Math.round(sourceMatches[0].score * 100) : 0, warnings };
  }
  function smartTaskSuggestions(state) {
    const out = [], today = smartToday(), existing = new Set(taskList().map((t) => `${normalizeLabelText(t.title)}|${t.due}`));
    for (const s of state.sources || []) for (const d of s.dueDates || []) {
      if (d < today) continue;
      const title = `${s.name} – Fälligkeit`;
      const k = `${normalizeLabelText(title)}|${d}`;
      if (!existing.has(k)) out.push({ title, due: d, lead: 14, reason: "Fälligkeit aus Kostenquelle" });
    }
    for (const m of state.meters || []) {
      const last = latestMeterReading(m), age = last ? Math.max(0, calendarDayDiff(last.date, smartToday())) : 999;
      if (age > 90) {
        const due = /* @__PURE__ */ new Date();
        due.setDate(due.getDate() + 7);
        const title = `${m.name} ablesen`;
        const ds = localDateISO(due), k = `${normalizeLabelText(title)}|${ds}`;
        if (!existing.has(k)) out.push({ title, due: ds, lead: 2, reason: last ? `Letzte Ablesung vor ${age} Tagen` : "Noch keine Ablesung" });
      }
    }
    const backupAge = state.meta?.lastBackupAt ? Math.max(0, calendarDayDiff(String(state.meta.lastBackupAt).slice(0, 10), smartToday())) : 999;
    if (backupAge > 30) {
      const due = /* @__PURE__ */ new Date();
      due.setDate(due.getDate() + 3);
      out.push({ title: "Verschlüsselte Datensicherung erstellen", due: localDateISO(due), lead: 1, reason: "Datensicherung ist nicht aktuell" });
    }
    return out.slice(0, 12);
  }
  function smartInsights(state) {
    const out = [], today = smartToday(), rent = rentMonthStatus(state), proj = billingProjection(state), paymentPlan = smartPaymentPlan(state), todayDay = Number(today.slice(8, 10)), rentAttention = rentAttentionDay(state);
    for (const item of AppLifecycleLedger.lifecycleAlerts(state, String(state?.meta?.primaryBuildingId || ""), today)) out.push({ ...item, why: "Vermietungs-Lifecycle & explizites Mietkonto", confidence: 100 });
    for (const c of billingReadiness(state, currentPeriodYear()).filter((x) => !x.ok)) out.push({ id: `ready-${c.id}`, severity: "warn", title: c.label, detail: "Die Abrechnung ist an dieser Stelle noch nicht vollständig.", why: "Abschlussprüfung", confidence: 100, route: c.route, sub: c.sub });
    if (rent.status === "missing" && Number(rent.expected) > 0 && todayDay >= rentAttention) {
      const late = todayDay - rentAttention;
      out.push({ id: `rent-${rent.key}`, severity: late >= 7 ? "bad" : "warn", title: `Mietzahlung ${rent.key} noch nicht erkannt`, detail: `Erwartet ${euro(rent.expected)}. In den erfassten Kontobewegungen wurde noch keine passende Zahlung gefunden.`, why: "Abgleich Mietvertrag ↔ Zahlungseingänge; Zeitpunkt orientiert sich – wenn vorhanden – an bisherigen Zahlungseingängen. Keine automatische Mahnaussage.", confidence: 78, route: "owner", sub: "cashflow" });
    }
    if (rent.status === "partial") out.push({ id: `rent-${rent.key}`, severity: "warn", title: `Mietzahlung ${rent.key} nur teilweise erkannt`, detail: `Erkannt ${euro(rent.paid)} von ${euro(rent.expected)}.`, why: "Zahlungseingangsabgleich", confidence: rent.confidence || 65, route: "owner", sub: "cashflow" });
    if (paymentPlan.length) out.push({ id: "payment-match", severity: "warn", title: `${paymentPlan.length} Zahlung(en) mit plausiblem Zuordnungsvorschlag`, detail: `Bester aktueller Treffer: ${paymentPlan[0].suggestions[0].score} %.`, why: "Betrag, Text, Quelle und Fälligkeit", confidence: paymentPlan[0].suggestions[0].score, route: "owner", sub: "reconciliation" });
    const docs = state.documentsCache || [], reviewDocs = docs.filter((d) => documentWorkflowState(d) === "review").length, newDocs = docs.filter((d) => documentWorkflowState(d) === "new").length;
    if (reviewDocs || newDocs) out.push({ id: "docs-review", severity: "warn", title: `${reviewDocs + newDocs} Dokument(e) warten auf Prüfung`, detail: `${newDocs} neu · ${reviewDocs} mit Prüfschritt.`, why: "Dokumenten-Inbox", confidence: 100, route: "data", sub: "documents" });
    for (const d of billingDeadlineInsights(state)) out.push(d);
    for (const a of smartDataAnomalies(state)) out.push(a);
    const adv = advanceAdjustmentSuggestion(state);
    if (adv?.material) out.push({ id: "advance", severity: "info", title: "Betriebskostenvorauszahlung prüfen", detail: `Aktuell ${euro(adv.current)} / Monat · rechnerischer Richtwert aus letzter Abrechnung ${euro(adv.recommended)} / Monat.`, why: "§ 560 Abs. 4 BGB; nur rechnerischer Vorschlag", confidence: 80, route: "rental", sub: "calculation" });
    if (proj.missingCategories.length && proj.confidence >= 55) out.push({ id: "projection", severity: "info", title: "Abrechnungsprognose nutzt Vorjahreswerte", detail: `Für ${proj.missingCategories.map((x) => categoryLabel(x.category)).join(", ")} fehlen noch aktuelle Werte. Prognose: ${euro(Math.abs(proj.projectedResult))} ${proj.projectedResult >= 0 ? "Nachzahlung" : "Guthaben"}.`, why: "Bekannte Kosten + fehlende Vorjahreskategorien", confidence: proj.confidence, route: "rental", sub: "calculation" });
    const age = state.meta?.lastBackupAt ? Math.max(0, calendarDayDiff(String(state.meta.lastBackupAt).slice(0, 10), smartToday())) : 9999;
    if (age > 30) out.push({ id: "backup", severity: "warn", title: state.meta?.lastBackupAt ? "Datensicherung älter als 30 Tage" : "Noch keine verschlüsselte Datensicherung", detail: "Eine aktuelle Vollsicherung schützt Daten und Dokumente bei Geräteverlust.", why: "Datensicherheit", confidence: 100, route: "more", sub: "backup" });
    const rank = { bad: 0, warn: 1, info: 2, good: 3 };
    return out.sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9) || Number(b.confidence || 0) - Number(a.confidence || 0));
  }
  var DECISION_UI_VERSION = 1;
  function confidenceBand(score) {
    const n = Math.max(0, Math.min(100, Number(score || 0)));
    if (n >= 90) return { id: "high", label: "Sehr sicher", short: "Sicher" };
    if (n >= 75) return { id: "good", label: "Gut begründet", short: "Plausibel" };
    if (n >= 55) return { id: "medium", label: "Mit Vorbehalt", short: "Prüfen" };
    return { id: "low", label: "Unsicher", short: "Unsicher" };
  }
  function qualityBand(score) {
    const n = Number(score || 0);
    if (n >= 90) return { id: "high", label: "Sehr gut" };
    if (n >= 75) return { id: "good", label: "Gut" };
    if (n >= 55) return { id: "medium", label: "Prüfen" };
    return { id: "low", label: "Unvollständig" };
  }
  function decisionSeverityWeight(s) {
    return s === "bad" ? 400 : s === "warn" ? 260 : s === "info" ? 100 : 0;
  }
  function decisionActionLabel(x) {
    if (x.route === "rental" && x.sub === "lifecycle") return "Mietkonto öffnen";
    if (x.route === "rental" && x.sub === "calculation") return "Abrechnung prüfen";
    if (x.route === "rental" && x.sub === "water") return "Wasser prüfen";
    if (x.route === "owner" && x.sub === "cashflow") return "Zahlungen öffnen";
    if (x.route === "owner" && x.sub === "reconciliation") return "Zuordnung prüfen";
    if (x.route === "data" && x.sub === "documents") return "Dokumente prüfen";
    if (x.route === "data" && x.sub === "positions") return "Kosten prüfen";
    if (x.route === "more" && x.sub === "backup") return "Sicherung öffnen";
    return "Öffnen";
  }
  function decisionKind(x) {
    if ((x.why || "").includes("§")) return "Regel";
    if (/Prognose|Richtwert|Analyse|Abgleich|Plausibil/i.test(x.why || "")) return "Auswertung";
    return Number(x.confidence || 0) >= 95 ? "Fakt" : "Hinweis";
  }
  function smartDecisionQueue(s) {
    const raw = smartInsights(s), seen = /* @__PURE__ */ new Set(), out = [];
    for (const x of raw) {
      const key = `${normalizeLabelText(x.title)}|${x.route}|${x.sub || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const confidence = Math.max(0, Math.min(100, Number(x.confidence || 0))), band = confidenceBand(confidence), blocker = x.severity === "bad" || /fehlt|offen|ungeklärt|abschließen|nicht erkannt/i.test(`${x.title} ${x.detail || ""}`), actionability = x.route && x.route !== "home" ? 60 : 0;
      if (x.severity === "info" && confidence < 55 && !blocker) continue;
      out.push({ ...x, confidence, band, blocker, kind: decisionKind(x), actionLabel: decisionActionLabel(x), decisionScore: decisionSeverityWeight(x.severity) + confidence + actionability + (blocker ? 50 : 0) });
    }
    return out.sort((a, b) => b.decisionScore - a.decisionScore);
  }
  function decisionWhyHTML(x) {
    return `<details class="decision-details"><summary>Warum zeigt mir die App das?</summary><div><p>${esc(x.why || "Auswertung der vorhandenen Daten")}</p><p><strong>Einordnung:</strong> ${esc(x.kind)} · ${esc(x.band.label)}${x.confidence ? ` (${Math.round(x.confidence)} %)` : ""}</p>${x.severity === "info" ? `<p class="muted">Dieser Hinweis ist nicht dringend. Er soll eine Entscheidung vorbereiten, nicht automatisch ausführen.</p>` : ""}</div></details>`;
  }
  function rentAttentionDay(s) {
    const days = (s.payments || []).filter((p) => p.direction === "income" && detectRentPayment(s, p)?.score >= 70 && p.date).map((p) => Number(p.date.slice(8, 10))).filter((n) => n >= 1 && n <= 28).sort((a, b) => a - b);
    if (days.length >= 2) {
      const mid = days[Math.floor(days.length / 2)];
      return Math.max(6, Math.min(14, mid + 3));
    }
    return 10;
  }
  function smartSummaryText(state) {
    const ins = smartInsights(state), rent = rentMonthStatus(state), p = billingProjection(state), q = dataQualityScore(state);
    return `Datenqualität ${q} %. ${ins.length ? `${ins.filter((x) => x.severity === "bad").length} dringende und ${ins.filter((x) => x.severity === "warn").length} wichtige Hinweise.` : "Keine offenen Smart-Hinweise."} Mietzahlung aktuell: ${rentStatusLabel(rent)}. Abrechnungsprognose: ${euro(Math.abs(p.projectedResult))} ${p.projectedResult >= 0 ? "Nachzahlung" : "Guthaben"} bei ${p.confidence} % Modellkonfidenz.`;
  }
  function smartAnswer(state, query) {
    const q = normalizeLabelText(query), y = currentPeriodYear(), rent = rentMonthStatus(state), proj = billingProjection(state), ins = smartInsights(state);
    if (/miete|mietzahlung|zahlungseingang/.test(q)) return { title: "Mietzahlung", answer: rent.status === "none" ? "Für den aktuellen Monat ist kein aktiver Mietvertrag hinterlegt." : `Für ${rent.key} sind ${euro(rent.paid)} von ${euro(rent.expected)} als passende Mietzahlung erkannt. Status: ${rentStatusLabel(rent)}. Erkennungs-Sicherheit ${rent.confidence || 0} %.`, route: "owner", sub: "cashflow" };
    if (/abrechnung|nachzahlung|guthaben|nebenkosten/.test(q)) return { title: "Abrechnung", answer: `Aktuell bestätigte Mieter-Kosten: ${euro(proj.knownTenantCosts)}. Vorauszahlungen im Zeitraum: ${euro(proj.advances)}. Prognose: ${euro(Math.abs(proj.projectedResult))} ${proj.projectedResult >= 0 ? "Nachzahlung" : "Guthaben"} (${proj.confidence} % Modellkonfidenz).${proj.missingCategories.length ? ` Noch geschätzt aus dem Vorjahr: ${proj.missingCategories.map((x) => categoryLabel(x.category)).join(", ")}.` : ""}`, route: "rental", sub: "calculation" };
    if (/wasser|zahler|zaehler|verbrauch/.test(q)) {
      const { main, owner } = ensureDefaultMeters(state), tm = meterTrend(main), to = meterTrend(owner), sett = settlementConsumption(state, settlementByPeriod(state, y));
      return { title: "Wasser", answer: sett?.valid ? `Abrechnungsperiode: Haus ${sett.house.toFixed(3)} m³, Eigennutzung ${sett.owner.toFixed(3)} m³, Mietwohnung ${sett.tenant.toFixed(3)} m³. Jüngerer Trend: Hauptzähler Ø ${tm.avgPer30.toFixed(2)} m³ / 30 Tage, Zwischenzähler Ø ${to.avgPer30.toFixed(2)} m³ / 30 Tage.` : "Für die aktuelle Abrechnungsperiode fehlen noch vollständige Verbrauchsdaten.", route: "rental", sub: "water" };
    }
    if (/kosten|steiger|teuer|entwicklung/.test(q)) {
      const al = costTrendAlerts(state, y);
      return { title: "Kostenentwicklung", answer: al.length ? al.map((x) => x.text).join(" ") : "Es gibt derzeit keine belastbare Kostenveränderung ab 15 % gegenüber der Vorperiode.", route: "owner", sub: "analytics" };
    }
    if (/zahlung|zuord|bezahlt|rechnung/.test(q)) {
      const p = smartPaymentPlan(state);
      return { title: "Zahlungszuordnung", answer: p.length ? `${p.length} offene Ausgabe(n) haben plausible Treffer. Der beste Treffer liegt bei ${p[0].suggestions[0].score} % und bezieht sich auf „${p[0].suggestions[0].target.label || p[0].suggestions[0].target.name}“.` : "Aktuell gibt es keine unzugeordnete Ausgabe mit einem ausreichend starken Treffer.", route: "owner", sub: "reconciliation" };
    }
    if (/dokument|beleg|bescheid|post/.test(q)) {
      const d = state.documentsCache || [], n = d.filter((x) => documentWorkflowState(x) === "new").length, r = d.filter((x) => documentWorkflowState(x) === "review").length;
      return { title: "Dokumente", answer: `Dokumenten-Inbox: ${n} neu, ${r} zu prüfen, ${d.filter((x) => documentWorkflowState(x) === "done").length} erledigt.`, route: "data", sub: "documents" };
    }
    if (/backup|sicherung/.test(q)) {
      const age = state.meta?.lastBackupAt ? Math.max(0, calendarDayDiff(String(state.meta.lastBackupAt).slice(0, 10), smartToday())) : null;
      return { title: "Datensicherung", answer: age == null ? "Es ist noch keine verschlüsselte Vollsicherung dokumentiert." : `Die letzte verschlüsselte Vollsicherung ist ${age} Tag(e) alt.`, route: "more", sub: "backup" };
    }
    if (/frist|recht|rechtsstand/.test(q)) {
      const dl = billingDeadlineInsights(state);
      return { title: "Fristen & Rechtsstand", answer: `Hinterlegter Rechtsstand: ${ACTIVE_LEGAL_PACK?.effectiveDate || LAW_DATE}. ${dl.length ? dl.map((x) => x.detail).join(" ") : "Aktuell erkennt die App keine unmittelbar bevorstehende offene Abrechnungsfrist."}`, route: "more", sub: "legal" };
    }
    if (/was fehlt.*abrechnung|abrechnung.*fehlt|abrechnung.*vorberei/.test(q)) {
      const v = v18BillingAssistant(state, preferredBillingYear()), parts = [...v.openItems, ...v.estimatedItems].slice(0, 5).map((x) => `${x.label} (${v18StatusLabel(x.status)})`);
      return { title: "Abrechnung vorbereiten", answer: `${v.score} % vorbereitet. ${parts.length ? `Noch zu klären: ${parts.join(", ")}.` : "Alle erwarteten Datenbausteine sind vorhanden."} Prognose: ${euro(Math.abs(v.projectedResult))} ${v.projectedResult >= 0 ? "Nachzahlung" : "Guthaben"}.`, route: "rental", sub: "billing" };
    }
    if (/vorauszahlung|abschlag/.test(q)) {
      const a = advanceAdjustmentSuggestion(state);
      return { title: "Betriebskostenvorauszahlung", answer: a ? `${a.basis} Aktuell ${euro(a.current)}, rechnerischer Richtwert ${euro(a.recommended)} pro Monat.` : "Für einen belastbaren rechnerischen Vorschlag wird zunächst eine abgeschlossene Abrechnung benötigt.", route: "rental", sub: "calculation" };
    }
    return { title: "Gesamtstatus", answer: smartSummaryText(state), route: ins[0]?.route || "home", sub: ins[0]?.sub || "" };
  }
  return __toCommonJS(v18_assistant_exports);
})();


/* ===== compiled src/io/backup-codec.ts ===== */
"use strict";
var AppBackupCodec = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/io/backup-codec.ts
  var backup_codec_exports = {};
  __export(backup_codec_exports, {
    ENCRYPTED_BACKUP_SCHEMA: () => ENCRYPTED_BACKUP_SCHEMA,
    FULL_BACKUP_SCHEMA: () => FULL_BACKUP_SCHEMA,
    b64ToBytes: () => b64ToBytes,
    bytesToB64: () => bytesToB64,
    createFullBackup: () => createFullBackup,
    decodeFullBackup: () => decodeFullBackup,
    decryptJSON: () => decryptJSON,
    encodeBlobForBackup: () => encodeBlobForBackup,
    encryptJSON: () => encryptJSON
  });
  var ENCRYPTED_BACKUP_SCHEMA = "mietverwaltung-encrypted-v1";
  var FULL_BACKUP_SCHEMA = "mietverwaltung-full-backup-v2";
  function bytesToB64(bytes) {
    let binary = "";
    const chunk = 32768;
    for (let index = 0; index < bytes.length; index += chunk) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
    }
    return btoa(binary);
  }
  function b64ToBytes(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(new ArrayBuffer(binary.length));
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }
  async function deriveKey(password, salt) {
    const material = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 25e4, hash: "SHA-256" },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }
  async function encryptJSON(value, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const plain = new TextEncoder().encode(JSON.stringify(value));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
    return {
      schema: ENCRYPTED_BACKUP_SCHEMA,
      salt: bytesToB64(salt),
      iv: bytesToB64(iv),
      data: bytesToB64(new Uint8Array(encrypted))
    };
  }
  async function decryptJSON(wrapper, password) {
    if (!wrapper || wrapper.schema !== ENCRYPTED_BACKUP_SCHEMA) {
      throw new Error("Falsches verschlüsseltes Backup-Format");
    }
    const salt = b64ToBytes(wrapper.salt);
    const iv = b64ToBytes(wrapper.iv);
    const key = await deriveKey(password, salt);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      b64ToBytes(wrapper.data)
    );
    return JSON.parse(new TextDecoder().decode(plain));
  }
  async function encodeBlobForBackup(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return {
      type: blob.type || "application/octet-stream",
      base64: bytesToB64(bytes)
    };
  }
  async function createFullBackup(state, password, documents) {
    const encoded = [];
    for (const document of documents) {
      const copy = { ...document, blob: void 0, pages: void 0 };
      if (Array.isArray(document.pages) && document.pages.length) {
        copy.pageData = [];
        for (const page of document.pages) {
          copy.pageData.push({
            id: page.id,
            name: page.name,
            type: page.type,
            size: page.size,
            blobData: await encodeBlobForBackup(page.blob)
          });
        }
      } else if (document.blob) {
        copy.blobData = await encodeBlobForBackup(document.blob);
      }
      encoded.push(copy);
    }
    const payload = {
      schema: FULL_BACKUP_SCHEMA,
      state,
      documents: encoded
    };
    return encryptJSON(payload, password);
  }
  async function decodeFullBackup(wrapper, password) {
    const payload = await decryptJSON(wrapper, password);
    if (!payload || payload.schema !== FULL_BACKUP_SCHEMA) {
      throw new Error("Falsches Backup-Format");
    }
    const documents = [];
    for (const document of payload.documents || []) {
      const copy = { ...document };
      if (Array.isArray(document.pageData)) {
        copy.pages = document.pageData.map((page) => ({
          id: page.id,
          name: page.name,
          type: page.type,
          size: page.size,
          blob: new Blob([b64ToBytes(page.blobData.base64)], { type: page.blobData.type })
        }));
        delete copy.pageData;
      } else if (document.blobData) {
        copy.blob = new Blob([b64ToBytes(document.blobData.base64)], {
          type: document.blobData.type
        });
        delete copy.blobData;
      }
      documents.push(copy);
    }
    return { state: payload.state, documents };
  }
  return __toCommonJS(backup_codec_exports);
})();


/* ===== compiled src/ui/ui-core.ts ===== */
"use strict";
var AppUiCore = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/ui/ui-core.ts
  var ui_core_exports = {};
  __export(ui_core_exports, {
    $: () => $,
    centralFieldLabel: () => centralFieldLabel,
    clearCentralValidation: () => clearCentralValidation,
    esc: () => esc,
    focusableIn: () => focusableIn,
    formField: () => formField,
    markCentralError: () => markCentralError,
    trapFocusInDialog: () => trapFocusInDialog,
    validateCentralForm: () => validateCentralForm,
    visibleDialog: () => visibleDialog
  });
  var $ = (id) => document.getElementById(id);
  var esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]);
  function focusableIn(root) {
    return [...root.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
  }
  function visibleDialog() {
    return ["modal", "searchOverlay", "quickOverlay"].map($).find((x) => x && !x.classList.contains("hidden")) || null;
  }
  function trapFocusInDialog(e) {
    if (e.key !== "Tab") return;
    const dlg = visibleDialog();
    if (!dlg) return;
    const els = focusableIn(dlg);
    if (!els.length) return;
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  function formField({ name, label, type = "text", value = "", options = [], full = false, step, min, placeholder = "" }) {
    if (type === "select") return `<label class="${full ? "full" : ""}">${esc(label)}<select name="${name}">${options.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(value) ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select></label>`;
    return `<label class="${full ? "full" : ""}">${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${step ? `step="${step}"` : ""} ${min !== void 0 ? `min="${min}"` : ""} placeholder="${esc(placeholder)}"></label>`;
  }
  function clearCentralValidation(form) {
    form.querySelectorAll(".field-error").forEach((x) => x.remove());
    form.querySelectorAll('[aria-invalid="true"]').forEach((x) => x.removeAttribute("aria-invalid"));
  }
  function centralFieldLabel(el) {
    const label = el.closest("label");
    if (!label) return el.name || "Eingabe";
    const text = [...label.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join(" ").trim();
    return text || el.name || "Eingabe";
  }
  function markCentralError(el, message) {
    el.setAttribute("aria-invalid", "true");
    const label = el.closest("label");
    if (label) {
      const note = document.createElement("small");
      note.className = "field-error";
      note.textContent = message;
      label.appendChild(note);
    }
  }
  function validateCentralForm(form) {
    clearCentralValidation(form);
    const values = Object.fromEntries(new FormData(form)), errors = [], warnings = [];
    const fail = (el, msg) => {
      if (!el) return;
      errors.push({ el, msg });
      markCentralError(el, msg);
    };
    const warn = (el, msg) => warnings.push({ el, msg });
    const byName = (name) => form.elements.namedItem(name);
    for (const el of form.querySelectorAll("input[name],select[name],textarea[name]")) {
      if (el.disabled) continue;
      const name = el.name, value = String(el.value ?? "").trim();
      if (el.type === "date" && value) {
        const r = AppValidation.validateIsoDate(value, false);
        if (!r.ok) fail(el, r.message || "Ungültiges Datum.");
      }
      if (el.type === "number" && value !== "") {
        const n = AppValidation.parseGermanNumber(value);
        if (n === null) {
          fail(el, "Bitte eine gültige Zahl eingeben.");
          continue;
        }
        if (el.min !== "" && n < Number(el.min)) fail(el, `Der Wert muss mindestens ${el.min} sein.`);
        if (el.max !== "" && n > Number(el.max)) fail(el, `Der Wert darf höchstens ${el.max} sein.`);
      }
      if (name === "iban" && value) {
        const r = AppValidation.validateIban(value, false);
        if (!r.ok) fail(el, r.message || "IBAN prüfen.");
      }
      if ((name === "area" || name === "totalArea") && value) {
        const r = AppValidation.validateArea(value);
        if (!r.ok) fail(el, r.message || "Wohnfläche prüfen.");
        else if (Number(r.value) > 1e3) warn(el, "Die eingegebene Wohnfläche ist ungewöhnlich groß.");
      }
      if ((name === "year" || name === "constructionYear" || name === "periodYear") && value) {
        const r = AppValidation.validateYear(value);
        if (!r.ok) fail(el, r.message || "Jahr prüfen.");
      }
      if (["rent", "advance", "amount", "repayment", "fixed"].includes(name) && value) {
        const r = AppValidation.validateMoney(value, { min: 0 });
        if (!r.ok) fail(el, r.message || "Betrag prüfen.");
        else if (Number(r.value) > 1e5) warn(el, "Der Betrag ist ungewöhnlich hoch.");
      }
      if (name === "persons" && value !== "" && Number(value) > 20) warn(el, "Die Personenzahl ist ungewöhnlich hoch.");
      if (["mainStart", "mainEnd", "ownerStart", "ownerEnd"].includes(name) && value !== "") {
        const r = AppValidation.validateMeterReading(value);
        if (!r.ok) fail(el, r.message || "Zählerstand prüfen.");
      }
    }
    const datePair = (a, b, label) => {
      const A = String(values[a] || ""), B = String(values[b] || "");
      if (A && B && A > B) fail(byName(b), `${label}: Das Enddatum liegt vor dem Startdatum.`);
    };
    datePair("start", "end", "Vertragszeitraum");
    datePair("serviceStart", "serviceEnd", "Leistungszeitraum");
    datePair("mainStartDate", "mainEndDate", "Hauptzähler-Zeitraum");
    datePair("ownerStartDate", "ownerEndDate", "Zwischenzähler-Zeitraum");
    if (values.billingTakeoverDate && values.predecessorBillingEnd && values.predecessorBillingEnd >= values.billingTakeoverDate) fail(byName("predecessorBillingEnd"), "Der Abrechnungszeitraum des Voreigentümers muss vor der eigenen Übernahme enden.");
    if (values.mainStart !== void 0 && values.mainEnd !== void 0 && values.mainStart !== "" && values.mainEnd !== "" && Number(values.mainEnd) < Number(values.mainStart)) fail(byName("mainEnd"), "Der Endstand des Hauptzählers darf nicht kleiner als der Anfangsstand sein.");
    if (values.ownerStart !== void 0 && values.ownerEnd !== void 0 && values.ownerStart !== "" && values.ownerEnd !== "" && Number(values.ownerEnd) < Number(values.ownerStart)) fail(byName("ownerEnd"), "Der Endstand des Zwischenzählers darf nicht kleiner als der Anfangsstand sein.");
    if (errors.length) {
      AppFeedback.showToast("Bitte markierte Eingaben prüfen.", { kind: "error", timeoutMs: 4200 });
      errors[0].el.focus();
      return false;
    }
    if (warnings.length) {
      const text = warnings.map((x) => `• ${centralFieldLabel(x.el)}: ${x.msg}`).join("\n");
      if (!confirm(`Ungewöhnliche Eingabe erkannt:

${text}

Trotzdem speichern?`)) {
        warnings[0].el.focus();
        return false;
      }
    }
    return true;
  }
  document.addEventListener("submit", (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement) || form.dataset.skipCentralValidation === "true") return;
    if (!validateCentralForm(form)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
  return __toCommonJS(ui_core_exports);
})();


/* ===== compiled src/ui/building-workspace-ui.ts ===== */
"use strict";
var AppBuildingWorkspaceUi = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/ui/building-workspace-ui.ts
  var building_workspace_ui_exports = {};
  __export(building_workspace_ui_exports, {
    openBuildingManager: () => openBuildingManager,
    renderBuildingSwitcher: () => renderBuildingSwitcher
  });
  var element = (id) => $(id);
  function activateBuilding(next) {
    activeBuildingId = AppPresentation.resolveActiveBuildingId(portfolioState, next);
    state = projectActiveState(portfolioState, activeBuildingId);
    LAST_STABLE_STATE = cloneState(state);
    render();
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }
  async function persistPortfolioMutation(next, action, detail, targetBuildingId) {
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
  function renderBuildingSwitcher() {
    const wrap = element("buildingSwitchWrap");
    const select = element("buildingSelect");
    if (!wrap || !select) return;
    const model = AppPresentation.createPresentationWorkspace(portfolioState, activeBuildingId);
    wrap.classList.toggle("hidden", !model.showBuildingSelector);
    if (!model.showBuildingSelector) {
      select.innerHTML = "";
      return;
    }
    select.innerHTML = model.buildings.map((item) => `<option value="${esc(item.id)}" ${item.active ? "selected" : ""}>${esc(item.name)}</option>`).join("");
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
  function buildingInput(form) {
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
  function openBuildingEditor(buildingId = "") {
    const master = portfolioState;
    const existing = (master.buildings || []).find((item) => String(item.id || "") === buildingId) || null;
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
      const form = element("buildingAdminForm");
      if (!form) return;
      form.onsubmit = async (event) => {
        event.preventDefault();
        const input = buildingInput(form);
        try {
          const targetId = existing ? String(existing.id) : uid();
          const next = existing ? AppApplication.updateBuildingInPortfolio(portfolioState, targetId, input) : AppApplication.createBuildingInPortfolio(portfolioState, targetId, input);
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
        } catch (error) {
          alert(String(error?.message || error));
        }
      };
    });
  }
  function openBuildingManager() {
    const model = AppPresentation.createPortfolioAdministrationModel(portfolioState, activeBuildingId);
    modal("Gebäude verwalten", `<div class="card">
    <div class="row between"><div><p class="eyebrow">${esc(model.portfolioName)}</p><h3>Gebäude im Portfolio</h3><p class="muted">Das Primärgebäude bleibt fachlich unverändert. „Öffnen“ wechselt nur den aktuellen Arbeitsbereich.</p></div><button id="addBuildingAdmin" class="primary">Gebäude hinzufügen</button></div>
  </div>
  ${model.buildings.map((item) => `<div class="item"><div class="row between"><div><div class="item-title-row"><h3>${esc(item.name)}</h3>${item.primary ? '<span class="pill good">Primär</span>' : ""}${item.active ? '<span class="pill">Aktiv</span>' : ""}</div><p>${esc(item.address || "Adresse fehlt")}</p><small>${Number(item.totalArea || 0).toLocaleString("de-DE")} m²${item.year ? ` · Baujahr ${esc(item.year)}` : ""} · ${item.counts.units} Einheiten · ${item.counts.tenancies} Mietverhältnisse</small></div><div class="item-actions"><button class="secondary" data-building-open="${esc(item.id)}">Öffnen</button><button class="secondary" data-building-edit="${esc(item.id)}">Bearbeiten</button></div></div></div>`).join("")}`, () => {
      const add = element("addBuildingAdmin");
      if (add) add.onclick = () => openBuildingEditor();
      document.querySelectorAll("[data-building-open]").forEach((button) => {
        button.onclick = () => {
          const id = button.dataset.buildingOpen || "";
          closeModal(true);
          activateBuilding(id);
        };
      });
      document.querySelectorAll("[data-building-edit]").forEach((button) => {
        button.onclick = () => openBuildingEditor(button.dataset.buildingEdit || "");
      });
    });
  }
  return __toCommonJS(building_workspace_ui_exports);
})();


/* ===== compiled src/ui/rental-lifecycle-ui.ts ===== */
"use strict";
var AppRentalLifecycleUi = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/ui/rental-lifecycle-ui.ts
  var rental_lifecycle_ui_exports = {};
  __export(rental_lifecycle_ui_exports, {
    RENTAL_LIFECYCLE_UI_VERSION: () => RENTAL_LIFECYCLE_UI_VERSION,
    billingLifecycleContext: () => billingLifecycleContext,
    renderCompactLedger: () => renderCompactLedger,
    renderRentalLifecycle: () => renderRentalLifecycle
  });
  var RENTAL_LIFECYCLE_UI_VERSION = 1;
  var q = (id) => document.getElementById(id);
  var money = (v) => Math.max(0, Number(v) || 0);
  var statusLabel = (s) => s === "paid" ? "Bezahlt" : s === "partial" ? "Teilzahlung" : s === "missing" ? "Offen" : s === "overpaid" ? "Überzahlt" : "–";
  var statusClass = (s) => s === "paid" ? "good" : s === "overpaid" ? "good" : s === "partial" ? "warn" : "bad";
  function fmtMonth(month) {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("de-DE", { month: "short", year: "numeric" });
  }
  function currentMonth() {
    const d = /* @__PURE__ */ new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  function remainingForPayment(state, p) {
    const used = AppLifecycleLedger.paymentAllocations(state, p.id).reduce((s, a) => s + Number(a.total || 0), 0);
    return Math.max(0, Number(p.amount || 0) - used);
  }
  function billingLifecycleContext(state, year, baseClosure, requestedLeaseId = "") {
    AppLifecycleLedger.ensureLifecycleState(state);
    const buildingId = String(state?.meta?.presentationBuildingId || state?.meta?.primaryBuildingId || "");
    const leases = AppLifecycleLedger.leasesForBillingYear(state, year, buildingId);
    const selectedLease = leases.find((l) => String(l.id) === String(requestedLeaseId)) || leases[0] || baseClosure?.analysis?.lease || null;
    let analysis = baseClosure?.analysis || {}, points = [...baseClosure?.points || []], ok = !!baseClosure?.ok, lifecycleIssues = [];
    if (selectedLease && leases.length > 1) {
      analysis = AppLifecycleLedger.leaseBillingAnalysis(state, analysis, year, String(selectedLease.id));
      points = points.map((x) => x.id === "advance" ? { ...x, ok: Number(analysis.advanceEvidence?.recognizedPayments || 0) > 0, label: "Vorauszahlungen dieses Mietverhältnisses sind im Mietkonto zugeordnet" } : x);
      lifecycleIssues = (analysis.unresolved || []).filter((x) => ![...baseClosure?.analysis?.unresolved || []].some((b) => b === x || b.id && b.id === x.id));
      ok = points.every((x) => x.ok) && !(analysis.unresolved || []).length;
    }
    const selectedLeaseId = String(selectedLease?.id || ""), snapshot = AppLifecycleLedger.latestSnapshotFor(state, year, selectedLeaseId);
    return { year, buildingId, leases, selectedLease, selectedLeaseId, analysis, closure: { ...baseClosure, analysis, points, ok }, snapshot, lifecycleIssues, history: AppLifecycleLedger.billingRevisionHistory(state, year, selectedLeaseId) };
  }
  function renderCompactLedger(state, h) {
    AppLifecycleLedger.ensureLifecycleState(state);
    const model = AppLifecycleLedger.rentLedger(state, { buildingId: String(state?.meta?.primaryBuildingId || "") }), rows = model.rows.slice(-12).reverse();
    return `<section id="rentLedger" class="card"><div class="card-head"><div><p class="eyebrow">MIETKONTO</p><h3>Soll, Ist & Zuordnung</h3></div><span class="pill ${model.open > 0.01 ? "warn" : "good"}">${model.open > 0.01 ? `${h.euro(model.open)} offen` : "Ausgeglichen"}</span></div>
  <div class="grid cards"><article class="card metric-card"><span>Soll 12M</span><strong>${h.euro(model.expected)}</strong></article><article class="card metric-card"><span>Zugeordnet</span><strong>${h.euro(model.paid)}</strong></article><article class="card metric-card"><span>Offen</span><strong>${h.euro(model.open)}</strong></article></div>
  <div class="tablewrap"><table class="costtable"><thead><tr><th>Monat</th><th>Soll</th><th>Zugeordnet</th><th>Differenz</th><th>Status</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${fmtMonth(r.month)}</td><td>${h.euro(r.total)}</td><td>${h.euro(r.paid)}</td><td>${h.euro(r.difference)}</td><td><span class="pill ${statusClass(r.status)}">${statusLabel(r.status)}</span></td></tr>`).join("")}</tbody></table></div><p class="muted">Das Mietkonto basiert auf zeitanteiligem Soll und expliziten Zahlungszuordnungen. Historische Vertragsdaten bleiben erhalten.</p></section>`;
  }
  function tenancyCard(p, lease) {
    const { esc, euro, dateDE } = p, terms = (lease.terms || []).slice().sort((a, b) => String(b.effectiveFrom).localeCompare(String(a.effectiveFrom))), latest = terms[0] || lease, moveIn = lease.handover?.moveIn, moveOut = lease.handover?.moveOut;
    return `<article class="card" data-tenancy-card="${esc(lease.id)}"><div class="card-head"><div><p class="eyebrow">${lease.end ? "MIETVERHÄLTNIS" : "AKTIVES MIETVERHÄLTNIS"}</p><h3>${esc(lease.tenantName || "Mieter/in")}</h3></div><span class="pill ${lease.end ? "" : "good"}">${dateDE(lease.start)}${lease.end ? ` – ${dateDE(lease.end)}` : " – laufend"}</span></div>
    <div class="fact-row"><span>Kaltmiete aktuell</span><strong>${euro(latest.rent)} / Monat</strong></div><div class="fact-row"><span>BK-Vorauszahlung aktuell</span><strong>${euro(latest.advance)} / Monat</strong></div><div class="fact-row"><span>Vertragsstände</span><strong>${terms.length}</strong></div>
    <div class="fact-row"><span>Einzugsübergabe</span><strong>${moveIn ? `✓ ${dateDE(moveIn.date)}` : "fehlt"}</strong></div><div class="fact-row"><span>Auszugsübergabe</span><strong>${lease.end ? moveOut ? `✓ ${dateDE(moveOut.date)}` : "fehlt" : "–"}</strong></div>
    <div class="row"><button class="secondary compact" data-term="${esc(lease.id)}">Miete/BK ändern</button><button class="secondary compact" data-handover="${esc(lease.id)}">Übergabe</button>${!lease.end ? `<button class="secondary compact" data-close-tenancy="${esc(lease.id)}">Auszug</button>` : ""}</div>
    ${terms.length > 1 ? `<details class="secondary-detail"><summary>Vertragshistorie</summary><div class="detail-content">${terms.map((t) => `<div class="fact-row"><span>${dateDE(t.effectiveFrom)}</span><strong>${euro(t.rent)} + ${euro(t.advance)} BK</strong></div>`).join("")}</div></details>` : ""}</article>`;
  }
  function openTenancy(p) {
    const units = (p.state.units || []).filter((u) => u.type === "rental" && (!p.activeBuildingId || u.buildingId === p.activeBuildingId));
    if (!units.length) return alert("Bitte zuerst eine Mietwohnung anlegen.");
    p.modal("Mietverhältnis anlegen", `<form id="gTenancyForm" class="form-grid">${p.formField({ name: "tenantName", label: "Mieter/in", value: "" })}${p.formField({ name: "tenantAddress", label: "Korrespondenzadresse", value: "", full: true })}${p.formField({ name: "unitId", label: "Mietwohnung", type: "select", value: units[0].id, options: units.map((u) => ({ value: u.id, label: u.name || "Mietwohnung" })) })}${p.formField({ name: "start", label: "Vertragsbeginn", type: "date", value: "" })}${p.formField({ name: "end", label: "Vertragsende (optional)", type: "date", value: "" })}${p.formField({ name: "rent", label: "Kaltmiete €", type: "number", step: "0.01", min: 0, value: "" })}${p.formField({ name: "advance", label: "BK-Vorauszahlung €", type: "number", step: "0.01", min: 0, value: "" })}${p.formField({ name: "note", label: "Notiz", value: "", full: true })}<div class="full form-actions"><button class="primary">Anlegen</button></div></form>`, () => {
      const form = q("gTenancyForm");
      form.onsubmit = async (e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(form));
        const result = await p.executeCommand("tenancy.create", v, () => AppApplication.createTenancyCommand(p.state, v, { buildingId: p.activeBuildingId, unitId: String(v.unitId || "") }), { auditText: "Mietverhältnis angelegt", restorePoint: true });
        if (!result.ok) return alert(result.message);
        p.closeModal(true);
        p.rerender();
      };
    });
  }
  function openTerm(p, lease) {
    const latest = AppLifecycleLedger.leaseTermAt(lease, (/* @__PURE__ */ new Date()).toISOString().slice(0, 10));
    p.modal("Miete / Vorauszahlung ändern", `<form id="gTermForm" class="form-grid">${p.formField({ name: "effectiveFrom", label: "Gültig ab", type: "date", value: "" })}${p.formField({ name: "rent", label: "Kaltmiete €", type: "number", step: "0.01", min: 0, value: latest.rent })}${p.formField({ name: "advance", label: "BK-Vorauszahlung €", type: "number", step: "0.01", min: 0, value: latest.advance })}${p.formField({ name: "reason", label: "Grund / Notiz", value: "Anpassung", full: true })}<div class="full info">Der bisherige Vertragsstand wird nicht überschrieben. Ab dem Stichtag entsteht ein neuer historischer Vertragsstand.</div><div class="full form-actions"><button class="primary">Änderung speichern</button></div></form>`, () => {
      const form = q("gTermForm");
      form.onsubmit = async (e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(form));
        const payload = { ...v, leaseId: lease.id, rent: money(v.rent), advance: money(v.advance) };
        const result = await p.executeCommand("tenancy.term.add", payload, () => AppApplication.addLeaseTermCommand(p.state, payload), { auditText: "Vertragsstand ergänzt", restorePoint: true });
        if (!result.ok) return alert(result.message);
        p.closeModal(true);
        p.rerender();
      };
    });
  }
  function openClose(p, lease) {
    p.modal("Auszug erfassen", `<form id="gCloseForm" class="form-grid">${p.formField({ name: "end", label: "Vertragsende / Auszug", type: "date", value: lease.end || "" })}${p.formField({ name: "note", label: "Notiz", value: "", full: true })}<div class="full legal-warn"><strong>Danach Übergabestände erfassen.</strong><br>Die App trennt Soll, Vorauszahlungen und Verbrauch am Auszugsdatum.</div><div class="full form-actions"><button class="primary">Auszug speichern</button></div></form>`, () => {
      const form = q("gCloseForm");
      form.onsubmit = async (e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(form)), payload = { ...v, leaseId: lease.id };
        const result = await p.executeCommand("tenancy.close", payload, () => AppApplication.closeTenancyCommand(p.state, payload), { auditText: "Mietverhältnis beendet", restorePoint: true });
        if (!result.ok) return alert(result.message);
        p.closeModal(true);
        p.rerender();
      };
    });
  }
  function openHandover(p, lease) {
    const canOut = !!lease.end, kind = canOut && !lease.handover?.moveOut ? "move-out" : "move-in", date = kind === "move-out" ? lease.end : lease.start;
    p.modal(kind === "move-out" ? "Auszugsübergabe" : "Einzugsübergabe", `<form id="gHandoverForm" class="form-grid"><label><span>Art</span><select name="kind"><option value="move-in" ${kind === "move-in" ? "selected" : ""}>Einzug</option>${canOut ? `<option value="move-out" ${kind === "move-out" ? "selected" : ""}>Auszug</option>` : ""}</select></label>${p.formField({ name: "date", label: "Übergabedatum", type: "date", value: date })}${p.formField({ name: "persons", label: "Personenzahl", type: "number", step: "1", min: 0, value: "" })}${p.formField({ name: "mainValue", label: "Hauptwasserzähler", type: "number", step: "0.001", value: "" })}${p.formField({ name: "ownerValue", label: "Zwischenzähler Eigennutzung", type: "number", step: "0.001", value: "" })}${p.formField({ name: "note", label: "Notiz", value: "", full: true })}<div class="full info">Für eine saubere Kaltwassertrennung bei Mieterwechseln werden beide Zählerstände am selben Übergabedatum gespeichert.</div><div class="full form-actions"><button class="primary">Übergabe speichern</button></div></form>`, () => {
      const form = q("gHandoverForm");
      form.onsubmit = async (e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(form)), payload = { leaseId: lease.id, kind: v.kind, date: v.date, persons: Number(v.persons) || 0, note: v.note, readings: [{ role: "mainWater", value: Number(v.mainValue) }, { role: "ownerWater", value: Number(v.ownerValue) }] };
        const result = await p.executeCommand("tenancy.handover", payload, () => AppApplication.recordHandoverCommand(p.state, payload), { auditText: "Übergabe dokumentiert", restorePoint: true });
        if (!result.ok) return alert(result.message);
        p.closeModal(true);
        p.rerender();
      };
    });
  }
  function openAllocation(p) {
    const payments = (p.state.payments || []).filter((x) => x.direction === "income" && remainingForPayment(p.state, x) > 0.01), leases = (p.state.leases || []).filter((l) => !p.activeBuildingId || l.buildingId === p.activeBuildingId);
    if (!payments.length) return alert("Keine noch zuzuordnende Einnahme vorhanden.");
    if (!leases.length) return alert("Kein Mietverhältnis vorhanden.");
    p.modal("Mietzahlung zuordnen", `<form id="gAllocForm" class="form-grid"><label class="full"><span>Zahlung</span><select name="paymentId">${payments.map((x) => `<option value="${p.esc(x.id)}">${p.esc(x.date)} · ${p.euro(remainingForPayment(p.state, x))} frei · ${p.esc(x.label || "")}</option>`).join("")}</select></label><label class="full"><span>Mietverhältnis</span><select name="leaseId">${leases.map((l) => `<option value="${p.esc(l.id)}">${p.esc(l.tenantName || l.id)}</option>`).join("")}</select></label>${p.formField({ name: "month", label: "Mietmonat", type: "month", value: currentMonth() })}${p.formField({ name: "total", label: "Betrag €", type: "number", step: "0.01", min: 0, value: "" })}<div class="full info">Die App ordnet den Betrag zuerst der Kaltmiete und danach der BK-Vorauszahlung des gewählten Monats zu. Eine Zahlung kann anschließend auf weitere Monate verteilt werden.</div><div class="full form-actions"><button class="primary">Zuordnen</button></div></form>`, () => {
      const form = q("gAllocForm");
      form.onsubmit = async (e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(form)), payment = p.state.payments.find((x) => x.id === v.paymentId), total = money(v.total) || remainingForPayment(p.state, payment), payload = { paymentId: v.paymentId, allocations: [{ leaseId: v.leaseId, month: v.month, total }] };
        const existing = AppLifecycleLedger.paymentAllocations(p.state, String(v.paymentId));
        if (existing.length) payload.allocations = [...existing.map((a) => ({ leaseId: a.leaseId, month: a.month, rentAmount: a.rentAmount, advanceAmount: a.advanceAmount, total: a.total })), ...payload.allocations];
        const result = await p.executeCommand("rent.allocate", payload, () => AppApplication.allocateRentPaymentCommand(p.state, payload), { auditText: "Mietzahlung zugeordnet" });
        if (!result.ok) return alert(result.message);
        p.closeModal(true);
        p.rerender();
      };
    });
  }
  function openReversal(p) {
    const candidates = (p.state.payments || []).filter((x) => x.direction === "income" && AppLifecycleLedger.paymentAllocations(p.state, x.id).length);
    if (!candidates.length) return alert("Keine zugeordnete Mietzahlung für eine Rücklastschrift vorhanden.");
    p.modal("Rücklastschrift erfassen", `<form id="gReverseForm" class="form-grid"><label class="full"><span>Ursprüngliche Zahlung</span><select name="paymentId">${candidates.map((x) => `<option value="${p.esc(x.id)}">${p.esc(x.date)} · ${p.euro(x.amount)} · ${p.esc(x.label || "")}</option>`).join("")}</select></label>${p.formField({ name: "date", label: "Rücklastschrift am", type: "date", value: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) })}${p.formField({ name: "amount", label: "Betrag € (leer = vollständig)", type: "number", step: "0.01", min: 0, value: "" })}${p.formField({ name: "label", label: "Bezeichnung", value: "Rücklastschrift Miete", full: true })}<div class="full legal-warn">Die ursprüngliche Buchung wird nicht gelöscht. Die Rücklastschrift erhält eine negative Gegenbuchung im Mietkonto.</div><div class="full form-actions"><button class="primary">Rücklastschrift buchen</button></div></form>`, () => {
      const form = q("gReverseForm");
      form.onsubmit = async (e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(form)), payload = { ...v, amount: v.amount ? Number(v.amount) : void 0 };
        const result = await p.executeCommand("rent.reversal", payload, () => AppApplication.createRentReversalCommand(p.state, payload, { buildingId: p.activeBuildingId }), { auditText: "Miet-Rücklastschrift erfasst", restorePoint: true });
        if (!result.ok) return alert(result.message);
        p.closeModal(true);
        p.rerender();
      };
    });
  }
  function openReplacement(p) {
    const meters = (p.state.meters || []).filter((m) => !m.removedAt && ["mainWater", "ownerWater"].includes(m.role));
    if (!meters.length) return alert("Kein aktiver Wasserzähler vorhanden.");
    p.modal("Zähler wechseln", `<form id="gMeterForm" class="form-grid"><label class="full"><span>Ausgebauter Zähler</span><select name="oldMeterId">${meters.map((m) => `<option value="${p.esc(m.id)}">${p.esc(m.name)} · ${p.esc(m.number || "ohne Nummer")}</option>`).join("")}</select></label>${p.formField({ name: "date", label: "Wechseldatum", type: "date", value: "" })}${p.formField({ name: "oldValue", label: "Ausbaustand", type: "number", step: "0.001", value: "" })}${p.formField({ name: "newNumber", label: "Neue Zählernummer", value: "" })}${p.formField({ name: "newValue", label: "Einbaustand", type: "number", step: "0.001", value: "0" })}${p.formField({ name: "reason", label: "Grund / Notiz", value: "Zählerwechsel", full: true })}<div class="full info">Alter Zähler und neuer Zähler werden als getrennte Geräte verkettet. Verbrauch wird über beide Geräte addiert; ein neuer Zähler darf deshalb wieder bei 0 starten.</div><div class="full form-actions"><button class="primary">Wechsel speichern</button></div></form>`, () => {
      const form = q("gMeterForm");
      form.onsubmit = async (e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(form)), payload = { ...v, oldValue: Number(v.oldValue), newValue: Number(v.newValue) };
        const result = await p.executeCommand("meter.replace", payload, () => AppApplication.recordMeterReplacementCommand(p.state, payload), { auditText: "Zählerwechsel dokumentiert", restorePoint: true });
        if (!result.ok) return alert(result.message);
        p.closeModal(true);
        p.rerender();
      };
    });
  }
  function renderRentalLifecycle(p) {
    AppLifecycleLedger.ensureLifecycleState(p.state);
    const m = AppApplication.lifecycleWorkspaceModel(p.state, { buildingId: p.activeBuildingId }), rows = m.ledger.rows.slice(-18).reverse(), unallocated = (p.state.payments || []).filter((x) => x.direction === "income" && remainingForPayment(p.state, x) > 0.01);
    p.host.innerHTML = `<div class="grid cards"><article class="card metric-card"><span>Mietverhältnisse</span><strong>${m.leases.length}</strong><small>${m.active ? `${p.esc(m.active.tenantName || "aktiv")}` : "aktuell keines"}</small></article><article class="card metric-card"><span>Offener Sollsaldo</span><strong>${p.euro(m.ledger.open)}</strong><small>explizites Mietkonto</small></article><article class="card metric-card"><span>Nicht zugeordnete Einnahmen</span><strong>${unallocated.length}</strong><small>noch im Mietkonto prüfen</small></article><article class="card metric-card"><span>Zählerwechsel</span><strong>${m.replacements.length}</strong><small>historisch verkettet</small></article></div>
  ${m.alerts.length ? `<section class="card"><div class="card-head"><div><p class="eyebrow">HANDLUNGSBEDARF</p><h3>${m.alerts.length} Lifecycle-Hinweis(e)</h3></div></div>${m.alerts.slice(0, 6).map((a) => `<div class="legal-warn"><strong>${p.esc(a.title)}</strong><br>${p.esc(a.detail)}</div>`).join("")}</section>` : "<div class='legal-ok'><strong>Lifecycle vollständig</strong><br>Aktuell fehlen keine Übergabe- oder Mietkonto-Schritte.</div>"}
  <section class="card"><div class="card-head"><div><p class="eyebrow">MIETVERHÄLTNISSE</p><h3>Historie statt Überschreiben</h3></div><button id="gAddTenancy" class="primary compact">Mietverhältnis</button></div><p class="muted">Mieterwechsel und Änderungen von Kaltmiete/BK werden mit Stichtag gespeichert. Alte Abrechnungsjahre behalten ihren damaligen Vertragsstand.</p></section>${m.leases.map((l) => tenancyCard(p, l)).join("") || "<div class='empty-state'><strong>Noch kein Mietverhältnis</strong><p>Lege das erste Mietverhältnis an.</p></div>"}
  <section class="card"><div class="card-head"><div><p class="eyebrow">MIETKONTO</p><h3>Monatliches Soll gegen echte Zahlungen</h3></div><div class="row"><button id="gAllocate" class="primary compact">Zahlung zuordnen</button><button id="gReverse" class="secondary compact">Rücklastschrift</button></div></div><div class="tablewrap"><table class="costtable"><thead><tr><th>Monat</th><th>Mieter/in</th><th>Soll</th><th>Zugeordnet</th><th>Differenz</th><th>Status</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${fmtMonth(r.month)}</td><td>${p.esc(r.tenantName)}</td><td>${p.euro(r.total)}</td><td>${p.euro(r.paid)}</td><td>${p.euro(r.difference)}</td><td><span class="pill ${statusClass(r.status)}">${statusLabel(r.status)}</span></td></tr>`).join("")}</tbody></table></div></section>
  <section class="card"><div class="card-head"><div><p class="eyebrow">ZÄHLER-LIFECYCLE</p><h3>Gerätewechsel ohne Verbrauchssprung</h3></div><button id="gReplaceMeter" class="primary compact">Zähler wechseln</button></div>${m.replacements.length ? m.replacements.map((r) => {
      const old = p.state.meters.find((x) => x.id === r.oldMeterId), fresh = p.state.meters.find((x) => x.id === r.newMeterId);
      return `<div class="fact-row"><span>${p.dateDE(r.date)} · ${p.esc(old?.name || r.role)}</span><strong>${p.esc(old?.number || "alt")} → ${p.esc(fresh?.number || "neu")}</strong></div>`;
    }).join("") : "<p class='muted'>Noch kein Zählerwechsel dokumentiert.</p>"}</section>
  <section class="card"><div class="card-head"><div><p class="eyebrow">ABRECHNUNGSVERSIONEN</p><h3>Revisionshistorie</h3></div><button id="gOpenBilling" class="secondary compact">Abrechnung öffnen</button></div>${m.snapshots.length ? m.snapshots.slice(0, 12).map((s) => `<div class="fact-row"><span>${s.periodYear} · ${p.esc(s.lease?.tenantName || "Mietverhältnis")} · Version ${Number(s.version || 1)}</span><strong>${p.euro(s.result)}</strong></div>`).join("") : "<p class='muted'>Noch keine eingefrorene Abrechnung vorhanden.</p>"}</section>`;
    q("gAddTenancy").onclick = () => openTenancy(p);
    q("gAllocate").onclick = () => openAllocation(p);
    q("gReverse").onclick = () => openReversal(p);
    q("gReplaceMeter").onclick = () => openReplacement(p);
    q("gOpenBilling").onclick = () => p.go("rental", "billing");
    document.querySelectorAll("[data-term]").forEach((b) => b.onclick = () => {
      const l = p.state.leases.find((x) => x.id === b.dataset.term);
      if (l) openTerm(p, l);
    });
    document.querySelectorAll("[data-close-tenancy]").forEach((b) => b.onclick = () => {
      const l = p.state.leases.find((x) => x.id === b.dataset.closeTenancy);
      if (l) openClose(p, l);
    });
    document.querySelectorAll("[data-handover]").forEach((b) => b.onclick = () => {
      const l = p.state.leases.find((x) => x.id === b.dataset.handover);
      if (l) openHandover(p, l);
    });
  }
  return __toCommonJS(rental_lifecycle_ui_exports);
})();

/* ===== schema.js ===== */
const {
  SCHEMA_VERSION,
  localDateISO,
  dateOnlyAddDays,
  localMonthEndISO,
  createEmptyState,
  validateState,
  normalizeState
}=AppState;

// Register the Service Worker before the first asynchronous startup wait.
// On fast page loads the window "load" event can fire while IndexedDB is still
// opening; registering only afterwards would permanently miss that event.
const SERVICE_WORKER_REGISTRATION=("serviceWorker" in navigator)
  ? navigator.serviceWorker.register("./service-worker.js",{updateViaCache:"none"}).catch(error=>{
      console.warn("Service Worker konnte nicht registriert werden:",error);
      return null;
    })
  : Promise.resolve(null);



/* ===== domain.js ===== */
const DOMAIN_VERSION=1;

const {
  normalizeMeterNumber,
  parseMeterReadingValue,
  meterNumericInterpretations,
  meterReadingCandidates,
  detectedMeterSerialCandidates,
  meterNumberComparable,
  editDistance,
  meterNumberSimilarity
}=AppMeterParsing;

const {
  positionDefaults,
  sourcePositions,
  positionById,
  migrateDomainState,
  ensureDefaultMeters,
  meterById,
  readingById,
  addMeterReading,
  matchMeterFromOCR,
  meterCandidateHistoryScore,
  rankMeterCandidates,
  analyzeMeterOCRText,
  latestMeterReading,
  meterReadingPlausibility,
  settlementByPeriod,
  settlementConsumption,
  positionToEvents,
  allocateCostPosition,
  centralBillingAnalysis,
  syncSimpleSourcePosition,
  replaceAssessmentPositions
}=AppPropertyDomain;

/* ===== integrity.js ===== */
const APP_VERSION="18.0.0";
const MAX_ERROR_LOG=100;
let LAST_STABLE_STATE=null;

const {
  cloneState,
  validateDomainState,
  repairDomainState,
  recordClientError,
  integritySummary,
  sha256Text,
  stableJSON,
  finalizeSnapshotIntegrity,
  blobSha256,
  documentFingerprint
}=AppIntegrity;
const {reconciliationSummary}=AppApplication;

/* ===== traceability.js ===== */
const TRACE_VERSION=1;
const COMMAND_VERSION=1;

const {
  ensureTraceShape,
  provenanceLabel,
  createRestorePoint,
  restoreFromPoint,
  executeCommand,
  documentWorkflowState,
  documentWorkflowLabel,
  documentsByWorkflow,
  traceForPosition,
  billingClosureChecklist,
  snapshotVerification
}=AppTraceability;

const APPLICATION_COMMAND_BUS=AppApplication.createCommandBus({
  getState:()=>state,
  setState:value=>{state=value},
  getLastStableState:()=>LAST_STABLE_STATE,
  setLastStableState:value=>{LAST_STABLE_STATE=value},
  cloneState,
  repairState:repairDomainState,
  validateState:validateDomainState,
  persist:(action,detail)=>persist(action,detail),
  recordError:(context,error)=>recordClientError(context,error),
  createRestorePoint,
  uid:()=>uid()
});
const applicationExecuteCommand=(type,payload,handler,options={})=>{
  const scopedPayload=payload&&typeof payload==="object"&&!Array.isArray(payload)
    ? {...payload,buildingId:activeBuildingId||payload.buildingId||""}
    : payload;
  return APPLICATION_COMMAND_BUS.executeCommand(type,scopedPayload,handler,options)
};

/* ===== intelligence.js ===== */
const {
  INTELLIGENCE_VERSION,
  normalizeLabelText,
  tokenSimilarity,
  daysDistance,
  dueDatesForPosition,
  paymentMatchScore,
  paymentMatchSuggestions,
  positionMonthlyEquivalent,
  predictedMonth,
  intelligentForecast,
  forecastSignals,
  extractDocumentIntelligence,
  validateDocumentTotals,
  documentConfidenceSummary,
  billingRecipient,
  splitAddressLines,
  formatRuleForReport,
  formatBillingRuleDetails,
  generateProfessionalBillingPDF
}=AppIntelligence;
/* ===== quality.js ===== */
const {
  QUALITY_VERSION,
  parseGermanNumber,
  parseFlexibleDate,
  csvDetectDelimiter,
  csvRows,
  bankHeaderIndex,
  parseBankCSV,
  paymentFingerprint,
  detectRentPayment,
  bankImportPreview,
  categoryLabel,
  periodCategoryTotals,
  annualComparison,
  costTrendAlerts,
  meterTrend,
  meterAnomalies,
  dataQualityScore
}=AppQuality;
/* ===== smart-engine.js ===== */
const {
  SMART_ENGINE_VERSION,
  smartToday,
  smartMonthKey,
  smartMonthOffset,
  smartMonthRange,
  activeLeaseInMonth,
  rentMonthStatus,
  rentMonitor,
  rentStatusLabel,
  latestBillingSnapshot,
  billingProjection
}=AppSmartEngine;
/* ===== V18 billing assistant preview ===== */
const {
  V18_ASSISTANT_VERSION,
  V18_EXPECTED_BILLING_CATEGORIES,
  v18CategoryForecast,
  v18BackupStatus,
  v18StatusWeight,
  v18StatusLabel,
  v18StatusClass,
  v18BillingAssistant,
  v18BillingAssistantHTML,
  bindV18AssistantActions,
  advanceAdjustmentSuggestion,
  billingDeadlineInsights,
  sourceExpectedAmounts,
  sourcePaymentMatchScore,
  smartPaymentSuggestions,
  smartPaymentPlan,
  medianValue,
  robustMeterAnomalies,
  smartDataAnomalies,
  historicalAssignmentPrediction,
  smartClassifyCostText,
  cleanProposalLabel,
  smartGenericPositionProposals,
  enrichDocumentProposalsSmart,
  smartDocumentSummary,
  smartTaskSuggestions,
  smartInsights,
  DECISION_UI_VERSION,
  confidenceBand,
  qualityBand,
  decisionSeverityWeight,
  decisionActionLabel,
  decisionKind,
  smartDecisionQueue,
  decisionWhyHTML,
  rentAttentionDay,
  smartSummaryText,
  smartAnswer
}=AppV18Assistant;
/* ===== legal-rules.js ===== */
const LAW_DATE=AppLegalRules.LAW_DATE;
const LEGAL_SOURCES=AppLegalRules.LEGAL_SOURCES;
const CATEGORIES=AppLegalRules.CATEGORIES;
let ACTIVE_LEGAL_PACK=null;
const {
  category,
  loadLegalPack,
  legalDecision
}=AppLegalRules;

/* ===== domain.js ===== */

const {
  euro,
  dateDE,
  intervalLabel,
  assignmentLabel,
  agreementLabel,
  confidencePercent,
  percent,
  uid,
  periodStart,
  periodEnd,
  periodLabel,
  periodBillingTargetISO,
  periodBillingTarget,
  periodDeadlineISO,
  periodDeadline,
  currentPeriodYear,
  preferredBillingYear,
  billingSelectableYears,
  selectedBillingYear,
  billingTakeoverDate,
  billingPeriodInfo,
  billingPeriodStart,
  billingPeriodLabel,
  billingPeriodContext,
  dateOnlyUtcValue,
  calendarDayDiff,
  overlapDays,
  daysInclusive,
  unitByType,
  currentPersons,
  shares,
  personDays,
  personShareForPeriod,
  monthlyAdvanceInPeriod,
  paymentAdvanceForLease,
  actualAdvanceEvidenceInPeriod,
  actualAdvanceInPeriod,
  billingAnalysis,
  billingReadiness,
  paymentMonthKey,
  actualCashflowByMonth,
  snapshotFor,
  createBillingSnapshot
}=AppBillingDomain;

/* ===== db.js ===== */

const {
  DB_NAME,
  DB_VERSION,
  STATE_ID,
  openDB,
  addDocument:addDocumentRecord,
  getDocument:getDocumentRecord,
  listDocuments:listAllDocuments,
  deleteDocument:deleteDocumentRecord,
  updateDocument:updateDocumentRecord,
  replaceDocuments:replaceAllDocuments
}=AppPersistence;
const {readStateRecord,saveState}=AppPortfolioRepository;

const {loadApplicationState}=AppApplication;

async function loadState(){
  const result=await loadApplicationState({
    readStateRecord,
    saveState,
    createEmptyState,
    repairState:repairDomainState,
    validateState:validateDomainState
  });
  LAST_STABLE_STATE=cloneState(result.state);
  return result.state
}

function documentBelongsToActiveBuilding(document){
  if(!document)return false;
  const buildingId=String(document.buildingId||"");
  if(buildingId)return buildingId===activeBuildingId;
  const primary=String(portfolioState?.meta?.primaryBuildingId||state?.meta?.primaryBuildingId||"");
  return !!activeBuildingId&&activeBuildingId===primary
}
async function addDocument(document){
  return addDocumentRecord({...document,buildingId:document?.buildingId||activeBuildingId||""})
}
async function getDocument(id){
  const document=await getDocumentRecord(id);
  return documentBelongsToActiveBuilding(document)?document:null
}
async function listDocuments(){
  return (await listAllDocuments()).filter(documentBelongsToActiveBuilding)
}
async function deleteDocument(id){
  const document=await getDocumentRecord(id);
  if(!documentBelongsToActiveBuilding(document))throw new Error("Dokument gehört zu einem anderen Gebäude.");
  return deleteDocumentRecord(id)
}
async function updateDocument(document){
  const existing=document?.id?await getDocumentRecord(document.id):null;
  if(existing&&!documentBelongsToActiveBuilding(existing))throw new Error("Dokument gehört zu einem anderen Gebäude.");
  return updateDocumentRecord({...document,buildingId:document?.buildingId||activeBuildingId||""})
}
const replaceDocuments=replaceAllDocuments;
/* ===== security.js ===== */

const {
  authCredentialId,
  authEnabled,
  registerDevice,
  authenticate,
  disableAuth
}=AppAuth;

/* ===== backup.js ===== */

async function createFullBackup(state,password){
  const docs=await listAllDocuments();
  return AppBackupCodec.createFullBackup(state,password,docs)
}

const {decodeFullBackup}=AppBackupCodec;

/* ===== TypeScript source src/ui/app-runtime.ts · outer-scope injection ===== */
// @ts-nocheck -- Browser compatibility shell; keep shrinking via modular TypeScript extraction.
/* Diese TypeScript-Quelle wird ohne zusätzliche Closure in den äußeren Browser-Runtime-Scope injiziert. */
/* Validierung und Regressionen laufen über CI, Architekturtests und Playwright. */
/* Zustandslose UI-Helfer liegen in src/ui/ui-core.ts; Dialogzustand und -steuerung bleiben als Live-Bindings zusammen. */

const {
  $,
  esc,
  focusableIn,
  visibleDialog,
  trapFocusInDialog,
  formField,
  clearCentralValidation,
  centralFieldLabel,
  markCentralError,
  validateCentralForm
}=AppUiCore;

let MODAL_RETURN_FOCUS=null,MODAL_INITIAL_FORM="",MODAL_RETURN_FOCUS_OVERRIDE=null;
function formSnapshot(root){
  const form=root?.querySelector?.("form");if(!form)return"";
  return JSON.stringify([...new FormData(form).entries()])
}
function closeModal(force=false){
  const host=$("modal");if(!host||host.classList.contains("hidden"))return true;
  if(!force&&MODAL_INITIAL_FORM&&formSnapshot(host)!==MODAL_INITIAL_FORM&&!confirm("Ungespeicherte Änderungen verwerfen?"))return false;
  host.classList.add("hidden");
  const back=MODAL_RETURN_FOCUS;MODAL_RETURN_FOCUS=null;MODAL_INITIAL_FORM="";
  setTimeout(()=>back?.focus?.(),0);return true
}
function modal(title,html,onReady){
  MODAL_RETURN_FOCUS=MODAL_RETURN_FOCUS_OVERRIDE||document.activeElement;
  MODAL_RETURN_FOCUS_OVERRIDE=null;
  $("modalTitle").textContent=title;$("modalBody").innerHTML=html;$("modal").classList.remove("hidden");
  $("modalClose").onclick=()=>closeModal(false);
  onReady?.();
  MODAL_INITIAL_FORM=formSnapshot($("modal"));
  const candidates=focusableIn($("modal")).filter(x=>x.id!=="modalClose");
  setTimeout(()=>candidates[0]?.focus?.(),30)
}

/* ===== app.js ===== */








const ACTIVE_BUILDING_STORAGE_KEY=AppPresentation.ACTIVE_BUILDING_STORAGE_KEY;
let storageError=null;
let portfolioState;
let activeBuildingId="";
let state;

function storedBuildingId(){
  try{return localStorage.getItem(ACTIVE_BUILDING_STORAGE_KEY)||""}catch{return""}
}
function rememberBuildingId(value){
  try{if(value)localStorage.setItem(ACTIVE_BUILDING_STORAGE_KEY,value)}catch{}
}
function projectActiveState(master,requested=""){
  activeBuildingId=AppPresentation.resolveActiveBuildingId(master,requested||activeBuildingId);
  const projected=AppPresentation.projectStateForBuilding(master,activeBuildingId);
  rememberBuildingId(activeBuildingId);
  return projected
}
function fullPortfolioState(){
  return AppPresentation.mergeStateFromBuilding(portfolioState,state,activeBuildingId)
}
function applyRestoredPortfolioState(value){
  portfolioState=repairDomainState(value);
  state=projectActiveState(portfolioState,activeBuildingId);
  LAST_STABLE_STATE=cloneState(state)
}

try{
  portfolioState=repairDomainState(await loadState());
  state=projectActiveState(portfolioState,storedBuildingId());
  LAST_STABLE_STATE=cloneState(state);
}catch(e){
  storageError=e;
  console.error("IndexedDB-Startfehler:",e);
  portfolioState=repairDomainState(createEmptyState());
  state=projectActiveState(portfolioState);
  state.meta.storageWarning=String(e?.message||e);
}
const {ROUTE_LABELS,DEFAULT_SUB,SUB_PARENT,normalizeSub,visibleSub,parseRouteHash,routeHash}=AppPresentation;
let route="home";
let sub={...DEFAULT_SUB};

function syncRouteFromHash(){
  const parsed=parseRouteHash(location.hash);
  route=parsed.route;
  if(route!=="home")sub[route]=parsed.sub
}
function go(r,s=null){
  if(!ROUTE_LABELS[r])r="home";
  route=r;
  if(r!=="home"&&s)sub[r]=normalizeSub(r,s);
  const target=routeHash(r,r==="home"?null:sub[r]);
  if(location.hash!==target)location.hash=target;else render()
}
function goTop(r){go(r,r==="home"?null:DEFAULT_SUB[r])}
function goSub(group,id){sub[group]=normalizeSub(group,id);go(group,sub[group])}
syncRouteFromHash();
window.addEventListener("hashchange",()=>{syncRouteFromHash();render();window.scrollTo({top:0,left:0,behavior:"auto"})});

function audit(action,detail){
  state.audit.unshift({id:uid(),at:new Date().toISOString(),revision:Number(state.meta?.revision||0)+1,action,detail});
  state.audit=state.audit.slice(0,500)
}
async function persist(action,detail){
  const before=LAST_STABLE_STATE?cloneState(LAST_STABLE_STATE):null;
  try{
    state=repairDomainState(state);
    const scopedCheck=validateDomainState(state);if(scopedCheck.errors.length)throw new Error("Datenintegrität: "+scopedCheck.errors.join(" · "));
    if(action)audit(action,detail);
    state.meta.revision=Number(state.meta?.revision||0)+1;state.meta.lastSavedAt=new Date().toISOString();state.meta.lastIntegrityCheckAt=new Date().toISOString();
    const merged=repairDomainState(fullPortfolioState()),fullCheck=validateDomainState(merged);
    if(fullCheck.errors.length)throw new Error("Portfolio-Integrität: "+fullCheck.errors.join(" · "));
    await saveState(merged);
    portfolioState=merged;
    state=projectActiveState(portfolioState,activeBuildingId);
    LAST_STABLE_STATE=cloneState(state);storageError=null;try{await updateBadge()}catch{};if(action)AppFeedback.showToast(action,{kind:"success"});return true
  }catch(e){
    recordClientError("persist",e);storageError=e;console.error("Speicher-/Integritätsfehler:",e);
    if(before){state=before;LAST_STABLE_STATE=cloneState(before)}
    AppFeedback.showToast("Speichern fehlgeschlagen – Änderung wurde zurückgenommen.",{kind:"error",timeoutMs:5000});
    alert("Die Änderung wurde nicht gespeichert und zurückgenommen: "+String(e.message||e));try{render()}catch{};return false
  }
}

function nav(){
  document.querySelectorAll(".main-tabs button").forEach(b=>{
    const active=b.dataset.route===route;b.classList.toggle("active",active);
    if(active)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current")
  });
  AppBuildingWorkspaceUi.renderBuildingSwitcher();
  const ctx=$("pageContext");if(ctx)ctx.textContent=route==="home"?(state.property?.name||"Start"):ROUTE_LABELS[route];
  const building=state.property?.name?` · ${state.property.name}`:"";
  document.title=`${ROUTE_LABELS[route]||"Mietverwaltung"}${building} · Mietverwaltung`
}
function taskList(){
  return AppApplication.queryTaskList(state,{buildingId:activeBuildingId},smartToday())
}
function daysUntil(d){const x=calendarDayDiff(smartToday(),d);return Number.isFinite(x)?x:0}
function taskHTML(t){
  const d=daysUntil(t.due),cls=d<0?"bad":d<=Number(t.lead||30)?"warn":"good",origin=t.origin==="source"?"aus Fälligkeit":t.origin==="billing"?"eigene Zielfrist 31.03.":t.origin==="smart"?"vorgeschlagen":"eigene Erinnerung";
  return `<div class="task premium-task"><div><h4>${esc(t.title)}</h4><small>${dateDE(t.due)} · ${esc(origin)}</small></div><span class="pill ${cls}">${d<0?`${Math.abs(d)} Tage überfällig`:d===0?"heute":`in ${d} Tagen`}</span></div>`
}

function render(){
  nav();
  if(route==="home")home();
  else if(route==="data")dataWorkspace();
  else if(route==="rental")rentalWorkspace();
  else if(route==="owner")ownerWorkspace();
  else more();
}

function workspaceHeader(eyebrow,title,description,tabs,active){
  return `<section class="workspace">
    <div class="section-head workspace-head"><div><p class="eyebrow">${esc(eyebrow)}</p><h2>${esc(title)}</h2><p class="muted">${esc(description)}</p></div></div>
    <div class="workspace-layout">
      <aside class="workspace-sidebar" aria-label="${esc(title)} Navigation">
        <p class="workspace-nav-title">Bereiche</p>
        ${tabs.map(i=>`<button data-workspace-sub="${i.id}" class="${i.id===active?"active":""}">${i.icon?`<span class="nav-symbol">${i.icon}</span>`:""}<span>${esc(i.label)}</span></button>`).join("")}
      </aside>
      <div class="workspace-content">
        <label class="workspace-mobile-picker"><span>Bereich</span><select id="workspaceSelect">${tabs.map(i=>`<option value="${esc(i.id)}" ${i.id===active?"selected":""}>${esc(i.label)}</option>`).join("")}</select></label>
        <div id="workspaceBody"></div>
      </div>
    </div>
  </section>`
}
function bindWorkspaceTabs(group,renderer){
  document.querySelectorAll("[data-workspace-sub]").forEach(b=>b.onclick=()=>goSub(group,b.dataset.workspaceSub));
  const picker=$("workspaceSelect");if(picker)picker.onchange=e=>goSub(group,e.target.value)
}


const CHECK_INPUT_MAP={
  "Objektname fehlt":{route:"data",sub:"property",label:"Objektname"},
  "Gesamtwohnfläche fehlt":{route:"data",sub:"property",label:"Gesamtwohnfläche"},
  "Eigennutzungs-Einheit fehlt":{route:"data",sub:"units",label:"Eigennutzung"},
  "Mietwohnung fehlt":{route:"data",sub:"units",label:"Mietwohnung"},
  "Mietvertrag fehlt":{route:"rental",sub:"overview",label:"Mietvertrag"},
  "Keine bestätigte Kostenposition für diese Abrechnungsperiode":{route:"data",sub:"positions",label:"Kostenpositionen"},
  "Wasserzähler / Verbrauchsdaten fehlen":{route:"rental",sub:"water",label:"Wasserzähler"},
  "Ungeklärte Umlageentscheidungen":{route:"data",sub:"positions",label:"Umlageentscheidung"}
};

function checkInputCoverage(){
  const missing=[],routeTabs={
    data:["overview","object","property","units","costs","sources","positions","infrastructure","assessment","documents"],
    rental:["overview","lease","water","billing","calculation","workflow"],
    owner:["overview","payments","cashflow","reconciliation","planning","finance","analytics","tasks"],
    more:["smart","legal","protection","security","backup","recovery","app","audit","diagnostics","overview"]
  };
  for(const [issue,m] of Object.entries(CHECK_INPUT_MAP))if(!routeTabs[m.route]?.includes(m.sub))missing.push(`${issue} → ${m.route}/${m.sub}`);
  for(const c of billingReadiness(state,currentPeriodYear()))if(!CHECK_INPUT_MAP[c.label])missing.push(`${c.label} → keine Eingabezuordnung`);
  return [...new Set(missing)]
}

function home(){
  const quality=dataQualityScore(state),qBand=qualityBand(quality),forecast=intelligentForecast(state),rent=state.leases.reduce((s,l)=>s+Number(l.rent||0),0),repay=Number(state.finance.repayment||0),rateAfterRent=repay-rent,a=billingAnalysis(state,currentPeriodYear()),sh=shares(state,billingPeriodStart(state,currentPeriodYear())),water=settlementConsumption(state,settlementByPeriod(state,currentPeriodYear())),decisions=smartDecisionQueue(state),next=decisions[0]||null,rentNow=rentMonthStatus(state),proj=billingProjection(state),v18=v18BillingAssistant(state,preferredBillingYear());
  $("app").innerHTML=`<section class="home-view">${storageError?`<div class="legal-warn"><strong>Lokaler Speicher eingeschränkt</strong><br>${esc(storageError.message||storageError)}</div>`:""}
  <div class="hero experience-hero"><div><p class="eyebrow">START</p><h2>Dein Haus auf einen Blick</h2><p class="muted">${esc(state.property.name||"Hausverwaltung")} · ${esc(billingPeriodLabel(state,currentPeriodYear()))}</p></div><div class="quality-orb quality-${qBand.id}" title="Datenqualität ${quality}%"><strong>${esc(qBand.label)}</strong><small>Datenstatus</small></div></div>
  <div class="quick-actions-bar"><button data-home-action="document"><span class="quick-symbol">▤</span><span><strong>Dokument</strong><small>erfassen</small></span></button><button data-home-action="meter"><span class="quick-symbol">◌</span><span><strong>Zähler</strong><small>ablesen</small></span></button><button data-home-action="payment"><span class="quick-symbol">€</span><span><strong>Zahlung</strong><small>erfassen</small></span></button><button data-home-action="billing"><span class="quick-symbol">✓</span><span><strong>Abrechnung</strong><small>prüfen</small></span></button></div>
  ${v18BillingAssistantHTML(state,v18.year,{compact:true})}
  ${next?`<section class="next-best-action decision-${next.severity}"><div><p class="eyebrow">NÄCHSTER SINNVOLLER SCHRITT</p><h3>${esc(next.title)}</h3><p>${esc(next.detail||"")}</p><div class="decision-meta"><span class="decision-kind">${esc(next.kind)}</span><span class="confidence confidence-${next.band.id}">${esc(next.band.short)}</span></div>${decisionWhyHTML(next)}</div><button id="openNextDecision" class="primary">${esc(next.actionLabel)}</button></section>`:`<div class="legal-ok experience-ok"><strong>Alles Wesentliche ist im grünen Bereich.</strong><br>Aktuell gibt es keinen dringenden nächsten Schritt.</div>`}
  <div class="grid cards overview-cards"><article class="card metric-card"><span>Hausrate</span><strong>${euro(repay)}</strong><small>monatlich</small></article><article class="card metric-card"><span>Kaltmiete</span><strong>${euro(rent)}</strong><small>monatlich</small></article><article class="card metric-card"><span>Hausrate nach Kaltmiete</span><strong class="${rateAfterRent>0?"negative":"positive"}">${euro(rateAfterRent)}</strong><small>ohne weitere Hauskosten</small></article><article class="card metric-card"><span>Mieter-BK aktuell</span><strong>${euro(a.tenantCosts)}</strong><small>bestätigter Stand</small></article></div>
  ${decisions.length>1?`<div class="card priority-card"><div class="card-head"><div><p class="eyebrow">WEITERE HINWEISE</p><h3>${decisions.length-1} weitere Punkte</h3></div><button class="secondary compact" id="openSmart">Alle ansehen</button></div>${decisions.slice(1,4).map((x,i)=>`<button class="decision-row" data-smart-home="${i+1}"><span><strong>${esc(x.title)}</strong><small>${esc(x.detail||"")}</small></span><span class="confidence confidence-${x.band.id}">${esc(x.band.short)}</span></button>`).join("")}</div>`:""}
  <div class="grid two-up"><div class="card"><p class="eyebrow">VERTEILUNG</p><h3>Aktuelle Anteile</h3><div class="fact-row"><span>Wohnfläche Mieterin</span><strong>${percent(sh.area)}</strong></div><div class="fact-row"><span>Kaltwasseranteil</span><strong>${water?.valid?percent(water.share):"noch offen"}</strong></div><div class="fact-row"><span>Umlagefähige Kosten</span><strong>${euro(a.tenantCosts)}</strong></div></div><div class="card"><p class="eyebrow">STATUS</p><h3>Vermietung</h3><div class="fact-row"><span>Mietzahlung</span><strong>${rentNow.status==="none"?"–":esc(rentStatusLabel(rentNow))}</strong></div><div class="fact-row"><span>Abrechnungsprognose</span><strong>${euro(Math.abs(proj.projectedResult))}</strong></div><div class="fact-row"><span>Einordnung</span><strong>${proj.projectedResult>=0?"Nachzahlung":"Guthaben"}</strong></div></div></div>
  <div class="card"><div class="card-head"><div><p class="eyebrow">PROGNOSE</p><h3>Nächste vier Monate</h3></div><button class="secondary compact" id="openPlanning">Planung öffnen</button></div><div class="tablewrap"><table class="costtable"><thead><tr><th>Monat</th><th>Einnahmen</th><th>Ausgaben</th><th>Saldo</th></tr></thead><tbody>${forecast.slice(0,4).map(x=>`<tr><td>${x.label}</td><td>${euro(x.income)}</td><td>${euro(x.outflow)}</td><td class="${x.net<0?"negative":"positive"}">${euro(x.net)}</td></tr>`).join("")}</tbody></table></div></div></section>`;
  if($("openNextDecision"))$("openNextDecision").onclick=()=>go(next.route,next.sub||DEFAULT_SUB[next.route]);
  if($("openSmart"))$("openSmart").onclick=()=>go("more","smart");$("openPlanning").onclick=()=>go("owner","planning");
  document.querySelectorAll("[data-smart-home]").forEach(b=>b.onclick=()=>{const x=decisions[Number(b.dataset.smartHome)];if(x)go(x.route,x.sub||DEFAULT_SUB[x.route])});
  document.querySelectorAll("[data-home-action]").forEach(b=>b.onclick=()=>{const a=b.dataset.homeAction;if(a==="document"){go("data","documents");setTimeout(openDocumentCapture,0)}else if(a==="meter"){go("data","infrastructure");setTimeout(()=>openMeterPhotoCapture(),0)}else if(a==="payment"){go("owner","cashflow");setTimeout(openPaymentEditor,0)}else go("rental","billing")});
  bindV18AssistantActions()
}




function hubAction(id,title,detail,badge=""){
  return `<button class="hub-action" data-hub-action="${id}"><span><strong>${esc(title)}</strong><small>${esc(detail)}</small></span>${badge?`<b>${esc(badge)}</b>`:""}<span class="chevron">›</span></button>`
}
async function houseOverviewView(){
  let docs=state.documentsCache||[];
  try{docs=await listDocuments();state.documentsCache=docs}catch{}
  if(route!=="data"||sub.data!=="overview")return;
  const owner=unitByType(state,"owner"),rental=unitByType(state,"rental"),openDocs=docs.filter(d=>documentWorkflowState(d)!=="done").length,takeover=state.property.billingTakeoverDate||state.property.ownershipEffective||"";
  $("workspaceBody").innerHTML=`<div class="grid cards overview-cards">
    <article class="card"><span>Wohnfläche gesamt</span><strong>${Number(state.property.totalArea||0).toLocaleString("de-DE")} m²</strong><small>${owner&&rental?`${owner.area} + ${rental.area} m²`:"Einheiten prüfen"}</small></article>
    <article class="card"><span>Kostenpositionen</span><strong>${state.costPositions.length}</strong><small>${state.costPositions.filter(p=>p.confirmed).length} bestätigt</small></article>
    <article class="card"><span>Zähler</span><strong>${state.meters.length}</strong><small>${state.meters.reduce((s,m)=>s+(m.readings?.length||0),0)} Ablesungen</small></article>
    <article class="card"><span>Dokumente offen</span><strong>${openDocs}</strong><small>${docs.length} insgesamt</small></article>
  </div>
  <section class="card embedded-overview-card">
    <div class="card-head"><div><p class="eyebrow">STAMMDATEN</p><h3>Objekt & Einheiten</h3></div><div class="row"><button class="secondary compact" id="manageBuildingsOverview">Gebäude verwalten</button><button class="secondary compact" id="editPropertyOverview">Objektdaten bearbeiten</button></div></div>
    <div class="fact-row"><span>Objekt</span><strong>${esc(state.property.name||"noch nicht benannt")}</strong></div>
    <div class="fact-row"><span>Adresse</span><strong>${esc(state.property.address||"fehlt")}</strong></div>
    <div class="fact-row"><span>Gesamtwohnfläche</span><strong>${state.property.totalArea?`${state.property.totalArea} m²`:"fehlt"}</strong></div>
    <div class="fact-row"><span>Eigennutzung</span><strong>${owner?`${esc(owner.name)} · ${owner.area} m²`:"fehlt"}</strong></div>
    <div class="fact-row"><span>Mietwohnung</span><strong>${rental?`${esc(rental.name)} · ${rental.area} m²`:"fehlt"}</strong></div>
    ${takeover?`<div class="fact-row"><span>Abrechnung übernommen</span><strong>${dateDE(takeover)}</strong></div>`:""}
    <button class="secondary wide" id="editUnitsOverview">Einheiten bearbeiten</button>
  </section>
  <div class="card">
    ${hubAction("costs","Kosten","Bescheide, Rechnungen, Kostenpositionen und Umlage",String(state.costPositions.length))}
    ${hubAction("infrastructure","Zähler","Wasserzähler, Ablesungen und Abfallbehälter",String(state.meters.length))}
    ${hubAction("documents","Dokumente","Belege, PDFs und OCR-Analyse",openDocs?`${openDocs} offen`:"")}
  </div>`;
  $("manageBuildingsOverview").onclick=()=>AppBuildingWorkspaceUi.openBuildingManager();
  $("editPropertyOverview").onclick=()=>goSub("data","property");
  $("editUnitsOverview").onclick=()=>goSub("data","units");
  document.querySelectorAll("[data-hub-action]").forEach(b=>b.onclick=()=>goSub("data",b.dataset.hubAction))
}
function houseObjectHubView(){
  const owner=unitByType(state,"owner"),rental=unitByType(state,"rental");
  $("workspaceBody").innerHTML=`<div class="grid two-up">
    <article class="card"><p class="eyebrow">OBJEKT</p><h3>${esc(state.property.name||"Haus")}</h3><p>${esc(state.property.address||"Adresse fehlt")}</p><div class="fact-row"><span>Gesamtwohnfläche</span><strong>${state.property.totalArea?`${state.property.totalArea} m²`:"fehlt"}</strong></div><div class="fact-row"><span>Baujahr Stammgebäude</span><strong>${esc(state.property.year||"–")}</strong></div><button class="secondary wide" data-house-detail="property">Objektdaten bearbeiten</button></article>
    <article class="card"><p class="eyebrow">EINHEITEN</p><h3>${state.units.length} Einheiten</h3><div class="fact-row"><span>Eigennutzung</span><strong>${owner?`${owner.area} m²`:"fehlt"}</strong></div><div class="fact-row"><span>Mietwohnung</span><strong>${rental?`${rental.area} m²`:"fehlt"}</strong></div><button class="secondary wide" data-house-detail="units">Einheiten verwalten</button></article>
  </div>
  <div class="info-strip"><strong>Warum hier zusammen?</strong><span>Objekt- und Einheitendaten bilden gemeinsam die Grundlage für Flächenanteile und Abrechnungen.</span></div>`;
  document.querySelectorAll("[data-house-detail]").forEach(b=>b.onclick=()=>goSub("data",b.dataset.houseDetail))
}
function houseCostsHubView(){
  const y=currentPeriodYear(),sources=state.sources.length,positions=state.costPositions.length,open=state.costPositions.filter(p=>p.assignment==="review"||!p.confirmed).length;
  $("workspaceBody").innerHTML=`<div class="grid cards">
    <article class="card"><span>Kostenquellen</span><strong>${sources}</strong><small>Bescheide, Rechnungen, Verträge</small></article>
    <article class="card"><span>Kostenpositionen</span><strong>${positions}</strong><small>${open} zu prüfen</small></article>
    <article class="card"><span>Abrechnungsperiode</span><strong>${esc(billingPeriodLabel(state,y))}</strong><small>aktiver Zeitraum</small></article>
  </div>
  <div class="card">
    ${hubAction("sources","Kostenquellen","Anbieter, Bescheide und Fälligkeiten",String(sources))}
    ${hubAction("positions","Kostenpositionen","Umlage, Zeitraum, Betrag und Herkunft",open?`${open} offen`:"")}
    ${hubAction("assessment","Grundbesitzabgaben","Kommunale Abgaben strukturiert verwalten")}
  </div>`;
  document.querySelectorAll("[data-hub-action]").forEach(b=>b.onclick=()=>goSub("data",b.dataset.hubAction))
}
function financePaymentsHubView(){
  const rows=actualCashflowByMonth(state,12),income=rows.reduce((s,r)=>s+r.income,0),outflow=rows.reduce((s,r)=>s+r.outflow,0),matches=smartPaymentPlan(state);
  $("workspaceBody").innerHTML=`<div class="grid cards">
    <article class="card"><span>Einnahmen 12M</span><strong>${euro(income)}</strong></article>
    <article class="card"><span>Ausgaben 12M</span><strong>${euro(outflow)}</strong></article>
    <article class="card"><span>Zuordnungsvorschläge</span><strong>${matches.length}</strong><small>plausible offene Treffer</small></article>
  </div><div class="card">
    ${hubAction("cashflow","Zahlungen & Kontoimport","Buchungen erfassen, CSV importieren und Verlauf ansehen")}
    ${hubAction("reconciliation","Zahlungen zuordnen","Ausgaben mit Kostenquellen und Positionen verknüpfen",matches.length?String(matches.length):"")}
  </div>`;
  document.querySelectorAll("[data-hub-action]").forEach(b=>b.onclick=()=>goSub("owner",b.dataset.hubAction))
}
function financePlanningHubView(){
  const f=intelligentForecast(state,12),sum=f.reduce((s,x)=>s+x.net,0),alerts=costTrendAlerts(state,currentPeriodYear());
  $("workspaceBody").innerHTML=`<div class="grid cards">
    <article class="card"><span>12M-Cashflow</span><strong class="${sum<0?"negative":"positive"}">${euro(sum)}</strong><small>geplanter Gesamtsaldo</small></article>
    <article class="card"><span>Kostenhinweise</span><strong>${alerts.length}</strong><small>auffällige Veränderungen</small></article>
  </div><div class="card">
    ${hubAction("finance","Planung & Hauskosten","Hausrate, feste Kosten und 12-Monats-Prognose")}
    ${hubAction("analytics","Jahresvergleich & Verbrauch","Kostenentwicklung und Zählertrends",alerts.length?String(alerts.length):"")}
  </div>`;
  document.querySelectorAll("[data-hub-action]").forEach(b=>b.onclick=()=>goSub("owner",b.dataset.hubAction))
}
function protectionHubView(){
  const points=state.meta?.restorePoints?.length||0,last=state.meta?.lastBackupAt?new Date(state.meta.lastBackupAt).toLocaleDateString("de-DE"):"keine";
  $("workspaceBody").innerHTML=`<div class="grid cards">
    <article class="card"><span>Geräteschutz</span><strong>${authEnabled()?"Aktiv":"Aus"}</strong><small>Face ID / Geräteauthentifizierung</small></article>
    <article class="card"><span>Letzte Datensicherung</span><strong>${esc(last)}</strong><small>verschlüsselte Vollsicherung</small></article>
    <article class="card"><span>Sicherungspunkte</span><strong>${points}</strong><small>lokale Rücksprungstände</small></article>
  </div><div class="card">
    ${hubAction("security","Geräteschutz","Face ID / Geräteauthentifizierung verwalten")}
    ${hubAction("backup","Datensicherung","Verschlüsselte Sicherung erstellen oder wiederherstellen")}
    ${hubAction("recovery","Sicherungspunkte","Lokale Rücksprungstände verwalten",points?String(points):"")}
  </div>`;
  document.querySelectorAll("[data-hub-action]").forEach(b=>b.onclick=()=>goSub("more",b.dataset.hubAction))
}
function appManagementHubView(){
  const errors=state.meta?.errorLog?.length||0;
  $("workspaceBody").innerHTML=`<div class="card"><p class="eyebrow">SELTENER BENÖTIGT</p><h3>Erweitert</h3><p class="muted">Rechtsstand, Änderungsverlauf und technische Prüfungen bleiben erreichbar, ohne die tägliche Navigation zu belasten.</p></div>
  <div class="card">
    ${hubAction("legal","Recht & Regeln","Hinterlegte Rechtsgrundlagen und Prüfstand")}
    ${hubAction("audit","Änderungsverlauf","Nachvollziehen, was wann geändert wurde")}
    ${hubAction("diagnostics","App-Prüfung","Datenintegrität, Speicher, Tests und technische Details",errors?`${errors} Fehler`:"")}
  </div>`;
  document.querySelectorAll("[data-hub-action]").forEach(b=>b.onclick=()=>goSub("more",b.dataset.hubAction))
}

function dataWorkspace(){
  const tabs=[
    {id:"overview",label:"Überblick",icon:"⌂"},
    {id:"costs",label:"Kosten",icon:"€"},
    {id:"infrastructure",label:"Zähler",icon:"◌"},
    {id:"documents",label:"Dokumente",icon:"▤"}
  ];
  const active=sub.data||"overview",visible=visibleSub("data",active);
  $("app").innerHTML=workspaceHeader("HAUS","Haus","Objekt, Kosten, Zähler und Belege an einem Ort.",tabs,visible);
  bindWorkspaceTabs("data",dataWorkspace);
  if(active==="overview")houseOverviewView();
  else if(active==="object")houseObjectHubView();
  else if(active==="costs")houseCostsHubView();
  else if(active==="property")propertyView();
  else if(active==="units")unitsDataView();
  else if(active==="sources")sourcesDataView();
  else if(active==="positions")costPositionsDataView();
  else if(active==="assessment")assessmentDataView();
  else if(active==="infrastructure")infrastructureDataView();
  else documentsDataView()
}
function propertyView(){
  const takeover=state.property.billingTakeoverDate||state.property.ownershipEffective||"",pred=state.property.predecessorBillingEnd||"";
  $("workspaceBody").innerHTML=`<form id="propertyForm" class="card form-grid">
    ${formField({name:"name",label:"Objektname",value:state.property.name||"",placeholder:"z. B. Zweifamilienhaus"})}
    ${formField({name:"address",label:"Adresse",value:state.property.address||"",placeholder:"Straße, Hausnummer, Ort"})}
    ${formField({name:"totalArea",label:"Gesamtwohnfläche m²",type:"number",step:"0.01",min:0,value:state.property.totalArea||""})}
    ${formField({name:"year",label:"Baujahr Stammgebäude",type:"number",min:1800,value:state.property.year||""})}
    <div class="full section-separator"><h3>Abrechnungsrhythmus</h3><p class="muted">Abgerechnet wird immer nach Kalenderjahr 01.01.–31.12. Bei einer Übernahme mitten im Jahr beginnt nur die erste eigene Periode am Übernahmedatum; ab dem Folgejahr gilt wieder 01.01.–31.12.</p></div>
    ${formField({name:"billingTakeoverDate",label:"Abrechnung übernommen am",type:"date",value:takeover})}
    ${formField({name:"predecessorBillingEnd",label:"Voreigentümer rechnet bis",type:"date",value:pred})}
    <div class="full" id="billingPeriodPreview"></div>
    <div class="full section-separator"><h3>Abrechnung & Korrespondenz</h3></div>
    ${formField({name:"landlordName",label:"Absender / Vermieter",value:state.correspondence.landlordName||""})}
    ${formField({name:"landlordAddress",label:"Absenderadresse",value:state.correspondence.landlordAddress||"",full:true})}
    ${formField({name:"iban",label:"IBAN für Nachzahlungen",value:state.correspondence.iban||""})}
    ${formField({name:"paymentReference",label:"Verwendungszweck",value:state.correspondence.paymentReference||""})}
    ${formField({name:"contact",label:"Kontakt für Rückfragen",value:state.correspondence.contact||""})}
    <div class="full"><button class="primary">Objektdaten speichern</button></div>
  </form>`;
  const preview=()=>{const v=Object.fromEntries(new FormData($("propertyForm"))),tmp=structuredClone(state);tmp.property.billingTakeoverDate=v.billingTakeoverDate||"";tmp.property.predecessorBillingEnd=v.predecessorBillingEnd||"";
    const y=currentPeriodYear(),ctx=billingPeriodContext(tmp,y),p=billingPeriodInfo(tmp,y);$("billingPeriodPreview").innerHTML=`<div class="${ctx.kind==="takeover"?"info":"legal-ok"}"><strong>${esc(billingPeriodLabel(tmp,y))}</strong><br>${esc(ctx.message)}${p.isTakeoverPeriod?`<br><small>Danach: ${esc(billingPeriodLabel(tmp,y+1))}</small>`:""}<br><small>Endabrechnung intern bis ${periodBillingTarget(y)} · gesetzliche Abrechnungsfrist ${periodDeadline(y)}</small></div>`};
  $("propertyForm").oninput=preview;preview();
  $("propertyForm").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));state.property={...state.property,name:v.name.trim(),address:v.address.trim(),totalArea:Number(v.totalArea)||0,year:v.year,billingTakeoverDate:v.billingTakeoverDate||"",predecessorBillingEnd:v.predecessorBillingEnd||""};if(state.property.billingTakeoverDate&&!state.property.ownershipEffective)state.property.ownershipEffective=state.property.billingTakeoverDate;
    state.correspondence={landlordName:v.landlordName.trim(),landlordAddress:v.landlordAddress.trim(),iban:v.iban.trim(),paymentReference:v.paymentReference.trim(),contact:v.contact.trim()};await persist("Objektdaten geändert",state.property.name||"Objekt");propertyView()}
}
function unitsDataView(){
  const owner=unitByType(state,"owner"),rental=unitByType(state,"rental");
  $("workspaceBody").innerHTML=`<div class="card"><button id="addUnit" class="primary">Einheit hinzufügen</button></div>
  ${state.units.map(u=>`<div class="item"><div class="row between"><div><h3>${esc(u.name)}</h3><p>${u.type==="owner"?"Eigennutzung":"Mietwohnung"} · ${u.area} m²${u.constructionYear?` · Baujahr ${esc(u.constructionYear)}`:""}</p><p>${esc(u.note||"")}</p></div><button class="secondary" data-edit-unit="${u.id}">Bearbeiten</button></div></div>`).join("")||"<div class='legal-warn'>Noch keine Einheiten angelegt.</div>"}
  <div class="card"><h3>Aktuelle Zuordnung</h3><p>Eigennutzung: <strong>${owner?esc(owner.name):"fehlt"}</strong></p><p>Mietwohnung: <strong>${rental?esc(rental.name):"fehlt"}</strong></p></div>`;
  $("addUnit").onclick=()=>openUnitEditor();
  document.querySelectorAll("[data-edit-unit]").forEach(b=>b.onclick=()=>openUnitEditor(state.units.find(x=>x.id===b.dataset.editUnit)))
}

function openUnitEditor(x=null){
  const today=localDateISO(),current=currentPersons(x,today);
  modal(x?"Einheit bearbeiten":"Einheit hinzufügen",`<form id="f" class="form-grid">
    ${formField({name:"name",label:"Bezeichnung",value:x?.name||"",placeholder:"z. B. Eigennutzung"})}
    ${formField({name:"type",label:"Nutzung",type:"select",value:x?.type||"rental",options:[{value:"owner",label:"Eigennutzung"},{value:"rental",label:"Mietwohnung"}]})}
    ${formField({name:"area",label:"Wohnfläche (m²)",type:"number",step:"0.01",min:0,value:x?.area||""})}
    ${formField({name:"constructionYear",label:"Baujahr dieses Gebäudeteils",type:"number",min:1800,value:x?.constructionYear||""})}
    ${formField({name:"buildingPart",label:"Gebäudeteil",value:x?.buildingPart||"",placeholder:"z. B. Stammgebäude oder Anbau"})}
    ${formField({name:"persons",label:"Aktuelle Personenzahl",type:"number",step:"1",min:0,value:current||0})}
    ${formField({name:"occupancyFrom",label:"Personenzahl gültig ab",type:"date",value:today})}
    ${formField({name:"note",label:"Notiz",value:x?.note||"",full:true})}
    <div class="full form-actions"><button class="primary">Speichern</button></div>
  </form>`,()=>{
    $("f").onsubmit=async e=>{
      e.preventDefault();const v=Object.fromEntries(new FormData(e.target)),obj=x||{id:uid(),occupancy:[]};
      if(!v.name.trim())return alert("Bitte eine Bezeichnung eingeben.");
      if(Number(v.area)<=0)return alert("Bitte die Wohnfläche prüfen.");
      if(!x&&state.units.some(u=>u.type===v.type)&&!confirm(`Es existiert bereits eine Einheit vom Typ „${v.type==="owner"?"Eigennutzung":"Mietwohnung"}“. Trotzdem anlegen?`))return;
      obj.name=v.name.trim();obj.type=v.type;obj.area=Number(v.area)||0;obj.constructionYear=v.constructionYear?Number(v.constructionYear):null;obj.buildingPart=v.buildingPart.trim();obj.note=v.note.trim();obj.occupancy=Array.isArray(obj.occupancy)?obj.occupancy:[];
      const persons=Math.max(0,Number(v.persons)||0),from=v.occupancyFrom||today,last=obj.occupancy.slice().sort((a,b)=>(b.from||"").localeCompare(a.from||""))[0];
      if(!last||Number(last.count)!==persons||last.from!==from){
        const active=obj.occupancy.find(o=>(!o.to)&&o.from&&o.from<from);if(active)active.to=dateOnlyAddDays(from,-1)
        obj.occupancy.push({from,to:"",count:persons});obj.occupancy.sort((a,b)=>(a.from||"").localeCompare(b.from||""))
      }
      if(!x)state.units.push(obj);
      await persist(x?"Einheit geändert":"Einheit angelegt",obj.name);closeModal(true);unitsDataView()
    }
  })
}
function openSourceEditor(x=null){
  const cats=Object.entries(CATEGORIES).map(([value,c])=>({value,label:c.label})),y=currentPeriodYear();
  modal(x?"Kostenquelle bearbeiten":"Kostenquelle hinzufügen",`<form id="f" class="form-grid">
    ${formField({name:"name",label:"Bezeichnung / Anbieter",value:x?.name||""})}
    ${formField({name:"category",label:"Kategorie",type:"select",value:x?.category||"other",options:cats})}
    ${formField({name:"amount",label:"Betrag (€)",type:"number",step:"0.01",min:0,value:x?.amount??""})}
    ${formField({name:"interval",label:"Intervall",type:"select",value:x?.interval||"yearly",options:[{value:"once",label:"einmalig / Zeitraum"},{value:"monthly",label:"monatlich"},{value:"quarterly",label:"vierteljährlich"},{value:"yearly",label:"jährlich"}]})}
    ${formField({name:"serviceStart",label:"Leistungszeitraum von",type:"date",value:x?.serviceStart||billingPeriodStart(state,y)})}
    ${formField({name:"serviceEnd",label:"Leistungszeitraum bis",type:"date",value:x?.serviceEnd||billingPeriodInfo(state,y).end})}
    ${formField({name:"assignment",label:"Zuordnung",type:"select",value:x?.assignment||"house",options:[{value:"house",label:"gesamtes Haus"},{value:"owner",label:"nur Eigennutzung"},{value:"rental",label:"nur Mietwohnung"},{value:"review",label:"noch prüfen"}]})}
    ${formField({name:"agreement",label:"Umlageregel",type:"select",value:x?.agreement||"auto",options:[{value:"auto",label:"automatisch / Standard"},{value:"area",label:"Wohnfläche"},{value:"persons",label:"Personen"},{value:"manual",label:"individuell prüfen"}]})}
    ${formField({name:"dueDates",label:"Fälligkeiten",value:Array.isArray(x?.dueDates)?x.dueDates.join(", "):"",full:true,placeholder:"z. B. 2026-11-15"})}
    ${formField({name:"note",label:"Notiz",value:x?.note||"",full:true})}
    <div class="full" id="sourceDecision"></div><div class="full"><button class="primary">Speichern</button></div>
  </form>`,()=>{
    const preview=()=>{const v=Object.fromEntries(new FormData($("f")));const d=v.assignment==="review"?{status:"check",reason:"Zuordnung muss bestätigt werden.",basis:"Objektzuordnung"}:legalDecision({category:v.category},{assignment:v.assignment,agreement:v.agreement,hasConsumption:v.category==="water"&&!!settlementConsumption(state,settlementByPeriod(state,currentPeriodYear()))?.valid});$("sourceDecision").innerHTML=`<div class="${d.status==="check"?"legal-warn":"info"}"><strong>Regelprüfung:</strong> ${esc(d.reason)}<br><small>${esc(d.basis||"")}</small></div>`};
    $("f").onchange=preview;preview();
    $("f").onsubmit=async e=>{
      e.preventDefault();const v=Object.fromEntries(new FormData(e.target));if(!v.name.trim())return alert("Bitte eine Bezeichnung eingeben.");if(v.serviceStart&&v.serviceEnd&&v.serviceEnd<v.serviceStart)return alert("Leistungszeitraum prüfen.");
      const obj=x||{id:uid(),kind:"manual"};
      Object.assign(obj,{name:v.name.trim(),category:v.category,amount:Number(v.amount)||0,interval:v.interval,serviceStart:v.serviceStart,serviceEnd:v.serviceEnd,assignment:v.assignment,agreement:v.agreement,dueDates:String(v.dueDates||"").split(/[,;]+/).map(s=>s.trim()).filter(Boolean),note:v.note.trim()});
      if(!x)state.sources.push(obj);syncSimpleSourcePosition(state,obj);
      await persist(x?"Kostenquelle geändert":"Kostenquelle angelegt",obj.name);closeModal(true);sourcesDataView()
    }
  })
}
function documentsDataView(){documentsView()}
function openDocumentCapture(){
  DOC_DRAFT_PAGES=[];
  modal("Dokument hinzufügen",`<div class="card">
    <label>Bezeichnung<input id="newDocLabel" class="big-input" placeholder="z. B. Grundbesitzabgaben 2026"></label>
    <p class="muted">Mehrere Fotos oder PDF-Dateien können als ein Dokument gespeichert werden.</p>
    <div class="doc-capture-actions">
      <label class="primary">Seite fotografieren<input id="docCameraPage" type="file" accept="image/*" capture="environment" hidden></label>
      <label class="secondary">Fotos / PDF auswählen<input id="docPageFiles" type="file" accept="image/*,.pdf" multiple hidden></label>
    </div>
    <div id="draftPages"></div>
    <button id="saveDocumentBtn" class="primary" disabled>Speichern & analysieren</button>
    <button id="clearDraftBtn" class="secondary">Auswahl leeren</button>
  </div>`,()=>{
    renderDraftPages();
    $("docCameraPage").onchange=e=>{appendDraftFiles(e.target.files);e.target.value=""};
    $("docPageFiles").onchange=e=>{appendDraftFiles(e.target.files);e.target.value=""};
    $("saveDocumentBtn").onclick=saveDraftDocument;
    $("clearDraftBtn").onclick=()=>{DOC_DRAFT_PAGES=[];renderDraftPages()}
  })
}

function leaseDataView(){
  const l=state.leases[0];
  $("workspaceBody").innerHTML=`<div class="card"><button id="editLease" class="primary">${l?"Mietvertrag bearbeiten":"Mietvertrag anlegen"}</button></div>
  ${l?`<div class="item"><h3>Mietvertrag</h3><p>Beginn ${esc(l.start)} · Kaltmiete ${euro(l.rent)} · BK-Vorauszahlung ${euro(l.advance)}</p><p>${esc(l.note||"")}</p></div>`:"<div class='legal-warn'>Noch kein Mietvertrag hinterlegt.</div>"}`;
  $("editLease").onclick=()=>openLeaseEditor(l)
}
function sourcesDataView(){
  $("workspaceBody").innerHTML=`<div class="card"><button id="addSource" class="primary">Kostenquelle / Vertrag hinzufügen</button></div>
  ${state.sources.filter(s=>s.kind!=="assessment").map(s=>`<div class="item"><div class="row between"><div><h3>${esc(s.name)}</h3><p>${esc(category(s.category).label)} · ${euro(s.amount)} · ${esc(s.interval||"einmalig")}</p><p><span class="pill">${s.assignment==="owner"?"nur Eigennutzung":s.assignment==="rental"?"nur Mietwohnung":"gesamtes Haus"}</span></p></div><button class="secondary" data-source="${s.id}">Bearbeiten</button></div></div>`).join("")||"<div class='muted card'>Noch keine Kostenquellen oder Verträge erfasst.</div>"}`;
  $("addSource").onclick=()=>openSourceEditor();
  document.querySelectorAll("[data-source]").forEach(b=>b.onclick=()=>openSourceEditor(state.sources.find(x=>x.id===b.dataset.source)))
}

function costPositionsDataView(){
  const positions=(state.costPositions||[]).slice().sort((a,b)=>(b.serviceStart||"").localeCompare(a.serviceStart||""));
  $("workspaceBody").innerHTML=`<div class="card"><div class="row between"><div><h3>Kostenpositionen</h3><p class="muted">Nur bestätigte Positionen fließen in die Abrechnung ein. Quelle, Dokument, Umlage und Zahlung bleiben nachvollziehbar getrennt.</p></div><button id="addPosition" class="primary">Position hinzufügen</button></div></div>
  ${positions.map(p=>{const src=state.sources.find(s=>s.id===p.sourceId),dec=allocateCostPosition(state,{...p,amount:p.amount},currentPeriodYear()).decision;return`<div class="item premium-list-item"><div class="list-main"><div><div class="item-title-row"><h3>${esc(p.label)}</h3><span class="pill ${p.confirmed?"good":"warn"}">${p.confirmed?"Bestätigt":"Entwurf"}</span></div><p>${esc(category(p.category).label)} · ${euro(p.amount)}</p><small>${dateDE(p.serviceStart)} – ${dateDE(p.serviceEnd)} · ${esc(assignmentLabel(p.assignment))} · ${esc(agreementLabel(p.agreement))}</small>${src?`<small>Quelle: ${esc(src.name)}</small>`:""}${dec.status==="check"?`<div class="inline-attention">${esc(dec.reason||"Umlage prüfen")}</div>`:""}</div><div class="item-actions"><button class="secondary" data-trace-pos="${p.id}">Herkunft</button><button class="secondary" data-pos="${p.id}">Bearbeiten</button></div></div></div>`}).join("")||`<div class="empty-state card"><strong>Noch keine Kostenpositionen</strong><p>Positionen entstehen aus Dokumenten oder können manuell angelegt werden.</p></div>`}`;
  $("addPosition").onclick=()=>openCostPositionEditor();
  document.querySelectorAll("[data-pos]").forEach(b=>b.onclick=()=>openCostPositionEditor(positionById(state,b.dataset.pos)));
  document.querySelectorAll("[data-trace-pos]").forEach(b=>b.onclick=()=>openPositionTrace(positionById(state,b.dataset.tracePos)))
}

function openPositionTrace(p){
  if(!p)return;
  const t=traceForPosition(state,p),docPromise=t.documentId?getDocument(t.documentId):Promise.resolve(null);
  Promise.resolve(docPromise).then(doc=>{
    const conf=t.confidence==null?null:confidenceBand(confidencePercent(t.confidence));
    modal("Datenherkunft",`<div class="trace-chain">
      <div class="trace-node"><small>Ursprung</small><strong>${esc(t.origin)}</strong></div><div class="trace-arrow">↓</div>
      <div class="trace-node"><small>Dokument / Quelle</small><strong>${esc(doc?.label||t.source?.name||"keine")}</strong></div><div class="trace-arrow">↓</div>
      <div class="trace-node"><small>Kostenposition</small><strong>${esc(p.label)} · ${euro(p.amount)}</strong></div><div class="trace-arrow">↓</div>
      <div class="trace-node"><small>Umlage</small><strong>${esc(assignmentLabel(p.assignment))} · ${esc(agreementLabel(p.agreement))}</strong></div>
    </div>
    ${t.evidence?`<div class="card"><h3>Erkannte Belegstelle</h3><p>${esc(t.evidence)}</p>${conf?`<span class="confidence confidence-${conf.id}">${esc(conf.label)}</span>`:""}</div>`:""}
    <div class="card"><p>Bestätigt: ${t.confirmedAt?new Date(t.confirmedAt).toLocaleString("de-DE"):"nicht dokumentiert"}</p>${doc?`<button id="openTraceDoc" class="primary">Quelldokument öffnen</button>`:""}</div>`,()=>{
      if($("openTraceDoc"))$("openTraceDoc").onclick=()=>openDocumentAnalysis(doc)
    })
  })
}

function openCostPositionEditor(x=null){
  const cats=Object.entries(CATEGORIES).map(([value,c])=>({value,label:c.label}));
  const sources=[{value:"",label:"keine Quelle"},...(state.sources||[]).map(s=>({value:s.id,label:s.name}))];
  modal(x?"Kostenposition bearbeiten":"Kostenposition hinzufügen",`<form id="f" class="form-grid">
    ${formField({name:"label",label:"Bezeichnung",value:x?.label||""})}
    ${formField({name:"category",label:"Kategorie",type:"select",value:x?.category||"other",options:cats})}
    ${formField({name:"amount",label:"Betrag €",type:"number",step:"0.01",min:0,value:x?.amount||""})}
    ${formField({name:"interval",label:"Intervall",type:"select",value:x?.interval||"once",options:[{value:"once",label:"einmalig / Zeitraum"},{value:"monthly",label:"monatlich"},{value:"quarterly",label:"vierteljährlich"},{value:"yearly",label:"jährlich"}]})}
    ${formField({name:"serviceStart",label:"Leistungszeitraum von",type:"date",value:x?.serviceStart||billingPeriodStart(state,currentPeriodYear())})}
    ${formField({name:"serviceEnd",label:"Leistungszeitraum bis",type:"date",value:x?.serviceEnd||billingPeriodInfo(state,currentPeriodYear()).end})}
    ${formField({name:"assignment",label:"Zuordnung",type:"select",value:x?.assignment||"house",options:[{value:"house",label:"gesamtes Haus"},{value:"owner",label:"nur Eigennutzung"},{value:"rental",label:"nur Mietwohnung"},{value:"review",label:"noch prüfen"}]})}
    ${formField({name:"agreement",label:"Umlageregel",type:"select",value:x?.agreement||"auto",options:[{value:"auto",label:"automatisch / Standard"},{value:"area",label:"Wohnfläche"},{value:"persons",label:"Personen"},{value:"manual",label:"individuell prüfen"}]})}
    ${formField({name:"sourceId",label:"Quelle",type:"select",value:x?.sourceId||"",options:sources})}
    ${formField({name:"quantity",label:"Menge",type:"number",step:"0.001",value:x?.details?.quantity??""})}
    ${formField({name:"unit",label:"Einheit",value:x?.details?.unit||"",placeholder:"m³, Stück, m …"})}
    ${formField({name:"rate",label:"Tarif / Einheit €",type:"number",step:"0.0001",value:x?.details?.rate??""})}
    ${formField({name:"vatRate",label:"USt. %",type:"number",step:"0.01",value:x?.details?.vatRate??""})}
    <label class="full"><span>Bestätigt</span><select name="confirmed"><option value="yes" ${x?.confirmed!==false?"selected":""}>ja – abrechnungswirksam</option><option value="no" ${x?.confirmed===false?"selected":""}>nein – Entwurf</option></select></label>
    <div class="full" id="positionDecision"></div><div class="full"><button class="primary">Speichern</button></div>
  </form>`,()=>{
    const preview=()=>{const v=Object.fromEntries(new FormData($("f")));const d=v.assignment==="review"?{status:"check",reason:"Zuordnung muss bestätigt werden.",basis:"Objektzuordnung"}:legalDecision({category:v.category},{assignment:v.assignment,agreement:v.agreement,hasConsumption:v.category==="water"&&!!settlementConsumption(state,settlementByPeriod(state,currentPeriodYear()))?.valid});$("positionDecision").innerHTML=`<div class="${d.status==="check"?"legal-warn":"info"}"><strong>Regelprüfung:</strong> ${esc(d.reason)}<br><small>${esc(d.basis||"")}</small></div>`};
    $("f").onchange=preview;preview();
    $("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));if(v.serviceEnd<v.serviceStart)return alert("Leistungszeitraum prüfen.");const obj=positionDefaults({...x,id:x?.id||uid(),label:v.label.trim(),category:v.category,amount:Number(v.amount)||0,interval:v.interval,serviceStart:v.serviceStart,serviceEnd:v.serviceEnd,assignment:v.assignment,agreement:v.agreement,sourceId:v.sourceId,confirmed:v.confirmed==="yes",origin:x?.origin||"manual",details:{...(x?.details||{}),quantity:v.quantity===""?null:Number(v.quantity),unit:v.unit.trim(),rate:v.rate===""?null:Number(v.rate),vatRate:v.vatRate===""?null:Number(v.vatRate)}});const result=await executeCommand(x?"costPosition.update":"costPosition.create",{id:obj.id,label:obj.label,amount:obj.amount},async()=>{const i=state.costPositions.findIndex(p=>p.id===obj.id);if(i>=0)state.costPositions[i]=obj;else state.costPositions.push(obj)},{auditText:x?"Kostenposition geändert":"Kostenposition angelegt"});if(!result.ok)return alert(result.message);closeModal(true);costPositionsDataView()}
  })
}


async function meterImageBitmap(file){
  if("createImageBitmap" in window)return createImageBitmap(file,{imageOrientation:"from-image"}).catch(()=>createImageBitmap(file));
  return new Promise((res,rej)=>{const img=new Image(),u=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(u);res(img)};img.onerror=e=>{URL.revokeObjectURL(u);rej(e)};img.src=u})
}
function defaultMeterCrop(){return{x:.10,y:.24,w:.80,h:.42}}
function clampCrop(c){return{x:Math.max(0,Math.min(.95,c.x)),y:Math.max(0,Math.min(.95,c.y)),w:Math.max(.05,Math.min(1-c.x,c.w)),h:Math.max(.05,Math.min(1-c.y,c.h))}}
async function prepareMeterVariant(file,crop=defaultMeterCrop(),variant="contrast"){
  const img=await meterImageBitmap(file),iw=img.width||img.naturalWidth,ih=img.height||img.naturalHeight,c=clampCrop(crop),sx=Math.round(iw*c.x),sy=Math.round(ih*c.y),sw=Math.max(20,Math.round(iw*c.w)),sh=Math.max(20,Math.round(ih*c.h)),scale=Math.min(4,Math.max(1.4,1600/sw)),canvas=document.createElement("canvas");
  canvas.width=Math.max(800,Math.round(sw*scale));canvas.height=Math.max(180,Math.round(sh*scale));const ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.drawImage(img,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
  if(variant!=="color"){const data=ctx.getImageData(0,0,canvas.width,canvas.height),px=data.data,hist=new Array(256).fill(0);for(let i=0;i<px.length;i+=4){const g=Math.round(.299*px[i]+.587*px[i+1]+.114*px[i+2]);hist[g]++;px[i]=px[i+1]=px[i+2]=g}
    if(variant==="contrast"){for(let i=0;i<px.length;i+=4){const v=Math.max(0,Math.min(255,(px[i]-128)*1.8+128));px[i]=px[i+1]=px[i+2]=v}}
    else if(variant==="threshold"){const total=canvas.width*canvas.height;let sum=0;for(let i=0;i<256;i++)sum+=i*hist[i];let sumB=0,wB=0,max=0,threshold=128;for(let i=0;i<256;i++){wB+=hist[i];if(!wB)continue;const wF=total-wB;if(!wF)break;sumB+=i*hist[i];const mB=sumB/wB,mF=(sum-sumB)/wF,b=wB*wF*(mB-mF)*(mB-mF);if(b>max){max=b;threshold=i}}for(let i=0;i<px.length;i+=4){const v=px[i]>threshold?255:0;px[i]=px[i+1]=px[i+2]=v}}
    ctx.putImageData(data,0,0)}
  return new Promise(res=>canvas.toBlob(res,"image/jpeg",.94))
}
async function setupMeterCropCanvas(file,cropState){
  const canvas=$("meterCropCanvas");if(!canvas)return;const img=await meterImageBitmap(file),iw=img.width||img.naturalWidth,ih=img.height||img.naturalHeight,maxW=900;canvas.width=maxW;canvas.height=Math.max(260,Math.round(maxW*ih/iw));const ctx=canvas.getContext("2d");
  const draw=()=>{const c=clampCrop(cropState.value);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);ctx.fillStyle="rgba(16,24,40,.48)";ctx.fillRect(0,0,canvas.width,canvas.height);const x=c.x*canvas.width,y=c.y*canvas.height,w=c.w*canvas.width,h=c.h*canvas.height;ctx.save();ctx.globalCompositeOperation="destination-out";ctx.fillRect(x,y,w,h);ctx.restore();ctx.strokeStyle="#fff";ctx.lineWidth=4;ctx.strokeRect(x,y,w,h);ctx.fillStyle="rgba(255,255,255,.92)";ctx.fillRect(x,y-25,155,23);ctx.fillStyle="#101828";ctx.font="bold 15px sans-serif";ctx.fillText("Ziffern hier einrahmen",x+7,y-8)};draw();
  let start=null;const point=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height}};
  canvas.onpointerdown=e=>{canvas.setPointerCapture?.(e.pointerId);start=point(e);cropState.value={x:start.x,y:start.y,w:.01,h:.01};draw()};
  canvas.onpointermove=e=>{if(!start)return;const p=point(e),x=Math.min(start.x,p.x),y=Math.min(start.y,p.y),w=Math.abs(p.x-start.x),h=Math.abs(p.y-start.y);cropState.value=clampCrop({x,y,w,h});draw()};
  canvas.onpointerup=()=>{start=null;draw()};canvas.onpointercancel=()=>{start=null};cropState.draw=draw
}
function meterCandidatesFromPass(text,source,base){return meterReadingCandidates(String(text||"").replace(/[Oo]/g,"0"),source,base)}

function adjustMeterCrop(cropState,action){
  const c={...cropState.value},step=.035,size=.06;
  if(action==="left")c.x-=step;if(action==="right")c.x+=step;if(action==="up")c.y-=step;if(action==="down")c.y+=step;
  if(action==="smaller"){c.x+=size/2;c.y+=size/2;c.w-=size;c.h-=size}
  if(action==="larger"){c.x-=size/2;c.y-=size/2;c.w+=size;c.h+=size}
  if(action==="auto")Object.assign(c,defaultMeterCrop());
  cropState.value=clampCrop(c);cropState.draw?.()
}

let METER_PHOTO_BUSY=false;
async function recognizeMeterPhoto(file,preferredMeterId="",progress,crop=defaultMeterCrop(),date=smartToday()){
  if(!file)throw new Error("Kein Foto ausgewählt.");if(!String(file.type||"").startsWith("image/"))throw new Error("Für Zählerstände bitte ein Foto/Bild auswählen.");
  const worker=await createOCRWorker(progress);
  try{
    progress?.("1/4 · Zählernummer und Beschriftung lesen …");await worker.setParameters({tessedit_pageseg_mode:"6"});const full=await worker.recognize(file),fullText=full.data.text||"",extra=[];
    const variants=[{name:"Kontrast",blob:await prepareMeterVariant(file,crop,"contrast"),score:.76},{name:"Schwarz/Weiß",blob:await prepareMeterVariant(file,crop,"threshold"),score:.72},{name:"Farbe",blob:await prepareMeterVariant(file,crop,"color"),score:.68}];
    await worker.setParameters({tessedit_char_whitelist:"0123456789,. ",preserve_interword_spaces:"1"});
    for(let i=0;i<variants.length;i++){const v=variants[i];progress?.(`${i+2}/4 · Ziffernfeld ${v.name} analysieren …`);await worker.setParameters({tessedit_pageseg_mode:"7"});const rr=await worker.recognize(v.blob);extra.push(...meterCandidatesFromPass(rr.data.text||"",v.name,v.score))}
    if(!fullText.trim()&&!extra.length)throw new Error("Im gewählten Bereich konnten keine Ziffern erkannt werden.");
    const analysis=analyzeMeterOCRText(state,fullText,preferredMeterId,extra,date);analysis.crop=clampCrop(crop);analysis.passCount=variants.length+1;return analysis
  }finally{await worker.terminate()}
}
function openMeterPhotoCapture(preferredMeterId="",initialMode="camera"){
  const meters=state.meters||[],preferred=meters.find(m=>m.id===preferredMeterId);
  modal("Wasserzähler per Foto",`<div class="card"><h3>${preferred?esc(preferred.name):"Zähler erfassen"}</h3><p class="muted">Für bessere Erkennung rahmst du nach dem Foto nur das Ziffernfeld ein. Die App liest den Bereich in mehreren Bildvarianten und gleicht den Wert mit früheren Ablesungen ab.</p>
    <div class="doc-capture-actions"><label class="primary">Foto aufnehmen<input id="meterCameraInput" type="file" accept="image/*" capture="environment" hidden></label><label class="secondary">Foto auswählen<input id="meterFileInput" type="file" accept="image/*" hidden></label></div>
    <div id="meterCropStage" class="hidden"><p><strong>1. Ziffernfeld einrahmen</strong><br><small>Mit dem Finger einen Rahmen möglichst eng um die Zahlenanzeige ziehen.</small></p><canvas id="meterCropCanvas" class="meter-crop-canvas"></canvas>
    <div class="crop-controls" aria-label="Rahmen ohne Ziehen anpassen">
      <span class="crop-help">Alternativ per Tippen anpassen:</span>
      <button type="button" data-crop-adjust="left" aria-label="Rahmen nach links">←</button>
      <button type="button" data-crop-adjust="up" aria-label="Rahmen nach oben">↑</button>
      <button type="button" data-crop-adjust="down" aria-label="Rahmen nach unten">↓</button>
      <button type="button" data-crop-adjust="right" aria-label="Rahmen nach rechts">→</button>
      <button type="button" data-crop-adjust="smaller">Enger</button>
      <button type="button" data-crop-adjust="larger">Größer</button>
      <button type="button" data-crop-adjust="auto">Auto</button>
    </div>
    <div class="row"><button id="meterCropReset" type="button" class="secondary">Rahmen zurücksetzen</button><button id="meterAnalyzeBtn" type="button" class="primary">Erkennung starten</button></div></div>
    <div id="meterPhotoProgress"></div><div id="meterPhotoResult"></div></div>`,()=>{
      let selectedFile=null,cropState={value:defaultMeterCrop(),draw:null};
      const load=async file=>{if(!file)return;selectedFile=file;cropState.value=defaultMeterCrop();$("meterPhotoResult").innerHTML="";$("meterPhotoProgress").innerHTML="";$("meterCropStage").classList.remove("hidden");await setupMeterCropCanvas(file,cropState)};
      const analyze=async()=>{if(!selectedFile||METER_PHOTO_BUSY)return;METER_PHOTO_BUSY=true;const p=$("meterPhotoProgress"),r=$("meterPhotoResult");r.innerHTML="";
        try{const analysis=await recognizeMeterPhoto(selectedFile,preferredMeterId,msg=>p.innerHTML=`<div class="info">${esc(msg)}</div>`,cropState.value,smartToday());p.innerHTML=`<div class="legal-ok">Mehrfachanalyse abgeschlossen · ${analysis.passCount} OCR-Durchläufe</div>`;renderMeterPhotoProposal(selectedFile,analysis)}
        catch(err){recordClientError("meter-photo-ocr",err);r.innerHTML=`<div class="legal-bad"><strong>Foto konnte nicht sicher ausgewertet werden</strong><br>${esc(err.message||err)}<br><small>Rahmen enger um das Ziffernfeld ziehen oder ein geraderes, schärferes Foto verwenden.</small></div>`}
        finally{METER_PHOTO_BUSY=false}};
      $("meterCameraInput").onchange=e=>{const f=e.target.files?.[0];e.target.value="";load(f)};$("meterFileInput").onchange=e=>{const f=e.target.files?.[0];e.target.value="";load(f)};$("meterAnalyzeBtn").onclick=analyze;$("meterCropReset").onclick=()=>{cropState.value=defaultMeterCrop();cropState.draw?.()};document.querySelectorAll("[data-crop-adjust]").forEach(b=>b.onclick=()=>adjustMeterCrop(cropState,b.dataset.cropAdjust));if(initialMode==="file")setTimeout(()=>$("meterFileInput")?.click(),80)
    })
}
function renderMeterPhotoProposal(file,a){
  const r=$("meterPhotoResult");if(!r)return;
  const meters=state.meters||[],meterOptions=meters.map(m=>({value:m.id,label:`${m.name}${m.number?` · ${m.number}`:""}`}));
  const candidates=a.candidates||[];
  r.innerHTML=`<form id="meterPhotoConfirm" class="form-grid">
    <div class="full ${a.meterId?"legal-ok":"legal-warn"}"><strong>Zuordnung:</strong> ${a.meterId?`${esc(a.meterName)} · ${Math.round(a.assignmentConfidence*100)} %`:"nicht eindeutig"}<br><small>${esc(a.assignmentReason)}</small></div>
    ${formField({name:"meterId",label:"Zähler",type:"select",value:a.meterId||"",options:[{value:"",label:"Bitte Zähler wählen"},...meterOptions]})}
    ${formField({name:"date",label:"Ablesedatum",type:"date",value:localDateISO()})}
    ${formField({name:"value",label:"Erkannter Zählerstand",type:"number",step:"0.001",value:a.reading??""})}
    ${a.serialCandidate?formField({name:"detectedNumber",label:"Erkannte mögliche Zählernummer",value:a.serialCandidate}):""}
    <div class="full" id="meterPhotoPlausibility"></div>
    ${candidates.length>1?`<div class="full"><details><summary>Weitere erkannte Zahlen</summary>${candidates.slice(1).map(c=>`<button type="button" class="secondary meter-candidate" data-value="${c.value}">${esc(c.raw)} · ${(c.score*100).toFixed(0)} %</button>`).join(" ")}</details></div>`:""}
    <div class="full info"><strong>Erkennungssicherheit Zählerstand:</strong> ${Math.round((a.readingConfidence||0)*100)} % · Mehrfach-OCR${a.readingEvidence?`<br><small>${esc(a.readingEvidence)}</small>`:""}<br><small>Der Wert wurde mit früheren Ablesungen plausibilisiert. Vor dem Speichern trotzdem mit dem Foto vergleichen.</small></div>
    <label class="full"><span>Zählernummer übernehmen</span><select name="saveDetectedNumber"><option value="no">nein</option><option value="yes" ${a.serialCandidate&&!a.meterId?"selected":""}>ja, erkannte Nummer am gewählten Zähler speichern</option></select></label>
    <div class="full"><button class="primary">Zählerstand bestätigen & Foto speichern</button></div>
  </form>`;
  const updatePlausibility=()=>{
    const v=Object.fromEntries(new FormData($("meterPhotoConfirm"))),m=meterById(state,v.meterId),val=Number(v.value);
    if(!m||v.value===""){ $("meterPhotoPlausibility").innerHTML=`<div class="legal-warn">Zähler und Stand auswählen.</div>`;return}
    const q=meterReadingPlausibility(m,v.date,val);
    $("meterPhotoPlausibility").innerHTML=`<div class="${q.ok?"legal-ok":"legal-warn"}">${esc(q.message)}</div>`
  };
  $("meterPhotoConfirm").oninput=updatePlausibility;updatePlausibility();
  document.querySelectorAll(".meter-candidate").forEach(b=>b.onclick=()=>{$("meterPhotoConfirm").elements.value.value=b.dataset.value;updatePlausibility()});
  $("meterPhotoConfirm").onsubmit=async e=>{
    e.preventDefault();const v=Object.fromEntries(new FormData(e.target)),m=meterById(state,v.meterId);
    if(!m)return alert("Bitte den Zähler auswählen.");
    if(v.value==="")return alert("Bitte den Zählerstand prüfen.");
    const value=Number(v.value),pl=meterReadingPlausibility(m,v.date,value);
    if(!pl.ok&&!confirm(pl.message+"\n\nTrotzdem speichern?"))return;
    const pages=[{id:uid(),name:file.name||"Zählerfoto.jpg",type:file.type||"image/jpeg",size:file.size,blob:file}],fingerprint=await documentFingerprint(pages);
    const doc={id:uid(),name:`Zählerfoto ${m.name} ${v.date}`,label:`Zählerfoto ${m.name} ${v.date}`,type:file.type||"image/jpeg",size:file.size,created:new Date().toISOString(),sourceId:"",pages,fingerprint,analysis:{status:"done",finishedAt:new Date().toISOString(),text:a.text,fields:{kind:"Zählerstand",meterId:m.id,meterName:m.name,detectedMeterNumber:v.detectedNumber||a.serialCandidate||"",reading:value,date:v.date,assignmentConfidence:a.assignmentConfidence,readingConfidence:a.readingConfidence}}};
    await addDocument(doc);
    const reading=addMeterReading(m,v.date,value,"photo",false);
    reading.photoDocumentId=doc.id;reading.ocrConfidence=Number(a.readingConfidence||0);reading.assignmentConfidence=Number(a.assignmentConfidence||0);reading.detectedMeterNumber=v.detectedNumber||a.serialCandidate||"";
    if(v.saveDetectedNumber==="yes"&&!m.number&&(v.detectedNumber||a.serialCandidate))m.number=String(v.detectedNumber||a.serialCandidate).trim();
    const ok=await persist("Zählerstand per Foto erfasst",`${m.name} · ${value} ${m.unit||""} · ${v.date}`);
    if(!ok){try{await deleteDocument(doc.id)}catch{};return}
    closeModal(true);
    if(route==="data"&&sub.data==="infrastructure")infrastructureDataView();else if(route==="rental"&&sub.rental==="water")waterView();else render()
  }
}

function infrastructureDataView(){
  const {main,owner}=ensureDefaultMeters(state);
  $("workspaceBody").innerHTML=`<div class="card"><div class="row between"><div><h3>Zähler</h3><p class="muted">Zählerstände können manuell oder per Foto erfasst werden. Bei einem allgemeinen Foto versucht die App die gespeicherte Zählernummer automatisch zu erkennen.</p></div><div><button id="meterPhotoCamera" class="primary">Foto aufnehmen</button><button id="meterPhotoFile" class="secondary">Foto auswählen</button></div></div></div>
  ${[main,owner].map(m=>{const last=latestMeterReading(m);return`<div class="item"><div class="row between"><div><h3>${esc(m.name)}</h3><p>Zählernummer: ${esc(m.number||"noch nicht eingetragen")} · ${esc(m.unit||"m³")}</p><small>${m.readings.length} Ablesung(en)${last?` · zuletzt ${last.value} ${esc(m.unit||"")} am ${esc(last.date)}${last.photoDocumentId?" · Foto":""}`:""}</small></div><div><button class="primary" data-meter-photo="${m.id}">Foto</button><button class="secondary" data-meter="${m.id}">Bearbeiten</button></div></div></div>`}).join("")}
  <div class="card"><div class="row between"><div><h3>Abfallbehälter</h3><p class="muted">Behälter werden getrennt von Gebühren geführt. Dadurch kann z. B. eine zusätzliche Restmülltonne eindeutig der Eigennutzung zugeordnet werden.</p></div><button id="addContainer" class="primary">Behälter hinzufügen</button></div></div>
  ${(state.containers||[]).map(c=>`<div class="item"><div class="row between"><div><h3>${esc(c.type)} ${c.volumeL?c.volumeL+" L":""}</h3><p>${assignmentLabel(c.assignment)} · ab ${dateDE(c.activeFrom)}${c.containerNumber?` · Nr. ${esc(c.containerNumber)}`:""}</p></div><button class="secondary" data-container="${c.id}">Bearbeiten</button></div></div>`).join("")||`<div class="card muted">Noch keine Behälter erfasst.</div>`}`;
  $("meterPhotoCamera").onclick=()=>openMeterPhotoCapture("","camera");
  $("meterPhotoFile").onclick=()=>openMeterPhotoCapture("","file");
  document.querySelectorAll("[data-meter-photo]").forEach(b=>b.onclick=()=>openMeterPhotoCapture(b.dataset.meterPhoto,"camera"));
  document.querySelectorAll("[data-meter]").forEach(b=>b.onclick=()=>openMeterEditor(meterById(state,b.dataset.meter)));
  $("addContainer").onclick=()=>openContainerEditor();
  document.querySelectorAll("[data-container]").forEach(b=>b.onclick=()=>openContainerEditor((state.containers||[]).find(c=>c.id===b.dataset.container)))
}
function openMeterEditor(m){
  modal("Zähler bearbeiten",`<form id="f" class="form-grid">${formField({name:"name",label:"Bezeichnung",value:m.name})}${formField({name:"number",label:"Zählernummer",value:m.number||"",placeholder:"wichtig für automatische Foto-Zuordnung"})}${formField({name:"unit",label:"Einheit",value:m.unit||"m³"})}<div class="full"><div class="row between"><h3>Ablesungen</h3><button type="button" id="photoFromMeterEditor" class="primary">Stand per Foto</button></div>${(m.readings||[]).slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map(r=>`<p>${esc(r.date)} · <strong>${r.value} ${esc(m.unit||"")}</strong>${r.synthetic?" · übernommen":r.origin==="photo"?" · 📷 Foto":""}</p>`).join("")||"<p class='muted'>Noch keine Ablesungen.</p>"}</div><div class="full"><button class="primary">Zähler speichern</button></div></form>`,()=>{
    $("photoFromMeterEditor").onclick=()=>{MODAL_RETURN_FOCUS=null;closeModal(true);openMeterPhotoCapture(m.id,"camera")};
    $("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));m.name=v.name.trim();m.number=v.number.trim();m.unit=v.unit.trim()||"m³";await persist("Zähler geändert",m.name);closeModal(true);infrastructureDataView()}
  })
}
function openContainerEditor(x=null){
  modal(x?"Behälter bearbeiten":"Behälter hinzufügen",`<form id="f" class="form-grid">
    ${formField({name:"type",label:"Behälterart",type:"select",value:x?.type||"Restmüll",options:[{value:"Restmüll",label:"Restmüll"},{value:"Bioabfall",label:"Bioabfall"},{value:"Papier",label:"Papier"},{value:"Sonstige",label:"Sonstige"}]})}
    ${formField({name:"volumeL",label:"Volumen (Liter)",type:"number",value:x?.volumeL||120})}
    ${formField({name:"containerNumber",label:"Behälternummer",value:x?.containerNumber||"",placeholder:"optional"})}
    ${formField({name:"assignment",label:"Zuordnung",type:"select",value:x?.assignment||"review",options:[{value:"house",label:"gemeinsam"},{value:"owner",label:"nur Eigennutzung"},{value:"rental",label:"nur Mietwohnung"},{value:"review",label:"noch prüfen"}]})}
    ${formField({name:"activeFrom",label:"Aktiv ab",type:"date",value:x?.activeFrom||""})}
    ${formField({name:"activeTo",label:"Aktiv bis",type:"date",value:x?.activeTo||""})}
    <div class="full form-actions"><button class="primary">Speichern</button></div>
  </form>`,()=>{$("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target)),obj=x||{id:uid()};Object.assign(obj,{type:v.type,volumeL:Number(v.volumeL)||0,containerNumber:v.containerNumber.trim(),assignment:v.assignment,activeFrom:v.activeFrom,activeTo:v.activeTo});if(!x)state.containers.push(obj);await persist(x?"Behälter geändert":"Behälter angelegt",`${obj.type} ${obj.volumeL} L`);closeModal(true);infrastructureDataView()}})
}

function assessmentDataView(){
  const assessments=state.sources.filter(s=>s.kind==="assessment");
  $("workspaceBody").innerHTML=`<div class="card"><button id="addAssessment" class="primary">Grundbesitzabgaben erfassen</button><p class="muted">Bescheid = Quelle. Einzelne Gebühren = zentrale Kostenpositionen.</p></div>${assessments.map(a=>{const ps=sourcePositions(state,a.id);return`<div class="item"><div class="row between"><div><h3>${esc(a.name)}</h3><p class="task-meta">${esc(a.serviceStart||"")} bis ${esc(a.serviceEnd||"")}</p><p>${ps.map(p=>`${esc(p.label)} ${euro(p.amount)}`).join(" · ")}</p></div><button class="secondary" data-assess="${a.id}">Bearbeiten</button></div></div>`}).join("")||"<div class='muted card'>Noch kein Bescheid erfasst.</div>"}`;
  $("addAssessment").onclick=()=>openAssessmentEditor();
  document.querySelectorAll("[data-assess]").forEach(b=>b.onclick=()=>openAssessmentEditor(assessments.find(x=>x.id===b.dataset.assess)))
}
function openAssessmentEditor(x=null){
  const existing=!!(x&&state.sources.some(s=>s.id===x.id)),src=existing?x:(x||{id:uid(),kind:"assessment"});
  const current=sourcePositions(state,src.id);
  const get=(label)=>current.find(p=>p.label===label)?.amount??"";
  const year=Number(src.year)||new Date().getFullYear(),start=src.serviceStart||`${year}-01-01`,end=src.serviceEnd||`${year}-12-31`;
  modal(existing?"Bescheid bearbeiten":"Grundbesitzabgaben erfassen",`<form id="f" class="form-grid">
    ${formField({name:"year",label:"Veranlagungsjahr",type:"number",value:year})}
    ${formField({name:"serviceStart",label:"Leistungszeitraum von",type:"date",value:start})}
    ${formField({name:"serviceEnd",label:"Leistungszeitraum bis",type:"date",value:end})}
    ${formField({name:"dueDates",label:"Fälligkeiten",value:Array.isArray(src.dueDates)?src.dueDates.join(", "):""})}
    ${formField({name:"street",label:"Winterdienst innerörtliche Straße €",type:"number",step:"0.01",value:get("Winterdienst innerörtliche Straße")})}
    ${formField({name:"rain",label:"Niederschlagswasser €",type:"number",step:"0.01",value:get("Niederschlagswasser")})}
    ${formField({name:"wasteEmpty",label:"Leerung 120 L Restmüll €",type:"number",step:"0.01",value:get("Leerung 120 L Restmüll")})}
    ${formField({name:"wasteBase",label:"Grundgebühr 120 L Restmüll €",type:"number",step:"0.01",value:get("Grundgebühr 120 L Restmüll")})}
    ${formField({name:"bio",label:"Gebühr 120 L Bioabfall €",type:"number",step:"0.01",value:get("Gebühr 120 L Bioabfall")})}
    ${formField({name:"sewage",label:"Schmutzwasser €",type:"number",step:"0.01",value:get("Schmutzwasser")})}
    ${formField({name:"waterBase",label:"Grundgebühr Wasser €",type:"number",step:"0.01",value:get("Grundgebühr Wasser")})}
    ${formField({name:"waterUse",label:"Wasserverbrauch €",type:"number",step:"0.01",value:get("Wasserverbrauch")})}
    ${formField({name:"propertyTax",label:"Grundsteuer B €",type:"number",step:"0.01",value:get("Grundsteuer B")})}
    <div class="full info">Jede Zeile wird als eigene Kostenposition gespeichert. Wasser/Kanal ist damit kein Sonderfeld mehr. Müllgebühren können später über „Zähler & Behälter“ einem konkreten Behälter bzw. Nutzer zugeordnet werden.</div>
    <div class="full"><button class="primary">Bescheid speichern</button></div>
  </form>`,()=>{
    $("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));if(v.serviceEnd<v.serviceStart)return alert("Leistungszeitraum prüfen.");
      const y=Number(v.year),due=String(v.dueDates||"").split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean);
      Object.assign(src,{kind:"assessment",year:y,serviceStart:v.serviceStart,serviceEnd:v.serviceEnd,dueDates:due,name:`Grundbesitzabgaben ${new Date(v.serviceStart+"T00:00:00").toLocaleDateString("de-DE")}–${new Date(v.serviceEnd+"T00:00:00").toLocaleDateString("de-DE")}`});
      if(!existing)state.sources.push(src);
      const rows=[
        ["Grundsteuer B","propertyTax",v.propertyTax,"house"],
        ["Winterdienst innerörtliche Straße","street",v.street,"house"],
        ["Niederschlagswasser","rainwater",v.rain,"house"],
        ["Leerung 120 L Restmüll","waste",v.wasteEmpty,"review"],
        ["Grundgebühr 120 L Restmüll","waste",v.wasteBase,"review"],
        ["Gebühr 120 L Bioabfall","waste",v.bio,"house"],
        ["Schmutzwasser","water",v.sewage,"house"],
        ["Grundgebühr Wasser","water",v.waterBase,"house"],
        ["Wasserverbrauch","water",v.waterUse,"house"]
      ].filter(r=>Number(r[2])>0).map(r=>positionDefaults({sourceId:src.id,documentId:src.sourceDocumentId||"",label:r[0],category:r[1],amount:Number(r[2]),serviceStart:v.serviceStart,serviceEnd:v.serviceEnd,assignment:r[3],agreement:"auto",origin:"assessment"}));
      replaceAssessmentPositions(state,src,rows);
      await persist(existing?"Bescheid geändert":"Bescheid angelegt",src.name);closeModal(true);assessmentDataView()
    }
  })
}


let OCR_SCRIPT_PROMISE=null,PDFJS_PROMISE=null,JSPDF_PROMISE=null,DOC_DRAFT_PAGES=[],DOC_ANALYSIS_RUNNING=new Set();

function docPages(doc){
  if(Array.isArray(doc?.pages)&&doc.pages.length)return doc.pages;
  if(doc?.blob)return [{id:`legacy-${doc.id}`,name:doc.name||"Seite 1",type:doc.type||doc.blob.type,size:doc.size||doc.blob.size,blob:doc.blob}];
  return []
}

function docStatus(doc){
  const s=doc?.analysis?.status;
  if(s==="done")return {label:"analysiert",cls:"good"};
  if(s==="processing")return {label:"Analyse läuft",cls:"warn"};
  if(s==="error")return {label:"Analysefehler",cls:"bad"};
  return {label:"wartet auf Analyse",cls:"warn"}
}
function loadOCRLibrary(){
  if(window.Tesseract)return Promise.resolve(window.Tesseract);
  if(OCR_SCRIPT_PROMISE)return OCR_SCRIPT_PROMISE;
  OCR_SCRIPT_PROMISE=new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    s.async=true;
    s.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(new Error("OCR wurde geladen, ist aber nicht verfügbar."));
    s.onerror=()=>reject(new Error("OCR-Bibliothek konnte nicht geladen werden. Internetverbindung prüfen."));
    document.head.appendChild(s)
  });
  return OCR_SCRIPT_PROMISE
}
function loadPDFJS(){
  if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);
  if(PDFJS_PROMISE)return PDFJS_PROMISE;
  PDFJS_PROMISE=new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload=()=>window.pdfjsLib?resolve(window.pdfjsLib):reject(new Error("PDF.js wurde geladen, ist aber nicht verfügbar."));
    s.onerror=()=>reject(new Error("PDF-Analyse konnte nicht geladen werden. Internetverbindung prüfen."));
    document.head.appendChild(s)
  });
  return PDFJS_PROMISE
}
function loadJSPDF(){
  if(window.jspdf?.jsPDF)return Promise.resolve(window.jspdf.jsPDF);
  if(JSPDF_PROMISE)return JSPDF_PROMISE;
  JSPDF_PROMISE=new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload=()=>window.jspdf?.jsPDF?resolve(window.jspdf.jsPDF):reject(new Error("PDF-Erstellung konnte nicht geladen werden."));
    s.onerror=()=>reject(new Error("PDF-Erstellung konnte nicht geladen werden. Internetverbindung prüfen."));
    document.head.appendChild(s)
  });
  return JSPDF_PROMISE
}
function parseMoney(v){return Number(String(v||"").replace(/\./g,"").replace(",",".").replace(/[^\d.-]/g,""))||0}
function ocrAmount(lines,keys){
  const candidates=lines.filter(l=>keys.some(k=>l.toLowerCase().includes(k)));
  for(const l of candidates){
    const ms=[...l.matchAll(/(\d{1,6}(?:\.\d{3})*,\d{2})/g)].map(x=>x[1]);
    if(ms.length)return parseMoney(ms[ms.length-1])
  }
  return 0
}
function isoDateFromParts(d,m,y){
  let year=Number(y);if(year<100)year+=2000;
  const dt=new Date(year,Number(m)-1,Number(d));
  if(dt.getFullYear()!==year||dt.getMonth()!==Number(m)-1||dt.getDate()!==Number(d))return "";
  return `${year}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`
}
function extractServicePeriod(text){
  const clean=String(text||"").replace(/\s+/g," ");
  const dm='(\\d{1,2})[.\\/-](\\d{1,2})[.\\/-](\\d{2,4})';
  const preferred=[
    new RegExp(`(?:leistungszeitraum|abrechnungszeitraum|zeitraum|vom)\\D{{0,40}}${dm}\\D{{0,30}}(?:bis|[-–—])\\D{{0,10}}${dm}`,"i"),
    new RegExp(`${dm}\\s*(?:bis|[-–—])\\s*${dm}`,"i")
  ];
  for(const r of preferred){
    const m=clean.match(r);if(!m)continue;
    // Regex contains optional prefix only in first variant, date groups are always the last 6 capture groups.
    const nums=m.slice(-6);
    const start=isoDateFromParts(nums[0],nums[1],nums[2]),end=isoDateFromParts(nums[3],nums[4],nums[5]);
    if(start&&end&&end>=start)return {start,end}
  }
  return {start:"",end:""}
}
function extractDueDates(text){
  const lines=String(text||"").split(/\r?\n/).filter(l=>/fällig|fälligkeit|zahlung|abbuch/i.test(l));
  const out=[];
  for(const l of lines){
    for(const m of l.matchAll(/(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d{2}|\d{2})/g)){
      const d=isoDateFromParts(m[1],m[2],m[3]);if(d&&!out.includes(d))out.push(d)
    }
  }
  return out
}
function analyzeOCRText(text){
  const lines=String(text||"").split(/\r?\n/).map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean),low=String(text||"").toLowerCase();
  const period=extractServicePeriod(text),ym=(period.start||text).match(/\b(20\d{2})\b/);
  let kind="Sonstiges";
  if(/grundbesitz|grundsteuer|niederschlagswasser|straßenreinigung|strassenreinigung|grundbesitzabgaben/.test(low))kind="Grundbesitzabgaben";
  else if(/versicherung/.test(low))kind="Versicherung";
  else if(/schornstein|kehrgebühr|kehrgebuehr/.test(low))kind="Schornsteinfeger";
  else if(/wasser|kanal|abwasser/.test(low))kind="Wasser/Kanal";
  return {
    kind,year:ym?Number(ym[1]):new Date().getFullYear(),
    serviceStart:period.start,serviceEnd:period.end,dueDates:extractDueDates(text),
    tax:ocrAmount(lines,["grundsteuer b","grundsteuer"]),
    street:ocrAmount(lines,["straßenreinigung","strassenreinigung","winterdienst"]),
    rain:ocrAmount(lines,["niederschlagswasser"]),
    waterRef:ocrAmount(lines,["wasser / kanal","wasser/kanal","wasser kanal","festsetzungen wasser","wasser und kanal"]),
    bio:ocrAmount(lines,["biotonne","bio-tonne","bioabfall"]),
    rest:ocrAmount(lines,["restmüll","restmuell","restabfall"])
  }
}

function evidenceLine(lines,keys){
  return lines.find(l=>keys.some(k=>l.toLowerCase().includes(k)))||""
}
function extractPositionProposals(text,fields){
  const lines=String(text||"").split(/\r?\n/).map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean);
  const start=fields.serviceStart||`${fields.year}-01-01`,end=fields.serviceEnd||`${fields.year}-12-31`;
  const defs=[
    {label:"Grundsteuer B",category:"propertyTax",keys:["grundsteuer b"],assignment:"house"},
    {label:"Winterdienst innerörtliche Straße",category:"street",keys:["winterdienst innerörtl","winterdienst innerört","winterdienst"],assignment:"house"},
    {label:"Niederschlagswasser",category:"rainwater",keys:["niederschlagswasser"],assignment:"house"},
    {label:"Leerung 120 L Restmüll",category:"waste",keys:["leerung 120 l restmüll","leerung 120 l restmuell"],assignment:"review"},
    {label:"Grundgebühr 120 L Restmüll",category:"waste",keys:["grundgebühr 120 l restmüll","grundgebuehr 120 l restmuell"],assignment:"review"},
    {label:"Gebühr 120 L Bioabfall",category:"waste",keys:["gebühr 120 l bioabfall","gebuehr 120 l bioabfall"],assignment:"house"},
    {label:"Schmutzwasser",category:"water",keys:["schmutzwasser"],assignment:"house"},
    {label:"Grundgebühr Wasser",category:"water",keys:["grundgebühr q3+4","grundgebuehr q3+4","grundgebühr"],assignment:"house"},
    {label:"Wasserverbrauch",category:"water",keys:["wasserverbrauch"],assignment:"house"}
  ];
  const out=[];
  for(const d of defs){
    const ev=evidenceLine(lines,d.keys);if(!ev)continue;
    const matches=[...ev.matchAll(/(\d{1,6}(?:\.\d{3})*,\d{2})/g)].map(m=>m[1]);
    if(!matches.length)continue;
    const amount=parseMoney(matches[matches.length-1]);
    if(amount<=0)continue;
    out.push({id:uid(),label:d.label,category:d.category,amount,serviceStart:start,serviceEnd:end,assignment:d.assignment,agreement:"auto",confidence:0.92,evidence:ev,confirmed:false})
  }
  return out
}
function extractContainerProposals(text,fields){
  const low=String(text||"").toLowerCase(),out=[],from=fields.serviceStart||"";
  const add=(type,volume,pattern)=>{if(pattern.test(low))out.push({id:uid(),type,volumeL:volume,assignment:type==="Restmüll"?"review":"house",activeFrom:from,confidence:0.9})};
  add("Bioabfall",120,/bio\s*\(120\s*l\)|bioabfall|120\s*l\s*bio/);
  add("Restmüll",120,/rest\s*\(120\s*l\)|120\s*l\s*rest/);
  add("Papier",240,/papier\s*\(240\s*l\)|240\s*l\s*papier/);
  return out
}

async function createOCRWorker(progress){
  const T=await loadOCRLibrary();
  return T.createWorker("deu",1,{logger:m=>{
    if(progress&&m.status)progress(`${m.status}${m.progress!=null?" · "+Math.round(m.progress*100)+" %":""}`)
  }})
}
async function ocrImagePages(pages,progress){
  const worker=await createOCRWorker(progress),parts=[];
  try{
    for(let i=0;i<pages.length;i++){
      progress?.(`OCR Seite ${i+1}/${pages.length}`);
      const r=await worker.recognize(pages[i].blob);
      parts.push(r.data.text||"")
    }
    return parts.join("\n\n--- Seite ---\n\n")
  }finally{await worker.terminate()}
}
async function extractPDFTextAndImages(file,progress){
  const lib=await loadPDFJS();
  lib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const pdf=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise,parts=[],images=[],max=Math.min(pdf.numPages,12);
  for(let i=1;i<=max;i++){
    progress?.(`PDF Seite ${i}/${max}`);
    const page=await pdf.getPage(i),content=await page.getTextContent(),text=content.items.map(x=>x.str).join(" ").trim();
    parts.push(text);
    if(text.length<40){
      const viewport=page.getViewport({scale:1.6}),canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");
      canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      await page.render({canvasContext:ctx,viewport}).promise;
      const blob=await new Promise(res=>canvas.toBlob(res,"image/jpeg",0.9));
      if(blob)images.push({id:uid(),name:`PDF-Seite-${i}.jpg`,type:"image/jpeg",size:blob.size,blob})
    }
  }
  let text=parts.join("\n");
  if(images.length){
    progress?.("PDF enthält Scan-Seiten – OCR startet");
    const ocr=await ocrImagePages(images,progress);
    text += "\n\n"+ocr
  }
  return text
}
async function analyzeDocumentRecord(doc,progress){
  if(DOC_ANALYSIS_RUNNING.has(doc.id))return;
  DOC_ANALYSIS_RUNNING.add(doc.id);
  doc.analysis={...(doc.analysis||{}),status:"processing",startedAt:new Date().toISOString(),error:""};
  await updateDocument(doc);
  try{
    const pages=docPages(doc),texts=[],imagePages=[];
    for(let i=0;i<pages.length;i++){
      const p=pages[i],isPDF=p.type==="application/pdf"||String(p.name||"").toLowerCase().endsWith(".pdf");
      if(isPDF){
        progress?.(`PDF ${i+1}/${pages.length} wird gelesen`);
        texts.push(await extractPDFTextAndImages(p.blob,progress))
      }else imagePages.push(p)
    }
    if(imagePages.length)texts.push(await ocrImagePages(imagePages,progress));
    const text=texts.join("\n\n===== Dokumentseite =====\n\n"),fields=analyzeOCRText(text);
    fields.positionProposals=extractPositionProposals(text,fields);fields.containerProposals=extractContainerProposals(text,fields);
    fields.intelligence=extractDocumentIntelligence(text,fields);
    fields.positionProposals=enrichDocumentProposalsSmart(state,text,fields,fields.positionProposals);
    fields.smart=smartDocumentSummary(state,text,fields);
    if((fields.intelligence.dueDates||[]).length&&!fields.dueDates?.length)fields.dueDates=fields.intelligence.dueDates;
    fields.anomalies=validateDocumentTotals(fields);fields.confidence=documentConfidenceSummary(fields);
    doc.analysis={status:"done",finishedAt:new Date().toISOString(),text,fields,error:""};
    if(!doc.label||/^IMG_|^image|^photo/i.test(doc.label))doc.label=fields.kind!=="Sonstiges"?`${fields.kind} ${fields.serviceStart?new Date(fields.serviceStart+"T00:00:00").toLocaleDateString("de-DE"):fields.year}`:doc.label;
    await updateDocument(doc);
    return doc
  }catch(err){
    doc.analysis={...(doc.analysis||{}),status:"error",finishedAt:new Date().toISOString(),error:String(err?.message||err)};
    await updateDocument(doc);
    throw err
  }finally{DOC_ANALYSIS_RUNNING.delete(doc.id)}
}
async function analyzeDocumentById(id,progress){
  const docs=await listDocuments(),doc=docs.find(d=>d.id===id);if(!doc)return;
  return analyzeDocumentRecord(doc,progress)
}

function draftPageRow(p,i){
  return `<div class="doc-page"><div><strong>Seite ${i+1}</strong><small>${esc(p.name)} · ${Math.round(p.size/1024)} KB</small></div><div><button class="secondary" data-up="${i}" ${i===0?"disabled":""}>↑</button><button class="secondary" data-down="${i}" ${i===DOC_DRAFT_PAGES.length-1?"disabled":""}>↓</button><button class="danger" data-remove-page="${i}">Entfernen</button></div></div>`
}
function renderDraftPages(){
  const host=$("draftPages");if(!host)return;
  host.innerHTML=DOC_DRAFT_PAGES.length?DOC_DRAFT_PAGES.map(draftPageRow).join(""):`<p class="muted">Noch keine Seiten ausgewählt.</p>`;
  const btn=$("saveDocumentBtn");if(btn)btn.disabled=!DOC_DRAFT_PAGES.length;
  document.querySelectorAll("[data-remove-page]").forEach(b=>b.onclick=()=>{DOC_DRAFT_PAGES.splice(Number(b.dataset.removePage),1);renderDraftPages()});
  document.querySelectorAll("[data-up]").forEach(b=>b.onclick=()=>{const i=Number(b.dataset.up);[DOC_DRAFT_PAGES[i-1],DOC_DRAFT_PAGES[i]]=[DOC_DRAFT_PAGES[i],DOC_DRAFT_PAGES[i-1]];renderDraftPages()});
  document.querySelectorAll("[data-down]").forEach(b=>b.onclick=()=>{const i=Number(b.dataset.down);[DOC_DRAFT_PAGES[i+1],DOC_DRAFT_PAGES[i]]=[DOC_DRAFT_PAGES[i],DOC_DRAFT_PAGES[i+1]];renderDraftPages()})
}
function appendDraftFiles(files){
  for(const f of Array.from(files||[]))DOC_DRAFT_PAGES.push({id:uid(),name:f.name||`Seite-${DOC_DRAFT_PAGES.length+1}`,type:f.type||"application/octet-stream",size:f.size,blob:f});
  renderDraftPages()
}
async function saveDraftDocument(){
  if(!DOC_DRAFT_PAGES.length)return;
  const label=$("newDocLabel").value.trim()||DOC_DRAFT_PAGES[0].name||"Dokument",fingerprint=await documentFingerprint(DOC_DRAFT_PAGES);
  const existing=await listDocuments(),duplicate=existing.find(d=>fingerprint&&d.fingerprint===fingerprint);
  if(duplicate&&!confirm(`Dieses Dokument scheint bereits als „${duplicate.label||duplicate.name}“ gespeichert zu sein. Trotzdem erneut speichern?`))return;
  const doc={id:uid(),name:label,label,type:DOC_DRAFT_PAGES.length>1?"application/x-mietverwaltung-document":DOC_DRAFT_PAGES[0].type,size:DOC_DRAFT_PAGES.reduce((sum,p)=>sum+p.size,0),created:new Date().toISOString(),sourceId:"",pages:DOC_DRAFT_PAGES.slice(),fingerprint,analysis:{status:"queued",createdAt:new Date().toISOString()}};
  await addDocument(doc);DOC_DRAFT_PAGES=[];await persist("Dokument gespeichert",`${label} · ${doc.pages.length} Seite(n)`);closeModal(true);await documentsView(false);
  const progress=msg=>{const el=$("documentGlobalStatus");if(el)el.innerHTML=`<div class="info"><strong>Automatische Analyse:</strong> ${esc(msg)}</div>`};
  try{progress(`${label} wird analysiert …`);await analyzeDocumentById(doc.id,progress);progress(`${label} wurde analysiert.`)}catch(err){recordClientError("document-analysis",err);progress(`Analyse fehlgeschlagen: ${err.message||err}`)}
  if(route==="data"&&sub.data==="documents")await documentsView(false)
}
async function exportDocumentPDF(doc){
  const images=docPages(doc).filter(p=>p.type.startsWith("image/"));
  if(!images.length)return alert("Dieses Dokument enthält keine Bildseiten, die zusammengeführt werden können.");
  const JsPDF=await loadJSPDF(),pdf=new JsPDF({unit:"mm",format:"a4"}),pw=210,ph=297,margin=8;
  for(let i=0;i<images.length;i++){
    if(i>0)pdf.addPage();
    const url=URL.createObjectURL(images[i].blob);
    try{
      const img=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=url});
      const ratio=Math.min((pw-2*margin)/img.width,(ph-2*margin)/img.height),w=img.width*ratio,h=img.height*ratio;
      pdf.addImage(img,"JPEG",margin+(pw-2*margin-w)/2,margin,w,h,undefined,"FAST")
    }finally{URL.revokeObjectURL(url)}
  }
  pdf.save(`${(doc.label||"Dokument").replace(/[^\wäöüÄÖÜß -]/g,"_")}.pdf`)
}
function assessmentDraftFromDocument(doc){
  const f=doc?.analysis?.fields||{},smart=f.smart||{},family=f.intelligence?.documentFamily||"document",isAssessment=family==="municipal_assessment"||/grundbesitzabgaben/i.test(f.kind||"");
  return {id:uid(),kind:isAssessment?"assessment":"document",name:smart.sourceName||f.intelligence?.issuer||f.kind||"Dokument",year:Number(f.year)||new Date().getFullYear(),serviceStart:f.serviceStart||`${f.year||new Date().getFullYear()}-01-01`,serviceEnd:f.serviceEnd||`${f.year||new Date().getFullYear()}-12-31`,dueDates:f.dueDates||[],sourceDocumentId:doc.id,category:smart.category||"other",amount:Number(f.intelligence?.total||0),interval:"once",assignment:"house",agreement:"auto"}
}
async function acceptDocumentProposals(doc){
  const f=doc?.analysis?.fields||{},proposals=(f.positionProposals||[]);
  if(!proposals.length)return alert("Keine Kostenpositionen erkannt.");
  let src=state.sources.find(s=>s.sourceDocumentId===doc.id);
  if(!src&&f.smart?.sourceId)src=state.sources.find(s=>s.id===f.smart.sourceId);
  if(!src){src=assessmentDraftFromDocument(doc);if(!src.name||src.name==="Dokument")src.name=`${f.kind||"Dokument"} ${f.serviceStart?new Date(f.serviceStart+"T00:00:00").toLocaleDateString("de-DE"):f.year}`;state.sources.push(src)}
  if(!src.sourceDocumentId)src.sourceDocumentId=doc.id
  const accepted=[];
  document.querySelectorAll("[data-proposal]").forEach(el=>{
    if(!el.checked)return;const p=proposals.find(x=>x.id===el.dataset.proposal);if(!p)return;
    const assignment=document.querySelector(`[data-assignment="${p.id}"]`)?.value||p.assignment;
    accepted.push(positionDefaults({...p,sourceId:src.id,documentId:doc.id,assignment,confirmed:true,origin:"document",provenance:{origin:"document",documentId:doc.id,sourceId:src.id,evidence:p.evidence||"",confidence:p.confidence??null,confirmedAt:new Date().toISOString(),confirmedBy:"local-user"}}))
  });
  if(!accepted.length)return alert("Keine Position ausgewählt.");
  // Replace only document-origin positions from this document, preserving manual edits elsewhere.
  state.costPositions=state.costPositions.filter(p=>p.documentId!==doc.id||p.origin!=="document").concat(accepted);
  for(const c of f.containerProposals||[]){
    if(!state.containers.some(x=>x.type===c.type&&Number(x.volumeL)===Number(c.volumeL)&&x.activeFrom===c.activeFrom))state.containers.push({...c,id:c.id||uid(),sourceDocumentId:doc.id})
  }
  doc.sourceId=src.id;doc.analysis.acceptedAt=new Date().toISOString();await updateDocument(doc);
  await persist("Dokumentvorschläge bestätigt",`${doc.label||doc.name} · ${accepted.length} Kostenposition(en)`);
  closeModal(true);sub.data="positions";dataWorkspace()
}
function openDocumentAnalysis(doc){
  const a=doc.analysis||{},f=a.fields||{},proposals=f.positionProposals||[],overall=confidenceBand(confidencePercent(f.confidence||0));
  modal("Dokumentanalyse",`<div class="${a.status==="done"?"legal-ok":a.status==="error"?"legal-bad":"info"}"><strong>${esc(docStatus(doc).label)}</strong>${a.error?`<br>${esc(a.error)}`:""}</div>
    ${a.status==="done"?`<div class="card"><div class="item-title-row"><div><p class="eyebrow">ANALYSE</p><h3>${esc(f.kind||"Dokument")}</h3></div><span class="confidence confidence-${overall.id}">${esc(overall.label)}</span></div>
      <div class="fact-row"><span>Leistungszeitraum</span><strong>${f.serviceStart?`${dateDE(f.serviceStart)} – ${dateDE(f.serviceEnd)}`:"nicht sicher erkannt"}</strong></div>
      ${f.intelligence?.issuer?`<div class="fact-row"><span>Aussteller</span><strong>${esc(f.intelligence.issuer)}</strong></div>`:""}
      ${f.intelligence?.total?`<div class="fact-row"><span>Gesamtbetrag erkannt</span><strong>${euro(f.intelligence.total)}</strong></div>`:""}
      ${(f.anomalies||[]).map(x=>`<div class="${x.severity==="warn"?"legal-warn":"info"}">${esc(x.message)}</div>`).join("")}
      <p class="muted">Die Analyse erzeugt Vorschläge. Erst deine Bestätigung macht eine Position abrechnungswirksam.</p></div>
    ${proposals.length?`<div class="card"><div class="card-head"><div><p class="eyebrow">VORSCHLÄGE</p><h3>Erkannte Kostenpositionen</h3></div></div>${proposals.map(p=>{const cb=confidenceBand(confidencePercent(p.confidence));return`<div class="proposal-row premium-proposal"><label><input type="checkbox" data-proposal="${p.id}" checked> <span><strong>${esc(p.label)}</strong><small>${euro(p.amount)}</small></span></label><select data-assignment="${p.id}" aria-label="Zuordnung für ${esc(p.label)}"><option value="house" ${p.assignment==="house"?"selected":""}>gesamtes Haus</option><option value="owner" ${p.assignment==="owner"?"selected":""}>nur Eigennutzung</option><option value="rental" ${p.assignment==="rental"?"selected":""}>nur Mietwohnung</option><option value="review" ${p.assignment==="review"?"selected":""}>noch prüfen</option></select><span class="confidence confidence-${cb.id}">${esc(cb.short)}</span><details><summary>Erkennungsgrund</summary><small>${esc(p.smartReason||p.evidence||"OCR-Vorschlag")}</small></details></div>`}).join("")}<button id="acceptProposals" class="primary">Ausgewählte Positionen bestätigen</button></div>`:`<div class="legal-warn">Keine einzelnen Kostenpositionen ausreichend sicher erkannt. Du kannst das Dokument trotzdem als Beleg behalten.</div>`}
    <details class="card secondary-detail"><summary>Technische Analyse anzeigen</summary><div class="detail-content">${f.intelligence?`<p>Dokumenttyp: ${esc(f.intelligence.documentFamily||"Dokument")}${f.intelligence.reference?` · Referenz ${esc(f.intelligence.reference)}`:""}</p>`:""}${f.smart?`<p>Smart-Kategorie: ${esc(category(f.smart.category).label)} · ${Math.round(confidencePercent(f.smart.categoryConfidence))}%</p>`:""}<textarea class="big-input" rows="12" readonly>${esc(a.text||"")}</textarea></div></details>`:""}
    ${a.status==="error"?`<button id="retryAnalysis" class="primary">Analyse erneut versuchen</button>`:""}`,()=>{
      if($("retryAnalysis"))$("retryAnalysis").onclick=async()=>{closeModal(true);await analyzeDocumentById(doc.id,msg=>{});await documentsView(false)};
      if($("acceptProposals"))$("acceptProposals").onclick=()=>acceptDocumentProposals(doc)
    })
}
async function documentsView(autoQueue=true){
  const docs=await listDocuments();state.documentsCache=docs;
  if(autoQueue){const unanalysed=docs.filter(d=>!d.analysis||!d.analysis.status);for(const d of unanalysed){d.analysis={status:"queued",createdAt:new Date().toISOString()};await updateDocument(d)}}
  const groups=documentsByWorkflow(docs);
  const rows=items=>items.map(d=>`<div class="item premium-list-item"><div class="list-main"><div><strong>${esc(d.label||d.name)}</strong><p>${d.pages?.length||1} Seite(n) · ${humanBytes(d.size||0)}</p><small>${esc(docStatus(d).label)} · ${esc(documentWorkflowLabel(d))}</small></div><div class="item-actions"><button class="primary" data-doc-analysis="${d.id}">${documentWorkflowState(d)==="review"?"Prüfen":"Öffnen"}</button><button class="secondary" data-doc-export="${d.id}">PDF</button></div></div></div>`).join("");
  $("workspaceBody").innerHTML=`<div id="documentGlobalStatus"></div>
  <div class="card"><div class="row between"><div><h3>Dokumente</h3><p class="muted">Neue Belege werden analysiert, anschließend geprüft und erst danach als erledigt abgelegt.</p></div><button id="newDocument" class="primary">Dokument hinzufügen</button></div></div>
  ${groups.review.length?`<section class="card"><div class="row between"><h3>Zu prüfen</h3><span class="pill warn">${groups.review.length}</span></div>${rows(groups.review)}</section>`:""}
  ${groups.new.length?`<section class="card"><div class="row between"><h3>In Analyse</h3><span class="pill">${groups.new.length}</span></div>${rows(groups.new)}</section>`:""}
  ${!groups.review.length&&!groups.new.length?`<div class="legal-ok">✓ Kein Dokument wartet auf Prüfung.</div>`:""}
  <details class="card secondary-detail" ${groups.done.length<=3?"open":""}><summary>Erledigte Dokumente (${groups.done.length})</summary><div class="detail-content">${rows(groups.done)||"<p class='muted'>Noch keine erledigten Dokumente.</p>"}</div></details>`;
  $("newDocument").onclick=()=>openDocumentCapture();
  document.querySelectorAll("[data-doc-analysis]").forEach(b=>b.onclick=()=>{const d=docs.find(x=>x.id===b.dataset.docAnalysis);if(d)openDocumentAnalysis(d)});
  document.querySelectorAll("[data-doc-export]").forEach(b=>b.onclick=()=>{const d=docs.find(x=>x.id===b.dataset.docExport);if(d)exportDocumentPDF(d)})
}
function rentalWorkspace(){
  const tabs=[
    {id:"overview",label:"Überblick",icon:"⌂"},
    {id:"lifecycle",label:"Mietkonto",icon:"↔"},
    {id:"water",label:"Kaltwasser",icon:"◌"},
    {id:"billing",label:"Abrechnung",icon:"€"}
  ];
  let active=sub.rental||"overview";
  if(active==="calculation"||active==="workflow")active="billing";
  sub.rental=active;
  $("app").innerHTML=workspaceHeader("VERMIETUNG","Vermietung","Mietverhältnis, Kaltwasser und Betriebskostenabrechnung.",tabs,visibleSub("rental",active));
  bindWorkspaceTabs("rental",rentalWorkspace);
  if(active==="overview")rentalOverview();
  else if(active==="lifecycle")rentalLifecycleView();
  else if(active==="lease")leaseDataView();
  else if(active==="water")waterRentalView();
  else calculationView()
}
function rentLedgerCard(s){return AppRentalLifecycleUi.renderCompactLedger(s,{euro,esc})}
function rentalLifecycleView(){
AppRentalLifecycleUi.renderRentalLifecycle({state,activeBuildingId:String(state?.meta?.presentationBuildingId||state?.meta?.primaryBuildingId||""),host:$("workspaceBody"),esc,euro,dateDE,modal,closeModal,formField,executeCommand,rerender:rentalLifecycleView,go})
}
function utilitiesResponsibilityCard(s){
  const p=s.meta?.v17?.utilityProfile||{};
  return `<section id="utilityResponsibility" class="card"><p class="eyebrow">VERSORGUNG</p><h3>Abrechnungsverantwortung</h3>
  <div class="fact-row"><span>Kaltwasser / Kanal</span><strong>${p.coldWater==="landlord"?"über Vermieter":"Mietervertrag"}</strong></div>
  <div class="fact-row"><span>Heizung</span><strong>${p.heating==="tenant"?"eigener Mietervertrag":"über Vermieter"}</strong></div>
  <div class="fact-row"><span>Warmwasser</span><strong>${p.hotWater==="tenant"?"eigene Verantwortung":"über Vermieter"}</strong></div>
  <div class="fact-row"><span>Strom</span><strong>${p.electricity==="tenant"?"eigener Mietervertrag":"über Vermieter"}</strong></div>
  <div class="fact-row"><span>Gas</span><strong>${p.gas==="tenant"?"eigener Mietervertrag":"über Vermieter"}</strong></div>
  <p class="muted">Heizung, Warmwasser, Strom und Gas werden in diesem Objekt nicht über die Vermieter-Betriebskostenabrechnung geführt.</p></section>`
}
function paymentQualityCard(s){
  const payments=s.payments||[],bad=payments.filter(p=>!p.date||!String(p.label||"").trim()||!(Number(p.amount)>0)),seen=new Map();
  for(const p of payments){const k=`${p.date}|${p.direction}|${Number(p.amount||0).toFixed(2)}|${normalizeLabelText(p.label||"")}`;seen.set(k,(seen.get(k)||0)+1)}
  const dups=[...seen.values()].filter(n=>n>1).length,problem=bad.length||dups;
  return `<div id="paymentQuality" class="${problem?"legal-warn":"legal-ok"}"><strong>Buchungsprüfung</strong><br>${bad.length?`${bad.length} Buchung(en) mit unvollständigen Pflichtdaten. `:""}${dups?`${dups} mögliche Dublette(n).`:"Keine ungültigen oder doppelten Buchungen erkannt."}</div>`
}

function leaseDocumentCandidate(doc){
  const hay=normalizeLabelText(`${doc?.label||""} ${doc?.name||""} ${doc?.analysis?.fields?.kind||""}`);
  return /mietvertrag|wohnraummietvertrag|mietvereinbarung/.test(hay)
}
function openStoredLeaseDocument(doc){
  const pages=docPages(doc);
  if(pages.length===1&&(pages[0].type==="application/pdf"||String(pages[0].name||"").toLowerCase().endsWith(".pdf"))){
    const url=URL.createObjectURL(pages[0].blob),opened=window.open(url,"_blank");
    if(!opened){URL.revokeObjectURL(url);openDocumentAnalysis(doc);return}
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    return
  }
  openDocumentAnalysis(doc)
}
async function renderLeaseDocumentSlot(){
  const host=$("leaseDocumentSlot");if(!host)return;
  try{
    const docs=await listDocuments();state.documentsCache=docs;
    if(route!=="rental"||sub.rental!=="overview"||!$("leaseDocumentSlot"))return;
    const matches=docs.filter(leaseDocumentCandidate);
    if(matches.length){
      const d=matches[0],more=matches.length-1;
      host.innerHTML=`<div class="mini-document-row"><span><strong>${esc(d.label||d.name)}</strong><small>${d.pages?.length||1} Seite(n) · ${esc(docStatus(d).label)}${more>0?` · +${more} weiteres Dokument`:""}</small></span><button class="secondary compact" id="openLeaseDocument">Öffnen</button></div>`;
      $("openLeaseDocument").onclick=()=>openStoredLeaseDocument(d)
    }else{
      host.innerHTML=`<div class="empty-inline"><span><strong>Noch kein Vertragsdokument erkannt</strong><small>Ein PDF oder Foto mit „Mietvertrag“ in der Bezeichnung erscheint hier automatisch.</small></span></div>`
    }
  }catch(e){
    host.innerHTML=`<div class="empty-inline"><span><strong>Vertragsdokument konnte nicht geladen werden</strong><small>${esc(e.message||e)}</small></span></div>`
  }
}
function rentalOverview(){
  const y=currentPeriodYear(),a=billingAnalysis(state,y),p=billingProjection(state,y),rent=rentMonthStatus(state),ctx=billingPeriodContext(state,y),cb=confidenceBand(p.confidence),l=AppLifecycleLedger.activeLeaseAt(state,localDateISO())||state.leases.slice().sort((x,y)=>String(y.start||"").localeCompare(String(x.start||"")))[0];
  $("workspaceBody").innerHTML=`<div class="grid cards">
    <article class="card metric-card"><span>Bestätigte Kosten Mieterin</span><strong>${euro(a.tenantCosts)}</strong><small>aktueller Rechenstand</small></article>
    <article class="card metric-card"><span>Vorauszahlungen</span><strong>${euro(a.advances)}</strong><small>für diese Periode</small></article>
    <article class="card metric-card"><span>Aktuelles Ergebnis</span><strong>${euro(Math.abs(a.result))}</strong><small>${a.result>=0?"Nachzahlung":"Guthaben"}</small></article>
    <article class="card metric-card"><span>Prognose</span><strong>${euro(Math.abs(p.projectedResult))}</strong><small>${p.projectedResult>=0?"Nachzahlung":"Guthaben"} · ${esc(cb.short)}</small></article>
  </div>
  <section class="card embedded-overview-card lease-overview-card">
    <div class="card-head"><div><p class="eyebrow">MIETVERHÄLTNIS</p><h3>${l?esc(l.tenantName||"Mietvertrag"):"Noch kein Mietvertrag"}</h3></div><button id="editLeaseOverview" class="${l?"secondary":"primary"} compact">${l?"Vertragsdaten bearbeiten":"Mietvertrag anlegen"}</button></div>
    ${l?`<div class="overview-facts">
      <div class="fact-row"><span>Vertragsbeginn</span><strong>${dateDE(l.start)}</strong></div>
      <div class="fact-row"><span>Kaltmiete</span><strong>${euro(l.rent)} / Monat</strong></div>
      <div class="fact-row"><span>BK-Vorauszahlung</span><strong>${euro(l.advance)} / Monat</strong></div>
      ${l.end?`<div class="fact-row"><span>Vertragsende</span><strong>${dateDE(l.end)}</strong></div>`:""}
    </div>`:`<p class="muted">Lege einmalig die Vertragsdaten an. Danach erscheinen sie dauerhaft direkt hier in der Übersicht.</p>`}
    <div class="embedded-document">
      <div class="embedded-document-head"><span><strong>Mietvertrag / PDF</strong><small>Direkt beim Mietverhältnis abgelegt</small></span><button id="addLeaseDocument" class="secondary compact">Dokument hinzufügen</button></div>
      <div id="leaseDocumentSlot"><span class="muted">Dokument wird geladen …</span></div>
    </div>
  </section>
  <div class="${ctx.kind==="takeover"?"info":"legal-ok"}"><strong>${esc(billingPeriodLabel(state,y))}</strong><br>${esc(ctx.message)}<br><small>Endabrechnung intern bis ${periodBillingTarget(y)} · gesetzliche Abrechnungsfrist ${periodDeadline(y)}.</small></div>
  ${p.missingCategories.length?`<details class="card secondary-detail"><summary>Was in der Prognose noch geschätzt wird</summary><div class="detail-content"><p>${p.missingCategories.map(x=>`${esc(categoryLabel(x.category))}${x.annualized?" (aus Teilperiode hochgerechnet)":""}`).join(", ")}</p><span class="confidence confidence-${cb.id}">${esc(cb.label)} · ${p.confidence}%</span></div></details>`:""}
  <div class="card"><div class="fact-row"><span>Mietzahlung ${esc(rent.key)}</span><strong>${rent.status==="none"?"kein aktiver Vertrag":esc(rentStatusLabel(rent))}</strong></div>${rent.status!=="none"?`<small>${euro(rent.paid)} von ${euro(rent.expected)} in erfassten Zahlungen erkannt.</small>`:""}</div>
  ${rentLedgerCard(state)}
  ${utilitiesResponsibilityCard(state)}`;
  $("editLeaseOverview").onclick=()=>go("rental","lifecycle");
  $("addLeaseDocument").onclick=()=>{go("data","documents");setTimeout(()=>{openDocumentCapture();setTimeout(()=>{if($("newDocLabel")&&!$("newDocLabel").value)$("newDocLabel").value="Mietvertrag"},0)},0)};
  renderLeaseDocumentSlot()
}
function waterRentalView(){
  // Reuse water view into workspaceBody
  waterView()
}






function openLeaseEditor(x=null){
  modal(x?"Mietvertrag bearbeiten":"Mietvertrag anlegen",`<form id="f" class="form-grid">
    <div class="full form-intro"><strong>${x?"Vertragsdaten aktualisieren":"Neuen Mietvertrag erfassen"}</strong><small>Personenbezogene Daten werden nur lokal in deiner App gespeichert.</small></div>
    ${formField({name:"tenantName",label:"Mieter/in – Name",value:x?.tenantName||"",placeholder:"Name"})}
    ${formField({name:"tenantAddress",label:"Korrespondenzadresse",value:x?.tenantAddress||"",full:true,placeholder:"Anschrift"})}
    ${formField({name:"start",label:"Vertragsbeginn",type:"date",value:x?.start||""})}
    ${formField({name:"end",label:"Vertragsende",type:"date",value:x?.end||""})}
    ${formField({name:"rent",label:"Kaltmiete pro Monat (€)",type:"number",step:"0.01",min:0,value:x?.rent??""})}
    ${formField({name:"advance",label:"Betriebskostenvorauszahlung pro Monat (€)",type:"number",step:"0.01",min:0,value:x?.advance??""})}
    ${formField({name:"note",label:"Vertragsnotiz",value:x?.note||"",full:true,placeholder:"Optionale Besonderheiten"})}
    <div class="full form-actions"><button class="primary">Speichern</button></div>
  </form>`,()=>{
    $("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target)),obj=x||{id:uid()};if(!v.start)return alert("Bitte den Vertragsbeginn eintragen.");Object.assign(obj,{tenantName:v.tenantName.trim(),tenantAddress:v.tenantAddress.trim(),start:v.start,end:v.end,rent:Number(v.rent)||0,advance:Number(v.advance)||0,note:v.note.trim()});if(!x)state.leases.push(obj);await persist(x?"Mietvertrag geändert":"Mietvertrag angelegt","Mietvertrag");closeModal(true);go("rental","overview")}
  })
}
function waterView(){
  const y=currentPeriodYear(),sett=settlementByPeriod(state,y),cons=settlementConsumption(state,sett),waterCosts=(state.costPositions||[]).filter(p=>p.confirmed&&p.category==="water"&&positionToEvents(state,p,y).length),waterCostTotal=waterCosts.reduce((sum,p)=>sum+positionToEvents(state,p,y).reduce((a,e)=>a+Number(e.amount||0),0),0),waterTenantCost=cons?.valid?waterCostTotal*cons.share:0,waterRate=cons?.valid&&cons.house>0?waterCostTotal/cons.house:0,{main,owner}=ensureDefaultMeters(state);
  $("workspaceBody").innerHTML=`<div class="card"><div class="row between"><div><button id="editWater" class="primary">${sett?"Abrechnungsperiode bearbeiten":"Abrechnungsperiode erfassen"}</button><button id="openMeters" class="secondary">Zählerstammdaten</button></div><div><button id="photoMain" class="secondary">📷 Hauptzähler</button><button id="photoOwner" class="secondary">📷 Zwischenzähler</button></div></div></div>
  ${cons?`<div class="${cons.valid?"legal-ok":"legal-bad"}"><strong>${billingPeriodLabel(state,y)}</strong><br>Hausverbrauch ${cons.house.toFixed(3)} m³ · Eigennutzung ${cons.owner.toFixed(3)} m³ · Mietwohnung ${cons.tenant.toFixed(3)} m³ · Anteil ${percent(cons.share)}</div>`:`<div class="legal-warn">Für diese Periode fehlen vollständige Zählerstände. Fotoaufnahmen werden als historische Ablesungen gespeichert; die Abrechnungsperiode wählt anschließend die passenden Anfangs- und Endstände aus.</div>`}
  <section id="waterCostSummary" class="card"><div class="card-head"><div><p class="eyebrow">KALTWASSER</p><h3>Verbrauch & Kosten auf einen Blick</h3></div><span class="pill ${cons?.valid&&waterCostTotal>0?"good":"warn"}">${cons?.valid&&waterCostTotal>0?"Abrechnungsbereit":"Noch offen"}</span></div><div class="grid cards"><article class="card metric-card"><span>Hausverbrauch</span><strong>${cons?.valid?cons.house.toFixed(3)+" m³":"–"}</strong></article><article class="card metric-card"><span>Mietwohnung</span><strong>${cons?.valid?cons.tenant.toFixed(3)+" m³":"–"}</strong><small>${cons?.valid?percent(cons.share):"Anteil offen"}</small></article><article class="card metric-card"><span>Wasserkosten</span><strong>${euro(waterCostTotal)}</strong><small>${cons?.valid&&waterCostTotal?`${euro(waterRate)} / m³ Hausverbrauch`:"Tarif noch offen"}</small></article><article class="card metric-card"><span>Rechnerischer Mieteranteil</span><strong>${cons?.valid&&waterCostTotal?euro(waterTenantCost):"–"}</strong></article></div><p class="muted">Die Werte stammen direkt aus dem zentralen Zähler- und Kostenmodell; es gibt keine separate Nebenrechnung.</p></section>
  <div class="card"><h3>Letzte Ablesungen</h3><p>${esc(main.name)}: <strong>${latestMeterReading(main)?`${latestMeterReading(main).value} ${esc(main.unit||"")} · ${esc(latestMeterReading(main).date)}`:"noch keine"}</strong></p><p>${esc(owner.name)}: <strong>${latestMeterReading(owner)?`${latestMeterReading(owner).value} ${esc(owner.unit||"")} · ${esc(latestMeterReading(owner).date)}`:"noch keine"}</strong></p></div>
  <div class="card"><h3>Wasser-/Kanalkosten</h3>${waterCosts.map(p=>`<p>${esc(p.label)}: <strong>${euro(p.amount)}</strong></p>`).join("")||"<div class='empty-state compact-empty'><strong>Noch keine bestätigten Wasser-/Kanalkosten</strong><p>Bestätigte Kosten erscheinen hier automatisch.</p></div>"}<p class="muted">Kosten und Verbrauch sind getrennt gespeichert. Die Abrechnung verbindet beides erst bei der Umlage.</p></div>`;
  $("editWater").onclick=()=>openWaterEditor(sett);$("openMeters").onclick=()=>{sub.data="infrastructure";go("data")};
  $("photoMain").onclick=()=>openMeterPhotoCapture(main.id,"camera");$("photoOwner").onclick=()=>openMeterPhotoCapture(owner.id,"camera")
}
function openWaterEditor(x=null){
  const y=Number(x?.periodYear)||currentPeriodYear(),{main,owner}=ensureDefaultMeters(state);
  const old=settlementConsumption(state,x);
  const mainStart=x?readingById(main,x.mainStartReadingId):null,mainEnd=x?readingById(main,x.mainEndReadingId):null,ownerStart=x?readingById(owner,x.ownerStartReadingId):null,ownerEnd=x?readingById(owner,x.ownerEndReadingId):null;
  modal(x?"Wasserperiode bearbeiten":"Wasserperiode erfassen",`<form id="f" class="form-grid">
    ${formField({name:"periodYear",label:"Abrechnungsjahr (Beginn)",type:"number",value:y})}
    ${formField({name:"mainStartDate",label:"Hauptzähler Anfang Datum",type:"date",value:mainStart?.date||billingPeriodStart(state,y)})}
    ${formField({name:"mainStart",label:"Hauptzähler Anfang",type:"number",step:"0.001",value:mainStart?.value??""})}
    ${formField({name:"mainEndDate",label:"Hauptzähler Ende Datum",type:"date",value:mainEnd?.date||periodEnd(y)})}
    ${formField({name:"mainEnd",label:"Hauptzähler Ende",type:"number",step:"0.001",value:mainEnd?.value??""})}
    ${formField({name:"ownerStartDate",label:"Eigener Zwischenzähler Anfang Datum",type:"date",value:ownerStart?.date||billingPeriodStart(state,y)})}
    ${formField({name:"ownerStart",label:"Eigener Zwischenzähler Anfang",type:"number",step:"0.001",value:ownerStart?.value??""})}
    ${formField({name:"ownerEndDate",label:"Eigener Zwischenzähler Ende Datum",type:"date",value:ownerEnd?.date||periodEnd(y)})}
    ${formField({name:"ownerEnd",label:"Eigener Zwischenzähler Ende",type:"number",step:"0.001",value:ownerEnd?.value??""})}
    <div class="full" id="waterCalc"></div><div class="full"><button class="primary">Speichern</button></div>
  </form>`,()=>{
    const calc=()=>{const v=Object.fromEntries(new FormData($("f"))),house=Number(v.mainEnd)-Number(v.mainStart),own=Number(v.ownerEnd)-Number(v.ownerStart),tenant=house-own;$("waterCalc").innerHTML=house>=0&&own>=0&&tenant>=0?`<div class="info">Haus ${house.toFixed(3)} m³ − Eigennutzung ${own.toFixed(3)} m³ = Mietwohnung <strong>${tenant.toFixed(3)} m³</strong> (${house>0?percent(tenant/house):"–"})</div>`:`<div class="legal-bad">Zählerstände ergeben einen negativen Verbrauch. Bitte prüfen.</div>`};$("f").oninput=calc;calc();
    $("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target)),house=Number(v.mainEnd)-Number(v.mainStart),own=Number(v.ownerEnd)-Number(v.ownerStart);if(house<0||own<0||house-own<0)return alert("Zählerstände prüfen.");
      const ms=addMeterReading(main,v.mainStartDate,Number(v.mainStart),"manual"),me=addMeterReading(main,v.mainEndDate,Number(v.mainEnd),"manual"),os=addMeterReading(owner,v.ownerStartDate,Number(v.ownerStart),"manual"),oe=addMeterReading(owner,v.ownerEndDate,Number(v.ownerEnd),"manual");
      const obj=x||{id:uid()};Object.assign(obj,{periodYear:Number(v.periodYear),mainMeterId:main.id,ownerMeterId:owner.id,mainStartReadingId:ms.id,mainEndReadingId:me.id,ownerStartReadingId:os.id,ownerEndReadingId:oe.id});if(!x)state.waterSettlements.push(obj);await persist(x?"Wasserperiode geändert":"Wasserperiode angelegt",billingPeriodLabel(state,obj.periodYear));closeModal(true);waterView()
    }
  })
}
function calculationView(){
  const y=selectedBillingYear(state),yearOptions=billingSelectableYears(state),baseClosure=billingClosureChecklist(state,y),g=AppRentalLifecycleUi.billingLifecycleContext(state,y,baseClosure,sessionStorage.getItem("billingSelectedLeaseId")||""),closure=g.closure,a=g.analysis,snap=g.snapshot,ctx=billingPeriodContext(state,y),v18=v18BillingAssistant(state,y);
  const routeFor={period:["data","property"],periodComplete:["rental","billing"],costs:["data","positions"],assignment:["data","positions"],water:["rental","water"],advance:["rental","overview"],readiness:["more","smart"]};
  $("workspaceBody").innerHTML=`<div class="card"><div class="row between"><div><p class="eyebrow">BETRIEBSKOSTENABRECHNUNG</p><h3>${billingPeriodLabel(state,y)}</h3><p class="muted">${esc(ctx.message)}</p><label style="display:block;margin-top:10px"><span class="muted">Abrechnungsperiode</span><select id="billingYearSelect" aria-label="Abrechnungsperiode">${yearOptions.map(yy=>`<option value="${yy}" ${yy===y?"selected":""}>${esc(billingPeriodLabel(state,yy))}</option>`).join("")}</select></label>${g.leases.length>1?`<label style="display:block;margin-top:10px"><span class="muted">Mietverhältnis</span><select id="billingLeaseSelect" aria-label="Mietverhältnis">${g.leases.map(l=>`<option value="${esc(l.id)}" ${l.id===g.selectedLeaseId?"selected":""}>${esc(l.tenantName||l.id)} · ${dateDE(l.start)}${l.end?` – ${dateDE(l.end)}`:""}</option>`).join("")}</select></label>`:""}</div><span class="pill ${closure.ok?"good":"warn"}">${closure.ok?"Abschlussbereit":"Noch offen"}</span></div></div>
  ${v18BillingAssistantHTML(state,y,{compact:false})}
  <div class="card"><h3>Abschlussprüfung</h3><p class="muted">Offene Punkte führen direkt zur passenden Eingabe.</p>${closure.points.map((p,i)=>`<${p.ok?"div":"button"} class="closure-step ${p.ok?"done":"open actionable"}" ${p.ok?"":`data-closure="${p.id}"`}><span>${p.ok?"✓":"!"}</span><div><strong>${i+1}. ${esc(p.label)}</strong>${p.ok?"":"<small>Öffnen und beheben</small>"}</div></${p.ok?"div":"button"}>`).join("")}</div>
  <div class="grid cards"><article class="card metric-card"><span>Umlagefähige Kosten</span><strong>${euro(a.tenantCosts)}</strong></article><article class="card metric-card"><span>Vorauszahlungen</span><strong>${euro(a.advances)}</strong></article><article class="card metric-card"><span>Ergebnis</span><strong>${euro(Math.abs(a.result))}</strong><small>${a.result>=0?"Nachzahlung":"Guthaben"}</small></article></div>
  <div class="card"><h3>Abrechnungspositionen</h3>${a.events.length?`<div class="tablewrap"><table class="costtable"><thead><tr><th>Position</th><th>Gesamt</th><th>Verteilung</th><th>Mieteranteil</th><th>Herkunft</th></tr></thead><tbody>${a.events.map(e=>{const p=positionById(state,e.positionId);return`<tr><td>${esc(e.label)}</td><td>${euro(e.amount)}</td><td>${esc(formatRuleForReport(e))}</td><td>${euro(e.tenantAmount)}</td><td><button class="linkbutton" data-bill-trace="${e.positionId}">${esc(provenanceLabel(p))}</button></td></tr>`}).join("")}</tbody></table></div>`:`<div class="empty-state compact-empty"><strong>Noch keine Abrechnungspositionen</strong><p>Bestätigte Kosten der Periode erscheinen hier.</p></div>`}</div>
  ${snap?`<div class="legal-ok"><strong>Abrechnung eingefroren · Version ${Number(snap.version||1)}</strong><br>${esc(snapshotVerification(snap).label)}${snap.correctionReason?`<br><small>Korrekturgrund: ${esc(snap.correctionReason)}</small>`:""}</div><div class="card action-row"><button id="downloadBillingPDF" class="primary">PDF erstellen</button><button id="printBillingBtn" class="secondary">Druckansicht</button><button id="correctBillingBtn" class="secondary">Korrektur erstellen</button></div>`:`<div class="card"><button id="freezeBilling" class="primary wide" ${closure.ok?"":"disabled"}>Final prüfen & einfrieren</button>${closure.ok?"":"<p class='muted'>Der Abschluss wird automatisch freigeschaltet, sobald alle Pflichtpunkte erfüllt sind.</p>"}</div>`}`;
  if($("billingYearSelect"))$("billingYearSelect").onchange=e=>{sessionStorage.setItem("billingSelectedYear",String(Number(e.target.value)));sessionStorage.removeItem("billingSelectedLeaseId");calculationView()};
if($("billingLeaseSelect"))$("billingLeaseSelect").onchange=e=>{sessionStorage.setItem("billingSelectedLeaseId",String(e.target.value));calculationView()};
  bindV18AssistantActions();
  document.querySelectorAll("[data-closure]").forEach(b=>b.onclick=()=>{const r=routeFor[b.dataset.closure];if(r)go(r[0],r[1])});
  document.querySelectorAll("[data-bill-trace]").forEach(b=>b.onclick=()=>openPositionTrace(positionById(state,b.dataset.billTrace)));
  if($("freezeBilling"))$("freezeBilling").onclick=()=>openBillingFinalReview(y,g.selectedLeaseId);
if($("correctBillingBtn"))$("correctBillingBtn").onclick=()=>openBillingFinalReview(y,g.selectedLeaseId,snap);
  if($("downloadBillingPDF"))$("downloadBillingPDF").onclick=async()=>{try{const pdf=await generateProfessionalBillingPDF(state,y,snap);pdf.save(`Betriebskostenabrechnung_${y}.pdf`);AppFeedback.showToast("Abrechnungs-PDF erstellt",{kind:"success"})}catch(e){recordClientError("billing-pdf",e);AppFeedback.showToast("PDF-Erstellung fehlgeschlagen",{kind:"error"});alert(e.message||e)}};
  if($("printBillingBtn"))$("printBillingBtn").onclick=()=>printBilling(snap||a,y,snap)
}
function openBillingFinalReview(y,leaseId="",supersedes=null){
const baseClosure=billingClosureChecklist(state,y),g=AppRentalLifecycleUi.billingLifecycleContext(state,y,baseClosure,leaseId),closure=g.closure;if(!closure.ok)return alert("Die Abrechnung ist noch nicht vollständig.");
const a=closure.analysis,isCorrection=!!supersedes,nextVersion=isCorrection?Number(supersedes.version||1)+1:1;
modal(isCorrection?`Abrechnung korrigieren · Version ${nextVersion}`:"Abrechnung finalisieren",`<div class="legal-warn"><strong>${isCorrection?"Revisionssichere Korrektur":"Letzte Prüfung"}</strong><br>${isCorrection?"Die bisherige Abrechnung bleibt unverändert erhalten. Es entsteht eine neue Version mit eigener Prüfsumme.":"Nach dem Einfrieren wird ein revisionssicherer Snapshot mit Prüfsumme erstellt. Änderungen an Stammdaten wirken nicht rückwirkend auf diesen Snapshot."}</div>
<div class="card"><p>Mietverhältnis: <strong>${esc(a.lease?.tenantName||"Mieter/in")}</strong></p><p>Umlagefähige Kosten: <strong>${euro(a.tenantCosts)}</strong></p><p>Vorauszahlungen: <strong>${euro(a.advances)}</strong></p><p>Ergebnis: <strong>${euro(a.result)}</strong></p></div>
${isCorrection?`<label class="full">Korrekturgrund<textarea id="billingCorrectionReason" class="big-input" rows="3" placeholder="z. B. nachgereichter Gebührenbescheid"></textarea></label>`:""}
<label class="confirm-row"><input id="billingConfirm" type="checkbox"> Ich habe Zeitraum, Belege, Umlageschlüssel und Vorauszahlungen geprüft.</label>
<button id="billingFinalize" class="primary" disabled>${isCorrection?`Version ${nextVersion} einfrieren`:"Abrechnung einfrieren"}</button>`,()=>{
$("billingConfirm").onchange=e=>$("billingFinalize").disabled=!e.target.checked;
$("billingFinalize").onclick=async()=>{
const correctionReason=isCorrection?String($("billingCorrectionReason")?.value||"").trim():"";if(isCorrection&&!correctionReason)return alert("Bitte den Korrekturgrund dokumentieren.");
const payload={periodYear:y,leaseId:g.selectedLeaseId,correctionReason,supersedesSnapshotId:supersedes?.id||""};
const result=await executeCommand(isCorrection?"billing.correct":"billing.freeze",payload,async()=>{const snap=createBillingSnapshot(state,y,payload);await finalizeSnapshotIntegrity(snap);state.billingSnapshots.push(snap);return snap},{auditText:isCorrection?"Abrechnung korrigiert":"Abrechnung eingefroren",restorePoint:true});
if(!result.ok)return alert(result.message);closeModal(true);calculationView()
}
})
}
function printBilling(a,y,snapshot=null){
  const w=window.open("","_blank");if(!w)return alert("Druckfenster blockiert.");
  const lease=snapshot?.lease||state.leases?.[0],recipient=billingRecipient(lease),sender=snapshot?.correspondence||state.correspondence||{},property=snapshot?.property||state.property;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Betriebskostenabrechnung ${billingPeriodLabel(state,y)}</title><style>@page{size:A4;margin:18mm}body{font-family:Arial,sans-serif;color:#111;line-height:1.35}.sender{font-size:12px}.recipient{margin:28px 0 32px}.meta{font-size:12px;color:#444}table{width:100%;border-collapse:collapse;margin-top:18px;font-size:12px}th,td{padding:7px;border-bottom:1px solid #ddd;text-align:left}td.num,th.num{text-align:right}.result{margin-top:20px;padding:14px;border:2px solid #222}.foot{margin-top:35px;font-size:10px;color:#555}</style></head><body>
  <div class="sender"><strong>${esc(sender.landlordName||"Vermieter")}</strong><br>${esc(sender.landlordAddress||property.address||"").replace(/\n/g,"<br>")}</div>
  <div class="recipient"><strong>${esc(recipient.name||"Mieter/in")}</strong><br>${esc(recipient.address||property.address||"").replace(/\n/g,"<br>")}</div>
  <h1>Betriebskostenabrechnung</h1><p class="meta">Abrechnungszeitraum: ${billingPeriodLabel(state,y)}<br>Mietobjekt: ${esc(property.name||property.address||"")}</p>
  <table><thead><tr><th>Kostenart</th><th class="num">Gesamt</th><th>Verteilung</th><th class="num">Ihr Anteil</th></tr></thead><tbody>${(a.events||[]).map(e=>`<tr><td>${esc(e.label)}</td><td class="num">${euro(e.amount)}</td><td>${esc(formatRuleForReport(e))}</td><td class="num">${euro(e.tenantAmount)}</td></tr>`).join("")}</tbody></table>
  <div class="result"><strong>Anteilige Betriebskosten:</strong> ${euro(a.tenantCosts)}<br><strong>Vorauszahlungen:</strong> ${euro(a.advances)}<br><br><strong>${a.result>=0?"Nachzahlung":"Guthaben"}: ${euro(Math.abs(a.result))}</strong></div>
  <p>Die Kostenpositionen und verwendeten Verteilungsmaßstäbe sind einzeln ausgewiesen. Die hinterlegten Belege und Herkunftsnachweise können in der App nachvollzogen werden.</p>
  <p>Mit freundlichen Grüßen<br><br>${esc(sender.landlordName||"Vermieter")}</p>
  <div class="foot">Erstellt am ${new Date().toLocaleDateString("de-DE")}${snapshot?.integrityHash?` · Prüfsumme ${esc(String(snapshot.integrityHash).slice(0,20))}…`:""}</div>
  </body></html>`);w.document.close();setTimeout(()=>w.print(),250)
}



function ownerWorkspace(){
  const tabs=[
    {id:"overview",label:"Überblick",icon:"⌂"},
    {id:"payments",label:"Zahlungen",icon:"€"},
    {id:"planning",label:"Planung",icon:"↗"}
  ];
  const active=sub.owner||"overview",visible=visibleSub("owner",active);
  $("app").innerHTML=workspaceHeader("FINANZEN","Finanzen","Zahlungen, Planung und Termine – getrennt von der Mieterabrechnung.",tabs,visible);
  bindWorkspaceTabs("owner",ownerWorkspace);
  if(active==="overview")ownerOverview();
  else if(active==="payments")financePaymentsHubView();
  else if(active==="planning")financePlanningHubView();
  else if(active==="cashflow")ownerCashflowView();
  else if(active==="reconciliation")reconciliationView();
  else if(active==="finance")ownerFinanceView();
  else if(active==="analytics")ownerAnalyticsView();
  else ownerTasksView()
}
function ownerOverview(){
  const f=intelligentForecast(state,12),sum=f.reduce((s,x)=>s+x.net,0),rent=state.leases.reduce((s,l)=>s+Number(l.rent||0),0),repay=Number(state.finance.repayment||0),items=taskList(),overdue=items.filter(t=>daysUntil(t.due)<0),upcoming=items.filter(t=>daysUntil(t.due)>=0),shown=[...overdue,...upcoming].slice(0,4);
  $("workspaceBody").innerHTML=`<div class="grid cards">
    <article class="card metric-card"><span>Hausrate</span><strong>${euro(repay)}</strong><small>monatlich</small></article>
    <article class="card metric-card"><span>Kaltmiete</span><strong>${euro(rent)}</strong><small>monatlich</small></article>
    <article class="card metric-card"><span>Hausrate nach Kaltmiete</span><strong>${euro(repay-rent)}</strong><small>ohne weitere Hauskosten</small></article>
    <article class="card metric-card"><span>12M-Cashflow-Prognose</span><strong class="${sum<0?"negative":"positive"}">${euro(sum)}</strong><small>inkl. BK-Geldfluss</small></article>
  </div>
  <div class="info"><strong>Privater Bereich</strong><br>Hausfinanzierung und eigener Zahlungsfluss werden hier analysiert, aber niemals als umlagefähige Betriebskosten behandelt.</div>
  <section class="card embedded-overview-card">
    <div class="card-head"><div><p class="eyebrow">TERMINE</p><h3>Erinnerungen</h3></div><div class="overview-button-group"><button id="exportOverviewICS" class="secondary compact">Kalender exportieren</button><button id="addOverviewTask" class="primary compact">Hinzufügen</button></div></div>
    ${shown.length?shown.map(taskHTML).join(""):`<div class="empty-inline"><span><strong>Keine anstehenden Erinnerungen</strong><small>Fälligkeiten aus Kostenquellen und eigene Termine erscheinen automatisch hier.</small></span></div>`}
    ${items.length>4?`<button id="openAllTasks" class="secondary wide">Alle ${items.length} Erinnerungen anzeigen</button>`:""}
  </section>`;
  $("exportOverviewICS").onclick=exportICS;
  $("addOverviewTask").onclick=openTaskEditor;
  if($("openAllTasks"))$("openAllTasks").onclick=()=>go("owner","tasks")
}
function ownerFinanceView(){
  financeView()
}
function ownerCashflowView(){
  cashflowView()
}
function ownerAnalyticsView(){analyticsView()}
function ownerTasksView(){
  tasksView()
}


function smartCenterView(){
  const decisions=smartDecisionQueue(state),next=decisions[0]||null,rent=rentMonitor(state,8),proj=billingProjection(state),adv=advanceAdjustmentSuggestion(state),matches=smartPaymentPlan(state),taskSuggestions=smartTaskSuggestions(state),q=dataQualityScore(state),qBand=qualityBand(q);
  $("workspaceBody").innerHTML=`<div class="smart-hero card"><div><p class="eyebrow">ASSISTENT</p><h3>Entscheidungen statt Meldungen</h3><p class="muted">Die App priorisiert nur Punkte, bei denen du sinnvoll handeln kannst. Dringlichkeit und Sicherheit werden getrennt bewertet.</p></div><div class="quality-orb quality-${qBand.id}"><strong>${esc(qBand.label)}</strong><small>${q}% Datenqualität</small></div></div>
  ${next?`<section class="next-best-action decision-${next.severity}"><div><p class="eyebrow">EMPFEHLUNG</p><h3>${esc(next.title)}</h3><p>${esc(next.detail||"")}</p><div class="decision-meta"><span class="decision-kind">${esc(next.kind)}</span><span class="confidence confidence-${next.band.id}">${esc(next.band.label)}</span></div>${decisionWhyHTML(next)}</div><button id="smartNextOpen" class="primary">${esc(next.actionLabel)}</button></section>`:`<div class="legal-ok experience-ok"><strong>Keine offene Handlungsempfehlung.</strong><br>Die vorhandenen Daten ergeben aktuell keinen priorisierten Handlungsbedarf.</div>`}
  <div class="card"><form id="smartAskForm" class="smart-ask"><input id="smartQuestion" class="big-input" placeholder="Was möchtest du über das Haus wissen?" aria-label="Frage an den Assistenten"><button class="primary">Fragen</button></form><div class="smart-chips"><button type="button" data-smart-q="Ist die Miete eingegangen?">Miete</button><button type="button" data-smart-q="Wie sieht die Abrechnung aus?">Abrechnung</button><button type="button" data-smart-q="Was fehlt für die Abrechnung?">Vorbereitung</button><button type="button" data-smart-q="Wie ist der Wasserverbrauch?">Wasser</button><button type="button" data-smart-q="Was ist gerade wichtig?">Status</button></div><div id="smartAnswer" aria-live="polite"></div></div>
  ${decisions.length>1?`<div class="card"><div class="card-head"><div><p class="eyebrow">WEITERE ENTSCHEIDUNGEN</p><h3>Nach Wirkung sortiert</h3></div>${taskSuggestions.length?`<button id="smartTasks" class="secondary compact">Erinnerungen</button>`:""}</div>${decisions.slice(1,10).map((x,i)=>`<div class="decision-card decision-${x.severity}"><button class="decision-main" data-smart-insight="${i+1}"><span><strong>${esc(x.title)}</strong><small>${esc(x.detail||"")}</small></span><span class="confidence confidence-${x.band.id}">${esc(x.band.short)}</span></button>${decisionWhyHTML(x)}</div>`).join("")}</div>`:""}
  <div class="grid two-up"><article class="card"><p class="eyebrow">ABRECHNUNG</p><h3>${euro(Math.abs(proj.projectedResult))}</h3><p>${proj.projectedResult>=0?"voraussichtliche Nachzahlung":"voraussichtliches Guthaben"}</p><span class="confidence confidence-${confidenceBand(proj.confidence).id}">${esc(confidenceBand(proj.confidence).label)}</span></article><article class="card"><p class="eyebrow">MIETZAHLUNG</p><h3>${rent[0]?euro(rent[0].paid):"–"}</h3><p>${rent[0]?esc(rentStatusLabel(rent[0])):"kein Status"}</p></article></div>
  <details class="card secondary-detail"><summary>Weitere Auswertungen</summary><div class="detail-content"><h3>Mietzahlungsverlauf</h3><div class="tablewrap"><table class="costtable"><thead><tr><th>Monat</th><th>Soll</th><th>Erkannt</th><th>Status</th></tr></thead><tbody>${rent.map(r=>`<tr><td>${esc(r.key)}</td><td>${r.status==="none"?"–":euro(r.expected)}</td><td>${euro(r.paid)}</td><td>${esc(rentStatusLabel(r))}</td></tr>`).join("")}</tbody></table></div>${adv?`<h3>Vorauszahlungs-Check</h3><p>Aktuell ${euro(adv.current)} / Monat · rechnerischer Richtwert ${euro(adv.recommended)} / Monat.</p><small>${esc(adv.basis)}</small>`:""}${matches.length?`<h3>Zahlungszuordnungen</h3><p>${matches.length} Ausgabe(n) haben einen plausiblen Zuordnungsvorschlag. Die eigentliche Zuordnung erfolgt weiterhin nur nach deiner Bestätigung.</p>`:""}</div></details>`;
  const ask=q=>{const a=smartAnswer(state,q),host=$("smartAnswer");host.innerHTML=`<div class="smart-answer"><div class="answer-head"><strong>${esc(a.title)}</strong><span class="decision-kind">Auswertung</span></div><p>${esc(a.answer)}</p><button id="smartAnswerOpen" class="secondary">Passenden Bereich öffnen</button></div>`;$("smartAnswerOpen").onclick=()=>{if(a.route==="home")go("home");else go(a.route,a.sub||DEFAULT_SUB[a.route])}};
  $("smartAskForm").onsubmit=e=>{e.preventDefault();ask($("smartQuestion").value)};
  document.querySelectorAll("[data-smart-q]").forEach(b=>b.onclick=()=>{$("smartQuestion").value=b.dataset.smartQ;ask(b.dataset.smartQ)});
  if($("smartNextOpen"))$("smartNextOpen").onclick=()=>go(next.route,next.sub||DEFAULT_SUB[next.route]);
  document.querySelectorAll("[data-smart-insight]").forEach(b=>b.onclick=()=>{const x=decisions[Number(b.dataset.smartInsight)];if(x)go(x.route,x.sub||DEFAULT_SUB[x.route])});
  if($("smartTasks"))$("smartTasks").onclick=()=>openSmartTaskSuggestions(taskSuggestions)
}
function openSmartTaskSuggestions(items=smartTaskSuggestions(state)){
  modal("Erinnerungsvorschläge",items.length?`<div class="card"><p>Diese Vorschläge werden aus Fälligkeiten, Ablesungen und Sicherungsstatus abgeleitet.</p></div>${items.map((t,i)=>`<label class="import-row"><input type="checkbox" data-smart-task="${i}" checked><span><strong>${esc(t.title)}</strong><br>${esc(t.due)} · ${esc(t.reason)}</span></label>`).join("")}<button id="acceptSmartTasks" class="primary">Ausgewählte Erinnerungen anlegen</button>`:`<div class="legal-ok">Keine neuen Erinnerungsvorschläge.</div>`,()=>{
    if($("acceptSmartTasks"))$("acceptSmartTasks").onclick=async()=>{const selected=[...document.querySelectorAll("[data-smart-task]:checked")].map(x=>items[Number(x.dataset.smartTask)]).filter(Boolean);if(!selected.length)return;for(const t of selected)state.tasks.push({id:uid(),title:t.title,due:t.due,lead:t.lead||14,origin:"smart"});await persist("Smart-Erinnerungen angelegt",`${selected.length} Vorschlag/Vorschläge`);closeModal(true);smartCenterView()}
  })
}

function more(){
  const tabs=[
    {id:"smart",label:"Assistent",icon:"✦"},
    {id:"protection",label:"Sicherung",icon:"◇"},
    {id:"app",label:"Erweitert",icon:"•••"}
  ];
  const active=sub.more||"smart",visible=visibleSub("more",active);
  $("app").innerHTML=workspaceHeader("MEHR","Mehr","Assistent, Datensicherung und selten benötigte Einstellungen.",tabs,visible);
  bindWorkspaceTabs("more",more);
  if(active==="smart"||active==="overview")smartCenterView();
  else if(active==="legal")legalMoreView();
  else if(active==="protection")protectionHubView();
  else if(active==="app")appManagementHubView();
  else if(active==="security")securityMoreView();
  else if(active==="backup")backupMoreView();
  else if(active==="recovery")recoveryView();
  else if(active==="audit")auditMoreView();
  else diagnosticsMoreView()
}

function auditMoreView(){auditView()}
function legalMoreView(){legalView()}
function securityMoreView(){securityView()}
function diagnosticsMoreView(){diagnosticsView()}
function backupMoreView(){backupView()}


function financeView(){
  const f=intelligentForecast(state,12),sum=f.reduce((s,x)=>s+x.net,0),signals=forecastSignals(state);
  $("workspaceBody").innerHTML=`<form id="financeForm" class="card form-grid">${formField({name:"repayment",label:"Hausrate pro Monat (€)",type:"number",step:"0.01",value:state.finance.repayment})}${formField({name:"fixed",label:"Weitere feste Hauskosten pro Monat (€)",type:"number",step:"0.01",value:state.finance.fixed})}<div class="full"><button class="primary">Speichern</button></div></form>
  <div class="grid cards"><article class="card"><span>12M-Cashflow</span><strong class="${sum<0?"negative":"positive"}">${euro(sum)}</strong></article><article class="card"><span>Ø Monatsbelastung</span><strong>${euro(f.reduce((s,r)=>s+r.outflow,0)/Math.max(1,f.length))}</strong></article></div>
  ${signals.map(s=>`<div class="${s.severity==="warn"?"legal-warn":"legal-ok"}">${esc(s.text)}</div>`).join("")}
  <div class="card"><h3>12-Monats-Cashflow-Prognose</h3><p class="muted">Berücksichtigt Mietzahlungen, Hausrate, feste Hauskosten und bestätigte Kostenpositionen anhand ihres tatsächlichen Leistungszeitraums.</p><div class="tablewrap"><table class="costtable"><thead><tr><th>Monat</th><th>Einnahmen</th><th>Geplante Ausgaben</th><th>Saldo</th></tr></thead><tbody>${f.map(r=>`<tr><td>${r.label}</td><td>${euro(r.income)}</td><td>${euro(r.outflow)}</td><td class="${r.net<0?"negative":"positive"}">${euro(r.net)}</td></tr>`).join("")}</tbody></table></div></div>`;
  $("financeForm").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));const result=await executeCommand("finance.update",{repayment:Number(v.repayment)||0,fixed:Number(v.fixed)||0},async()=>{state.finance={repayment:Number(v.repayment)||0,fixed:Number(v.fixed)||0}},{auditText:"Finanzen geändert"});if(!result.ok)return alert(result.message);financeView()}
}

function cashflowView(){
  const rows=actualCashflowByMonth(state,12),sumIn=rows.reduce((s,r)=>s+r.income,0),sumOut=rows.reduce((s,r)=>s+r.outflow,0),rentHits=(state.payments||[]).filter(p=>detectRentPayment(state,p)?.score>=80);
  $("workspaceBody").innerHTML=`<div class="card"><div class="row between"><div><h3>Tatsächlicher Zahlungsfluss</h3><p class="muted">Echte Kontobewegungen. CSV-Import arbeitet mit Vorschau und Duplikaterkennung.</p></div><div><button id="importBank" class="secondary">Kontoauszug CSV</button><button id="addPayment" class="primary">Buchung hinzufügen</button></div></div><input id="bankCsvInput" type="file" accept=".csv,text/csv,text/plain" hidden></div>
  ${paymentQualityCard(state)}
  <div class="grid cards"><article class="card"><span>Einnahmen 12M</span><strong>${euro(sumIn)}</strong></article><article class="card"><span>Ausgaben 12M</span><strong>${euro(sumOut)}</strong></article><article class="card"><span>Saldo 12M</span><strong class="${sumIn-sumOut<0?"negative":"positive"}">${euro(sumIn-sumOut)}</strong></article><article class="card"><span>erkannte Mietzahlungen</span><strong>${rentHits.length}</strong></article></div>
  <div class="card"><div class="tablewrap"><table class="costtable"><thead><tr><th>Monat</th><th>Einnahmen</th><th>Ausgaben</th><th>Saldo</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.label}</td><td>${euro(r.income)}</td><td>${euro(r.outflow)}</td><td class="${r.net<0?"negative":"positive"}">${euro(r.net)}</td></tr>`).join("")}</tbody></table></div></div>
  <div class="card"><h3>Letzte Buchungen</h3>${(state.payments||[]).slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,20).map(p=>{const rm=detectRentPayment(state,p);return`<div class="item"><strong>${esc(p.date)} · ${p.direction==="income"?"+":"−"} ${euro(p.amount)}</strong><p>${esc(p.label)}</p>${rm?(()=>{const cb=confidenceBand(rm.score);return`<small class="positive">Mietzahlung wahrscheinlich · ${esc(rm.kind)} · ${esc(cb.short)}</small>`})():""}</div>`}).join("")||"<div class='empty-state'><strong>Noch keine Zahlungen erfasst</strong><p>Du kannst eine Zahlung manuell hinzufügen oder einen Kontoauszug importieren.</p></div>"}</div>`;
  $("addPayment").onclick=openPaymentEditor;$("importBank").onclick=()=>$("bankCsvInput").click();
  $("bankCsvInput").onchange=async e=>{const f=e.target.files?.[0];e.target.value="";if(!f)return;try{openBankImportPreview(parseBankCSV(await f.text()),f.name)}catch(err){recordClientError("bank-csv",err);alert("Import nicht möglich: "+(err.message||err))}}
}
function openBankImportPreview(parsed,fileName){
  const rows=bankImportPreview(state,parsed),fresh=rows.filter(x=>!x.duplicate);
  modal("Kontoauszug importieren",`<div class="card"><h3>${esc(fileName)}</h3><p>${rows.length} Buchungen erkannt · <strong>${fresh.length} neu</strong> · ${rows.length-fresh.length} Duplikat(e).</p><p class="muted">Vor dem Import wird nichts gespeichert.</p></div><div class="import-preview">${rows.slice(0,80).map((r,i)=>`<label class="import-row ${r.duplicate?"duplicate":""}"><input type="checkbox" data-import-row="${i}" ${r.duplicate?"disabled":"checked"}><span><strong>${esc(r.date)} · ${r.direction==="income"?"+":"−"} ${euro(r.amount)}</strong><br>${esc(r.label)}${r.rentMatch?(()=>{const cb=confidenceBand(r.rentMatch.score);return`<br><small class="positive">Mietzahlung: ${esc(r.rentMatch.kind)} · ${esc(cb.short)}</small>`})():""}${r.duplicate?"<br><small>bereits vorhanden</small>":""}</span></label>`).join("")}</div><button id="commitBankImport" class="primary" ${fresh.length?"":"disabled"}>Ausgewählte Buchungen importieren</button>`,()=>{
    $("commitBankImport").onclick=async()=>{const selected=[...document.querySelectorAll("[data-import-row]:checked")].map(x=>rows[Number(x.dataset.importRow)]).filter(Boolean);if(!selected.length)return;
      createRestorePoint("Vor Kontoimport");
      const result=await executeCommand("bank.csv.import",{fileName,count:selected.length},async()=>{for(const r of selected)state.payments.push({id:uid(),date:r.date,direction:r.direction,label:r.label,amount:r.amount,sourceId:"",positionId:"",importOrigin:"csv",importFile:fileName});state.meta.importHistory.unshift({id:uid(),at:new Date().toISOString(),fileName,recognized:rows.length,imported:selected.length,duplicates:rows.length-fresh.length});state.meta.importHistory=state.meta.importHistory.slice(0,25)},{auditText:"Kontoauszug importiert"});
      if(!result.ok)return alert(result.message);AppFeedback.showToast(`${selected.length} Buchung(en) importiert`,{kind:"success"});closeModal(true);cashflowView()
    }
  })
}
function openPaymentEditor(){
  const sources=(state.sources||[]).map(s=>({value:s.id,label:s.name})),positions=(state.costPositions||[]).filter(p=>p.confirmed).map(p=>({value:p.id,label:`${p.label} · ${euro(p.amount)}`}));
  modal("Zahlung erfassen",`<form id="f" class="form-grid">${formField({name:"date",label:"Datum",type:"date",value:localDateISO()})}${formField({name:"direction",label:"Art",type:"select",value:"outflow",options:[{value:"outflow",label:"Ausgabe"},{value:"income",label:"Einnahme"}]})}${formField({name:"label",label:"Bezeichnung"})}${formField({name:"amount",label:"Betrag €",type:"number",step:"0.01",min:0.01})}${formField({name:"sourceId",label:"Quelle",type:"select",value:"",options:[{value:"",label:"keine Quelle"},...sources]})}${formField({name:"positionId",label:"Kostenposition",type:"select",value:"",options:[{value:"",label:"keine Kostenposition"},...positions]})}<div class="full"><button class="primary">Speichern</button></div></form>`,()=>{
    $("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target)),amount=Number(v.amount);if(!v.date)return alert("Bitte ein Buchungsdatum eintragen.");if(!String(v.label||"").trim())return alert("Bitte eine aussagekräftige Bezeichnung eintragen.");if(!Number.isFinite(amount)||amount<=0)return alert("Der Betrag muss größer als 0,00 € sein.");const payment={id:uid(),buildingId:activeBuildingId,date:v.date,direction:v.direction,label:v.label.trim(),amount,sourceId:v.sourceId||"",positionId:v.positionId||""};const result=await executeCommand("payment.create",payment,async()=>state.payments.push(payment),{auditText:"Zahlung erfasst"});if(!result.ok)return alert(result.message);closeModal(true);cashflowView()}
  })
}

function analyticsView(){
  const y=currentPeriodYear(),cmp=annualComparison(state,y),alerts=costTrendAlerts(state,y),meters=state.meters||[],bp=billingPeriodInfo(state,y),prev=billingPeriodInfo(state,y-1);
  $("workspaceBody").innerHTML=`<div class="card"><h3>Jahresvergleich & Verbrauchsanalyse</h3><p class="muted">Volle Jahresperioden werden direkt verglichen. Übernahme-Teilperioden werden ausdrücklich als nicht direkt vergleichbar markiert.</p></div>
  ${(bp.days<bp.nominalDays||prev.days<prev.nominalDays)?`<div class="info"><strong>Teilperiode berücksichtigt</strong><br>${bp.days<bp.nominalDays?`${esc(billingPeriodLabel(state,y))} ist eine verkürzte Übernahmeperiode. `:""}${prev.days<prev.nominalDays?`${esc(billingPeriodLabel(state,y-1))} war eine verkürzte Periode. `:""}Prozentvergleiche werden dafür nicht als regulärer Jahresvergleich ausgegeben.</div>`:""}
  ${alerts.length?alerts.map(a=>`<div class="${a.severity==="warn"?"legal-warn":"info"}">${esc(a.text)}</div>`).join(""):`<div class="legal-ok">✓ Keine belastbare Kostenänderung über 15 % zwischen zwei vollen Jahresperioden erkannt.</div>`}
  <div class="card"><h3>${esc(billingPeriodLabel(state,y-1))} → ${esc(billingPeriodLabel(state,y))}</h3><div class="tablewrap"><table class="costtable"><thead><tr><th>Kategorie</th><th>Vorperiode</th><th>Aktuell</th><th>Änderung</th></tr></thead><tbody>${cmp.map(x=>`<tr><td>${esc(categoryLabel(x.category))}</td><td>${euro(x.prior)}</td><td>${euro(x.current)}</td><td class="${x.change>0?"negative":"positive"}">${x.comparable&&x.pct!=null?`${x.pct>=0?"+":""}${Math.round(x.pct*100)} %`:"Teilperiode"}</td></tr>`).join("")||"<tr><td colspan='4'>Noch keine zwei Perioden vorhanden.</td></tr>"}</tbody></table></div></div>
  ${meters.map(m=>{const t=meterTrend(m),an=robustMeterAnomalies(m);return`<div class="card"><h3>${esc(m.name)}</h3><p>${t.segments.length?`Ø ${t.avgPer30.toFixed(2)} ${esc(m.unit||"")} je 30 Tage`:"Noch zu wenige Ablesungen für einen Trend."}</p>${an.map(a=>`<div class="legal-warn">${esc(a.text)}</div>`).join("")}<div class="tablewrap"><table class="costtable"><thead><tr><th>Zeitraum</th><th>Verbrauch</th><th>/30 Tage</th></tr></thead><tbody>${t.segments.slice(-8).reverse().map(x=>`<tr><td>${esc(x.from.date)}–${esc(x.to.date)}</td><td>${x.delta.toFixed(3)} ${esc(m.unit||"")}</td><td>${x.per30.toFixed(3)}</td></tr>`).join("")}</tbody></table></div></div>`}).join("")}`
}
function reconciliationView(){
  const r=reconciliationSummary(state),open=r.rows.filter(x=>Math.abs(x.difference)>.01),plan=smartPaymentPlan(state);
  $("workspaceBody").innerHTML=`<div class="card"><div class="row between"><div><h3>Zahlungen zuordnen</h3><p class="muted">Betrag, Buchungstext und Fälligkeit werden gemeinsam bewertet. Gespeichert wird erst nach deiner Bestätigung.</p></div></div></div>
  <div class="grid cards"><article class="card"><span>Kostenpositionen</span><strong>${r.rows.length}</strong></article><article class="card"><span>Abweichungen</span><strong>${open.length}</strong></article><article class="card"><span>Plausible Vorschläge</span><strong>${plan.length}</strong></article></div>
  ${plan.length?`<div class="card"><h3>Vorschläge</h3>${plan.slice(0,8).map((x,i)=>{const s=x.suggestions[0],cb=confidenceBand(s.score);return`<div class="decision-row"><span><strong>${esc(x.payment.label)} · ${euro(x.payment.amount)}</strong><small>→ ${esc(s.target.label||s.target.name)} · ${s.type==="source"?"Kostenquelle":"Kostenposition"}<br>${esc(s.reasons.join(" · "))}</small></span><span><span class="confidence confidence-${cb.id}">${esc(cb.short)}</span><button class="secondary compact" data-recon-smart="${i}">Zuordnen</button></span></div>`}).join("")}</div>`:`<div class="legal-ok">✓ Aktuell keine ausreichend plausiblen offenen Zuordnungsvorschläge.</div>`}
  <div class="card"><h3>Zahlungsabgleich</h3><div class="tablewrap"><table class="costtable"><thead><tr><th>Position</th><th>Soll</th><th>Bezahlt</th><th>Differenz</th></tr></thead><tbody>${r.rows.map(x=>`<tr><td>${esc(x.position.label)}</td><td>${euro(x.position.amount)}</td><td>${euro(x.paid)}</td><td class="${Math.abs(x.difference)>.01?"negative":"positive"}">${euro(x.difference)}</td></tr>`).join("")}</tbody></table></div></div>`;
  const accept=async i=>{const x=plan[i],s=x?.suggestions?.[0];if(!x||!s)return;if(!confirm(`„${x.payment.label}“ (${euro(x.payment.amount)}) mit „${s.target.label||s.target.name}“ verknüpfen?`))return;const res=await executeCommand("payment.smartMatch",{paymentId:x.payment.id,type:s.type,targetId:s.target.id,score:s.score},async()=>{if(s.type==="position"){x.payment.positionId=s.target.id;x.payment.sourceId=s.target.sourceId||""}else x.payment.sourceId=s.target.id},{auditText:"Zahlung zugeordnet"});if(!res.ok)return alert(res.message);reconciliationView()};
  document.querySelectorAll("[data-recon-smart]").forEach(b=>b.onclick=()=>accept(Number(b.dataset.reconSmart)))
}

function tasksView(){
  const items=taskList(),overdue=items.filter(t=>daysUntil(t.due)<0),upcoming=items.filter(t=>daysUntil(t.due)>=0);
  $("workspaceBody").innerHTML=`<div class="card"><div class="row between"><div><h3>Erinnerungen</h3><p class="muted">Fälligkeiten aus Kostenquellen und eigene Erinnerungen erscheinen gemeinsam. Der Kalenderexport übernimmt den aktuellen Stand.</p></div><div><button id="ics" class="secondary">Kalender exportieren</button><button id="addTask" class="primary">Erinnerung hinzufügen</button></div></div></div>
  ${overdue.length?`<section class="card"><h3>Überfällig</h3>${overdue.map(taskHTML).join("")}</section>`:""}
  ${upcoming.length?`<section class="card"><h3>Demnächst</h3>${upcoming.slice(0,20).map(taskHTML).join("")}</section>`:`<div class="legal-ok">✓ Keine anstehenden Erinnerungen.</div>`}`;
  $("addTask").onclick=openTaskEditor;$("ics").onclick=exportICS
}
function openTaskEditor(){
  modal("Erinnerung hinzufügen",`<form id="f" class="form-grid">${formField({name:"title",label:"Titel"})}${formField({name:"due",label:"Fällig am",type:"date"})}${formField({name:"lead",label:"Vorwarnung (Tage)",type:"number",value:14})}<div class="full"><button class="primary">Speichern</button></div></form>`,()=>{$("f").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));state.tasks.push({id:uid(),title:v.title,due:v.due,lead:Number(v.lead)||14});await persist("Erinnerung angelegt",v.title);closeModal(true);route==="owner"?(sub.owner==="overview"?ownerOverview():ownerTasksView()):tasksView()}})
}
function exportICS(){
  let out="BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Mietverwaltung//DE\r\n";
  for(const t of taskList()){if(!t.due)continue;out+=`BEGIN:VEVENT\r\nUID:${t.id}@mietverwaltung\r\nDTSTART;VALUE=DATE:${t.due.replaceAll("-","")}\r\nSUMMARY:${String(t.title).replace(/,/g,"\\,")}\r\nBEGIN:VALARM\r\nTRIGGER:-P${Number(t.lead||14)}D\r\nACTION:DISPLAY\r\nDESCRIPTION:${String(t.title).replace(/,/g,"\\,")}\r\nEND:VALARM\r\nEND:VEVENT\r\n`}
  out+="END:VCALENDAR\r\n";const blob=new Blob([out],{type:"text/calendar"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="Mietverwaltung_Erinnerungen.ics";a.click();URL.revokeObjectURL(a.href)
}
function auditView(){
  $("workspaceBody").innerHTML=state.audit.length?state.audit.map(x=>`<div class="item"><h3>${esc(x.action)}</h3><p>${esc(x.detail)}</p><small>${new Date(x.at).toLocaleString("de-DE")}</small></div>`).join(""):`<div class="card muted">Noch keine Änderungen protokolliert.</div>`
}
function legalView(){
  const effective=ACTIVE_LEGAL_PACK?.effectiveDate||LAW_DATE,age=Math.max(0,calendarDayDiff(effective,smartToday())),sources=ACTIVE_LEGAL_PACK?.sources||LEGAL_SOURCES;
  $("workspaceBody").innerHTML=`<div class="${age<=90?"legal-ok":"legal-warn"}"><strong>Rechtsstand ${esc(effective)}</strong><br>${age<=90?"Aktueller Prüfstand hinterlegt.":`Letzte Prüfung vor ${age} Tagen.`}</div><div class="card"><h3>Amtliche Quellen</h3>${sources.map(s=>`<p><a href="${s.url}" target="_blank" rel="noopener">${esc(s.name)}</a>${s.purpose?`<br><small>${esc(s.purpose)}</small>`:""}</p>`).join("")}<button id="reloadRules" class="secondary">Rechtsstand neu laden</button></div>`;
  $("reloadRules").onclick=async()=>{await loadLegalPack();legalView()}
}

async function storageStatus(){
  let persisted=false,usage=0,quota=0;
  try{if(navigator.storage?.persisted) persisted=await navigator.storage.persisted()}catch(e){console.warn(e)}
  try{
    if(navigator.storage?.estimate){
      const x=await navigator.storage.estimate();
      usage=Number(x.usage||0); quota=Number(x.quota||0);
    }
  }catch(e){console.warn(e)}
  return {persisted,usage,quota};
}


async function requestPersistentStorage(){
  try{return navigator.storage?.persist ? await navigator.storage.persist() : false}
  catch(e){console.warn(e);return false}
}


function humanBytes(n){
  n=Number(n||0); if(!n)return "0 MB";
  const units=["B","KB","MB","GB"],i=Math.min(3,Math.floor(Math.log(n)/Math.log(1024)));
  return `${(n/Math.pow(1024,i)).toFixed(i<2?0:1)} ${units[i]}`;
}


async function updateBadge(){
  try{
    const now=new Date(new Date().toDateString()),tasks=typeof taskList==="function"?taskList():[];
    const due=tasks.filter(t=>{if(!t?.due)return false;const diff=Math.ceil((new Date(t.due+"T00:00:00")-now)/86400000);return diff<=Number(t.lead||30)}).length;
    const smart=typeof smartDecisionQueue==="function"?smartDecisionQueue(state).filter(x=>x.severity==="bad"||x.severity==="warn").length:0;
    const count=Math.min(99,due+smart);
    if(count>0&&navigator.setAppBadge)await navigator.setAppBadge(count);else if(navigator.clearAppBadge)await navigator.clearAppBadge()
  }catch(e){console.warn("App-Badge nicht verfügbar:",e)}
}


let SW_UPDATE_WAITING=false;
function setupServiceWorkerUpdates(){
  if(!("serviceWorker" in navigator))return;
  SERVICE_WORKER_REGISTRATION.then(reg=>{
    if(!reg)return;
    const watch=worker=>{
      if(!worker)return;
      const mark=()=>{if(worker.state==="installed"&&navigator.serviceWorker.controller)SW_UPDATE_WAITING=true};
      mark();worker.addEventListener("statechange",mark)
    };
    if(reg.waiting&&navigator.serviceWorker.controller)SW_UPDATE_WAITING=true;
    watch(reg.installing);
    reg.addEventListener("updatefound",()=>watch(reg.installing));
  }).catch(e=>console.warn("Service-Worker-Updateprüfung nicht verfügbar:",e));
}
async function activateWaitingServiceWorker(){
  try{const reg=await navigator.serviceWorker.getRegistration();if(reg?.waiting){reg.waiting.postMessage({type:"SKIP_WAITING"});location.reload()}else alert("Es wartet derzeit kein Update.")}
  catch(e){recordClientError("service-worker-update",e);alert("Update konnte nicht aktiviert werden.")}
}


function securityView(){
  $("workspaceBody").innerHTML=`<div class="card"><div class="card-head"><div><p class="eyebrow">GERÄTESCHUTZ</p><h3>Face ID / Geräteauthentifizierung</h3></div><div id="authStatus"></div></div><p class="muted">Auf unterstützten Geräten bestätigt iOS den Zugriff mit Face ID, Touch ID oder Gerätecode.</p><div class="action-row"><button id="authEnable" class="primary">Aktivieren</button><button id="authTest" class="secondary">Funktion prüfen</button><button id="authDisable" class="danger">Deaktivieren</button></div></div><div class="info"><strong>Wichtig:</strong> Der Geräteschutz sperrt den App-Zugang. Die lokale IndexedDB wird dadurch nicht zusätzlich verschlüsselt. Für transportierbare Daten ist die verschlüsselte Datensicherung vorgesehen.</div>`;
  const refresh=()=>{const on=authEnabled();$("authStatus").innerHTML=`<span class="pill ${on?"good":"warn"}">${on?"Aktiv":"Nicht aktiv"}</span>`;$("authEnable").disabled=on;$("authDisable").disabled=!on};refresh();
  $("authEnable").onclick=async()=>{try{await registerDevice();refresh()}catch(e){alert(e.message)}};
  $("authTest").onclick=async()=>alert(await authenticate()?"Geräteschutz funktioniert.":"Authentifizierung fehlgeschlagen.");
  $("authDisable").onclick=async()=>{if(!confirm("Geräteschutz wirklich deaktivieren?"))return;if(authEnabled()&&!(await authenticate()))return alert("Authentifizierung erforderlich.");disableAuth();refresh()}
}
async function diagnosticsView(){
  const tests=runSelfTests(),coverageMissing=checkInputCoverage(),ok=tests.filter(t=>t.ok).length,st=await storageStatus(),pct=st.quota?Math.round(st.usage/st.quota*100):0,integrity=integritySummary(state),errors=state.meta?.errorLog||[],allOk=ok===tests.length&&integrity.ok&&!coverageMissing.length;
  $("workspaceBody").innerHTML=`<div class="card"><h3>App-Prüfung</h3><div class="analysis-grid"><div><small>Gesamtstatus</small><strong>${allOk?"OK":"Prüfen"}</strong></div><div><small>Datenqualität</small><strong>${dataQualityScore(state)}%</strong></div><div><small>Prüfungen</small><strong>${ok}/${tests.length}</strong></div></div></div>
  ${integrity.errors.length?`<div class="legal-bad"><strong>Datenfehler</strong>${integrity.errors.map(x=>`<p>${esc(x)}</p>`).join("")}</div>`:`<div class="legal-ok">✓ Datenbestand ohne blockierende Fehler.</div>`}
  ${integrity.warnings.length?`<div class="legal-warn"><strong>Zu prüfen</strong>${integrity.warnings.map(x=>`<p>${esc(x)}</p>`).join("")}</div>`:""}
  ${coverageMissing.length?`<div class="legal-bad"><strong>Interner Navigationsfehler</strong><br>${coverageMissing.map(esc).join("<br>")}</div>`:""}
  <div class="card"><h3>Lokaler Speicher</h3><p>${st.persisted?"Dauerhafter Speicher ist angefordert.":"Der Browser kann lokale Daten bei starkem Speicherdruck theoretisch entfernen."}</p><p>Nutzung: ${humanBytes(st.usage)} von ca. ${humanBytes(st.quota)} (${pct} %)</p><div class="storage-meter"><span style="width:${Math.min(100,pct)}%"></span></div>${st.persisted?"":`<p><button id="persistBtn" class="primary">Dauerhaften Speicher anfordern</button></p>`}</div>
  <details class="card"><summary><strong>Prüfdetails</strong></summary>${tests.map(t=>`<p class="${t.ok?"test-ok":"test-bad"}">${t.ok?"✓":"✕"} ${esc(t.name)}</p>`).join("")}</details>
  <details class="card"><summary><strong>Technische Details</strong></summary><p>Geräteauthentifizierung: ${window.PublicKeyCredential?"verfügbar":"nicht verfügbar"} · App-Badge: ${navigator.setAppBadge?"verfügbar":"nicht verfügbar"} · Offline-Unterstützung: ${"serviceWorker" in navigator?"verfügbar":"nicht verfügbar"}</p><p>App ${APP_VERSION} · Schema ${SCHEMA_VERSION} · Datenmodell ${DOMAIN_VERSION} · Smart Engine ${SMART_ENGINE_VERSION}</p><p>Revision ${integrity.revision} · protokollierte Änderungen ${(state.meta?.commandLog||[]).length} · Sicherungspunkte ${(state.meta?.restorePoints||[]).length}</p><p>Rechtsstand ${esc(ACTIVE_LEGAL_PACK?.effectiveDate||LAW_DATE)}</p>${SW_UPDATE_WAITING?`<p class="legal-warn">Eine neue App-Version ist bereit.</p><button id="activateUpdate" class="primary">Update aktivieren</button>`:""}</details>
  <details class="card"><summary><strong>Fehlerprotokoll (${errors.length})</strong></summary>${errors.length?errors.slice(0,20).map(e=>`<div class="task"><strong>${esc(e.context)}</strong><br><small>${new Date(e.at).toLocaleString("de-DE")}</small><p>${esc(e.message)}</p></div>`).join(""):"<p class='muted'>Keine protokollierten Laufzeitfehler.</p>"}<button id="clearErrors" class="secondary">Fehlerprotokoll leeren</button></details>`;
  if($("persistBtn"))$("persistBtn").onclick=async()=>{const granted=await requestPersistentStorage();alert(granted?"Dauerhafter Speicher wurde angefordert.":"Der Browser hat die Anfrage derzeit nicht bestätigt.");diagnosticsView()};
  $("clearErrors").onclick=async()=>{state.meta.errorLog=[];await persist("Fehlerprotokoll geleert","");diagnosticsView()};if($("activateUpdate"))$("activateUpdate").onclick=()=>activateWaitingServiceWorker()
}

function recoveryView(){
  const pts=state.meta?.restorePoints||[];
  $("workspaceBody").innerHTML=`<div class="card"><h3>Sicherungspunkte</h3><p class="muted">Vor wichtigen Änderungen kann ein lokaler Rücksprungpunkt gespeichert werden. Beim Wiederherstellen wird der aktuelle Stand automatisch als neuer Sicherungspunkt erhalten.</p><button id="createRestorePoint" class="primary">Sicherungspunkt erstellen</button></div>${pts.map(p=>`<div class="item"><div class="row between"><div><strong>${esc(p.label)}</strong><p>${new Date(p.at).toLocaleString("de-DE")}</p></div><button class="secondary" data-restore="${p.id}">Wiederherstellen</button></div></div>`).join("")||"<div class='card muted'>Noch keine Sicherungspunkte.</div>"}`;
  $("createRestorePoint").onclick=async()=>{createRestorePoint("Manuell erstellt");await persist("Sicherungspunkt erstellt","manuell");recoveryView()};
  document.querySelectorAll("[data-restore]").forEach(b=>b.onclick=async()=>{if(!confirm("Diesen Stand wiederherstellen? Der aktuelle Stand bleibt als Sicherungspunkt erhalten."))return;try{await restoreFromPoint(b.dataset.restore);alert("Stand wiederhergestellt.");render()}catch(e){alert("Wiederherstellung fehlgeschlagen: "+(e.message||e))}})
}

function backupView(){
  const stamp=localDateISO(),last=state.meta?.lastBackupAt?new Date(state.meta.lastBackupAt).toLocaleString("de-DE"):"noch keine";
  $("workspaceBody").innerHTML=`<div class="card"><div class="item-title-row"><div><p class="eyebrow">EMPFOHLEN</p><h3>Verschlüsselte Datensicherung</h3></div><span class="pill good">Stammdaten + Dokumente</span></div><p>Letzte erstellte Sicherung: <strong>${esc(last)}</strong></p><label>Passwort<input id="backupPw" type="password" class="big-input" placeholder="mindestens 8 Zeichen" autocomplete="new-password"></label><div class="action-row"><button id="fullExport" class="primary">Sicherung erstellen</button><label class="file-label">Sicherung auswählen<input id="fullImportFile" type="file" accept=".json,application/json"></label><button id="fullImport" class="secondary">Wiederherstellen</button></div><p class="muted">Das Passwort wird nicht gespeichert. Ohne Passwort kann eine verschlüsselte Sicherung nicht wiederhergestellt werden.</p></div>
  <details class="card secondary-detail"><summary>Technischer Klartext-Export</summary><div class="detail-content"><div class="legal-warn"><strong>Unverschlüsselt</strong><br>Enthält persönliche Verwaltungsdaten im Klartext und keine Dokumentdateien. Nur für technische Zwecke verwenden.</div><button id="exportState" class="secondary">JSON exportieren</button></div></details>`;
  $("exportState").onclick=()=>{const blob=new Blob([JSON.stringify(fullPortfolioState(),null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`Mietverwaltung_Daten_${stamp}.json`;a.click();URL.revokeObjectURL(a.href)};
  $("fullExport").onclick=async()=>{const pw=$("backupPw").value;if(pw.length<8)return alert("Bitte mindestens 8 Zeichen für das Passwort verwenden.");const wrapper=await createFullBackup(fullPortfolioState(),pw),blob=new Blob([JSON.stringify(wrapper)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`Mietverwaltung_Datensicherung_${stamp}.json`;a.click();URL.revokeObjectURL(a.href);state.meta.lastBackupAt=new Date().toISOString();await persist("Datensicherung erstellt","verschlüsselt");backupView()};
  $("fullImport").onclick=async()=>{const f=$("fullImportFile").files[0],pw=$("backupPw").value;if(!f)return alert("Bitte zuerst eine Datensicherung auswählen.");if(pw.length<1)return alert("Bitte das Passwort der Datensicherung eingeben.");const oldState=cloneState(fullPortfolioState()),oldDocs=await listAllDocuments();try{const wrapper=JSON.parse(await f.text()),decoded=await decodeFullBackup(wrapper,pw),next=ensureTraceShape(repairDomainState(decoded.state)),check=validateDomainState(next);if(check.errors.length)throw new Error("Die Sicherung enthält fehlerhafte Daten: "+check.errors.join(" · "));if(!confirm(`Geprüfte Sicherung wiederherstellen? ${decoded.documents.length} Dokument(e) werden übernommen.`))return;createRestorePoint("Vor Datensicherung-Import");const importRestorePoints=fullPortfolioState().meta?.restorePoints||[];await replaceAllDocuments(decoded.documents);next.meta.restorePoints=[...importRestorePoints,...(next.meta.restorePoints||[])].slice(0,5);await saveState(next);applyRestoredPortfolioState(next);alert("Datensicherung erfolgreich wiederhergestellt.");more()}catch(e){try{await replaceAllDocuments(oldDocs);await saveState(oldState);applyRestoredPortfolioState(oldState)}catch{}alert("Wiederherstellung fehlgeschlagen: "+(e.message||e))}}
}
function setupGlobal(){
  document.querySelectorAll(".main-tabs button").forEach(b=>b.onclick=()=>goTop(b.dataset.route));
  $("modalClose").onclick=()=>closeModal(false);
  $("searchBtn").onclick=()=>{$("searchOverlay").classList.remove("hidden");$("searchInput").value="";search("");setTimeout(()=>$("searchInput").focus(),30)};
  $("searchClose").onclick=()=>{$("searchOverlay").classList.add("hidden");$("searchBtn").focus()};
  $("searchInput").oninput=e=>search(e.target.value);
  $("quickBtn").onclick=()=>{$("quickOverlay").classList.remove("hidden");setTimeout(()=>focusableIn($("quickOverlay"))[0]?.focus?.(),30)};
  $("quickClose").onclick=()=>{$("quickOverlay").classList.add("hidden");$("quickBtn").focus()};
  document.querySelectorAll("[data-quick]").forEach(b=>b.onclick=()=>{
    const q=b.dataset.quick;
    MODAL_RETURN_FOCUS_OVERRIDE=["document","meter","payment","source","task"].includes(q)?$("quickBtn"):null;
    $("quickOverlay").classList.add("hidden");
    if(q==="document"){go("data","documents");setTimeout(openDocumentCapture,0)}
    else if(q==="meter"){go("data","infrastructure");setTimeout(()=>openMeterPhotoCapture(),0)}
    else if(q==="payment"){go("owner","cashflow");setTimeout(openPaymentEditor,0)}
    else if(q==="source"){go("data","sources");setTimeout(openSourceEditor,0)}
    else if(q==="task"){go("owner","tasks");setTimeout(()=>openTaskEditor(),0)}
    else {go("rental","overview");setTimeout(()=>openLeaseEditor(state.leases?.[0]||null),0)}
  })
}
function search(q){
  const z=normalizeLabelText(q||""),rows=[];
  const add=(title,detail,route,sub,keywords="")=>rows.push({title,detail,route,sub,keywords});
  add(state.property.name||"Objekt","Haus · Objektdaten","data","object","adresse wohnfläche baujahr");
  (state.sources||[]).forEach(s=>add(s.name,"Haus · Kostenquelle","data","sources",`${categoryLabel(s.category)} fälligkeit bescheid vertrag`));
  (state.costPositions||[]).forEach(p=>add(p.label,`Haus · Kostenposition · ${euro(p.amount)}`,"data","positions",`${categoryLabel(p.category)} umlage kosten`));
  (state.tasks||[]).forEach(t=>add(t.title,`Finanzen · Erinnerung · ${dateDE(t.due)}`,"owner","tasks","termin fällig"));
  (state.payments||[]).forEach(p=>add(p.label,`Finanzen · ${p.direction==="income"?"Einnahme":"Ausgabe"} · ${dateDE(p.date)} · ${euro(p.amount)}`,"owner","cashflow","zahlung buchung konto"));
  (state.meters||[]).forEach(m=>add(m.name,`Haus · Zähler · ${m.number||"ohne Nummer"}`,"data","infrastructure","wasser zählerstand ablesung"));
  (state.documentsCache||[]).forEach(d=>add(d.label||d.name,`Haus · Dokument · ${documentWorkflowLabel(d)}`,"data","documents","beleg pdf scan ocr"));
  (state.leases||[]).forEach(l=>add("Mietvertrag",`Vermietung · ab ${dateDE(l.start)}`,"rental","overview",`${l.tenantName||""} miete vertrag`));
  [
    ["Kaltwasser","Vermietung · Zähler & Verbrauch","rental","water","wasser verbrauch"],
    ["Betriebskostenabrechnung","Vermietung · Abrechnung","rental","billing","abrechnung betriebskosten nebenkosten"],
    ["Datensicherung","Mehr · Sicherheit","more","backup","backup sicherung export"],
    ["Assistent","Mehr · Entscheidungen","more","smart","status wichtig"]
  ].forEach(x=>add(...x));

  if(!z){
    const suggestions=[
      ["Betriebskostenabrechnung","Vermietung · Abrechnung","rental","billing"],
      ["Kaltwasser","Vermietung · Verbrauch","rental","water"],
      ["Dokumente","Haus · Dokumente","data","documents"],
      ["Zahlungen","Finanzen · Zahlungsfluss","owner","cashflow"],
      ["Kostenpositionen","Haus · Kosten","data","positions"],
      ["Datensicherung","Mehr · Sicherheit","more","backup"]
    ];
    $("searchResults").innerHTML=`<p class="search-section-title">Häufig gebraucht</p>${suggestions.map((r,i)=>`<button class="search-result" data-suggestion="${i}"><span><strong>${esc(r[0])}</strong><small>${esc(r[1])}</small></span><b>›</b></button>`).join("")}`;
    document.querySelectorAll("[data-suggestion]").forEach(b=>b.onclick=()=>{const r=suggestions[Number(b.dataset.suggestion)];$("searchOverlay").classList.add("hidden");go(r[2],r[3])});return
  }
  const tokens=z.split(/\s+/).filter(Boolean);
  const ranked=rows.map(r=>{
    const hay=normalizeLabelText(`${r.title} ${r.detail} ${r.keywords}`),title=normalizeLabelText(r.title);
    let score=tokenSimilarity(z,hay)*60+tokenSimilarity(z,title)*35;
    if(title===z)score+=80;else if(title.startsWith(z))score+=55;else if(hay.includes(z))score+=30;
    score+=tokens.reduce((s,t)=>s+(title.includes(t)?12:hay.includes(t)?5:0),0);
    return {...r,score}
  }).filter(r=>r.score>8).sort((a,b)=>b.score-a.score).slice(0,24);
  $("searchResults").innerHTML=ranked.length?ranked.map((r,i)=>`<button class="search-result" data-search="${i}"><span><strong>${esc(r.title)}</strong><small>${esc(r.detail)}</small></span><b>›</b></button>`).join(""):`<div class="empty-state"><strong>Keine passenden Treffer</strong><p>Versuche einen kürzeren Begriff wie „Wasser“, „Miete“ oder „Bescheid“.</p></div>`;
  document.querySelectorAll("[data-search]").forEach(b=>b.onclick=()=>{const r=ranked[Number(b.dataset.search)];$("searchOverlay").classList.add("hidden");go(r.route,r.sub)})
}

function updateConnectionState(){
  const el=$("connectionState");if(!el)return;el.textContent=navigator.onLine?"Online":"Offline";el.className=`connection-pill ${navigator.onLine?"online":"offline"}`
}
function setupRuntimeGuards(){
  updateConnectionState();window.addEventListener("online",updateConnectionState);window.addEventListener("offline",updateConnectionState);
  window.addEventListener("error",e=>recordClientError("window-error",e.error||e.message));
  window.addEventListener("unhandledrejection",e=>recordClientError("unhandled-promise",e.reason));
  document.addEventListener("keydown",e=>{
    trapFocusInDialog(e);
    if(e.key==="Escape"){
      const dlg=visibleDialog();if(!dlg)return;
      if(dlg.id==="modal")closeModal(false);
      else{dlg.classList.add("hidden");$("searchBtn")?.focus?.()}
    }
  })
}
async function startApp(){
  setupGlobal();setupRuntimeGuards();
  await loadLegalPack();
  try{if(navigator.storage?.persist)await navigator.storage.persist()}catch{}
  try{setupServiceWorkerUpdates()}catch(e){console.warn("Updateprüfung übersprungen:",e)}
  if(authEnabled()){
    const ok=await authenticate();
    if(!ok){document.body.innerHTML=`<div style="padding:40px;font-family:-apple-system"><h1>Mietverwaltung gesperrt</h1><p>Geräteauthentifizierung fehlgeschlagen.</p><button onclick="location.reload()">Erneut versuchen</button></div>`;return}
  }
  render();try{await updateBadge()}catch(e){console.warn("Badge übersprungen:",e)}
}
startApp();


}catch(error){
  console.error("Mietverwaltung Startfehler:",error);
  const host=document.getElementById("app");
  if(host){
    host.innerHTML=`<section>
      <div class="legal-bad">
        <h2>Die App konnte nicht gestartet werden</h2>
        <p>${String(error?.message||error)}</p>
        <p>Diese Fehlermeldung ist absichtlich sichtbar, damit ein Startproblem nicht mehr nur als leere Seite erscheint.</p>
      </div>
    </section>`;
  }
}
})();


/* Professional PWA hardening */
(async()=>{try{if(navigator.storage&&navigator.storage.persist){await navigator.storage.persist();}}catch(e){console.warn('Persistent storage request failed',e)}})();
