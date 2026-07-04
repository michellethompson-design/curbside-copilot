// Severity presentation helpers. Never rely on color alone (accessibility):
// every severity also carries a text label and a distinct glyph.
export const SEVERITY = {
  high: { label: 'High', glyph: '▲', className: 'sev-high' },
  medium: { label: 'Medium', glyph: '●', className: 'sev-medium' },
  low: { label: 'Low', glyph: '○', className: 'sev-low' },
};

export const RECOMMENDATION = {
  hold: { label: 'Hold — do not ship as is', className: 'rec-hold' },
  review: { label: 'Review — your call', className: 'rec-review' },
  clear: { label: 'Clear — nothing flagged', className: 'rec-clear' },
};

export function sevOf(s) {
  return SEVERITY[s] || SEVERITY.low;
}

const RANK = { high: 3, medium: 2, low: 1 };
export function bySeverityDesc(a, b) {
  return (RANK[b.severity] || 0) - (RANK[a.severity] || 0) || b.confidence - a.confidence;
}
