import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/ui/design-system.css", "utf8");
const built = fs.readFileSync("style.css", "utf8");

assert.equal(built, source, "style.css ist nicht byte-identisch zur Design-System-Quelle.");
assert(source.includes("Mietverwaltung Design System F"), "Design-System-F Kennung fehlt.");
assert(source.includes("@layer reset, base, components, patterns, features, responsive, accessibility;"), "CSS-Layer-Vertrag fehlt.");

for (const token of [
  "--color-bg", "--color-surface", "--color-text", "--color-text-muted",
  "--color-border", "--color-primary", "--color-accent", "--color-success",
  "--color-warning", "--color-danger", "--touch", "--content-max"
]) assert(source.includes(token), `Design-Token fehlt: ${token}`);

for (const forbidden of [
  "V14 Navigation & UX",
  "V15 Meter Vision",
  "V16 Premium Final",
  "V18 consolidated olive theme",
  "V18 simplified navigation preview",
  "Architecture E: mobile touch safety",
  "!important"
]) assert(!source.includes(forbidden), `Historische CSS-Schicht/Spezifitäts-Notbremse verblieben: ${forbidden}`);

assert.equal((source.match(/:root\s*\{/g) || []).length, 2, "Es darf nur Light-Root plus Dark-Root geben.");
assert.equal((source.match(/prefers-color-scheme:dark/g) || []).length, 1, "Dark Theme muss zentral genau einmal definiert sein.");
assert(source.includes("@media(min-width:1100px)"), "Desktop-Arbeitsoberfläche fehlt.");
assert(source.includes("nav.main-tabs{\n      top:88px") || source.includes("nav.main-tabs{\n                top:88px"), "Desktop-Hauptnavigation hat nicht die nötige Selektor-Spezifität.");
assert(source.includes("button{min-height:var(--touch)}"), "Globaler 44px-Touch-Ratchet fehlt.");
assert(source.includes(".overview-cards{grid-template-columns:repeat(2,minmax(0,1fr))}"), "Mobile Kennzahlenübersicht ist nicht explizit auf zwei sichere Spalten begrenzt.");
assert(source.includes(".cards .metric-card{min-width:0;overflow:hidden}"), "Mobile Kennzahlenkarten verhindern keinen intrinsischen Text-Overflow.");
assert(source.includes(".cards .metric-card>span,.cards .metric-card>strong,.cards .metric-card>small{display:block;max-width:100%;min-width:0;overflow-wrap:anywhere}"), "Kennzahleninhalte dürfen in Fachbereichen nicht aus ihrer Karte herauslaufen.");
assert(source.includes(".quality-orb{overflow:hidden}"), "Qualitätsindikator clippt seinen Inhalt nicht sicher innerhalb der Karte.");
assert(source.includes(".quality-orb small{display:block;max-width:100%;min-width:0;overflow:hidden"), "Datenstatus-Label ist auf iPhone nicht im Qualitätsindikator begrenzt.");
assert(source.includes(".experience-hero{display:grid;grid-template-columns:minmax(0,1fr) 68px"), "Mobile Hero-Geometrie ist nicht hart auf die Viewportbreite begrenzt.");
assert(source.includes("#modal .close-action{position:relative;z-index:7;pointer-events:auto}"), "Modal-Schließen liegt nicht sicher über Sticky-Formularaktionen.");
assert(source.includes("#buildingAdminForm>.form-actions"), "Gebäudeformular-Touchvertrag fehlt.");
assert(source.includes("nav.main-tabs"), "Hauptnavigation fehlt im Design-System.");
assert(source.includes(".workspace-sidebar"), "Desktop-Workspace-Navigation fehlt.");
assert(source.includes(".next-best-action"), "Aufgabenorientierte Startseite ist nicht gestaltet.");
assert(source.includes(".field-error"), "Zentrale Formularfehler sind nicht gestaltet.");
assert(source.includes(".empty-state"), "Leerezustände sind nicht gestaltet.");
assert(source.length < 44500, `Design-System überschreitet Größenratchet: ${source.length} Zeichen.`);

console.log(`Design-System F bestanden: ${source.length} Zeichen, 1 Quelle, 0 historische Override-Schichten.`);
