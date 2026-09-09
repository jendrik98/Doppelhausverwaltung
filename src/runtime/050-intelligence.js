/* ===== intelligence.js ===== */
/* Phase 8 runtime bridge: Implementierung in src/domain/intelligence.ts */
const {
  INTELLIGENCE_VERSION,
  normalizeLabelText,
  tokenSimilarity,
  daysDistance,
  dueDatesForPosition,
  paymentMatchScore,
  paymentMatchSuggestions,
  positionMonthlyEquivalent,
  predictedMonth,
  intelligentForecast,
  forecastSignals,
  extractDocumentIntelligence,
  validateDocumentTotals,
  documentConfidenceSummary,
  billingRecipient,
  splitAddressLines,
  formatRuleForReport,
  formatBillingRuleDetails,
  generateProfessionalBillingPDF
}=AppIntelligence;
