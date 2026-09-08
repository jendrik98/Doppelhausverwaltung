/* ===== domain.js ===== */
const DOMAIN_VERSION=1;

const {
  normalizeMeterNumber,
  parseMeterReadingValue,
  meterNumericInterpretations,
  meterReadingCandidates,
  detectedMeterSerialCandidates,
  meterNumberComparable,
  editDistance,
  meterNumberSimilarity
}=AppMeterParsing;

const {
  positionDefaults,
  sourcePositions,
  positionById,
  migrateDomainState,
  ensureDefaultMeters,
  meterById,
  readingById,
  addMeterReading,
  matchMeterFromOCR,
  meterCandidateHistoryScore,
  rankMeterCandidates,
  analyzeMeterOCRText,
  latestMeterReading,
  meterReadingPlausibility,
  settlementByPeriod,
  settlementConsumption,
  positionToEvents,
  allocateCostPosition,
  centralBillingAnalysis,
  syncSimpleSourcePosition,
  replaceAssessmentPositions
}=AppPropertyDomain;

