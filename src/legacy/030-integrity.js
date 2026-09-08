/* ===== integrity.js ===== */
const APP_VERSION="18.0.0";
const MAX_ERROR_LOG=100;
let LAST_STABLE_STATE=null;

const {
  cloneState,
  validateDomainState,
  repairDomainState,
  recordClientError,
  integritySummary,
  sha256Text,
  stableJSON,
  finalizeSnapshotIntegrity,
  blobSha256,
  documentFingerprint,
  reconciliationSummary
}=AppIntegrity;

