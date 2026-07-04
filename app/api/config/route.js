import { NextResponse } from 'next/server';
import { config } from '../../../lib/config.js';
import { BRAND } from '../../../lib/brand.js';
import { STRICTNESS_LEVELS, DEFAULT_STRICTNESS } from '../../../lib/prompt.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public runtime config for the frontend. Never leaks the actual key — only
// whether a server-side fallback exists.
export async function GET() {
  return NextResponse.json({
    brand: BRAND,
    demoMode: config.demoMode,
    hasServerKey: Boolean(config.serverApiKey),
    model: config.model,
    maxFileSizeBytes: config.maxFileSizeBytes,
    maxBatchFiles: config.maxBatchFiles,
    strictnessLevels: STRICTNESS_LEVELS,
    defaultStrictness: DEFAULT_STRICTNESS,
    categories: BRAND.categories,
  });
}
