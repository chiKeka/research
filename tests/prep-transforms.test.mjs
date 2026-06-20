import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFm,
  titleCase,
  deriveSummary,
  buildFrameworks,
  collectPublished,
  sanitizeUrl,
  validateLedger,
  ageInDays,
  isStale,
} from '../scripts/lib/prep-transforms.mjs';

test('parseFm extracts front-matter and body', () => {
  const { fm, body } = parseFm('---\ntitle: "Hi"\ndate: 2026-01-01\n---\n\nHello world');
  assert.equal(fm.title, 'Hi');
  assert.equal(fm.date, '2026-01-01');
  assert.equal(body, 'Hello world');
});

test('parseFm returns raw body when no front-matter', () => {
  const { fm, body } = parseFm('No front matter here');
  assert.deepEqual(fm, {});
  assert.equal(body, 'No front matter here');
});

test('titleCase humanizes slugs', () => {
  assert.equal(titleCase('the-twin-keeps-score'), 'The Twin Keeps Score');
});

test('deriveSummary prefers topic, else first body line', () => {
  assert.equal(deriveSummary({ topic: 'A topic' }, 'Body line', 'Title'), 'A topic');
  assert.equal(deriveSummary({}, '# Heading\nFirst real line', 'Title'), 'Heading');
});

test('buildFrameworks keeps active only, projects public fields, sorts', () => {
  const out = buildFrameworks([
    { name: 'Zeta', domain: 'ai', description: 'z', status: 'active' },
    { name: 'Alpha', domain: 'ai', description: 'a', status: 'active' },
    { name: 'Dead', domain: 'ai', description: 'd', status: 'retired' },
  ]);
  assert.deepEqual(out.map((f) => f.name), ['Alpha', 'Zeta']);
  assert.deepEqual(Object.keys(out[0]), ['name', 'domain', 'description']);
});

test('collectPublished maps publish actions and sanitizes urls', () => {
  const m = collectPublished([
    { action: 'publish', timestamp: '2026-06-11T10:00:00Z', details: { draft_file: 'd.md', post_url: 'https://x.com/a/1', platform: 'x' } },
    { action: 'draft', details: { draft_file: 'skip.md', post_url: 'https://x.com/n' } },
    { action: 'publish', timestamp: '2026-06-12T10:00:00Z', details: { draft_file: 'li.md', post_url: 'https://linkedin.com/in/x (feed post)', platform: 'linkedin' } },
  ]);
  assert.equal(m.size, 2);
  assert.equal(m.get('d.md').url, 'https://x.com/a/1');
  assert.equal(m.get('d.md').date, '2026-06-11');
  assert.equal(m.get('li.md').url, 'https://linkedin.com/in/x'); // parenthetical stripped
});

test('sanitizeUrl strips trailing note and rejects non-http', () => {
  assert.equal(sanitizeUrl('https://a.com/p (note here)'), 'https://a.com/p');
  assert.equal(sanitizeUrl('https://a.com/p'), 'https://a.com/p');
  assert.equal(sanitizeUrl('not a url'), null);
  assert.equal(sanitizeUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeUrl(''), null);
  assert.equal(sanitizeUrl(undefined), null);
});

test('validateLedger accepts a good payload', () => {
  const r = validateLedger({
    updated: '2026-06-20',
    claims: [{ id: 'a', claim: 'x', confidence: 0.5, status: 'open' }],
    experiments: [],
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, []);
});

test('validateLedger rejects bad payloads', () => {
  assert.equal(validateLedger(null).ok, false);
  assert.equal(validateLedger({ claims: [] }).ok, false); // empty + no updated
  const bad = validateLedger({ updated: '2026', claims: [{ id: 1, claim: 'x', confidence: 2, status: 'nope' }] });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => e.includes('confidence')));
  assert.ok(bad.errors.some((e) => e.includes('status')));
});

test('validateLedger rejects duplicate claim ids', () => {
  const r = validateLedger({
    updated: '2026-06-20',
    claims: [
      { id: 'x', claim: 'a', confidence: 0.5, status: 'open' },
      { id: 'x', claim: 'b', confidence: 0.5, status: 'open' },
    ],
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('duplicate')));
});

test('ageInDays and isStale', () => {
  const now = new Date('2026-06-20T00:00:00Z');
  assert.equal(Math.round(ageInDays('2026-06-10T00:00:00Z', now)), 10);
  assert.equal(ageInDays('not-a-date', now), Infinity);
  assert.equal(isStale({ updated: '2026-06-18' }, 14, now), false);
  assert.equal(isStale({ updated: '2026-05-01' }, 14, now), true);
  assert.equal(isStale({ source: { committed_at: '2026-06-19T00:00:00Z' } }, 14, now), false);
  assert.equal(isStale({}, 14, now), true); // no provenance → treat as stale
  // A garbage committed_at must not override a fresh `updated` date:
  assert.equal(isStale({ updated: '2026-06-18', source: { committed_at: 'not-a-date' } }, 14, now), false);
});
