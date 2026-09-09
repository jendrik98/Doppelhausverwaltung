/* ===== quality.js ===== */
/* Phase 8 runtime bridge: Implementierung in src/domain/quality.ts */
const {
  QUALITY_VERSION,
  parseGermanNumber,
  parseFlexibleDate,
  csvDetectDelimiter,
  csvRows,
  bankHeaderIndex,
  parseBankCSV,
  paymentFingerprint,
  detectRentPayment,
  bankImportPreview,
  categoryLabel,
  periodCategoryTotals,
  annualComparison,
  costTrendAlerts,
  meterTrend,
  meterAnomalies,
  dataQualityScore
}=AppQuality;
