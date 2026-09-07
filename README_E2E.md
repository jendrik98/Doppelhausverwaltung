# Live-Browser-E2E – Doppelhausverwaltung V18

Die Suite prüft die tatsächlich veröffentlichte GitHub-Pages-App in einem iPhone-artigen Chromium-Kontext.

Wesentliche Prüfungen:
- Live-Version und Kernassets
- Service Worker und Offline-Neustart
- Hell-/Dunkelmodus inklusive Kontrast
- Hauptnavigation, reduzierte Fachbereiche, Suche und Schnellaktionen
- Objekt, Einheiten, Mietverhältnis, Kaltwasser und Betriebskosten
- Zahlungen, Mietzahlungserkennung, ICS-Export
- verschlüsselte Vollsicherung und Wiederherstellung
- 15-Jahre-Abrechnung sowie rechtliche und fachliche Plausibilitätsprüfungen
- V18-Abrechnungsassistent

Playwright läuft bewusst mit `retries: 0`. Ein grüner Lauf bedeutet daher, dass jeder Test im ersten Versuch bestanden hat.

Der Live-Workflow wartet vor dem Browserlauf darauf, dass GitHub Pages die erwartete App-Version ausliefert. Testdaten bleiben ausschließlich im temporären Browserprofil des GitHub-Runners.
