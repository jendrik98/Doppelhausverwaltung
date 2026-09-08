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
const db = read("src/legacy/110-db.js");
const security = read("src/legacy/120-security.js");
const backup = read("src/legacy/130-backup.js");
const buildScript = read("scripts/build-app.mjs");
const state = read("src/core/state.ts");
const persistence = read("src/core/persistence.ts");
const meter = read("src/domain/meter-parsing.ts");
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
assert(backup.includes("AppBackupCodec.createFullBackup"), "Backup-Erstellung nutzt das TypeScript-Codec nicht.");
assert(backup.includes("decodeFullBackup}=AppBackupCodec"), "Backup-Decoding ist nicht an AppBackupCodec gebunden.");
assert(backupCodec.includes('FULL_BACKUP_SCHEMA = "mietverwaltung-full-backup-v2"'), "Aktuelles Vollbackup-Schema fehlt.");
assert(backupCodec.includes('ENCRYPTED_BACKUP_SCHEMA = "mietverwaltung-encrypted-v1"'), "Aktuelles Verschlüsselungsschema fehlt.");
assert(!backupCodec.includes("mietverwaltung-v81-full-backup"), "Veraltetes V81-Backupformat ist noch zugelassen.");
assert(!backupCodec.includes("mietverwaltung-v75-full-backup"), "Veraltetes V75-Backupformat ist noch zugelassen.");

assert(buildScript.includes("bundle: true"), "Build bündelt TypeScript-Importe nicht.");
assert(buildScript.includes('"AppState"'), "AppState wird nicht gebaut.");
assert(buildScript.includes('"AppPersistence"'), "AppPersistence wird nicht gebaut.");
assert(buildScript.includes('"AppMeterParsing"'), "AppMeterParsing wird nicht gebaut.");
assert(buildScript.includes('"AppBackupCodec"'), "AppBackupCodec wird nicht gebaut.");
assert(tsconfig.includes('"src/io/**/*.ts"'), "TypeScript-Prüfung umfasst src/io nicht.");

assert(app.includes("compiled src/core/state.ts"), "State-TypeScript fehlt im Browser-Bundle.");
assert(app.includes("compiled src/core/persistence.ts"), "Persistenz-TypeScript fehlt im Browser-Bundle.");
assert(app.includes("compiled src/domain/meter-parsing.ts"), "Meter-TypeScript fehlt im Browser-Bundle.");
assert(app.includes("compiled src/io/backup-codec.ts"), "Backup-Codec-TypeScript fehlt im Browser-Bundle.");
assert(app.includes('APP_VERSION="18.0.0"'), "APP_VERSION wurde unerwartet verändert.");

console.log("Architekturprüfung bestanden: Persistenz und Backup-Codec sind echte TypeScript-Module; IndexedDB v2 bleibt unverändert.");
