# Echter Live-Browser-E2E-Test für Mietverwaltung V16

Dieses Paket testet **nicht nur die Quelldateien**, sondern die tatsächlich unter
`https://jendrik98.github.io/Doppelhausverwaltung/` veröffentlichte App mit Playwright + Chromium.

## Was der Test wirklich macht

- prüft die live ausgelieferte V16-Version und alle Kernassets
- startet die App in einem iPhone-artigen Browser-Kontext
- prüft Service Worker und echten Offline-Neustart
- bedient Hauptnavigation, Unterseiten, Browser Zurück/Vorwärts, Suche und Schnellaktionen
- trägt über die sichtbare UI ein synthetisches Objekt ein
- legt Eigennutzung und Mietwohnung an
- legt einen synthetischen Mietvertrag an
- erfasst Kostenquelle/Kostenposition und Zahlung
- prüft Mietzahlungserkennung und Zahlungszuordnung
- öffnet die Betriebskosten-Abschlussprüfung
- lädt die Seite neu und kontrolliert echte IndexedDB-Persistenz
- erstellt einen ICS-Export
- erstellt eine AES-GCM-Vollsicherung und stellt sie in einem frischen Browser-Kontext wieder her
- prüft Dark Mode, Touch-Ziele und Fokusdarstellung
- prüft den Zählerfoto-Crop inklusive Bedienung ohne Dragging
- führt einen separaten echten OCR/CDN-Integrationstest durch
- erstellt Playwright Trace, Screenshots und Video bei Fehlern

Die Testdaten existieren nur im temporären Browser des GitHub-Runners. Sie werden nicht in der Website oder im Repository gespeichert, da die Anwendung ihre Nutzdaten lokal im Browser hält.

## Installation im Repository

Die Dateien aus diesem Paket gehören direkt in die Wurzel des Repositorys. Danach enthält das Repository zusätzlich:

- `package.json`
- `playwright.config.js`
- `tests/`
- eingebettete synthetische Bild-Fixtures in `tests/fixtures.js`
- `.github/workflows/e2e-live.yml`

Nach dem Commit kann der Test unter **GitHub → Actions → Live E2E – Mietverwaltung → Run workflow** manuell gestartet werden. Bei Änderungen an den App-Dateien startet er zusätzlich automatisch.

Der Workflow wartet bis zu 10 Minuten darauf, dass GitHub Pages tatsächlich V16.0.0 ausliefert. Damit wird nicht versehentlich die alte Deployment-Version getestet.

## Ergebnis

Grün = der reale Browser hat die getestete Benutzerreise auf der öffentlichen GitHub-Pages-Version bestanden.

Rot = unter `Actions → fehlgeschlagener Lauf → Artifacts → playwright-report` liegen HTML-Bericht, Trace, Screenshots und ggf. Video. Der Trace zeigt Klick für Klick, an welcher Stelle die App scheitert.

## Hinweis zur ChatGPT-Ausführungsumgebung

Die hier verfügbare Chromium-Installation wird durch eine verwaltete `URLBlocklist: ["*"]` daran gehindert, URLs zu öffnen (`ERR_BLOCKED_BY_ADMINISTRATOR`). Deshalb kann der Live-Test in dieser Umgebung nicht seriös als bestanden ausgegeben werden. Der GitHub-Action-Runner hat diese Einschränkung nicht und führt genau den echten Browser-Test aus, den wir benötigen.
