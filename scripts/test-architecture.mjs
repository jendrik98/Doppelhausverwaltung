import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FEHLER: ${message}`);
    process.exit(1);
  }
}

const schema = read("src/legacy/010-schema.js");
const domain = read("src/legacy/020-domain.js");
const buildScript = read("scripts/build-app.mjs");
const state = read("src/core/state.ts");
const meter = read("src/domain/meter-parsing.ts");
const app = read("app.js");

assert(!schema.includes("function localDateISO"), "localDateISO liegt noch im Legacy-Schema.");
assert(!schema.includes("function createEmptyState"), "createEmptyState liegt noch im Legacy-Schema.");
assert(schema.includes("}=AppState;"), "Legacy-Kompatibilitätsbrücke zu AppState fehlt.");

assert(!domain.includes("function normalizeMeterNumber"), "normalizeMeterNumber liegt noch im Legacy-Domain-Code.");
assert(!domain.includes("function meterNumberSimilarity"), "meterNumberSimilarity liegt noch im Legacy-Domain-Code.");
assert(domain.includes("}=AppMeterParsing;"), "Legacy-Kompatibilitätsbrücke zu AppMeterParsing fehlt.");

assert(state.includes('from "./date"'), "state.ts verwendet das eigenständige date-Modul nicht.");
assert(meter.includes("export function parseMeterReadingValue"), "meter-parsing.ts exportiert den Parser nicht.");

assert(buildScript.includes("bundle: true"), "Build bündelt TypeScript-Importe nicht.");
assert(buildScript.includes('"AppState"'), "AppState wird nicht gebaut.");
assert(buildScript.includes('"AppMeterParsing"'), "AppMeterParsing wird nicht gebaut.");

assert(app.includes("compiled src/core/state.ts"), "State-TypeScript fehlt im Browser-Bundle.");
assert(app.includes("compiled src/domain/meter-parsing.ts"), "Meter-TypeScript fehlt im Browser-Bundle.");
assert(app.includes('APP_VERSION="18.0.0"'), "APP_VERSION wurde unerwartet verändert.");

console.log("Architekturprüfung bestanden: State/Datum und Zählerparser sind echte TypeScript-Module.");
