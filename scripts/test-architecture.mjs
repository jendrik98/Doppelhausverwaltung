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

const schema = read("src/runtime/010-schema.js");
const domain = read("src/runtime/020-domain.js");
const legalLegacy = read("src/runtime/090-legal-rules.js");
const domain2 = read("src/runtime/100-domain-2.js");
const intelligenceLegacy = read("src/runtime/050-intelligence.js");
const qualityLegacy = read("src/runtime/060-quality.js");
const smartLegacy = read("src/runtime/070-smart-engine.js");
const assistantLegacy = read("src/runtime/080-v18-billing-assistant-preview.js");
const integrityLegacy = read("src/runtime/030-integrity.js");
const traceabilityLegacy = read("src/runtime/040-traceability.js");
const db = read("src/runtime/110-db.js");
const security = read("src/runtime/120-security.js");
const backup = read("src/runtime/130-backup.js");
const appRuntime = read("src/ui/app-runtime.ts");
const runtimeOrder = read("src/runtime/order.json");
const runtimeEntry = read("src/runtime/900-app-entry.js");
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
const intelligence = read("src/domain/intelligence.ts");
const quality = read("src/domain/quality.ts");
const smartEngine = read("src/domain/smart-engine.ts");
const v18Assistant = read("src/domain/v18-assistant.ts");
const backupCodec = read("src/io/backup-codec.ts");
const uiCore = read("src/ui/ui-core.ts");
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


assert(!intelligenceLegacy.includes("function paymentMatchScore"), "Zahlungs-Matching liegt noch im Legacy-Intelligence-Code.");
assert(!intelligenceLegacy.includes("async function generateProfessionalBillingPDF"), "Professionelle PDF-Logik liegt noch im Legacy-Intelligence-Code.");
assert(intelligenceLegacy.includes("}=AppIntelligence;"), "Legacy-Brücke zu AppIntelligence fehlt.");
assert(intelligence.includes("export const INTELLIGENCE_VERSION=1"), "INTELLIGENCE_VERSION wurde verändert.");
assert(intelligence.includes("export function paymentMatchScore"), "paymentMatchScore liegt nicht im TypeScript-Intelligence-Modul.");
assert(intelligence.includes("export async function generateProfessionalBillingPDF"), "PDF-Erzeugung liegt nicht im TypeScript-Intelligence-Modul.");

assert(!qualityLegacy.includes("function parseBankCSV"), "Bank-CSV-Parsing liegt noch im Legacy-Quality-Code.");
assert(!qualityLegacy.includes("function dataQualityScore"), "Datenqualitätsbewertung liegt noch im Legacy-Quality-Code.");
assert(qualityLegacy.includes("}=AppQuality;"), "Legacy-Brücke zu AppQuality fehlt.");
assert(quality.includes("export const QUALITY_VERSION=1"), "QUALITY_VERSION wurde verändert.");
assert(quality.includes("export function parseBankCSV"), "parseBankCSV liegt nicht im TypeScript-Quality-Modul.");
assert(quality.includes("export function dataQualityScore"), "dataQualityScore liegt nicht im TypeScript-Quality-Modul.");

assert(!smartLegacy.includes("function rentMonthStatus"), "Mietzahlungsmonitor liegt noch im Legacy-Smart-Engine-Code.");
assert(!smartLegacy.includes("function billingProjection"), "Abrechnungsprognose liegt noch im Legacy-Smart-Engine-Code.");
assert(smartLegacy.includes("}=AppSmartEngine;"), "Legacy-Brücke zu AppSmartEngine fehlt.");
assert(smartEngine.includes("export const SMART_ENGINE_VERSION=1"), "SMART_ENGINE_VERSION wurde verändert.");
assert(smartEngine.includes("export function rentMonthStatus"), "rentMonthStatus liegt nicht im TypeScript-Smart-Engine-Modul.");
assert(smartEngine.includes("export function billingProjection"), "billingProjection liegt nicht im TypeScript-Smart-Engine-Modul.");

