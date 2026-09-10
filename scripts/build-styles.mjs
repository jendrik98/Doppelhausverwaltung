import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = path.join(root, "src", "ui", "design-system.css");
const target = path.join(root, "style.css");

if (!fs.existsSync(source)) throw new Error("src/ui/design-system.css fehlt.");
const css = fs.readFileSync(source, "utf8");
if (!css.includes("Mietverwaltung Design System F")) throw new Error("Design-System-F Kennung fehlt.");
if (process.env.CI && fs.existsSync(target)) {
  const checkedIn = fs.readFileSync(target, "utf8");
  if (checkedIn !== css) throw new Error("style.css ist gegenüber src/ui/design-system.css veraltet. Bitte npm run build ausführen und style.css mit committen.");
}
fs.writeFileSync(target, css, "utf8");
console.log(`style.css reproduzierbar aus src/ui/design-system.css erzeugt (${Buffer.byteLength(css, "utf8")} Bytes).`);
