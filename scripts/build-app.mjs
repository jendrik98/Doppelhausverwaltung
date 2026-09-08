import fs from "node:fs";
import path from "node:path";
import { transform } from "esbuild";

const root = process.cwd();
const manifestPath = path.join(root, "src", "legacy", "order.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

if (!Array.isArray(manifest.files) || manifest.files.length < 2) {
  throw new Error("src/legacy/order.json enthält keine plausible Build-Reihenfolge.");
}

async function compileCore(relativePath, globalName) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) throw new Error(`TypeScript-Core fehlt: ${relativePath}`);
  const result = await transform(fs.readFileSync(absolute, "utf8"), {
    loader: "ts",
    format: "iife",
    globalName,
    target: "es2022",
    charset: "utf8",
    legalComments: "none",
    sourcemap: false
  });
  return `\n/* ===== compiled ${relativePath} ===== */\n${result.code}\n`;
}

const coreRuntime =
  await compileCore("src/core/validation.ts", "AppValidation") +
  await compileCore("src/core/feedback.ts", "AppFeedback");

let output = "";
for (let i = 0; i < manifest.files.length; i++) {
  const rel = manifest.files[i];
  const absolute = path.join(root, rel);
  if (!fs.existsSync(absolute)) throw new Error(`Build-Quelle fehlt: ${rel}`);
  output += fs.readFileSync(absolute, "utf8");
  if (i === 0) output += coreRuntime;
}

fs.writeFileSync(path.join(root, "app.js"), output, "utf8");
console.log(`app.js aus ${manifest.files.length} Legacy-Quellbereichen + TypeScript-Core erzeugt (${output.length} Zeichen).`);
