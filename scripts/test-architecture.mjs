import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FEHLER: ${message}`);
    process.exit(1);
  }
}

const schema = read("src/legacy/010-schema.js");
const domain = read("src/legacy/020-domain.js");
const legalLegacy = read("src/legacy/090-legal-rules.js");
const domain2 = read("src/legacy/100-domain-2.js");
const integrityLegacy = read("src/legacy/030-integrity.js");
const traceabilityLegacy = read("src/legacy/040-traceability.js");
const db = read("src/legacy/110-db.js");
const security = read("src/legacy/120-security.js");
const backup = read("src/legacy/130-backup.js");
const buildScript = read("scripts/build-app.mjs");
const state = read("src/core/state.ts");
const persistence = read("src/core/persistence.ts");
const auth = read("src/core/auth.ts");
const integrity = read("src/core/integrity.ts");
const traceability = read("src/core/traceability.ts");
const meter = read("src/domain/meter-parsing.ts");
const propertyDomain = read("src/domain/property-domain.ts");
const legalRules = read("src/domain/legal-rules.ts");
const billingDomain = read("src/domain/billing-domain.ts");
const backupCodec = read("src/io/backup-codec.ts");
const tsconfig = read("tsconfig.json");
const app = read("app.js");

assert(!schema.includes("function localDateISO"), "localDateISO liegt noch im Legacy-Schema.");
assert(!schema.includes("function createEmptyState"), "createEmptyState liegt noch im Legacy-Schema.");
assert(schema.includes("}=AppState;"), "Legacy-Kompatibilitätsbrücke zu AppState fehlt.");

assert(!domain.includes("function normalizeMeterNumber"), "normalizeMeterNumber liegt noch im Legacy-Domain-Code.");
assert(!domain.includes("function meterNumberSimilarity"), "meterNumberSimilarity liegt noch im Legacy-Domain-Code.");
assert(domain.includes("}=AppMeterParsing;"), "Legacy-Kompatibilitätsbrücke zu AppMeterParsing fehlt.");

assert(state.includes('from "./date"'), "state.ts verwendet das eigenständige date-Modul nicht.");
assert(meter.includes("export function parseMeterReadingValue"), "meter-parsing.ts exportiert den Parser nicht.");

assert(!domain.includes("function positionDefaults"), "Kostenpositionslogik liegt noch im Legacy-Domain-Code.");
assert(!domain.includes("function migrateDomainState"), "Domain-Migrationslogik liegt noch im Legacy-Domain-Code.");
assert(!domain.includes("function settlementConsumption"), "Wasserabrechnungslogik liegt noch im Legacy-Domain-Code.");
assert(!domain.includes("function centralBillingAnalysis"), "Zentrale Abrechnungsanalyse liegt noch im Legacy-Domain-Code.");
assert(domain.includes("}=AppPropertyDomain;"), "Legacy-Brücke zu AppPropertyDomain fehlt.");
assert(domain.includes("const DOMAIN_VERSION=1;"), "DOMAIN_VERSION wurde verändert oder aus der Laufzeitbrücke entfernt.");
assert(propertyDomain.includes("export function positionDefaults"), "positionDefaults liegt nicht im TypeScript-Domainmodul.");
assert(propertyDomain.includes("export function settlementConsumption"), "settlementConsumption liegt nicht im TypeScript-Domainmodul.");
assert(propertyDomain.includes("export function centralBillingAnalysis"), "centralBillingAnalysis liegt nicht im TypeScript-Domainmodul.");
assert(propertyDomain.includes("declare const DOMAIN_VERSION: number;"), "TypeScript-Domainmodul nutzt die bestehende DOMAIN_VERSION-Bindung nicht.");

assert(!legalLegacy.includes("function category"), "Kategorie-Regellogik liegt noch im Legacy-Rechtscode.");
assert(!legalLegacy.includes("async function loadLegalPack"), "Regelpaket-Lader liegt noch im Legacy-Rechtscode.");
assert(!legalLegacy.includes("function legalDecision"), "Umlageentscheidung liegt noch im Legacy-Rechtscode.");
assert(legalLegacy.includes("let ACTIVE_LEGAL_PACK=null;"), "ACTIVE_LEGAL_PACK-Live-Bindung fehlt in der Laufzeitbrücke.");
assert(legalLegacy.includes("}=AppLegalRules;"), "Legacy-Brücke zu AppLegalRules fehlt.");
assert(legalRules.includes('export const LAW_DATE="2026-09-05"'), "LAW_DATE wurde bei der Migration verändert.");
assert(legalRules.includes("declare let ACTIVE_LEGAL_PACK: any;"), "TypeScript-Rechtsmodul nutzt die Live-Bindung ACTIVE_LEGAL_PACK nicht.");
assert(legalRules.includes("ACTIVE_LEGAL_PACK=p;return p"), "Geladenes Regelpaket aktualisiert ACTIVE_LEGAL_PACK nicht mehr.");
assert(legalRules.includes('mietverwaltung-legal-pack-v1'), "Aktuelles Regelpaket-Schema fehlt im TypeScript-Rechtsmodul.");
assert(legalRules.includes("export function legalDecision"), "legalDecision liegt nicht im TypeScript-Rechtsmodul.");

assert(!domain2.includes("const euro=n=>"), "Format-/Domain-Helfer liegen noch im zweiten Legacy-Domain-Code.");
assert(!domain2.includes("function billingPeriodInfo"), "Abrechnungsperiodenlogik liegt noch im zweiten Legacy-Domain-Code.");
assert(!domain2.includes("function actualAdvanceEvidenceInPeriod"), "Vorauszahlungslogik liegt noch im zweiten Legacy-Domain-Code.");
assert(!domain2.includes("function billingReadiness"), "Abrechnungsbereitschaft liegt noch im zweiten Legacy-Domain-Code.");
assert(!domain2.includes("function createBillingSnapshot"), "Snapshot-Erstellung liegt noch im zweiten Legacy-Domain-Code.");
assert(domain2.includes("}=AppBillingDomain;"), "Legacy-Brücke zu AppBillingDomain fehlt.");
assert(billingDomain.includes("export function billingPeriodInfo"), "billingPeriodInfo liegt nicht im TypeScript-Billingmodul.");
assert(billingDomain.includes("export function actualAdvanceEvidenceInPeriod"), "Vorauszahlungslogik liegt nicht im TypeScript-Billingmodul.");
assert(billingDomain.includes("export function billingReadiness"), "billingReadiness liegt nicht im TypeScript-Billingmodul.");
assert(billingDomain.includes("export function createBillingSnapshot"), "createBillingSnapshot liegt nicht im TypeScript-Billingmodul.");
assert(billingDomain.includes("ACTIVE_LEGAL_PACK?.version"), "Snapshots verwenden das aktive Regelpaket nicht mehr dynamisch.");

assert(!integrityLegacy.includes("function cloneState"), "cloneState liegt noch im Legacy-Integritätscode.");
assert(!integrityLegacy.includes("function validateDomainState"), "Domain-Validierung liegt noch im Legacy-Integritätscode.");
assert(!integrityLegacy.includes("async function sha256Text"), "Prüfsummenlogik liegt noch im Legacy-Integritätscode.");
assert(integrityLegacy.includes("}=AppIntegrity;"), "Legacy-Brücke zu AppIntegrity fehlt.");
assert(integrityLegacy.includes('const APP_VERSION="18.0.0"'), "APP_VERSION wurde aus der Laufzeitbrücke entfernt oder verändert.");
assert(integrityLegacy.includes("let LAST_STABLE_STATE=null"), "LAST_STABLE_STATE fehlt in der Laufzeitbrücke.");
assert(integrity.includes("export function validateDomainState"), "validateDomainState liegt nicht im TypeScript-Integritätsmodul.");
assert(integrity.includes("export function repairDomainState"), "repairDomainState liegt nicht im TypeScript-Integritätsmodul.");
assert(integrity.includes("export async function finalizeSnapshotIntegrity"), "Snapshot-Prüfsumme liegt nicht im TypeScript-Integritätsmodul.");
assert(integrity.includes("export async function documentFingerprint"), "Dokument-Fingerprint liegt nicht im TypeScript-Integritätsmodul.");

assert(!traceabilityLegacy.includes("function ensureTraceShape"), "Trace-Form liegt noch im Legacy-Traceability-Code.");
assert(!traceabilityLegacy.includes("async function executeCommand"), "Command-Ausführung liegt noch im Legacy-Traceability-Code.");
assert(!traceabilityLegacy.includes("function billingClosureChecklist"), "Abschluss-Checkliste liegt noch im Legacy-Traceability-Code.");
assert(traceabilityLegacy.includes("}=AppTraceability;"), "Legacy-Brücke zu AppTraceability fehlt.");
assert(traceabilityLegacy.includes("const TRACE_VERSION=1"), "TRACE_VERSION wurde verändert.");
assert(traceabilityLegacy.includes("const COMMAND_VERSION=1"), "COMMAND_VERSION wurde verändert.");
assert(traceability.includes("export function ensureTraceShape"), "ensureTraceShape liegt nicht im TypeScript-Traceability-Modul.");
assert(traceability.includes("export async function restoreFromPoint"), "Restore-Point-Wiederherstellung liegt nicht im TypeScript-Traceability-Modul.");
assert(traceability.includes("export async function executeCommand"), "executeCommand liegt nicht im TypeScript-Traceability-Modul.");
assert(traceability.includes("export function billingClosureChecklist"), "billingClosureChecklist liegt nicht im TypeScript-Traceability-Modul.");

assert(!db.includes("indexedDB."), "IndexedDB-Zugriffe liegen noch im Legacy-DB-Code.");
assert(!db.includes("migrateLegacyStorage"), "Alte LocalStorage-Migration liegt noch im DB-Pfad.");
assert(db.includes("}=AppPersistence;"), "Legacy-Brücke zu AppPersistence fehlt.");
assert(persistence.includes('DB_NAME = "mietverwaltung-v6"'), "IndexedDB-Name wurde verändert.");
assert(persistence.includes("DB_VERSION = 2"), "IndexedDB-Version wurde verändert.");
assert(persistence.includes('STATE_ID = "main"'), "State-Schlüssel wurde verändert.");
assert(persistence.includes('createObjectStore(STATE_STORE, { keyPath: "id" })'), "State-Store-Schema wurde verändert.");
assert(persistence.includes('createObjectStore(DOCS_STORE, { keyPath: "id" })'), "Docs-Store-Schema wurde verändert.");

assert(!security.includes("async function encryptJSON"), "Backup-Verschlüsselung liegt noch im Legacy-Sicherheitscode.");
assert(!security.includes("function bytesToB64"), "Backup-Base64-Codec liegt noch im Legacy-Sicherheitscode.");
assert(!security.includes("PublicKeyCredential"), "WebAuthn-Implementierung liegt noch im Legacy-Sicherheitscode.");
assert(security.includes("}=AppAuth;"), "Legacy-Brücke zu AppAuth fehlt.");
assert(auth.includes('SEC_KEY = "mietverwaltung_webauthn"'), "Aktueller WebAuthn-Schlüssel wurde verändert.");
assert(auth.includes("export async function registerDevice"), "registerDevice liegt nicht im TypeScript-Auth-Modul.");
assert(auth.includes("export async function authenticate"), "authenticate liegt nicht im TypeScript-Auth-Modul.");
assert(!auth.includes("mietverwaltung_v75_webauthn"), "Veraltete V75-WebAuthn-Schlüsselübernahme ist noch vorhanden.");
assert(backup.includes("AppBackupCodec.createFullBackup"), "Backup-Erstellung nutzt das TypeScript-Codec nicht.");
assert(backup.includes("decodeFullBackup}=AppBackupCodec"), "Backup-Decoding ist nicht an AppBackupCodec gebunden.");
assert(backupCodec.includes('FULL_BACKUP_SCHEMA = "mietverwaltung-full-backup-v2"'), "Aktuelles Vollbackup-Schema fehlt.");
assert(backupCodec.includes('ENCRYPTED_BACKUP_SCHEMA = "mietverwaltung-encrypted-v1"'), "Aktuelles Verschlüsselungsschema fehlt.");
assert(!backupCodec.includes("mietverwaltung-v81-full-backup"), "Veraltetes V81-Backupformat ist noch zugelassen.");
assert(!backupCodec.includes("mietverwaltung-v75-full-backup"), "Veraltetes V75-Backupformat ist noch zugelassen.");

assert(buildScript.includes("bundle: true"), "Build bündelt TypeScript-Importe nicht.");
assert(buildScript.includes('"AppState"'), "AppState wird nicht gebaut.");
assert(buildScript.includes('"AppPersistence"'), "AppPersistence wird nicht gebaut.");
assert(buildScript.includes('"AppAuth"'), "AppAuth wird nicht gebaut.");
assert(buildScript.includes('"AppIntegrity"'), "AppIntegrity wird nicht gebaut.");
assert(buildScript.includes('"AppTraceability"'), "AppTraceability wird nicht gebaut.");
assert(buildScript.includes('"AppMeterParsing"'), "AppMeterParsing wird nicht gebaut.");
assert(buildScript.includes('"AppPropertyDomain"'), "AppPropertyDomain wird nicht gebaut.");
assert(buildScript.includes('"AppLegalRules"'), "AppLegalRules wird nicht gebaut.");
assert(buildScript.includes('"AppBillingDomain"'), "AppBillingDomain wird nicht gebaut.");
assert(buildScript.includes('"AppBackupCodec"'), "AppBackupCodec wird nicht gebaut.");
assert(tsconfig.includes('"src/io/**/*.ts"'), "TypeScript-Prüfung umfasst src/io nicht.");

assert(app.includes("compiled src/core/state.ts"), "State-TypeScript fehlt im Browser-Bundle.");
assert(app.includes("compiled src/core/persistence.ts"), "Persistenz-TypeScript fehlt im Browser-Bundle.");
assert(app.includes("compiled src/core/auth.ts"), "Auth-TypeScript fehlt im Browser-Bundle.");
assert(app.includes("compiled src/core/integrity.ts"), "Integritäts-TypeScript fehlt im Browser-Bundle.");
assert(app.includes("compiled src/core/traceability.ts"), "Traceability-TypeScript fehlt im Browser-Bundle.");
assert(app.includes("compiled src/domain/meter-parsing.ts"), "Meter-TypeScript fehlt im Browser-Bundle.");
assert(app.includes("compiled src/domain/property-domain.ts"), "Property-Domain-TypeScript fehlt im Browser-Bundle.");
assert(app.includes("compiled src/domain/legal-rules.ts"), "Legal-Rules-TypeScript fehlt im Browser-Bundle.");
assert(app.includes("compiled src/domain/billing-domain.ts"), "Billing-Domain-TypeScript fehlt im Browser-Bundle.");
assert(app.includes("compiled src/io/backup-codec.ts"), "Backup-Codec-TypeScript fehlt im Browser-Bundle.");
assert(app.includes('APP_VERSION="18.0.0"'), "APP_VERSION wurde unerwartet verändert.");

console.log("Architekturprüfung bestanden: Phase 7 migriert Kern-Fachlogik und Rechtsregeln nach TypeScript; IndexedDB v2 und App-Version 18.0.0 bleiben unverändert.");
