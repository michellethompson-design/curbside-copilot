import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, SUPPORTED_MIME, SUPPORTED_EXT } from './config.js';
import { BRAND } from '../shared/brand.js';
import { rasterize, makeImageId } from './rasterize.js';
import { analyzePage } from './analyze.js';
import { normalizeStrictness, STRICTNESS_LEVELS, DEFAULT_STRICTNESS } from './prompt.js';
import { AuthError, RateLimitError } from './claude.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxFileSizeBytes, files: config.maxBatchFiles },
});

function isSupported(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  return SUPPORTED_MIME.has(file.mimetype) || SUPPORTED_EXT.has(ext);
}

// Public runtime config for the frontend. Never leaks the actual key — only
// whether a server-side fallback exists.
app.get('/api/config', (_req, res) => {
  res.json({
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
});

// Analyze one or more files. Streams NDJSON: one JSON object per line.
//   { type: 'start', totalFiles }
//   { type: 'result', ...schemaResult }   (one per rasterized page)
//   { type: 'fatal', message }            (auth/rate-limit — request aborted)
//   { type: 'done', count }
app.post('/api/analyze', upload.array('files'), async (req, res) => {
  const files = req.files || [];
  const strictness = normalizeStrictness(req.body?.strictness);
  const model = req.body?.model?.trim() || undefined;
  // BYO-key: header wins; server key is the optional fallback.
  const apiKey = (req.get('x-api-key') || '').trim() || config.serverApiKey;

  if (files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded.' });
  }
  if (!config.demoMode && !apiKey) {
    return res.status(400).json({
      error:
        'No Claude API key provided. Add your key in the app (bring-your-own-key) or configure a server key.',
    });
  }

  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const send = (obj) => res.write(JSON.stringify(obj) + '\n');

  send({ type: 'start', totalFiles: files.length });

  let emitted = 0;
  try {
    // Sequential processing queues requests instead of firing all at once,
    // respecting rate limits (PRD 11/12). Per-image completion streams out.
    for (const file of files) {
      if (!isSupported(file)) {
        send({
          type: 'result',
          image_id: makeImageId(),
          filename: file.originalname,
          error: `Unsupported file type. Supported: PNG, JPEG, TIFF, WEBP, SVG, PDF.`,
          summary: { flag_count: 0, highest_severity: 'none', overall_recommendation: 'clear' },
          flags: [],
        });
        emitted++;
        continue;
      }

      let pages;
      try {
        pages = await rasterize(file);
      } catch (err) {
        send({
          type: 'result',
          image_id: makeImageId(),
          filename: file.originalname,
          error: `Could not process file: ${err.message}`,
          summary: { flag_count: 0, highest_severity: 'none', overall_recommendation: 'clear' },
          flags: [],
        });
        emitted++;
        continue;
      }

      for (let p = 0; p < pages.length; p++) {
        const page = pages[p];
        const multi = pages.length > 1;
        const filename = multi ? `${file.originalname} (page ${p + 1})` : file.originalname;
        const image_id = makeImageId();
        const result = await analyzePage({
          pageBuffer: page.buffer,
          meta: { image_id, filename, strictness_profile: strictness },
          apiKey,
          model,
        });
        // Include a data URL so the frontend can render the exact raster that
        // was analyzed, keeping overlay coordinates aligned.
        result.image_data_url = `data:image/png;base64,${page.buffer.toString('base64')}`;
        result.page = multi ? p + 1 : undefined;
        send({ type: 'result', ...result });
        emitted++;
      }
    }
    send({ type: 'done', count: emitted });
  } catch (err) {
    // Auth / rate-limit are fatal for the whole request.
    const message =
      err instanceof AuthError
        ? 'Authentication failed. Check your Claude API key.'
        : err instanceof RateLimitError
          ? 'Rate limited by the Claude API. Wait a moment and try a smaller batch.'
          : `Unexpected server error: ${err.message}`;
    send({ type: 'fatal', message });
  } finally {
    res.end();
  }
});

// Serve the built frontend in production.
const webDist = path.resolve(__dirname, '..', 'web', 'dist');
app.use(express.static(webDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(webDist, 'index.html'), (err) => {
    if (err) res.status(404).send('Frontend not built. Run `npm run build`.');
  });
});

app.listen(config.port, () => {
  const mode = config.demoMode ? ' [DEMO MODE — no API calls]' : '';
  console.log(`${BRAND.name} server listening on http://localhost:${config.port}${mode}`);
});