assert(!assistantLegacy.includes("function v18BillingAssistant"), "V18-Abrechnungsassistent liegt noch im Legacy-Code.");
assert(!assistantLegacy.includes("function smartInsights"), "Smart-Insights liegen noch im Legacy-V18-Code.");
assert(!assistantLegacy.includes("function smartAnswer"), "Smart-Antworten liegen noch im Legacy-V18-Code.");
assert(assistantLegacy.includes("}=AppV18Assistant;"), "Legacy-Brücke zu AppV18Assistant fehlt.");
assert(v18Assistant.includes("export const V18_ASSISTANT_VERSION=1"), "V18_ASSISTANT_VERSION wurde verändert.");
assert(v18Assistant.includes("export function v18BillingAssistant"), "v18BillingAssistant liegt nicht im TypeScript-Modul.");
assert(v18Assistant.includes("export function smartInsights"), "smartInsights liegt nicht im TypeScript-Modul.");
assert(v18Assistant.includes("export function smartAnswer"), "smartAnswer liegt nicht im TypeScript-Modul.");

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
assert(buildScript.includes('"AppIntelligence"'), "AppIntelligence wird nicht gebaut.");
assert(buildScript.includes('"AppQuality"'), "AppQuality wird nicht gebaut.");
assert(buildScript.includes('"AppSmartEngine"'), "AppSmartEngine wird nicht gebaut.");
assert(buildScript.includes('"AppV18Assistant"'), "AppV18Assistant wird nicht gebaut.");
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
assert(app.includes("compiled src/domain/intelligence.ts"), "Intelligence-TypeScript fehlt im Browser-Bundle.");
assert(app.includes("compiled src/domain/quality.ts"), "Quality-TypeScript fehlt im Browser-Bundle.");
assert(app.includes("compiled src/domain/smart-engine.ts"), "Smart-Engine-TypeScript fehlt im Browser-Bundle.");
assert(app.includes("compiled src/domain/v18-assistant.ts"), "V18-Assistant-TypeScript fehlt im Browser-Bundle.");
assert(app.includes("compiled src/io/backup-codec.ts"), "Backup-Codec-TypeScript fehlt im Browser-Bundle.");
assert(app.includes('APP_VERSION="18.0.0"'), "APP_VERSION wurde unerwartet verändert.");

