import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJson, normalizeResult, MalformedResponseError } from './schema.js';

const meta = {
  image_id: 'img_1',
  filename: 'logo.png',
  analyzed_at: '2026-01-01T00:00:00.000Z',
  strictness_profile: 'medium',
};

test('extractJson strips markdown fences', () => {
  const obj = extractJson('```json\n{"flags":[]}\n```');
  assert.deepEqual(obj, { flags: [] });
});

test('extractJson pulls object out of surrounding prose', () => {
  const obj = extractJson('Here you go: {"flags": []} hope that helps');
  assert.deepEqual(obj, { flags: [] });
});

test('extractJson throws on non-JSON', () => {
  assert.throws(() => extractJson('no json here'), MalformedResponseError);
});

test('normalizeResult produces all-clear for empty flags', () => {
  const r = normalizeResult({ flags: [] }, meta);
  assert.equal(r.summary.flag_count, 0);
  assert.equal(r.summary.highest_severity, 'none');
  assert.equal(r.summary.overall_recommendation, 'clear');
  assert.deepEqual(r.flags, []);
});

test('normalizeResult derives summary and recommendation from flags', () => {
  const r = normalizeResult(
    {
      flags: [
        { category: 'breast', severity: 'medium', confidence: 0.5, explanation: 'x', region: {} },
        { category: 'phallic', severity: 'high', confidence: 2, explanation: 'y', region: {} },
      ],
    },
    meta
  );
  assert.equal(r.summary.flag_count, 2);
  assert.equal(r.summary.highest_severity, 'high');
  assert.equal(r.summary.overall_recommendation, 'hold');
  assert.equal(r.flags[1].confidence, 1); // clamped
  assert.ok(r.flags[0].id.startsWith('flag_'));
});

test('normalizeResult repairs inverted coords and clamps to 0-1000', () => {
  const r = normalizeResult(
    {
      flags: [
        {
          category: 'vulvar',
          severity: 'low',
          confidence: 0.3,
          explanation: 'z',
          region: { x_min: 900, y_min: 50, x_max: 100, y_max: 1200 },
        },
      ],
    },
    meta
  );
  const reg = r.flags[0].region;
  assert.equal(reg.x_min, 100);
  assert.equal(reg.x_max, 900);
  assert.equal(reg.y_max, 1000); // clamped from 1200
  assert.equal(reg.is_approximate, true);
});

test('normalizeResult discards unknown categories', () => {
  const r = normalizeResult(
    { flags: [{ category: 'elbow', severity: 'high', confidence: 1, explanation: 'q', region: {} }] },
    meta
  );
  assert.equal(r.flags.length, 0);
  assert.equal(r.summary.highest_severity, 'none');
});
