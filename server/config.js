import 'dotenv/config';

const num = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const config = {
  port: num(process.env.PORT, 8787),
  // Server-side fallback key. Optional — BYO-key is the privacy-preserving path.
  serverApiKey: process.env.ANTHROPIC_API_KEY?.trim() || '',
  model: process.env.CLAUDE_MODEL?.trim() || 'claude-sonnet-5',
  demoMode: process.env.DEMO_MODE === '1' || process.env.DEMO_MODE === 'true',
  maxFileSizeBytes: num(process.env.MAX_FILE_SIZE_MB, 25) * 1024 * 1024,
  maxBatchFiles: num(process.env.MAX_BATCH_FILES, 50),
  isProduction: process.env.NODE_ENV === 'production',
  // Anthropic messages API.
  anthropicUrl: 'https://api.anthropic.com/v1/messages',
  anthropicVersion: '2023-06-01',
  // Longest edge (px) we downscale to before sending to the model. Keeps token
  // cost and latency sane; coordinates are normalized 0–1000 so display size is
  // recovered on the frontend regardless of the analysis resolution.
  analysisMaxEdge: 1568,
};

export const SUPPORTED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/tiff',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
]);

export const SUPPORTED_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.tif', '.tiff', '.webp', '.svg', '.pdf',
]);
