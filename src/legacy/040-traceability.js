/* ===== traceability.js ===== */
const TRACE_VERSION=1;
const COMMAND_VERSION=1;

const {
  ensureTraceShape,
  provenanceLabel,
  createRestorePoint,
  restoreFromPoint,
  commandResult,
  executeCommand,
  safeCommandSummary,
  documentWorkflowState,
  documentWorkflowLabel,
  documentsByWorkflow,
  traceForPosition,
  billingClosureChecklist,
  snapshotVerification
}=AppTraceability;

