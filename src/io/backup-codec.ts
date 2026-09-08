export const ENCRYPTED_BACKUP_SCHEMA = "mietverwaltung-encrypted-v1";
export const FULL_BACKUP_SCHEMA = "mietverwaltung-full-backup-v2";

export interface EncryptedBackupWrapper {
  schema: typeof ENCRYPTED_BACKUP_SCHEMA;
  salt: string;
  iv: string;
  data: string;
}

type LooseRecord = Record<string, any>;

interface FullBackupPayload {
  schema: typeof FULL_BACKUP_SCHEMA;
  state: unknown;
  documents: LooseRecord[];
}

export function bytesToB64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

export function b64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptJSON(value: unknown, password: string): Promise<EncryptedBackupWrapper> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);

  return {
    schema: ENCRYPTED_BACKUP_SCHEMA,
    salt: bytesToB64(salt),
    iv: bytesToB64(iv),
    data: bytesToB64(new Uint8Array(encrypted))
  };
}

export async function decryptJSON<T = unknown>(
  wrapper: EncryptedBackupWrapper,
  password: string
): Promise<T> {
  if (!wrapper || wrapper.schema !== ENCRYPTED_BACKUP_SCHEMA) {
    throw new Error("Falsches verschlüsseltes Backup-Format");
  }

  const salt = b64ToBytes(wrapper.salt);
  const iv = b64ToBytes(wrapper.iv);
  const key = await deriveKey(password, salt);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    b64ToBytes(wrapper.data)
  );
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

export async function encodeBlobForBackup(blob: Blob): Promise<{ type: string; base64: string }> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return {
    type: blob.type || "application/octet-stream",
    base64: bytesToB64(bytes)
  };
}

export async function createFullBackup(
  state: unknown,
  password: string,
  documents: readonly LooseRecord[]
): Promise<EncryptedBackupWrapper> {
  const encoded: LooseRecord[] = [];

  for (const document of documents) {
    const copy: LooseRecord = { ...document, blob: undefined, pages: undefined };

    if (Array.isArray(document.pages) && document.pages.length) {
      copy.pageData = [];
      for (const page of document.pages) {
        copy.pageData.push({
          id: page.id,
          name: page.name,
          type: page.type,
          size: page.size,
          blobData: await encodeBlobForBackup(page.blob)
        });
      }
    } else if (document.blob) {
      copy.blobData = await encodeBlobForBackup(document.blob);
    }

    encoded.push(copy);
  }

  const payload: FullBackupPayload = {
    schema: FULL_BACKUP_SCHEMA,
    state,
    documents: encoded
  };
  return encryptJSON(payload, password);
}

export async function decodeFullBackup(
  wrapper: EncryptedBackupWrapper,
  password: string
): Promise<{ state: unknown; documents: LooseRecord[] }> {
  const payload = await decryptJSON<FullBackupPayload>(wrapper, password);
  if (!payload || payload.schema !== FULL_BACKUP_SCHEMA) {
    throw new Error("Falsches Backup-Format");
  }

  const documents: LooseRecord[] = [];
  for (const document of payload.documents || []) {
    const copy: LooseRecord = { ...document };

    if (Array.isArray(document.pageData)) {
      copy.pages = document.pageData.map((page: LooseRecord) => ({
        id: page.id,
        name: page.name,
        type: page.type,
        size: page.size,
        blob: new Blob([b64ToBytes(page.blobData.base64)], { type: page.blobData.type })
      }));
      delete copy.pageData;
    } else if (document.blobData) {
      copy.blob = new Blob([b64ToBytes(document.blobData.base64)], {
        type: document.blobData.type
      });
      delete copy.blobData;
    }

    documents.push(copy);
  }

  return { state: payload.state, documents };
}
