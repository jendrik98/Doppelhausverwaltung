# Mietverwaltung Version 17.0.0

Dieses Paket ist ein **Upgrade auf der stabilen, vollständig grünen V16.0.2-Basis**.

Neu:
- Mietkonto mit 12-Monats-Soll/Ist-Übersicht, Rückständen, Teil- und Überzahlungen
- harte Validierung für Zahlungen: Datum, Bezeichnung und Betrag > 0
- Buchungsqualitätsprüfung inkl. möglicher Dubletten
- explizites Versorgungsprofil: Kaltwasser Vermieter; Heizung/Warmwasser/Strom/Gas Mieterseite
- V17-Migration ohne Löschen vorhandener IndexedDB-Daten
- V17-Anzeige und Offline-Caching des Upgrade-Moduls
- neue E2E-Tests für V17

Upload:
1. `index.html` ersetzen
2. `service-worker.js` ersetzen
3. `v17-upgrade.js` neu ins Hauptverzeichnis hochladen
4. `tests/deployment.spec.js` ersetzen
5. `tests/v17-functionality.spec.js` neu hochladen
6. Alle übrigen Dateien unverändert lassen

Danach startet automatisch der Live-E2E-Workflow.
