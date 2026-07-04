// Turn any supported upload into one or more flat PNG rasters ready for the
// vision model. Raster formats and SVG go through sharp; PDF goes through
// poppler's pdftoppm (one raster per page — PRD 13: each page is analyzed
// separately). Everything is downscaled to a sane analysis resolution; because
// coordinates are normalized 0–1000, display size is recovered on the frontend.

import sharp from 'sharp';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';

const execFileAsync = promisify(execFile);

async function toAnalysisPng(inputBuffer, { density } = {}) {
  // density matters for SVG so it rasterizes crisply before downscaling.
  const img = sharp(inputBuffer, density ? { density } : undefined).flatten({
    background: '#ffffff',
  });
  const meta = await img.metadata();
  const longest = Math.max(meta.width || 0, meta.height || 0);
  let pipeline = img;
  if (longest > config.analysisMaxEdge) {
    pipeline = pipeline.resize({
      width: meta.width >= meta.height ? config.analysisMaxEdge : undefined,
      height: meta.height > meta.width ? config.analysisMaxEdge : undefined,
      fit: 'inside',
    });
  }
  const buffer = await pipeline.png().toBuffer();
  const outMeta = await sharp(buffer).metadata();
  return { buffer, width: outMeta.width, height: outMeta.height };
}

async function rasterizePdf(inputBuffer) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fresh-eyes-pdf-'));
  const inPath = path.join(dir, 'in.pdf');
  const outPrefix = path.join(dir, 'page');
  try {
    await fs.writeFile(inPath, inputBuffer);
    // 150 DPI is enough resolution for shape QA without exploding token cost.
    await execFileAsync('pdftoppm', ['-png', '-r', '150', inPath, outPrefix], {
      maxBuffer: 1024 * 1024 * 256,
    });
    const files = (await fs.readdir(dir))
      .filter((f) => f.startsWith('page') && f.endsWith('.png'))
      .sort();
    if (files.length === 0) throw new Error('pdftoppm produced no pages');
    const pages = [];
    for (const f of files) {
      const buf = await fs.readFile(path.join(dir, f));
      pages.push(await toAnalysisPng(buf));
    }
    return pages;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// Returns an array of { buffer, width, height } PNG pages. Single-page inputs
// return a one-element array so the caller can treat everything uniformly.
export async function rasterize(file) {
  const { mimetype, originalname, buffer } = file;
  const ext = path.extname(originalname || '').toLowerCase();

  if (mimetype === 'application/pdf' || ext === '.pdf') {
    return rasterizePdf(buffer);
  }
  if (mimetype === 'image/svg+xml' || ext === '.svg') {
    // Flatten layered/animated SVG to a static raster at a crisp density.
    return [await toAnalysisPng(buffer, { density: 200 })];
  }
  // Raster formats: PNG, JPEG, TIFF, WEBP.
  return [await toAnalysisPng(buffer)];
}

export function makeImageId() {
  return `img_${crypto.randomUUID()}`;
}
