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
- `src/runtime/` – schmale Laufzeitbrücken, Live-Bindungen und der äußere Browser-Entry
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


## Phase 10: Abschlussmigration

`src/legacy/` ist vollständig entfernt. Die kleinen, bewusst globalen Kompatibilitätsbindungen liegen
nun unter `src/runtime/`; dazu gehören insbesondere `LAST_STABLE_STATE`, `ACTIVE_LEGAL_PACK`,
`DOMAIN_VERSION`, die Service-Worker-Frühregistrierung und die bisherigen Funktionsaliasse zu den
TypeScript-Modulen. Diese Bindungen werden nicht künstlich in Objektkopien umgewandelt, damit ihre
bestehende Live-Semantik erhalten bleibt.

Die bislang gekoppelte Restlaufzeit aus `140-tests.js`, `150-ui.js` und dem eigentlichen App-/Ansichts-
bereich `160-app.js` liegt nun gemeinsam in `src/ui/app-runtime.ts`. Der Build injiziert diese
TypeScript-Quelle direkt vor `src/runtime/900-app-entry.js` in den bereits bestehenden äußeren
Browser-Runtime-Scope. Es wird bewusst keine zusätzliche `AppRuntime.start()`-Closure eingeführt.
Damit bleiben Selbsttests, Dialogzustand, Rückkehrfokus, Routing, Ansichten, App-Start und freie
Live-Bindungen auf exakt derselben lexikalischen Ebene wie im bestätigten Phase-9-Build. Der äußere
Browser-Fehlerrahmen und das PWA-Hardening bleiben im kleinen Entry `src/runtime/900-app-entry.js`.

Die Migration ist strukturell und semantikerhaltend. `app-runtime.ts` ist deshalb – ebenso wie die
bereits in Phase 8 migrierten stark dynamischen Assistenzmodule – zunächst mit `@ts-nocheck`
markiert. Das ist keine Behauptung vollständiger statischer Typisierung; die Verhaltenssicherheit
wird weiterhin durch Build, Architektur-/Validierungstests und das strenge Browser-Gate mit exakt
25/25 Tests abgesichert. Eine spätere Typing-Härtung kann gezielt erfolgen, ohne erneut die
Laufzeitarchitektur zu verändern.

Fachregeln, Rechtsstand, Daten und Formate bleiben unverändert: Datenbank `mietverwaltung-v6`,
DB-Version `2`, State-Schlüssel `main`, WebAuthn-Schlüssel `mietverwaltung_webauthn`,
Backup-Schemata `mietverwaltung-full-backup-v2` und `mietverwaltung-encrypted-v1`, Rechtsstand
`2026-09-05`, `DOMAIN_VERSION=1` und App-Version `18.0.0`. Der Phase-9-V6-Workflow und die einmaligen
Phase-10-V1/V2/V3/V4/V5-Workflows werden erst im vollständig getesteten Abschlusscommit entfernt; der dauerhafte
Live-E2E-Workflow bleibt bestehen.

## Production Hardening A: PWA-Updates und dauerhafte CI

Nach der Abschlussmigration wird die Produktionssicherheit unabhängig von der Fachlogik gehärtet.
Kritische veränderliche PWA-Ressourcen (`index.html`, `app.js`, `style.css`, Manifest und Rechtsregeln)
verwenden eine Network-first-Strategie mit Cache-Fallback. Zusätzlich wurden die Asset-URLs bewusst
versioniert, sodass auch ein noch aktiver älterer Cache-first-Service-Worker beim ersten Laden den neuen
Build anfordern muss. Der Cache besitzt eine neue Production-ID und entfernt veraltete Caches bei der
Aktivierung.

Der Live-E2E-Workflow wartet nicht mehr nur auf `APP_VERSION=18.0.0`, sondern vergleicht den SHA-256-Hash
der auf GitHub Pages ausgelieferten `app.js` mit exakt dem `app.js` des getesteten Commits. Dadurch kann
ein unveränderter Versionsstring kein veraltetes Deployment mehr als aktuell erscheinen lassen.

Die ungenutzten historischen Browser-Selbsttests wurden aus `src/ui/app-runtime.ts` entfernt; fachliche
Regressionen werden ausschließlich durch die reproduzierbaren Validierungs-, Architektur- und
Playwright-Tests abgesichert. `scripts/test-quality.mjs` bildet ab jetzt ein Architektur-Ratchet: neue
`@ts-nocheck`-Dateien sind verboten und der große App-Runtime-Bereich darf nicht wieder wachsen.
`scripts/test-pwa-update.mjs` prüft die Synchronität zwischen HTML, Service Worker und Live-Workflow.

Die dauerhafte Workflow-Datei `.github/workflows/ci.yml` prüft auf `main` und in Pull Requests den
reproduzierbaren Build, TypeScript, Validierung, Architektur, Quality-/PWA-Verträge sowie anschließend
die vollständige lokale Browser-E2E-Suite. Änderungen in `src/**`, `scripts/**`, TypeScript-Konfiguration
und den Build-/Testdateien lösen diese Qualitätssicherung nun explizit aus.

