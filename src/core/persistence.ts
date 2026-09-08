export const DB_NAME = "mietverwaltung-v6";
export const DB_VERSION = 2;
export const STATE_ID = "main";

const STATE_STORE = "state";
const DOCS_STORE = "docs";

export interface PersistedStateRecord<T = unknown> {
  id: string;
  data: T;
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB-Transaktion abgebrochen"));
  });
}

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STATE_STORE)) {
        db.createObjectStore(STATE_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(DOCS_STORE)) {
        db.createObjectStore(DOCS_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
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
