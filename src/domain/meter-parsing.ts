export interface MeterNumericInterpretation {
  value: number;
  mode: string;
  bonus: number;
}

export interface MeterReadingCandidate {
  raw: string;
  value: number;
  line: string;
  score: number;
  source: string;
  interpretation: string;
}

export interface MeterSerialCandidate {
  raw: string;
  normalized: string;
  line: string;
  score: number;
}

export function normalizeMeterNumber(value: unknown): string {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function parseMeterReadingValue(value: unknown): number | null {
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

export function meterNumericInterpretations(raw: unknown): MeterNumericInterpretation[] {
  const clean = String(raw || "")
    .replace(/\s/g, "")
    .replace(/O/gi, "0")
    .replace(/[Il|]/g, "1");

  const out: MeterNumericInterpretation[] = [];
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

  const seen = new Set<string>();
  return out.filter(item => {
    const key = item.value.toFixed(4);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function meterReadingCandidates(
  text: unknown,
  source = "ocr",
  baseScore = 0.55
): MeterReadingCandidate[] {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const out: MeterReadingCandidate[] = [];

  for (const line of lines) {
    const low = line.toLowerCase();
    const context = /zählerstand|zaehlerstand|stand|m³|m3|kubik|verbrauch/.test(low);
    const regex = /\d(?:[\d\s.,]{1,12}\d)?/g;

    for (const match of line.matchAll(regex)) {
      const raw = match[0].trim();
      const digits = raw.replace(/\D/g, "");
      if (digits.length < 2 || digits.length > 10) continue;

      for (const interpretation of meterNumericInterpretations(raw)) {
        const score =
          baseScore +
          (context ? 0.16 : 0) +
          (/[.,]/.test(raw) ? 0.08 : 0) +
          (interpretation.bonus || 0);

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

export function detectedMeterSerialCandidates(text: unknown): MeterSerialCandidate[] {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const out: MeterSerialCandidate[] = [];

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

export function meterNumberComparable(value: unknown): string {
  return normalizeMeterNumber(value)
    .replace(/[OQ]/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/S/g, "5")
    .replace(/B/g, "8");
}

export function editDistance(aValue: unknown, bValue: unknown): number {
  const a = String(aValue);
  const b = String(bValue);
  const row = Array(b.length + 1)
    .fill(0)
    .map((_, index) => index);

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

export function meterNumberSimilarity(a: unknown, b: unknown): number {
  const left = meterNumberComparable(a);
  const right = meterNumberComparable(b);

  if (!left || !right) return 0;
  if (left.includes(right) || right.includes(left)) return 0.99;

  return 1 - editDistance(left, right) / Math.max(left.length, right.length);
}