## B1 – Portfolio- und Gebäudemodell

State-Schema 14 ergänzt die bisherige Einzelobjektstruktur additiv um `portfolios` und `buildings`. Das bestehende `property`-Objekt bleibt in B1 als Kompatibilitätsansicht und Quelle für das primäre Gebäude erhalten, damit die bestehende Oberfläche und alle Abrechnungswege unverändert weiterarbeiten.

`src/domain/portfolio-model.ts` stellt eine idempotente Migration bereit. Bestehende Einheiten werden dem primären Gebäude zugeordnet; bestehende Mietverhältnisse erhalten eine stabile `unitId` (bevorzugt die vorhandene Mietwohnung) sowie die abgeleitete `buildingId`. Zähler, Quellen, Kostenpositionen, Aufgaben, Zahlungen und Abrechnungsdatensätze erhalten eine Gebäudezuordnung, sofern noch keine gültige Zuordnung existiert. Gültige Mehrgebäude-Referenzen werden nicht überschrieben.

Die Referenzintegrität wird im zentralen `repairDomainState`/`validateDomainState`-Pfad erzwungen. B1 ändert weder IndexedDB-Name/-Version noch Backupformat oder App-Version; die Persistenzschicht bleibt dadurch rückwärtskompatibel. Die eigentliche Mehrgebäude-Bedienung und Dokument-Persistenz vNext folgen in B2.


## B2 – Indexed Portfolio Persistence

B2 führt eine Repository-Schicht zwischen Browser-Runtime und IndexedDB ein. Der vollständige State bleibt als kompatibler Snapshot unter `state/main` erhalten, wird aber bei jedem produktiven Speichern in derselben IndexedDB-Transaktion zusätzlich in normalisierte Stores für `portfolios`, `buildings`, `units` und `tenancies` projiziert. Dadurch bleiben bestehende Backups und die aktuelle Ein-Gebäude-UI kompatibel, während spätere Mehrgebäude-Abfragen indexiert und ohne Vermischung der Objekte möglich werden.

- State-Schema: 15; Portfolio-Modell: 2; IndexedDB: 3.
- `src/infrastructure/portfolio-repository.ts` ist die produktive Schreibgrenze für State + Projektion.
- Gebäude besitzen `portfolioId`, Einheiten `buildingId`, Mietverhältnisse `unitId` + konsistentes `buildingId`.
- Indizes: Gebäude nach `portfolioId`, Einheiten nach `buildingId`, Mietverhältnisse nach `buildingId` und `unitId`.
- Beim Laden eines bestehenden Snapshots repariert/migriert die Runtime zuerst das Domainmodell und schreibt anschließend die atomare Projektion neu.
- Die bisherige `property`-Oberfläche bleibt vorerst die editierbare Projektion des primären Gebäudes; bei nur einem Gebäude entsteht kein zusätzlicher Gebäudewähler.
- Browser-E2E prüft den Upgradepfad, die Projektions-Metadaten und die Isolation zweier Gebäude.

## Schritt C: Application-/Use-Case-Schicht

`src/application/` ist die neue Orchestrierungsschicht zwischen UI/Runtime, Fachlogik und Infrastruktur.
Sie enthält einen browserunabhängigen Application-Kontext, gebäudeisolierte Queries, den App-Lifecycle
und einen Command-Bus. Commands protokollieren den wirksamen Portfolio-/Gebäude-/Einheiten-/
Mietverhältnis-Kontext und blockieren unbeabsichtigte Änderungen oder Löschungen in einem anderen
Gebäude. Der bestehende Laufzeitname `executeCommand` bleibt als Kompatibilitätsgrenze erhalten,
delegiert seine Orchestrierung aber vollständig an die Application-Schicht.

Der App-Start läuft ebenfalls über den Application-Lifecycle: vorhandener oder neuer State wird
repariert, validiert und atomar über das B2-Repository gespeichert. Der Zahlungsabgleich verwendet
eine gebäudeisolierte Application-Query. Damit sind wichtige aktuelle Schreib- und Lesepfade bereits
funktional verdrahtet, ohne die bestehende Ein-Gebäude-Oberfläche zu verändern. Ein Gebäude-Selector
wird vom Application-Modell erst dann vorgesehen, wenn tatsächlich mehr als ein Gebäude vorhanden ist.

Schritt C ändert weder App-Version (`18.0.0`) noch State-Schema (`15`), IndexedDB (`mietverwaltung-v6`,
Version `3`) oder Backupformate. Nur der PWA-Asset-Key wird auf `app.js?v=1803` und einen neuen Cache
angehoben, damit GitHub Pages die neue Application-Schicht nachweislich frisch ausliefert.
## Schritt D: Presentation-/Building-Workspace-Schicht

