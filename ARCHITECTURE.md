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

## Phase 5: Geräteauthentifizierung

Die WebAuthn-/Passkey-nahe Geräteauthentifizierung liegt nun in `src/core/auth.ts`. Der bisherige
Legacy-Bereich `src/legacy/120-security.js` ist nur noch eine schmale Laufzeitbrücke zu `AppAuth`.
Der aktuelle lokale Credential-Schlüssel `mietverwaltung_webauthn` bleibt unverändert, damit eine
bereits für diese App eingerichtete Geräteauthentifizierung weiter verwendet werden kann.

Die frühere Übernahme des alten Schlüssels `mietverwaltung_v75_webauthn` wurde entfernt. Neue
Altkompatibilitäts-Pfade werden nicht mehr gepflegt. Die Authentifizierungsfunktionen behalten ihre
bestehenden Laufzeitnamen (`authCredentialId`, `authEnabled`, `registerDevice`, `authenticate`,
`disableAuth`), sodass die noch nicht migrierte UI unverändert weiterarbeiten kann.

Der einmalige Phase-4-Migrationsworkflow wird mit dem erfolgreichen Phase-5-Commit entfernt.

## Phase 6: Integrität und Nachvollziehbarkeit

Die Integritätslogik liegt nun in `src/core/integrity.ts`. Dazu gehören Domain-Validierung und
-Reparatur, Fehlerprotokollierung, stabile JSON-Serialisierung, SHA-256-Prüfsummen für Snapshots
und Dokumente sowie die Zahlungs-/Kosten-Abstimmung. `src/legacy/030-integrity.js` hält nur noch
die unveränderten Laufzeitkonstanten (`APP_VERSION = 18.0.0`, Fehlerlog-Limit und
`LAST_STABLE_STATE`) und bindet die bisherigen Funktionsnamen an `AppIntegrity`.

Restore-Points, Command-/Audit-Nachvollziehbarkeit, Dokument-Workflowstatus und die
Abschluss-Checkliste liegen in `src/core/traceability.ts`. `src/legacy/040-traceability.js` bleibt
als schmale Brücke mit den bisherigen Trace-/Command-Versionen bestehen. Dadurch können die noch
nicht migrierten Fach- und UI-Bereiche dieselben Laufzeitnamen weiterverwenden.

Phase 6 verändert weder das State-Schema noch IndexedDB: `mietverwaltung-v6`, DB-Version `2` und
State-Schlüssel `main` bleiben unverändert. Auch die App-Version bleibt `18.0.0`. Der einmalige
Phase-5-Migrationsworkflow wird erst im erfolgreichen Phase-6-Commit entfernt.


## Phase 7: Kern-Fachlogik

Die fachliche Basis ist nun in drei TypeScript-Module getrennt. `src/domain/property-domain.ts`
enthält Kostenpositionen, Wasser-/Zählerlogik einschließlich OCR-Zuordnung, die zentrale
Kostenallokation sowie die bestehende Domain-Migration. `src/domain/billing-domain.ts` bündelt
Kalender- und Abrechnungsperioden, Flächen-/Personenanteile, die Erkennung tatsächlich geleisteter
Betriebskostenvorauszahlungen, Readiness, Cashflow-Helfer und eingefrorene Abrechnungssnapshots.

`src/domain/legal-rules.ts` enthält unverändert die bisherige Kategorien- und Umlagelogik sowie das
Laden von `legal-rules.json`. Die äußere Laufzeitvariable `ACTIVE_LEGAL_PACK` bleibt absichtlich als
Live-Bindung in `src/legacy/090-legal-rules.js`; das TypeScript-Modul liest und aktualisiert genau
diese Bindung. Dadurch sehen Rechtsansicht und neu erzeugte Snapshots nach einem Regelpaket-Reload
weiterhin denselben aktuellen Stand. `LAW_DATE` bleibt `2026-09-05`, das Regelpaket-Schema bleibt
`mietverwaltung-legal-pack-v1`.

Die bisherigen Dateien `src/legacy/020-domain.js`, `src/legacy/090-legal-rules.js` und
`src/legacy/100-domain-2.js` sind nur noch Laufzeitbrücken. `DOMAIN_VERSION` bleibt `1`; vorhandene
Funktionsnamen bleiben für die noch nicht migrierten Intelligence-, Quality-, Smart- und UI-Bereiche
erhalten. Phase 7 verändert weder fachliche Berechnungsregeln noch State-Schema, IndexedDB, Backup-
formate oder App-Version. Datenbank `mietverwaltung-v6`, DB-Version `2`, State-Schlüssel `main` und
App-Version `18.0.0` bleiben unverändert.

