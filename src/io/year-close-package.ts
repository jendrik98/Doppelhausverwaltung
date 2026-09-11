type AnyRecord = Record<string, any>;

export const YEAR_CLOSE_PACKAGE_VERSION = 1;
export const YEAR_CLOSE_PACKAGE_SCHEMA = "doppelhaus-year-close-package-v1";

type BlobLike = Blob & { arrayBuffer: () => Promise<ArrayBuffer> };

type PreparedEntry = {
  path: string;
  data: Blob | Uint8Array;
  size: number;
  crc32: number;
  mime: string;
  documentId?: string;
  pageId?: string;
};

export type YearCloseCoverage = {
  status: "complete" | "review";
  documentRecords: number;
  documentsWithBinary: number;
  binaryFiles: number;
  missingBinaryDocuments: Array<{ id: string; label: string }>;
};

const arr = (value: unknown): AnyRecord[] => Array.isArray(value) ? value as AnyRecord[] : [];
const idText = (value: unknown): string => String(value || "");
const encoder = new TextEncoder();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function hex32(value: number): string {
  return (value >>> 0).toString(16).padStart(8, "0");
}

function safeSegment(value: unknown, fallback = "datei"): string {
  const text = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/]+/g, "-")
    .replace(/[^a-zA-Z0-9._ -]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .replace(/[.-]+$/, "")
    .toLowerCase();
  return text || fallback;
}

function extensionForMime(type: unknown): string {
  const mime = String(type || "").toLowerCase();
  if (mime === "application/pdf") return ".pdf";
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "text/plain") return ".txt";
  if (mime === "application/json") return ".json";
  return "";
}

function safeFilename(name: unknown, type: unknown, fallback = "datei"): string {
  const cleaned = safeSegment(name, fallback);
  if (/\.[a-z0-9]{1,8}$/i.test(cleaned)) return cleaned;
  return `${cleaned}${extensionForMime(type)}`;
}

function isBlobLike(value: unknown): value is BlobLike {
  return !!value && typeof (value as any).arrayBuffer === "function" && typeof (value as any).size === "number";
}

function binaryParts(document: AnyRecord): Array<{ blob: BlobLike; name: string; type: string; pageId?: string }> {
  const pages = arr(document?.pages).filter(page => isBlobLike(page?.blob));
  if (pages.length) {
    return pages.map((page, index) => ({
      blob: page.blob,
      name: safeFilename(page.name || `seite-${String(index + 1).padStart(2, "0")}`, page.type || page.blob?.type, `seite-${index + 1}`),
      type: String(page.type || page.blob?.type || "application/octet-stream"),
      pageId: idText(page.id)
    }));
  }
  if (isBlobLike(document?.blob)) {
    return [{
      blob: document.blob,
      name: safeFilename(document.name || document.label || document.id, document.type || document.blob?.type, idText(document.id) || "beleg"),
      type: String(document.type || document.blob?.type || "application/octet-stream")
    }];
  }
  return [];
}

export function analyzeYearClosePackage(archiveExport: AnyRecord, documents: AnyRecord[]): YearCloseCoverage {
  const archiveDocuments = arr(archiveExport?.archive?.documents);
  const documentMap = new Map(arr(documents).map(document => [idText(document.id), document]));
  const missingBinaryDocuments: Array<{ id: string; label: string }> = [];
  let documentsWithBinary = 0;
  let binaryFiles = 0;

  for (const meta of archiveDocuments) {
    const id = idText(meta.id);
    const document = documentMap.get(id);
    const parts = document ? binaryParts(document) : [];
    if (!parts.length) {
      missingBinaryDocuments.push({ id, label: String(meta.label || document?.label || document?.name || id || "Dokument") });
      continue;
    }
    documentsWithBinary += 1;
    binaryFiles += parts.length;
  }

  const archiveReady = String(archiveExport?.archive?.status || "") === "ready";
  return {
    status: archiveReady && missingBinaryDocuments.length === 0 ? "complete" : "review",
    documentRecords: archiveDocuments.length,
    documentsWithBinary,
    binaryFiles,
    missingBinaryDocuments
  };
}

function writeU16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value & 0xffff, true);
}
function writeU32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, true);
}

function localHeader(entry: PreparedEntry, nameBytes: Uint8Array): Uint8Array {
  const header = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(header.buffer);
  writeU32(view, 0, 0x04034b50);
  writeU16(view, 4, 20);
  writeU16(view, 6, 0x0800);
  writeU16(view, 8, 0);
  writeU16(view, 10, 0);
  writeU16(view, 12, 0x0021);
  writeU32(view, 14, entry.crc32);
  writeU32(view, 18, entry.size);
  writeU32(view, 22, entry.size);
  writeU16(view, 26, nameBytes.length);
  writeU16(view, 28, 0);
  header.set(nameBytes, 30);
  return header;
}

