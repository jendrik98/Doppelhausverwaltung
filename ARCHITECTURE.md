# Architektur der Doppelhausverwaltung

## Zielbild

Die PWA bleibt eine schlanke Browser-App. Quellcode wird künftig nach Verantwortung getrennt
und über einen reproduzierbaren Build zu `app.js` zusammengesetzt.

Neue oder stark überarbeitete Logik wird in TypeScript geschrieben.

Geplante Struktur:

- `src/core/` – Validierung, Feedback, State/Persistenz, gemeinsame Hilfen
- `src/domain/` – Haus, Mietverhältnis, Wasser, Finanzen, Abrechnung
- `src/ui/` – Router, Dialoge, Komponenten und Ansichten
- `src/io/` – Backup, PDF, OCR, Import/Export
- `src/legacy/` – nur die noch nicht migrierten Teile des bisherigen, bereits getesteten Codes
- `scripts/` – Build- und Qualitätswerkzeuge

## Wichtiger Migrationsgrundsatz

Phase 1 verändert bewusst keine Fachfunktion der Live-App.
Die bestehende `app.js` wird byte-identisch in wartbare Quellbereiche zerlegt.
Der Browser erhält weiterhin dieselbe `app.js`.

Danach werden die Bereiche einzeln nach TypeScript migriert. Erst wenn ein Bereich
migriert und durch Tests abgesichert ist, wird sein Legacy-Teil entfernt.

## Eingabevalidierung

`src/core/validation.ts` enthält die neue zentrale Validierungsbasis, unter anderem:
IBAN-Prüfsumme, Geldwerte, Wohnflächen, Jahre, echte ISO-Daten, Datumsbereiche,
Zählerstände, E-Mail und deutsche Postleitzahlen.

In der nächsten Phase werden alle Formulare auf diese zentrale Validierung umgestellt.
Harte Fehler verhindern das Speichern. Ungewöhnliche, aber mögliche Werte erzeugen
eine Warnung mit bewusster Bestätigung.

## Benutzerfeedback

`src/core/feedback.ts` enthält die gemeinsame Toast/Snackbar-Basis.
In der nächsten Phase ersetzt sie uneinheitliche Erfolgsmeldungen und ergänzt
sichtbare Rückmeldungen nach Speichern, Import, Export und anderen Aktionen.

## app.js

`app.js` ist ab dieser Architektur ein Build-Artefakt.
Sie soll nicht mehr direkt manuell bearbeitet werden.
Änderungen erfolgen in `src/` und anschließend über `npm run build`.
