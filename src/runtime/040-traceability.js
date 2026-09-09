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

const APPLICATION_COMMAND_BUS=AppApplication.createCommandBus({
  getState:()=>state,
  setState:value=>{state=value},
  getLastStableState:()=>LAST_STABLE_STATE,
  setLastStableState:value=>{LAST_STABLE_STATE=value},
  cloneState,
  repairState:repairDomainState,
  validateState:validateDomainState,
  persist:(action,detail)=>persist(action,detail),
  recordError:(context,error)=>recordClientError(context,error),
  createRestorePoint,
  uid:()=>uid()
});
const applicationExecuteCommand=(type,payload,handler,options={})=>{
  const scopedPayload=payload&&typeof payload==="object"&&!Array.isArray(payload)
    ? {...payload,buildingId:activeBuildingId||payload.buildingId||""}
    : payload;
  return APPLICATION_COMMAND_BUS.executeCommand(type,scopedPayload,handler,options)
};

