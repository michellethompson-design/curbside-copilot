// Parse, validate, and normalize the model's response into the exact contract
// defined in references/output-schema.md. Everything downstream (overlay,
// report) renders directly from this shape, so we are strict about producing
// well-formed output and forgiving about the model's occasional sloppiness.

import crypto from 'node:crypto';

const CATEGORIES = new Set(['phallic', 'vulvar', 'breast']);
const SEVERITIES = new Set(['low', 'medium', 'high']);
const SEVERITY_RANK = { none: 0, low: 1, medium: 2, high: 3 };

export class MalformedResponseError extends Error {}

// Pull a JSON object out of a model string that may carry stray prose or fences.
export function extractJson(text) {
  if (typeof text !== 'string') throw new MalformedResponseError('response was not text');
  let s = text.trim();
  // Strip markdown code fences (```json ... ``` or ``` ... ```).
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) s = fence[1].trim();
  // If there is leading/trailing prose, grab the outermost brace-delimited span.
  if (!s.startsWith('{')) {
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first === -1 || last === -1 || last <= first) {
      throw new MalformedResponseError('no JSON object found in response');
    }
    s = s.slice(first, last + 1);
  }
  try {
    return JSON.parse(s);
  } catch (err) {
    throw new MalformedResponseError(`could not parse JSON: ${err.message}`);
  }
}

const clampCoord = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(1000, Math.max(0, Math.round(n)));
};

const clampConfidence = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
};

function normalizeRegion(region) {
  const r = region && typeof region === 'object' ? region : {};
  let x_min = clampCoord(r.x_min) ?? 0;
  let y_min = clampCoord(r.y_min) ?? 0;
  let x_max = clampCoord(r.x_max) ?? 1000;
  let y_max = clampCoord(r.y_max) ?? 1000;
  // Repair inverted coordinates rather than dropping the flag.
  if (x_max < x_min) [x_min, x_max] = [x_max, x_min];
  if (y_max < y_min) [y_min, y_max] = [y_max, y_min];
  return { x_min, y_min, x_max, y_max, is_approximate: true };
}

function normalizeFlag(flag) {
  if (!flag || typeof flag !== 'object') return null;
  const category = String(flag.category || '').toLowerCase();
  if (!CATEGORIES.has(category)) return null; // unknown category → discard
  const severity = SEVERITIES.has(String(flag.severity || '').toLowerCase())
    ? String(flag.severity).toLowerCase()
    : 'low';
  return {
    id: typeof flag.id === 'string' && flag.id ? flag.id : `flag_${crypto.randomUUID()}`,
    category,
    severity,
    confidence: clampConfidence(flag.confidence),
    explanation:
      typeof flag.explanation === 'string' && flag.explanation.trim()
        ? flag.explanation.trim()
        : 'No explanation provided.',
    region: normalizeRegion(flag.region),
  };
}

// Take a parsed model object and produce a complete, valid result object.
// `meta` supplies image_id, filename, strictness_profile, analyzed_at.
export function normalizeResult(parsed, meta) {
  if (!parsed || typeof parsed !== 'object') {
    throw new MalformedResponseError('response was not an object');
  }
  const rawFlags = Array.isArray(parsed.flags) ? parsed.flags : [];
  const flags = rawFlags.map(normalizeFlag).filter(Boolean);

  // Derive the summary from the flags so it is always internally consistent,
  // regardless of what the model claimed in its own summary block.
  const highestRank = flags.reduce(
    (max, f) => Math.max(max, SEVERITY_RANK[f.severity] || 0),
    0
  );
  const highest_severity =
    Object.keys(SEVERITY_RANK).find((k) => SEVERITY_RANK[k] === highestRank) || 'none';

  let overall_recommendation = 'clear';
  if (highest_severity === 'high') overall_recommendation = 'hold';
  else if (flags.length > 0) overall_recommendation = 'review';

  return {
    image_id: meta.image_id,
    filename: meta.filename,
    analyzed_at: meta.analyzed_at,
    strictness_profile: meta.strictness_profile,
    summary: {
      flag_count: flags.length,
      highest_severity,
      overall_recommendation,
    },
    flags,
  };
}