function centralHeader(entry: PreparedEntry, nameBytes: Uint8Array, localOffset: number): Uint8Array {
  const header = new Uint8Array(46 + nameBytes.length);
  const view = new DataView(header.buffer);
  writeU32(view, 0, 0x02014b50);
  writeU16(view, 4, 20);
  writeU16(view, 6, 20);
  writeU16(view, 8, 0x0800);
  writeU16(view, 10, 0);
  writeU16(view, 12, 0);
  writeU16(view, 14, 0x0021);
  writeU32(view, 16, entry.crc32);
  writeU32(view, 20, entry.size);
  writeU32(view, 24, entry.size);
  writeU16(view, 28, nameBytes.length);
  writeU16(view, 30, 0);
  writeU16(view, 32, 0);
  writeU16(view, 34, 0);
  writeU16(view, 36, 0);
  writeU32(view, 38, 0);
  writeU32(view, 42, localOffset);
  header.set(nameBytes, 46);
  return header;
}

function endOfCentralDirectory(entries: number, centralSize: number, centralOffset: number): Uint8Array {
  const footer = new Uint8Array(22);
  const view = new DataView(footer.buffer);
  writeU32(view, 0, 0x06054b50);
  writeU16(view, 4, 0);
  writeU16(view, 6, 0);
  writeU16(view, 8, entries);
  writeU16(view, 10, entries);
  writeU32(view, 12, centralSize);
  writeU32(view, 16, centralOffset);
  writeU16(view, 20, 0);
  return footer;
}

async function prepareEntry(path: string, data: Blob | Uint8Array, mime: string, metadata: Partial<PreparedEntry> = {}): Promise<PreparedEntry> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(await data.arrayBuffer());
  return {
    path, data, size: bytes.byteLength, crc32: crc32(bytes), mime,
    documentId: metadata.documentId, pageId: metadata.pageId
  };
}

function zipStore(entries: PreparedEntry[]): Blob {
  if (entries.length > 65535) throw new Error("Zu viele Dateien für ein ZIP-Paket.");
  const parts: BlobPart[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.path);
    const local = localHeader(entry, nameBytes);
    parts.push(local as BlobPart, entry.data as BlobPart);
    central.push(centralHeader(entry, nameBytes, offset));
    offset += local.byteLength + entry.size;
  }
  const centralOffset = offset;
  let centralSize = 0;
  for (const header of central) {
    parts.push(header as BlobPart);
    centralSize += header.byteLength;
  }
  parts.push(endOfCentralDirectory(entries.length, centralSize, centralOffset) as BlobPart);
  return new Blob(parts, { type: "application/zip" });
}

function uniquePath(path: string, used: Set<string>): string {
  if (!used.has(path)) {
    used.add(path);
    return path;
  }
  const dot = path.lastIndexOf(".");
  const slash = path.lastIndexOf("/");
  const stem = dot > slash ? path.slice(0, dot) : path;
  const ext = dot > slash ? path.slice(dot) : "";
  let counter = 2;
  while (used.has(`${stem}-${counter}${ext}`)) counter += 1;
  const unique = `${stem}-${counter}${ext}`;
  used.add(unique);
  return unique;
}

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function paymentsCsv(archiveExport: AnyRecord): string {
  const lines = [["id","datum","richtung","betrag","bezeichnung","kostenposition","quelle","mietverhaeltnis"].map(csvCell).join(";")];
  for (const payment of arr(archiveExport?.archive?.payments)) {
    lines.push([payment.id,payment.date,payment.direction,Number(payment.amount || 0).toFixed(2).replace(".",","),payment.label,payment.positionId,payment.sourceId,payment.leaseId].map(csvCell).join(";"));
  }
  return `${lines.join("\n")}\n`;
}

