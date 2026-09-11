/* ===== intelligence.js ===== */
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
