/**
 * ClinicNest — Motor Universal de PDFs Premium
 *
 * barrel export
 */
export { BasePremiumPDFLayout, type ClinicInfo, type PremiumPDFOptions } from "./base-premium-layout";
export {
  renderPatientInfoBox,
  renderPremiumTable,
  renderSignatureBlock,
  renderDigitalSeal,
  renderSoapSection,
  renderSummaryCards,
  renderVitalsGrid,
  type PatientInfo,
  type PremiumTableOptions,
  type SignatureBlockOptions,
  type DigitalSealOptions,
  type SummaryCard,
} from "./pdf-components";
export {
  PAGE,
  PAGE_LANDSCAPE,
  FONT,
  COLORS,
  hexToRgb,
  applyOpacity,
  drawLine,
  ensureSpace,
  loadImageAsBase64,
  renderField,
  type RGB,
} from "./pdf-design-system";
