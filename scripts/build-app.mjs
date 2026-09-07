import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "src", "legacy", "order.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

if (!Array.isArray(manifest.files) || manifest.files.length < 2) {
  throw new Error("src/legacy/order.json enthält keine plausible Build-Reihenfolge.");
}

let output = "";
for (const rel of manifest.files) {
  const absolute = path.join(root, rel);
  if (!fs.existsSync(absolute)) throw new Error(`Build-Quelle fehlt: ${rel}`);
  output += fs.readFileSync(absolute, "utf8");
}

fs.writeFileSync(path.join(root, "app.js"), output, "utf8");
console.log(`app.js aus ${manifest.files.length} Quellbereichen erzeugt (${output.length} Zeichen).`);
