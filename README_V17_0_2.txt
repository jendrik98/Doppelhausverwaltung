Mietverwaltung V17.0.2 – Kaltwasser Plus + 15-Jahre-Langzeitstudie

UPLOAD / ERSETZEN:
1. index.html ersetzen
2. service-worker.js ersetzen
3. v17-water.js neu hinzufügen
4. tests/v17-water-longterm.spec.js neu hinzufügen

Alle anderen Dateien unverändert lassen.

Neu:
- Kaltwasser-Dashboard mit Hausverbrauch, Mietverbrauch, Anteil, Wasserkosten, €/m³ und rechnerischem Mieteranteil.
- Konkrete Bereitschafts-/Fehlhinweise.
- Bestehendes Wasser-Datenmodell bleibt erhalten.
- Langzeit-E2E erzeugt 15 Abrechnungsjahre, 15 Wasserperioden, 15 Wasserkostenpositionen und 180 Mietzahlungen.
- Zusätzlich 10 Reloads als Persistenz-Stresstest.

Die Langzeitstudie prüft Datenkonsistenz und App-Verhalten mit simulierten 15 Jahren Daten. Sie simuliert nicht 15 reale Jahre Browseralterung oder zukünftige Browser-/iOS-Versionen.
