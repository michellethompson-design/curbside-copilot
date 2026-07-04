// Thin wrapper over the Anthropic messages endpoint for single-image vision
// analysis. The API key is used per-request and never persisted (BYO-key
// privacy model). Distinguishes auth errors (surface to user) from transient
// errors (retryable).

import { config } from './config.js';

export class AuthError extends Error {}
export class RateLimitError extends Error {}

// Calls the model once and returns the raw text of the first text block.
export async function callVision({ apiKey, model, systemPrompt, userText, imageBase64, mediaType }) {
  const res = await fetch(config.anthropicUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': config.anthropicVersion,
    },
    body: JSON.stringify({
      model: model || config.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 },
            },
            { type: 'text', text: userText },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.error?.message || JSON.stringify(body);
    } catch {
      detail = await res.text().catch(() => res.statusText);
    }
    if (res.status === 401 || res.status === 403) {
      throw new AuthError(`Authentication failed (${res.status}): ${detail}`);
    }
    if (res.status === 429) {
      throw new RateLimitError(`Rate limited (429): ${detail}`);
    }
    const err = new Error(`Claude API error (${res.status}): ${detail}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const textBlock = Array.isArray(data.content)
    ? data.content.find((b) => b.type === 'text')
    : null;
  if (!textBlock?.text) throw new Error('Claude response contained no text block');
  return textBlock.text;
}