assert(!fs.existsSync("src/legacy"), "src/legacy wurde nach Phase 10 nicht vollständig entfernt.");
assert(runtimeOrder.includes('"architectureVersion": 2'), "Runtime-Manifest besitzt nicht Architekturversion 2.");
assert(runtimeOrder.includes('src/runtime/000-runtime-preamble.js'), "Runtime-Preamble fehlt im Manifest.");
assert(runtimeOrder.includes('src/runtime/130-backup.js'), "Backup-Runtime-Brücke fehlt im Manifest.");
assert(runtimeOrder.includes('src/runtime/900-app-entry.js'), "App-Entry fehlt im Runtime-Manifest.");
assert(!runtimeOrder.includes('140-tests.js'), "Laufzeit-Selbsttests wurden nicht in die TypeScript-App migriert.");
assert(!runtimeOrder.includes('150-ui.js'), "Dialogsteuerung wurde nicht in die TypeScript-App migriert.");
assert(!runtimeOrder.includes('160-app.js'), "App-/Ansichtsbereich wurde nicht in die TypeScript-App migriert.");
assert(appRuntime.includes("// @ts-nocheck -- Phase 10 V3:"), "Semantikerhaltende Typing-Grenze der dynamischen App-Runtime ist nicht dokumentiert.");
assert(!appRuntime.includes("export async function start(){"), "App-Runtime darf keine zusätzliche Start-Closure einführen.");
assert(appRuntime.trimEnd().endsWith("export {};"), "app-runtime.ts ist nicht als TypeScript-Modul markiert.");
assert(appRuntime.includes("function runSelfTests(){"), "Laufzeit-Selbsttests fehlen in app-runtime.ts.");
assert(appRuntime.includes('let MODAL_RETURN_FOCUS=null,MODAL_INITIAL_FORM="",MODAL_RETURN_FOCUS_OVERRIDE=null;'), "Gekoppelter Dialogzustand fehlt in app-runtime.ts.");
assert(appRuntime.includes("function formSnapshot("), "Dialog-Snapshot fehlt in app-runtime.ts.");
assert(appRuntime.includes("function closeModal("), "closeModal fehlt in app-runtime.ts.");
assert(appRuntime.includes("function modal("), "modal fehlt in app-runtime.ts.");
assert(appRuntime.includes("}=AppUiCore;"), "App-Runtime bindet AppUiCore nicht ein.");
assert(appRuntime.includes("let storageError=null;"), "App-Startzustand fehlt in app-runtime.ts.");
assert(appRuntime.includes("const ROUTE_LABELS="), "Routing-Konfiguration fehlt in app-runtime.ts.");
assert(appRuntime.includes("function render(){"), "Zentrale Ansichtsroutine fehlt in app-runtime.ts.");
assert(appRuntime.includes("async function startApp(){"), "App-Startfunktion fehlt in app-runtime.ts.");
assert(appRuntime.includes("startApp();"), "App-Start wird in app-runtime.ts nicht ausgelöst.");
assert(!runtimeEntry.includes("AppRuntime"), "Runtime-Entry darf keine zusätzliche AppRuntime-Closure starten.");
assert(runtimeEntry.includes('console.error("Mietverwaltung Startfehler:",error)'), "Sichtbare äußere Startfehlerbehandlung ging verloren.");
assert(runtimeEntry.includes("Professional PWA hardening"), "PWA-Hardening ging bei der Abschlussmigration verloren.");
assert(uiCore.includes("export const $=id=>"), "DOM-Helper liegt nicht im TypeScript-UI-Modul.");
assert(uiCore.includes("export function validateCentralForm("), "Zentrale Formularvalidierung liegt nicht im TypeScript-UI-Modul.");
assert(uiCore.includes('document.addEventListener("submit"'), "Zentrales Submit-Gate fehlt im TypeScript-UI-Modul.");
assert(!uiCore.includes("MODAL_RETURN_FOCUS"), "ui-core.ts darf keine mutable Dialog-Live-Bindung voraussetzen.");
assert(buildScript.includes('"AppUiCore"'), "AppUiCore wird nicht gebaut.");
assert(!buildScript.includes('"AppRuntime"'), "Build darf app-runtime.ts nicht in eine zusätzliche IIFE kapseln.");
assert(buildScript.includes("const lateAppRuntime ="), "Build besitzt keine Outer-Scope-Injektion für app-runtime.ts.");
assert(buildScript.includes('relativePath === "src/runtime/900-app-entry.js"'), "App-Runtime wird nicht direkt vor dem äußeren Entry injiziert.");
assert(buildScript.includes('"src", "runtime", "order.json"'), "Build verwendet das Runtime-Manifest nicht.");
assert(!buildScript.includes('"src", "legacy", "order.json"'), "Build verweist noch auf das Legacy-Manifest.");
assert(tsconfig.includes('"src/ui/**/*.ts"'), "TypeScript-Konfiguration prüft src/ui nicht.");
assert(app.includes("compiled src/ui/ui-core.ts"), "UI-Core-TypeScript fehlt im Browser-Bundle.");
assert(app.includes("TypeScript source src/ui/app-runtime.ts · outer-scope injection"), "App-Runtime-TypeScript fehlt im Browser-Bundle.");

console.log("Architekturprüfung bestanden: Phase 10 V3 migriert Laufzeit-Selbsttests, Dialogzustand, Routing und Ansichten nach TypeScript, injiziert sie semantikerhaltend im bisherigen äußeren Runtime-Scope und entfernt src/legacy vollständig. Bewusste Runtime-Kompatibilitätsbindungen, IndexedDB v2 und App-Version 18.0.0 bleiben unverändert.");
