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

## Phase 2: Kalenderjahr, Validierung und Feedback

Der Abrechnungszeitraum ist fachlich auf das Kalenderjahr `01.01.–31.12.` korrigiert. Bei der Übernahme mitten im Jahr beginnt nur die erste eigene Periode am Übernahmedatum. Die interne Arbeitszielfrist für die fertige Endabrechnung ist der `31.03.` des Folgejahres; die gesetzliche Frist nach § 556 Abs. 3 BGB wird davon getrennt als `31.12.` des Folgejahres geführt.

`src/core/validation.ts` und `src/core/feedback.ts` werden nun beim Build in die Browser-App kompiliert. Alle Formular-Submits laufen durch eine zentrale Validierungsschicht. Harte Fehler blockieren das Speichern und markieren das Feld; ungewöhnliche, aber mögliche Werte verlangen eine bewusste Bestätigung. Erfolgreiche Speicher- und ausgewählte Export-/Importaktionen erhalten Toast-Feedback.

## Phase 3: erste echte Fachmodule

Die Kompatibilitätsschicht bleibt vorerst bestehen, aber zentrale Logik liegt nicht mehr nur in
`src/legacy/`. Datum/State befinden sich in `src/core/date.ts` und `src/core/state.ts`; die
reinen Zähler-Parsing- und Vergleichsfunktionen liegen in `src/domain/meter-parsing.ts`.

Der Build verwendet esbuild mit `bundle: true`. Dadurch dürfen TypeScript-Module echte
`import`/`export`-Beziehungen besitzen. Kleine Kompatibilitätsbrücken stellen die bisherigen
Funktionsnamen innerhalb des bestehenden App-IIFE bereit, sodass die Migration schrittweise
und ohne Big-Bang-Rewrite fortgesetzt werden kann.

Neue Fachlogik soll nicht mehr in `src/legacy/` entstehen. Bestehende Bereiche werden
domänenweise migriert und nach jedem Schritt mit der vollständigen E2E-Suite abgesichert.

## Phase 4: Persistenz und Backup-Codec

Die IndexedDB-Zugriffe liegen nun in `src/core/persistence.ts`. Der bestehende Live-Speicher bleibt
absichtlich unverändert: Datenbank `mietverwaltung-v6`, DB-Version `2`, Stores `state` und `docs`,
jeweils `keyPath: "id"`, sowie der State-Schlüssel `main`. Es findet keine IndexedDB-Schema- oder
Datenmigration statt.

Der bisherige Import aus alten `mietverwaltung_v2*`-LocalStorage-Ständen wurde entfernt. Wenn kein
aktueller IndexedDB-State vorhanden ist, startet die App direkt mit einem neuen aktuellen State.

Backup-Serialisierung, Base64-Konvertierung und AES-GCM/PBKDF2-Codec liegen in
`src/io/backup-codec.ts`. Neue und aktuelle Backups behalten die Schemas
`mietverwaltung-encrypted-v1` und `mietverwaltung-full-backup-v2`. Ältere V81-/V75-Vollbackupformate
werden nicht mehr akzeptiert.

`src/legacy/110-db.js` und `src/legacy/130-backup.js` sind nur noch schmale Laufzeitbrücken zu den
TypeScript-Modulen; der WebAuthn-Teil bleibt vorerst in `src/legacy/120-security.js`.
