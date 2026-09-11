# Architektur – Doppelhausverwaltung

Dieses Dokument beschreibt ausschließlich den aktuellen Architekturvertrag. Historische Migrationsschritte gehören in die Git-Historie, nicht in die Produktionsdokumentation.

## 1. Harte Laufzeitverträge

- App-Version: `18.0.0`
- State-Schema: `15`
- IndexedDB: `mietverwaltung-v6`, Version `3`
- Primärer State-Record: `main`
- `app.js` und `style.css` sind reproduzierbare Build-Artefakte.
- Produktion wird aus `main` über GitHub Pages ausgeliefert.

Ein Schema- oder Persistenzwechsel muss migrationssicher, idempotent und durch Regressionstests belegt sein.

## 2. Schichtengrenzen

`src/core/` besitzt die kanonischen State-, Integritäts-, Validierungs-, Authentifizierungs- und Traceability-Verträge. `src/domain/` enthält fachliche Modelle ohne UI-Abhängigkeit. `src/infrastructure/` kapselt Persistenz. `src/application/` orchestriert Commands und Queries. `src/presentation/` erzeugt Workspace-Projektionen. `src/ui/` enthält Browser-UI und Design-System. `src/io/` kapselt Import, Export und Backup. `src/runtime/` stellt nur die verbleibenden Browser-Live-Bindings bereit.

Neue Fachlogik gehört nicht in `src/ui/app-runtime.ts`. Der Runtime-Shell darf nur schrumpfen oder dünne Adapter erhalten; die Quality-Ratchet überwacht ihre Größe und verbleibende `@ts-nocheck`-Quellen.

## 3. Persistierte Kompatibilität

`meta.v17` bleibt absichtlich erhalten. Der Name ist historisch, die Daten darin sind aber Bestandteil bestehender Nutzerzustände. `createEmptyState()` initialisiert diesen Bereich und `normalizeState()` übernimmt ihn bei Migrationen. Eine Entfernung oder Umbenennung ist nur zusammen mit einer expliziten State-Migration, Rückwärtskompatibilitätstests und Backup-/Restore-Nachweis zulässig.

Historische Dateinamen, Runtime-Helfernamen, DOM-IDs oder Testnamen sind dagegen kein Persistenzvertrag und sollen semantisch benannt sein.

## 4. Portfolio- und Gebäudeisolation

Portfolio → Gebäude → Einheit → Mietverhältnis ist die fachliche Hierarchie. Gebäudegebundene Sammlungen werden über stabile IDs projiziert und dürfen beim Wechsel des aktiven Gebäudes nicht vermischt werden. Das Primärgebäude bleibt migrations- und UI-seitig geschützt.

## 5. Produktive Basis A–G

Die aktuelle Basis umfasst Mehrgebäude-State und Migration, Repository-/Application-/Presentation-Grenzen, Portfolio-Administration, ein konsolidiertes Design-System sowie den Vermietungs-Lifecycle. Vertragsstände werden historisch ergänzt statt überschrieben; Zahlungen können explizit Mietmonaten zugeordnet werden; Übergaben und Zählerwechsel bleiben verkettet; Abrechnungssnapshots besitzen revisionssichere Versionen und Prüfsummen.

Diese Fähigkeiten sind Produktverträge. Die Buchstaben A–G bezeichnen nur die abgeschlossene Architekturserie und dürfen nicht als neue temporäre Runtime-Schichten weiterleben.

## 6. Architecture H – Dokumente, Nachweise & Jahresarchiv

### H1: Nachweiskette und Archivdomäne

`src/domain/year-archive.ts` ist eine reine, read-only Domänenschicht. Sie verbindet vorhandene Referenzen zu einer prüfbaren Kette:

`Dokument-ID → Kostenpositions-ID → direkte Zahlungsreferenz → Abrechnungssnapshot/Event`

Für eine vollständige Kette gelten nur explizite Zahlungsreferenzen (`payment.positionId`) als belastbarer Nachweis. Eine bloße gemeinsame Kostenquelle wird als Kandidat ausgewiesen, schließt die Lücke aber nicht automatisch. Dokumente werden aus `provenance.documentId`, `position.documentId` oder `source.sourceDocumentId` aufgelöst. Abrechnungssnapshots werden über `event.positionId` verknüpft.

Das Jahresarchiv enthält ausschließlich JSON-sichere Metadaten und Referenzen; Dokument-Binärdaten bleiben im Dokumentenspeicher. H1 mutiert weder den State noch erhöht es das State-Schema.

### H2: Jahresarchiv-Oberfläche

