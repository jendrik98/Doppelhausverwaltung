type AnyRecord = Record<string, any>;

export const YEAR_ARCHIVE_VERSION = 1;
export const YEAR_ARCHIVE_SCHEMA = "doppelhaus-year-archive-v1";

const arr = (value: any): AnyRecord[] => Array.isArray(value) ? value : [];
const idText = (value: any): string => String(value || "");
const iso = (value: any): string => String(value || "").slice(0, 10);

function sourceForPosition(state: AnyRecord, position: AnyRecord): AnyRecord | null {
  const sourceId = idText(position?.sourceId);
  return arr(state?.sources).find(source => idText(source.id) === sourceId) || null;
}

export function documentIdForPosition(state: AnyRecord, position: AnyRecord): string {
  const source = sourceForPosition(state, position);
  return idText(position?.provenance?.documentId || position?.documentId || source?.sourceDocumentId);
}

export function positionTouchesYear(position: AnyRecord, year: number): boolean {
  const start = iso(position?.serviceStart || position?.serviceEnd);
  const end = iso(position?.serviceEnd || position?.serviceStart);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return false;
  const yearStart = `${year}-01-01`, yearEnd = `${year}-12-31`;
  return start <= yearEnd && end >= yearStart;
}

function documentMeta(document: AnyRecord | null): AnyRecord | null {
  if (!document) return null;
  return {
    id: idText(document.id),
    label: String(document.label || document.name || "Dokument"),
    type: String(document.type || ""),
    size: Number(document.size || 0),
    created: String(document.created || document.createdAt || ""),
    sourceId: idText(document.sourceId),
    fingerprint: String(document.fingerprint || ""),
    analysisStatus: String(document.analysis?.status || ""),
    acceptedAt: String(document.analysis?.acceptedAt || ""),
  };
}

function paymentMeta(payment: AnyRecord): AnyRecord {
  return {
    id: idText(payment.id),
    date: iso(payment.date),
    direction: String(payment.direction || ""),
    amount: Number(payment.amount || 0),
    label: String(payment.label || ""),
    sourceId: idText(payment.sourceId),
    positionId: idText(payment.positionId),
    leaseId: idText(payment.leaseId),
  };
}

function snapshotMeta(snapshot: AnyRecord, positionId = ""): AnyRecord {
  const matchingEvents = arr(snapshot?.events)
    .filter(event => !positionId || idText(event.positionId) === positionId)
    .map(event => ({
      id: idText(event.id),
      positionId: idText(event.positionId),
      label: String(event.label || ""),
      amount: Number(event.amount || 0),
      tenantAmount: Number(event.tenantAmount || 0),
    }));
  return {
    id: idText(snapshot.id),
    periodYear: Number(snapshot.periodYear),
    buildingId: idText(snapshot.buildingId),
    leaseId: idText(snapshot.leaseId),
    version: Number(snapshot.version || 1),
    createdAt: String(snapshot.createdAt || ""),
    integrityHash: String(snapshot.integrityHash || ""),
    supersedesSnapshotId: idText(snapshot.supersedesSnapshotId),
    events: matchingEvents,
  };
}

export function buildEvidenceChains(state: AnyRecord, documents: AnyRecord[], year: number): AnyRecord[] {
  const documentMap = new Map(arr(documents).map(document => [idText(document.id), document]));
  const payments = arr(state?.payments);
  const snapshots = arr(state?.billingSnapshots).filter(snapshot => Number(snapshot.periodYear) === Number(year));
  const positions = arr(state?.costPositions)
    .filter(position => position?.confirmed && positionTouchesYear(position, year));

  return positions.map(position => {
    const positionId = idText(position.id);
    const documentId = documentIdForPosition(state, position);
    const document = documentId ? documentMap.get(documentId) || null : null;
    const directPayments = payments.filter(payment => idText(payment.positionId) === positionId);
    const candidatePayments = directPayments.length || !position?.sourceId
      ? []
      : payments.filter(payment => !payment.positionId && idText(payment.sourceId) === idText(position.sourceId));
    const billingSnapshots = snapshots.filter(snapshot =>
      arr(snapshot.events).some(event => idText(event.positionId) === positionId)
    );
    const missing: string[] = [];
    if (!document) missing.push("document");
    if (!directPayments.length) missing.push("payment");
    if (!billingSnapshots.length) missing.push("billing");
    return {
      position: {
        id: positionId,
        label: String(position.label || "Kostenposition"),
        category: String(position.category || ""),
        amount: Number(position.amount || 0),
        serviceStart: iso(position.serviceStart),
        serviceEnd: iso(position.serviceEnd),
        sourceId: idText(position.sourceId),
        documentId,
      },
      document: documentMeta(document),
      payments: directPayments.map(paymentMeta),
      candidatePayments: candidatePayments.map(paymentMeta),
      billingSnapshots: billingSnapshots.map(snapshot => snapshotMeta(snapshot, positionId)),
      missing,
      status: missing.length ? "gap" : "complete",
    };
  });
}

export function buildYearArchive(state: AnyRecord, documents: AnyRecord[], year: number): AnyRecord {
  const chains = buildEvidenceChains(state, documents, year);
  const linkedDocumentIds = new Set(chains.map(chain => idText(chain.document?.id)).filter(Boolean));
  const linkedPaymentIds = new Set(chains.flatMap(chain => chain.payments.map((payment: AnyRecord) => idText(payment.id))).filter(Boolean));
  const yearDocuments = arr(documents).filter(document => iso(document.created || document.createdAt).startsWith(`${year}-`));
  const includedDocuments = arr(documents).filter(document => linkedDocumentIds.has(idText(document.id)) || yearDocuments.includes(document));
  const yearPayments = arr(state?.payments).filter(payment => iso(payment.date).startsWith(`${year}-`));
  const includedPayments = arr(state?.payments).filter(payment => linkedPaymentIds.has(idText(payment.id)) || yearPayments.includes(payment));
  const snapshots = arr(state?.billingSnapshots).filter(snapshot => Number(snapshot.periodYear) === Number(year));
  const unlinkedOutflows = yearPayments
    .filter(payment => payment.direction === "outflow" && !linkedPaymentIds.has(idText(payment.id)))
    .map(paymentMeta);
  const unlinkedDocuments = yearDocuments
    .filter(document => !linkedDocumentIds.has(idText(document.id)))
    .map(documentMeta);
  const completeChains = chains.filter(chain => chain.status === "complete").length;

  return {
    archiveVersion: YEAR_ARCHIVE_VERSION,
    year: Number(year),
    status: chains.length > 0 && completeChains === chains.length && snapshots.length > 0 ? "ready" : "review",
    summary: {
      chains: chains.length,
      completeChains,
      gaps: chains.length - completeChains,
      documents: includedDocuments.length,
      payments: includedPayments.length,
      snapshots: snapshots.length,
      unlinkedOutflows: unlinkedOutflows.length,
      unlinkedDocuments: unlinkedDocuments.length,
    },
    chains,
    documents: includedDocuments.map(documentMeta),
    payments: includedPayments.map(paymentMeta),
    billingSnapshots: snapshots.map(snapshot => snapshotMeta(snapshot)),
    unlinkedOutflows,
    unlinkedDocuments,
  };
}

export function createYearArchiveExport(state: AnyRecord, documents: AnyRecord[], year: number, generatedAt = new Date().toISOString()): AnyRecord {
  return {
    schema: YEAR_ARCHIVE_SCHEMA,
    version: YEAR_ARCHIVE_VERSION,
    generatedAt,
    archive: buildYearArchive(state, documents, year),
  };
}
