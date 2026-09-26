export const MOBILE_QUALITY_CONTRACT = {
  schema: "ARKEM-MOBILE-QUALITY/1.0",
  release: "V100",
  auditedWidths: [320, 360, 390, 430, 768] as const,
  minimumTouchTarget: 44,
  minimumFormFontSize: 16,
  safeguards: [
    "No fixed-width content outside bounded data tables",
    "Single-column customer and zoning workflows below 760px",
    "Safe-area aware navigation and floating actions",
    "Reduced-motion support",
    "Keyboard-visible focus treatment",
    "Media and SVG elements constrained to their parent",
  ] as const,
  integrationChain: [
    "Customer identity",
    "Parcel and authority routing",
    "Evidence-backed zoning values",
    "Architectural and structural handoff",
    "Corporate PDF, DXF and JSON delivery",
  ] as const,
} as const;