function statusText(archiveExport: AnyRecord, coverage: YearCloseCoverage): string {
  const summary = archiveExport?.archive?.summary || {};
  const building = String(archiveExport?.context?.buildingLabel || "Aktives Gebäude");
  const year = Number(archiveExport?.archive?.year || 0);
  const lines = [
    `Jahresabschluss-Paket ${year}`,
    `Gebäude: ${building}`,
    `Paketstatus: ${coverage.status === "complete" ? "VOLLSTÄNDIG" : "PRÜFEN"}`,
    "",
    `Nachweisketten: ${Number(summary.chains || 0)}`,
    `Vollständige Nachweisketten: ${Number(summary.completeChains || 0)}`,
    `Offene Nachweislücken: ${Number(summary.gaps || 0)}`,
    `Dokumenteinträge: ${coverage.documentRecords}`,
    `Dokumente mit exportierbarer Datei: ${coverage.documentsWithBinary}`,
    `Exportierte Belegdateien: ${coverage.binaryFiles}`,
    `Abrechnungssnapshots: ${Number(summary.snapshots || 0)}`,
    ""
  ];
  if (coverage.missingBinaryDocuments.length) {
    lines.push("Dokumente ohne exportierbare Binärdatei:");
    for (const document of coverage.missingBinaryDocuments) lines.push(`- ${document.label} (${document.id})`);
    lines.push("");
  }
  lines.push(
    coverage.status === "complete"
      ? "Das Paket ist auf Basis des Jahresarchivs vollständig exportiert."
      : "Das Paket dokumentiert einen Prüfstatus. Offene Nachweise oder fehlende Binärdateien werden nicht als vollständig behandelt.",
    "",
    "Enthalten: manifest.json, STATUS.txt, zahlungen.csv, abrechnungen.json und die ausgewählten Belegdateien unter dokumente/.",
    "Das Paket ist eine lokale Exportkopie; der persistierte App-State wird dadurch nicht verändert."
  );
  return `${lines.join("\n")}\n`;
}

export async function createYearClosePackage(
  archiveExport: AnyRecord,
  documents: AnyRecord[]
): Promise<{ blob: Blob; filename: string; manifest: AnyRecord; coverage: YearCloseCoverage }> {
  const coverage = analyzeYearClosePackage(archiveExport, documents);
  const documentMap = new Map(arr(documents).map(document => [idText(document.id), document]));
  const used = new Set<string>();
  const preparedDocuments: PreparedEntry[] = [];

  for (const meta of arr(archiveExport?.archive?.documents)) {
    const documentId = idText(meta.id);
    const document = documentMap.get(documentId);
    if (!document) continue;
    const parts = binaryParts(document);
    if (!parts.length) continue;
    const folder = `dokumente/${safeSegment(meta.label || document.label || document.name || documentId, "beleg")}-${safeSegment(documentId, "id").slice(0, 18)}`;
    for (let index = 0; index < parts.length; index++) {
      const part = parts[index];
      const prefix = parts.length > 1 ? `${String(index + 1).padStart(2, "0")}-` : "";
      const path = uniquePath(`${folder}/${prefix}${part.name}`, used);
      preparedDocuments.push(await prepareEntry(path, part.blob, part.type, { documentId, pageId: part.pageId }));
    }
  }

  const statusEntry = await prepareEntry("STATUS.txt", encoder.encode(statusText(archiveExport, coverage)), "text/plain;charset=utf-8");
  const paymentsEntry = await prepareEntry("zahlungen.csv", encoder.encode(paymentsCsv(archiveExport)), "text/csv;charset=utf-8");
  const snapshotsEntry = await prepareEntry(
    "abrechnungen.json",
    encoder.encode(JSON.stringify({
      schema: "doppelhaus-year-close-billing-snapshots-v1",
      year: Number(archiveExport?.archive?.year || 0),
      context: archiveExport?.context || {},
      billingSnapshots: arr(archiveExport?.archive?.billingSnapshots)
    }, null, 2)),
    "application/json;charset=utf-8"
  );

  const indexedEntries = [statusEntry, paymentsEntry, snapshotsEntry, ...preparedDocuments];
  const manifest = {
    schema: YEAR_CLOSE_PACKAGE_SCHEMA,
    version: YEAR_CLOSE_PACKAGE_VERSION,
    generatedAt: String(archiveExport?.generatedAt || new Date().toISOString()),
    context: archiveExport?.context || {},
    year: Number(archiveExport?.archive?.year || 0),
    status: coverage.status,
    archive: archiveExport,
    package: {
      status: coverage.status,
      documentRecords: coverage.documentRecords,
      documentsWithBinary: coverage.documentsWithBinary,
      binaryFiles: coverage.binaryFiles,
      missingBinaryDocuments: coverage.missingBinaryDocuments,
      files: indexedEntries.map(entry => ({
        path: entry.path, mime: entry.mime, size: entry.size, crc32: hex32(entry.crc32),
        documentId: entry.documentId || "", pageId: entry.pageId || ""
      }))
    }
  };
  const manifestEntry = await prepareEntry("manifest.json", encoder.encode(JSON.stringify(manifest, null, 2)), "application/json;charset=utf-8");
  const blob = zipStore([manifestEntry, ...indexedEntries]);
  const label = safeSegment(archiveExport?.context?.buildingLabel || "gebaeude", "gebaeude");
  const suffix = coverage.status === "complete" ? "vollstaendig" : "pruefen";
  const filename = `jahresabschluss-${label}-${Number(archiveExport?.archive?.year || 0)}-${suffix}.zip`;
  return { blob, filename, manifest, coverage };
}