`src/ui/year-archive-ui.ts` baut ausschließlich auf der H1-Domäne auf. Der Bereich **Mehr → Jahresarchiv** zeigt den Status eines Jahres, vollständige und lückenhafte Nachweisketten, nicht zugeordnete Dokumente und Ausgaben sowie direkte Korrekturwege in die bestehenden Fachbereiche. Die globale Gebäudeauswahl bleibt die einzige Gebäudequelle; Dokumente werden über die bereits gebäudeisolierte `listDocuments()`-Runtime-Grenze geladen.

Der H2-Export nutzt `createYearArchiveExport()` und ergänzt nur den sichtbaren Gebäudekontext. Exportiert werden JSON-sichere Metadaten und Referenzen, keine Dokument-Binärdaten. Ein Export im Status `review` ist zulässig und dokumentiert die offenen Lücken ausdrücklich.

Die UI ist ein eigenes gebündeltes TypeScript-Modul (`AppYearArchiveUi`). `app-runtime.ts` enthält nur den Navigationsadapter und darf wegen H2 nicht wieder zum Fachlogik-Monolithen anwachsen.

### H3: Jahresabschluss-Paket

`src/io/year-close-package.ts` baut auf dem H2-Export auf und bündelt ausschließlich die Dokument-Binärdaten, deren IDs bereits im Jahresarchiv enthalten sind. Dadurch bleibt die Gebäudeisolation eine Eigenschaft der bestehenden Dokument-/Archivgrenzen; H3 führt keine zweite fachliche Auswahlquelle ein.

Das exportierte ZIP enthält:

- `manifest.json` mit dem unveränderten H1/H2-Jahresarchiv und H3-Paketindex,
- `STATUS.txt` mit dem menschenlesbaren Abschluss-/Prüfstatus,
- `zahlungen.csv` als lesbare Zahlungsübersicht,
- `abrechnungen.json` mit den JSON-sicheren Abrechnungssnapshot-Metadaten,
- `dokumente/…` mit den tatsächlich gespeicherten Einzeldateien bzw. Seiten der ausgewählten Belege.

H3 verwendet ein standardkonformes, unkomprimiertes ZIP-Format und benötigt deshalb keine externe Cloud- oder Laufzeitabhängigkeit. Dateinamen werden lokal normalisiert und können keine Pfadsegmente aus dem Dokumentenspeicher übernehmen.

Der Paketstatus ist nur `complete`, wenn das H1/H2-Jahresarchiv `ready` ist **und** zu jedem im Archiv geführten Dokument mindestens eine exportierbare Binärdatei vorhanden ist. Andernfalls bleibt der Paketstatus `review`; fehlende Binärdateien werden im Manifest und in `STATUS.txt` explizit aufgeführt. H3 mutiert weder den State noch den Dokumentenspeicher und ersetzt nicht das verschlüsselte Vollbackup.

## 7. Build und Runtime-Komposition

`scripts/build-app.mjs` erzeugt `app.js` deterministisch aus den modularen Quellen und der in `src/runtime/order.json` festgelegten Runtime-Reihenfolge. Runtime-Bridges exportieren nur Bindings, die vom äußeren Browser-Scope tatsächlich benötigt werden. Tote Alias-Bindings sind nicht zulässig.

Das Design-System wird aus `src/ui/design-system.css` nach `style.css` reproduziert. Cache-Busting in `index.html` und `service-worker.js` muss exakt übereinstimmen.

## 8. Dauerhafte Gates

Ein produktiver Commit muss mindestens bestehen:

```text
npm run build
npm run typecheck
npm run test:validation
npm run test:architecture
npm run test:archive
npm run test:archive-ui
npm run test:archive-package
npm run test:hygiene
npm run test:quality
npm run test:pwa
npm run test:e2e
```

`test:hygiene` erzwingt unter anderem: nur die dauerhaften CI-/Live-Workflows, aktuelle Paketidentität, semantische Test-/Runtime-Namen, keine bestätigten toten Runtime-Aliase und den ausdrücklichen Erhalt des `meta.v17`-Kompatibilitätsvertrags.

Der Live-E2E-Test akzeptiert ein Deployment erst, wenn die live geladene `app.js` denselben SHA-256-Hash wie das getestete Commit-Artefakt besitzt.

## 9. Repository-Regeln

Temporäre Architektur-Workflows bleiben nicht im Endzustand. Historische Migrations-Tagebücher, versionsgebundene Alt-Namen und veraltete Preview-Dateien gehören nicht in den aktuellen Tree. Generierte Artefakte werden nie von Hand editiert. Jede Ausnahme muss einen aktiven Persistenz- oder Kompatibilitätsvertrag schützen und im Hygiene-Test ausdrücklich sichtbar sein.
