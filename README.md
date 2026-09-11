# Doppelhausverwaltung

Local-first PWA zur privaten Verwaltung eines Doppelhauses und kleiner Mehrgebäude-Portfolios. Die Anwendung läuft im Browser, speichert Verwaltungsdaten lokal und wird reproduzierbar aus den TypeScript-/Runtime-Quellen gebaut.

## Aktueller Stand

Architecture A–G bildet die produktive Basis: Mehrgebäude-Portfolio, gebäudeisolierte Arbeitsbereiche, Portfolio-/Gebäudeverwaltung, konsolidiertes Design-System sowie Vermietungs-Lifecycle mit Vertragsständen, Übergaben, Mietkonto, Zählerwechseln und revisionssicheren Abrechnungskorrekturen.

Architecture H ist gestartet. H1 ergänzt eine reine Domänenschicht für Dokument-Nachweis-Ketten und das Jahresarchiv. Sie verknüpft vorhandene IDs nachvollziehbar als **Dokument → Kostenposition → Zahlung → Abrechnungssnapshot**, ohne den persistierten State umzuschreiben.

### Technische Verträge

- App-Version: `18.0.0`
- State-Schema: `15`
- IndexedDB: `mietverwaltung-v6`, Version `3`
- State-Schlüssel: `main`
- Produktionsartefakte: `app.js` und `style.css`
- Deployment: GitHub Pages

`meta.v17` ist trotz seines historischen Namens weiterhin Teil der persistierten Kompatibilität. Es darf nur mit einer expliziten, getesteten Datenmigration entfernt oder umbenannt werden.

## Schichten

- `src/core/` – State, Integrität, Validierung, Authentifizierung und Nachvollziehbarkeit
- `src/domain/` – fachliche Modelle und Berechnungen
- `src/infrastructure/` – Persistenz- und Repository-Grenzen
- `src/application/` – Commands, Use-Cases und gebäudeisolierte Queries
- `src/presentation/` – Workspace- und Navigationsprojektionen
- `src/ui/` – Browser-UI und Design-System
- `src/io/` – Import-/Export- und Backup-Codecs
- `src/runtime/` – kleine Browser-Live-Bindings und Kompatibilitätsadapter
- `scripts/` – reproduzierbarer Build und dauerhafte Qualitäts-Ratchets
- `tests/` – Playwright-Regressionen

Die verbindlichen Architekturregeln stehen in [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Entwicklung

```bash
npm ci
npm run build
npm run typecheck
npm run test:validation
npm run test:architecture
npm run test:archive
npm run test:hygiene
npm run test:quality
npm run test:pwa
npm run test:e2e
```

`app.js` und `style.css` werden nicht manuell gepflegt. Änderungen erfolgen an ihren Quellen und werden mit `npm run build` reproduzierbar erzeugt.

## Qualitätsnachweis

Die dauerhafte CI prüft den reproduzierbaren Build, TypeScript, fachliche/architektonische Verträge, Repository-Hygiene, PWA-Verträge und die vollständige lokale Playwright-Suite. Der Live-E2E-Workflow wartet zusätzlich auf exakt den SHA-256-Hash der `app.js` des getesteten Commits, bevor die veröffentlichte GitHub-Pages-App geprüft wird.

## Architecture H

H1 liefert die belastbare, read-only Nachweiskette und ein JSON-sicheres Jahresarchiv-Manifest. H2 kann darauf die Archiv-/Jahresabschluss-Oberfläche und den Export aufbauen, ohne die Kernlogik erneut in die Browser-Runtime zu legen.
