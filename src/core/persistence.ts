export const DB_NAME = "mietverwaltung-v6";
export const DB_VERSION = 3;
export const STATE_ID = "main";

export const STATE_STORE = "state";
export const DOCS_STORE = "docs";
export const PORTFOLIO_STORE = "portfolios";
export const BUILDING_STORE = "buildings";
export const UNIT_STORE = "units";
export const TENANCY_STORE = "tenancies";
export const REPOSITORY_META_STORE = "repositoryMeta";

// Historischer Architekturvertrag der beiden bestehenden Stores:
// createObjectStore(STATE_STORE, { keyPath: "id" })
// createObjectStore(DOCS_STORE, { keyPath: "id" })

export interface PersistedStateRecord<T = unknown> {
  id: string;
  data: T;
}

export function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB-Transaktion abgebrochen"));
  });
}

function ensureStore(
  db: IDBDatabase,
  transaction: IDBTransaction,
  name: string,
  indexes: ReadonlyArray<{ name: string; keyPath: string }> = []
): IDBObjectStore {
  const store = db.objectStoreNames.contains(name)
    ? transaction.objectStore(name)
    : db.createObjectStore(name, { keyPath: "id" });
  for (const index of indexes) {
    if (!store.indexNames.contains(index.name)) store.createIndex(index.name, index.keyPath, { unique: false });
  }
  return store;
}

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      const transaction = request.transaction;
      if (!transaction) throw new Error("IndexedDB-Upgrade ohne Transaktion");
      ensureStore(db, transaction, STATE_STORE);
      ensureStore(db, transaction, DOCS_STORE);
      ensureStore(db, transaction, PORTFOLIO_STORE);
      ensureStore(db, transaction, BUILDING_STORE, [{ name: "portfolioId", keyPath: "portfolioId" }]);
      ensureStore(db, transaction, UNIT_STORE, [{ name: "buildingId", keyPath: "buildingId" }]);
      ensureStore(db, transaction, TENANCY_STORE, [
        { name: "buildingId", keyPath: "buildingId" },
        { name: "unitId", keyPath: "unitId" }
      ]);
      ensureStore(db, transaction, REPOSITORY_META_STORE);
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onblocked = () => reject(new Error("IndexedDB-Upgrade wird durch einen älteren geöffneten App-Tab blockiert"));
    request.onerror = () => reject(request.error);
  });
}

export async function readStateRecord<T = unknown>(): Promise<PersistedStateRecord<T> | null> {
  const db = await openDB();
  const transaction = db.transaction(STATE_STORE, "readonly");
  const request = transaction.objectStore(STATE_STORE).get(STATE_ID);
  const record = await requestValue<PersistedStateRecord<T> | undefined>(request);
  return record ?? null;
}

// Kompatibilitäts-Snapshot. Produktive App-Schreibvorgänge laufen ab B2 über
// src/infrastructure/portfolio-repository.ts, damit Snapshot und Projektion atomar bleiben.
export async function saveState<T>(state: T): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction(STATE_STORE, "readwrite");
  transaction.objectStore(STATE_STORE).put({ id: STATE_ID, data: state });
  await transactionDone(transaction);
}

export async function addDocument(document: any): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction(DOCS_STORE, "readwrite");
  transaction.objectStore(DOCS_STORE).put(document);
  await transactionDone(transaction);
}

export async function getDocument<T = any>(id: IDBValidKey): Promise<T | null> {
  const db = await openDB();
  const transaction = db.transaction(DOCS_STORE, "readonly");
  const request = transaction.objectStore(DOCS_STORE).get(id);
  const document = await requestValue<T | undefined>(request);
  return document ?? null;
}

export async function listDocuments<T = any>(): Promise<T[]> {
  const db = await openDB();
  const transaction = db.transaction(DOCS_STORE, "readonly");
  const request = transaction.objectStore(DOCS_STORE).getAll();
  const documents = await requestValue<T[]>(request);
  return documents ?? [];
}

export async function deleteDocument(id: IDBValidKey): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction(DOCS_STORE, "readwrite");
  transaction.objectStore(DOCS_STORE).delete(id);
  await transactionDone(transaction);
}

export async function updateDocument(document: any): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction(DOCS_STORE, "readwrite");
  transaction.objectStore(DOCS_STORE).put(document);
  await transactionDone(transaction);
}

export async function replaceDocuments(documents: readonly any[]): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction(DOCS_STORE, "readwrite");
  const store = transaction.objectStore(DOCS_STORE);
  store.clear();
  for (const document of documents) store.put(document);
  await transactionDone(transaction);
}
