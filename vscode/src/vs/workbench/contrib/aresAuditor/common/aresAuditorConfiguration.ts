// Minimal placeholders for ARES Auditor configuration surface
export const ARESAuditorDefaultConfig = {
  enabled: true,
  onSave: true,
  tools: {
    semgrep: true,
    trident: true,
    fuzzyAI: true,
    whistleblower: true,
    mcpInjection: true
  }
} as const;
