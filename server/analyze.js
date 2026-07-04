// Orchestrates analysis of a single rasterized page: call the model, parse and
// validate, retry once on a malformed response, then normalize to the schema.
// A malformed response after one retry becomes an errored result — it must not
// crash the batch (PRD 12 / 13).

import { config } from './config.js';
import { callVision, AuthError, RateLimitError } from './claude.js';
import { buildSystemPrompt, USER_TEXT } from './prompt.js';
import { extractJson, normalizeResult, MalformedResponseError } from './schema.js';
import { demoResult } from './demo.js';

function nowIso(clock) {
  // Accept an injected clock for deterministic tests; default to real time.
  return (clock ? clock() : new Date()).toISOString();
}

// meta: { image_id, filename, strictness_profile }
// Returns a fully-normalized result object, or throws AuthError/RateLimitError
// (which are fatal for the whole request, not per-image).
export async function analyzePage({ pageBuffer, meta, apiKey, model, clock }) {
  const analyzed_at = nowIso(clock);
  const fullMeta = { ...meta, analyzed_at };

  if (config.demoMode) {
    // Simulate a touch of latency-free determinism; no network call.
    return normalizeResult(demoResult(null, fullMeta), fullMeta);
  }

  const systemPrompt = buildSystemPrompt(meta.strictness_profile);
  const imageBase64 = pageBuffer.toString('base64');

  const attempt = async () => {
    const text = await callVision({
      apiKey,
      model,
      systemPrompt,
      userText: USER_TEXT,
      imageBase64,
      mediaType: 'image/png',
    });
    return normalizeResult(extractJson(text), fullMeta);
  };

  try {
    return await attempt();
  } catch (err) {
    // Auth and rate-limit errors are fatal for the request — bubble up.
    if (err instanceof AuthError || err instanceof RateLimitError) throw err;
    // Malformed JSON (or a transient API hiccup): retry exactly once.
    try {
      return await attempt();
    } catch (retryErr) {
      if (retryErr instanceof AuthError || retryErr instanceof RateLimitError) throw retryErr;
      // Give up on this page only. Report an errored result; batch continues.
      return {
        image_id: fullMeta.image_id,
        filename: fullMeta.filename,
        analyzed_at,
        strictness_profile: fullMeta.strictness_profile,
        error:
          retryErr instanceof MalformedResponseError
            ? 'The model returned a response that could not be parsed, twice. This image was skipped.'
            : `Analysis failed: ${retryErr.message}`,
        summary: { flag_count: 0, highest_severity: 'none', overall_recommendation: 'clear' },
        flags: [],
      };
    }
  }
}
