import { NextResponse } from 'next/server';
import path from 'node:path';
import { config, SUPPORTED_MIME, SUPPORTED_EXT } from '../../../lib/config.js';
import { rasterize, makeImageId } from '../../../lib/rasterize.js';
import { analyzePage } from '../../../lib/analyze.js';
import { normalizeStrictness } from '../../../lib/prompt.js';
import { AuthError, RateLimitError } from '../../../lib/claude.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Allow large multipart uploads (batches of images/PDFs).
export const maxDuration = 300;

function isSupported(name, mimetype) {
  const ext = path.extname(name || '').toLowerCase();
  return SUPPORTED_MIME.has(mimetype) || SUPPORTED_EXT.has(ext);
}

const clearSummary = { flag_count: 0, highest_severity: 'none', overall_recommendation: 'clear' };

// Analyze one or more files. Streams NDJSON: one JSON object per line.
//   { type: 'start', totalFiles }
//   { type: 'result', ...schemaResult }   (one per rasterized page)
//   { type: 'fatal', message }            (auth/rate-limit — request aborted)
//   { type: 'done', count }
export async function POST(req) {
  let form;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Malformed upload.' }, { status: 400 });
  }

  let files = form.getAll('files').filter((f) => typeof f === 'object' && 'arrayBuffer' in f);
  const strictness = normalizeStrictness(form.get('strictness'));
  const apiKey = (req.headers.get('x-api-key') || '').trim() || config.serverApiKey;

  if (files.length === 0) {
    return NextResponse.json({ error: 'No files uploaded.' }, { status: 400 });
  }
  if (!config.demoMode && !apiKey) {
    return NextResponse.json(
      {
        error:
          'No Claude API key provided. Add your key in the app (bring-your-own-key) or configure a server key.',
      },
      { status: 400 }
    );
  }
  // Enforce the hard batch cap.
  files = files.slice(0, config.maxBatchFiles);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      send({ type: 'start', totalFiles: files.length });

      let emitted = 0;
      try {
        // Sequential processing queues requests instead of firing all at once,
        // respecting rate limits. Per-image completion streams out.
        for (const file of files) {
          const filename = file.name || 'upload';

          if (!isSupported(filename, file.type)) {
            send({
              type: 'result',
              image_id: makeImageId(),
              filename,
              error: 'Unsupported file type. Supported: PNG, JPEG, TIFF, WEBP, SVG, PDF.',
              summary: clearSummary,
              flags: [],
            });
            emitted++;
            continue;
          }

          const buffer = Buffer.from(await file.arrayBuffer());
          if (buffer.length > config.maxFileSizeBytes) {
            send({
              type: 'result',
              image_id: makeImageId(),
              filename,
              error: `File exceeds the ${Math.round(
                config.maxFileSizeBytes / (1024 * 1024)
              )} MB limit.`,
              summary: clearSummary,
              flags: [],
            });
            emitted++;
            continue;
          }

          let pages;
          try {
            pages = await rasterize({ mimetype: file.type, originalname: filename, buffer });
          } catch (err) {
            send({
              type: 'result',
              image_id: makeImageId(),
              filename,
              error: `Could not process file: ${err.message}`,
              summary: clearSummary,
              flags: [],
            });
            emitted++;
            continue;
          }

          for (let p = 0; p < pages.length; p++) {
            const page = pages[p];
            const multi = pages.length > 1;
            const label = multi ? `${filename} (page ${p + 1})` : filename;
            const image_id = makeImageId();
            const result = await analyzePage({
              pageBuffer: page.buffer,
              meta: { image_id, filename: label, strictness_profile: strictness },
              apiKey,
            });
            // Include a data URL so the frontend renders the exact analyzed
            // raster, keeping overlay coordinates aligned.
            result.image_data_url = `data:image/png;base64,${page.buffer.toString('base64')}`;
            result.page = multi ? p + 1 : undefined;
            send({ type: 'result', ...result });
            emitted++;
          }
        }
        send({ type: 'done', count: emitted });
      } catch (err) {
        const message =
          err instanceof AuthError
            ? 'Authentication failed. Check your Claude API key.'
            : err instanceof RateLimitError
              ? 'Rate limited by the Claude API. Wait a moment and try a smaller batch.'
              : `Unexpected server error: ${err.message}`;
        send({ type: 'fatal', message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