Der einmalige Phase-6-Migrationsworkflow wird erst mit dem erfolgreichen Phase-7-Commit entfernt.


## Phase 8: Intelligence und Assistenz

Die bislang zusammenhängenden Legacy-Bereiche für Intelligence, Datenqualität, Smart Engine und den V18-Abrechnungsassistenten sind in eigenständige TypeScript-Module verschoben:

- `src/domain/intelligence.ts`: Zahlungs-Matching, Forecasts, Dokumentintelligenz und professionelle Abrechnungs-PDF-Erzeugung.
- `src/domain/quality.ts`: Bank-CSV-Import, Dubletten-/Mietzahlungs-Erkennung, Periodenvergleich, Zählertrends und Datenqualität.
- `src/domain/smart-engine.ts`: Mietzahlungsmonitor und Abrechnungsprojektion.
- `src/domain/v18-assistant.ts`: V18-Vorbereitungsassistent, Smart-Zuordnung, Anomalien, Insights, Entscheidungsqueue und Smart-Antworten.

Die bisherigen Dateien `050-intelligence.js`, `060-quality.js`, `070-smart-engine.js` und `080-v18-billing-assistant-preview.js` bleiben nur als Laufzeitbrücken mit den bestehenden globalen Funktionsnamen erhalten. Die Migration ist bewusst semantikerhaltend; die vier stark dynamischen Module werden in dieser Strukturphase mit `@ts-nocheck` kompiliert. Das Verhaltensgate bleibt der vollständige Browser-E2E-Satz mit exakt 25/25 Tests. Eine spätere Phase kann die Typen dieser Module schrittweise härten, ohne gleichzeitig die Laufzeitstruktur zu verändern.

Phase 8 verändert keine fachlichen Regeln, keine Rechtsdaten, keine Datenbank- oder Backup-Schemata und keine App-Version. `mietverwaltung-v6`, DB-Version `2`, State-Schlüssel `main`, WebAuthn-Schlüssel, Backup-Schemata, Rechtsstand `2026-09-05`, `DOMAIN_VERSION=1` und App-Version `18.0.0` bleiben unverändert. Der einmalige Phase-7-Migrationsworkflow wird erst mit dem erfolgreichen Phase-8-Commit entfernt.


## Phase 9: UI-Infrastruktur

Die zustandslosen, gemeinsam genutzten Browser-UI-Helfer liegen nun in `src/ui/ui-core.ts`.
Dazu gehören DOM-Zugriff und HTML-Escaping, Fokus-Helfer und Fokusfalle, Formularfeld-Erzeugung
sowie die zentrale Formularvalidierung mit Fehler-Markierung, Warnbestätigung und Toast-Feedback.
Das zentrale Submit-Gate wird ebenfalls aus diesem TypeScript-Modul registriert.

Die veränderlichen Dialogzustände `MODAL_RETURN_FOCUS`, `MODAL_INITIAL_FORM` und
`MODAL_RETURN_FOCUS_OVERRIDE` bleiben zusammen mit `formSnapshot`, `closeModal` und `modal`
absichtlich in `src/legacy/150-ui.js`. `src/legacy/160-app.js` setzt sowohl den Rückkehrfokus für
Schnellaktionen als auch beim Wechsel vom Zähler-Editor zur Fotoerfassung direkt zurück. Diese
Zustandsgrenze wird deshalb nicht künstlich über Modul-Live-Bindungen aufgebrochen; sie wird erst
in Phase 10 gemeinsam mit dem App-/Ansichtsbereich migriert.

`src/legacy/150-ui.js` bindet die bereits migrierten, zustandslosen Funktionen über `AppUiCore` ein.
`tsconfig.json` prüft zusätzlich `src/ui/**/*.ts`, und der Build bündelt das Modul reproduzierbar.
Routing, Ansichten, Fachlogik, Datenbank `mietverwaltung-v6`, DB-Version `2`, State-Schlüssel `main`,
WebAuthn, Backup-Schemata, Rechtsstand `2026-09-05`, `DOMAIN_VERSION=1` und App-Version `18.0.0`
bleiben unverändert. Die fehlgeschlagenen Phase-9-V1/V2-Workflows und der Phase-8-Migrationsworkflow
werden erst mit dem erfolgreichen Phase-9-V6-Commit entfernt.
