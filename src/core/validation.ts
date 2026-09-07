export type ValidationLevel = "ok" | "warning" | "error";

export interface ValidationResult<T = string> {
  ok: boolean;
  level: ValidationLevel;
  value?: T;
  message?: string;
}

const valid = <T>(value: T): ValidationResult<T> => ({ ok: true, level: "ok", value });
const invalid = <T = string>(message: string): ValidationResult<T> => ({ ok: false, level: "error", message });

export function normalizeIban(input: string): string {
  return String(input ?? "").replace(/\s+/g, "").toUpperCase();
}

export function validateIban(input: string, required = false): ValidationResult<string> {
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

export function parseGermanNumber(input: unknown): number | null {
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

export function validateMoney(input: unknown, options: { required?: boolean; min?: number; max?: number } = {}): ValidationResult<number | null> {
  const text = String(input ?? "").trim();
  if (!text) return options.required ? invalid("Betrag fehlt.") : valid(null);
  const value = parseGermanNumber(text);
  if (value === null) return invalid("Der Betrag ist keine gültige Zahl.");
  if (options.min !== undefined && value < options.min) return invalid(`Der Betrag muss mindestens ${options.min} sein.`);
  if (options.max !== undefined && value > options.max) return invalid(`Der Betrag darf höchstens ${options.max} sein.`);
  return valid(value);
}

export function validatePositiveNumber(input: unknown, label: string, allowZero = false): ValidationResult<number> {
  const value = parseGermanNumber(input);
  if (value === null) return invalid(`${label} ist keine gültige Zahl.`);
  if (allowZero ? value < 0 : value <= 0) return invalid(`${label} muss ${allowZero ? "mindestens 0" : "größer als 0"} sein.`);
  return valid(value);
}

export function validateArea(input: unknown): ValidationResult<number> {
  const result = validatePositiveNumber(input, "Wohnfläche");
  if (!result.ok) return result;
  if ((result.value ?? 0) > 10000) return invalid("Die Wohnfläche ist unplausibel groß.");
  return result;
}

export function validateYear(input: unknown, min = 1800, max = new Date().getFullYear() + 5): ValidationResult<number> {
  const value = Number(input);
  if (!Number.isInteger(value)) return invalid("Das Jahr ist ungültig.");
  if (value < min || value > max) return invalid(`Das Jahr muss zwischen ${min} und ${max} liegen.`);
  return valid(value);
}

export function validateIsoDate(input: string, required = false): ValidationResult<string> {
  const value = String(input ?? "").trim();
  if (!value) return required ? invalid("Datum fehlt.") : valid("");
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return invalid("Das Datum hat kein gültiges Format.");
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  const same =
    date.getUTCFullYear() === Number(y) &&
    date.getUTCMonth() + 1 === Number(m) &&
    date.getUTCDate() === Number(d);
  return same ? valid(value) : invalid("Das Datum existiert nicht.");
}

export function validateDateRange(start: string, end: string): ValidationResult<{ start: string; end: string }> {
  const a = validateIsoDate(start, true);
  if (!a.ok) return invalid(`Startdatum: ${a.message}`);
  const b = validateIsoDate(end, true);
  if (!b.ok) return invalid(`Enddatum: ${b.message}`);
  if (start > end) return invalid("Das Enddatum liegt vor dem Startdatum.");
  return valid({ start, end });
}

export function validateMeterReading(input: unknown, previous?: number): ValidationResult<number> {
  const current = parseGermanNumber(input);
  if (current === null || current < 0) return invalid("Der Zählerstand ist ungültig.");
  if (previous !== undefined && current < previous) {
    return {
      ok: true,
      level: "warning",
      value: current,
      message: "Der neue Zählerstand ist kleiner als der vorherige. Bitte Zählerwechsel oder Eingabe prüfen.",
    };
  }
  return valid(current);
}

export function validateEmail(input: string, required = false): ValidationResult<string> {
  const value = String(input ?? "").trim();
  if (!value) return required ? invalid("E-Mail-Adresse fehlt.") : valid("");
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? valid(value) : invalid("Die E-Mail-Adresse ist ungültig.");
}

export function validatePostalCodeDE(input: string, required = false): ValidationResult<string> {
  const value = String(input ?? "").trim();
  if (!value) return required ? invalid("Postleitzahl fehlt.") : valid("");
  return /^\d{5}$/.test(value) ? valid(value) : invalid("Eine deutsche Postleitzahl muss aus 5 Ziffern bestehen.");
}
