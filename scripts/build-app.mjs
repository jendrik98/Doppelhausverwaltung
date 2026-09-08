import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const root = process.cwd();
const manifestPath = path.join(root, "src", "legacy", "order.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

if (!Array.isArray(manifest.files) || manifest.files.length < 2) {
  throw new Error("src/legacy/order.json enthält keine plausible Build-Reihenfolge.");
}

async function compileModule(relativePath, globalName) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`TypeScript-Modul fehlt: ${relativePath}`);
  }

  const result = await build({
    entryPoints: [absolute],
    bundle: true,
    write: false,
    format: "iife",
    globalName,
    target: "es2022",
    charset: "utf8",
    legalComments: "none",
    sourcemap: false,
    logLevel: "silent",
    platform: "browser"
  });

  if (result.outputFiles.length !== 1) {
    throw new Error(`Unerwartete Build-Ausgabe für ${relativePath}.`);
  }

  return `\n/* ===== compiled ${relativePath} ===== */\n${result.outputFiles[0].text}\n`;
}

const typedRuntime = (
  await Promise.all([
    compileModule("src/core/validation.ts", "AppValidation"),
    compileModule("src/core/feedback.ts", "AppFeedback"),
    compileModule("src/core/state.ts", "AppState"),
    compileModule("src/core/persistence.ts", "AppPersistence"),
    compileModule("src/core/auth.ts", "AppAuth"),
    compileModule("src/core/integrity.ts", "AppIntegrity"),
    compileModule("src/core/traceability.ts", "AppTraceability"),
    compileModule("src/domain/meter-parsing.ts", "AppMeterParsing"),
    compileModule("src/domain/property-domain.ts", "AppPropertyDomain"),
    compileModule("src/domain/legal-rules.ts", "AppLegalRules"),
    compileModule("src/domain/billing-domain.ts", "AppBillingDomain"),
    compileModule("src/domain/intelligence.ts", "AppIntelligence"),
    compileModule("src/domain/quality.ts", "AppQuality"),
    compileModule("src/domain/smart-engine.ts", "AppSmartEngine"),
    compileModule("src/domain/v18-assistant.ts", "AppV18Assistant"),
    compileModule("src/io/backup-codec.ts", "AppBackupCodec")
  ])
).join("");

let output = "";
for (let i = 0; i < manifest.files.length; i++) {
  const relativePath = manifest.files[i];
  const absolute = path.join(root, relativePath);

  if (!fs.existsSync(absolute)) {
    throw new Error(`Build-Quelle fehlt: ${relativePath}`);
  }

  output += fs.readFileSync(absolute, "utf8");
  if (i === 0) output += typedRuntime;
}

fs.writeFileSync(path.join(root, "app.js"), output, "utf8");
console.log(
  `app.js aus ${manifest.files.length} Legacy-Quellbereichen + gebündelten TypeScript-Modulen erzeugt (${output.length} Zeichen).`
);
