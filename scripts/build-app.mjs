import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const root = process.cwd();
const manifestPath = path.join(root, "src", "runtime", "order.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

if (!Array.isArray(manifest.files) || manifest.files.length < 2) {
  throw new Error("src/runtime/order.json enthält keine plausible Build-Reihenfolge.");
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
    compileModule("src/domain/portfolio-model.ts", "AppPortfolioModel"),
    compileModule("src/domain/lifecycle-ledger.ts", "AppLifecycleLedger"),
    compileModule("src/infrastructure/portfolio-repository.ts", "AppPortfolioRepository"),
    compileModule("src/application/index.ts", "AppApplication"),
    compileModule("src/presentation/index.ts", "AppPresentation"),
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
    compileModule("src/io/backup-codec.ts", "AppBackupCodec"),
    compileModule("src/ui/ui-core.ts", "AppUiCore"),
    compileModule("src/ui/building-workspace-ui.ts", "AppBuildingWorkspaceUi"),
compileModule("src/ui/rental-lifecycle-ui.ts", "AppRentalLifecycleUi")
  ])
).join("");

const appRuntimePath = path.join(root, "src", "ui", "app-runtime.ts");
const appRuntimeSource = fs.readFileSync(appRuntimePath, "utf8");
const appRuntimeEndMarker = "\nexport {};\n";
if (!appRuntimeSource.endsWith(appRuntimeEndMarker)) {
  throw new Error("src/ui/app-runtime.ts muss exakt mit export {}; enden.");
}
const lateAppRuntime = `\n/* ===== TypeScript source src/ui/app-runtime.ts · outer-scope injection ===== */\n${appRuntimeSource.slice(0, -appRuntimeEndMarker.length)}\n`;

let output = "";
for (let i = 0; i < manifest.files.length; i++) {
  const relativePath = manifest.files[i];
  const absolute = path.join(root, relativePath);

  if (!fs.existsSync(absolute)) {
    throw new Error(`Build-Quelle fehlt: ${relativePath}`);
  }

  if (relativePath === "src/runtime/900-app-entry.js") output += lateAppRuntime;
  output += fs.readFileSync(absolute, "utf8");
  if (i === 0) output += typedRuntime;
}

fs.writeFileSync(path.join(root, "app.js"), output, "utf8");
console.log(
  `app.js aus ${manifest.files.length} Runtime-Quellbereichen + gebündelten TypeScript-Modulen erzeugt (${output.length} Zeichen).`
);