`src/presentation/` bildet die neue Präsentationsgrenze zwischen Application-Schicht und Browser-UI.
Routing und Mehrgebäude-Workspace werden strikt typisiert aufgebaut. Die Browser-Runtime verwendet
für Aufgaben die gebäudeisolierte Application-Query statt einer zweiten, ungescopten Implementierung.
Dabei bleiben Übernahmeperioden erhalten: Jahre vor der Verwaltungsübernahme erzeugen keine falschen
Abrechnungsaufgaben, und die erste Teilperiode wird mit ihrem tatsächlichen Zeitraum bezeichnet.

Für die UI wird der vollständige Portfolio-State nicht mehr direkt als Arbeitszustand verwendet.
Stattdessen projiziert die Presentation-Schicht genau das aktive Gebäude in den bestehenden
Kompatibilitäts-State. Beim Speichern wird diese Projektion kontrolliert in den vollständigen
Portfolio-State zurückgeführt. Dadurch bleiben bestehende Fachansichten weitgehend unverändert,
während Einheiten, Mietverhältnisse, Quellen, Kosten, Zähler, Wasserperioden, Aufgaben, Zahlungen,
Abrechnungsdaten und Dokumente zwischen Gebäuden getrennt bleiben.

Der Gebäude-Selector erscheint ausschließlich bei mehr als einem Gebäude. Die Auswahl ist eine
Präsentationspräferenz und verändert `meta.primaryBuildingId` des Domainmodells nicht. Das bestehende
`property`-Objekt bleibt im vollständigen Persistenz-State die Kompatibilitätsprojektion des
Primärgebäudes. Vollbackups und Restore-Points enthalten weiterhin das komplette Portfolio und alle
Dokumente, nicht nur das gerade sichtbare Gebäude. Der flüchtige `documentsCache` wird beim
Gebäudewechsel und Portfolio-Merge bewusst geleert; Dokument-Metadaten werden ausschließlich über den
gebäudegefilterten IndexedDB-Dokumentpfad neu geladen.

Schritt D ändert weder App-Version (`18.0.0`) noch State-Schema (`15`) oder IndexedDB-Version (`3`).
Der PWA-Asset-Key wird auf `app.js?v=1804`, `style.css?v=1810p3` und
`mietverwaltung-v18-presentation-d-1` angehoben.
## Schritt E: Portfolio-/Gebäudeverwaltung

Schritt E macht die in B1/B2 modellierte und in D isolierte Mehrgebäude-Struktur erstmals vollständig
über die produktive Oberfläche administrierbar. Gebäude werden nicht mehr nur über vorhandene Test-/
Importdaten sichtbar, sondern können innerhalb des primären Portfolios angelegt und bearbeitet werden.
Das aktive Gebäude bleibt dabei eine reine Präsentationspräferenz; `meta.primaryBuildingId` wird durch
Anlegen, Öffnen oder Bearbeiten eines weiteren Gebäudes nicht verändert.

`src/application/portfolio-admin.ts` enthält die typisierten Use-Cases zum Anlegen und Bearbeiten von
Gebäuden einschließlich zentraler Flächen-, Jahres-, Datums- und Geldvalidierung. Änderungen am
Primärgebäude synchronisieren weiterhin die bestehende `property`-/`finance`-Kompatibilitätsprojektion;
Änderungen an Nebenobjekten dürfen diese Projektion nicht verschieben.

`src/presentation/portfolio-administration.ts` erzeugt das gebäudeübergreifende Verwaltungsmodell mit
Aktiv-/Primärkennzeichnung und gebäudeisolierten Bestandszählern. Der bisher im großen
`src/ui/app-runtime.ts` liegende Gebäudewähler wird zusammen mit der neuen Verwaltungsoberfläche nach
`src/ui/building-workspace-ui.ts` extrahiert. Das Modul verwendet bewusst die bestehenden äußeren
Runtime-Live-Bindungen, wächst aber selbst unter strikter TypeScript-Prüfung; der Runtime-Monolith wird
dadurch nicht wieder vergrößert.

Die TypeScript-Konfiguration prüft ab E zusätzlich `src/application/**` und `src/presentation/**`.
Gebäude werden zunächst bewusst nicht gelöscht: Solange Dokumente und Abrechnungsartefakte separat
referenziert werden, vermeidet E damit verwaiste fachliche Daten. Ein neu angelegtes Gebäude wird direkt
als Arbeitsbereich aktiviert; Einheiten und Mietverhältnisse werden anschließend über die bereits
gebäudeisolierten D-Ansichten gepflegt.

Schritt E ändert weder App-Version (`18.0.0`) noch State-Schema (`15`), IndexedDB-Name/-Version
(`mietverwaltung-v6`, Version `3`) oder Backupformate. Der PWA-Asset-Key steigt auf `app.js?v=1805`,
der Stylesheet-Key auf `style.css?v=1810p9` und der Production-Cache auf `mietverwaltung-v18-portfolio-admin-e-1`.
