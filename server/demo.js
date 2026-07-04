// DEMO mode: return a deterministic canned analysis so the whole UI (overlay,
// report, batch streaming, all-clear state) can be exercised without a Claude
// key or any API spend. Deterministic per filename so results are stable.

import crypto from 'node:crypto';

function hashInt(str) {
  const h = crypto.createHash('sha256').update(str).digest();
  return h.readUInt32BE(0);
}

// Roughly a third of demo images come back all-clear, so the all-clear state
// is exercised too.
export function demoResult(parsedIgnored, meta) {
  const seed = hashInt(meta.filename + meta.image_id);
  const bucket = seed % 3;

  const flagsByBucket = {
    0: [], // all-clear
    1: [
      {
        category: 'phallic',
        severity: 'high',
        confidence: 0.86,
        explanation:
          'The elongated central element with the two rounded forms at its base reads as a penis-and-testicles silhouette, most visible when the mark is scaled down. Sits in the lower-center of the composition.',
        region: { x_min: 380, y_min: 420, x_max: 640, y_max: 900, is_approximate: true },
      },
    ],
    2: [
      {
        category: 'breast',
        severity: 'medium',
        confidence: 0.62,
        explanation:
          'The paired rounded hills across the top, each with a small central mark, can read as breasts once a viewer’s attention lands there. Upper band of the image.',
        region: { x_min: 150, y_min: 80, x_max: 850, y_max: 380, is_approximate: true },
      },
      {
        category: 'vulvar',
        severity: 'low',
        confidence: 0.34,
        explanation:
          'The vertical almond of negative space between the two facing curves has a faint central division that could read as vulvar when mirrored. Low confidence — reads as neutral motion upright.',
        region: { x_min: 440, y_min: 300, x_max: 560, y_max: 720, is_approximate: true },
      },
    ],
  };

  return { flags: flagsByBucket[bucket] };
}
