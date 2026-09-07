import fs from "node:fs";
import { transform } from "esbuild";

const source = fs.readFileSync("src/core/validation.ts", "utf8");
const compiled = await transform(source, {
  loader: "ts",
  format: "cjs",
  target: "es2022",
  sourcemap: false
});

const module = { exports: {} };
const execute = new Function("module", "exports", compiled.code);
execute(module, module.exports);
const v = module.exports;

const checks = [
  [v.validateIban("test", true).ok === false, "IBAN 'test' muss abgewiesen werden"],
  [v.validateIban("DE89370400440532013000", true).ok === true, "gültige Test-IBAN muss akzeptiert werden"],
  [v.validateIban("DE89370400440532013001", true).ok === false, "falsche IBAN-Prüfsumme muss abgewiesen werden"],
  [v.validateMoney("1.234,56", { required: true }).value === 1234.56, "deutsches Geldformat"],
  [v.validateArea("0").ok === false, "0 m² muss abgewiesen werden"],
  [v.validateIsoDate("2026-02-30", true).ok === false, "nicht existentes Datum"],
  [v.validateDateRange("2026-09-02", "2026-09-01").ok === false, "umgekehrter Datumsbereich"],
  [v.validateMeterReading("90", 100).level === "warning", "fallender Zählerstand muss warnen"]
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, label] of failed) console.error("FEHLER:", label);
  process.exit(1);
}
console.log(`${checks.length} Validation-Basistests bestanden.`);
