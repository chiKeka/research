import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { contentDigest, fetchPublicLedger, validatePublicSnapshot } from '../scripts/lib/public-ledger.mjs';
const payload = JSON.parse(fs.readFileSync(new URL('../src/data/ledger.json', import.meta.url)));
const sha = 'a'.repeat(40);
const response = (data) => ({ ok: true, json: async () => structuredClone(data) });
async function pinned() {
  const urls = [];
  const ledger = await fetchPublicLedger({ fetchImpl: async (url) => {
    urls.push(url);
    return response(url.includes('/commits?') ? [{ sha, commit: { committer: { date: '2026-10-03T12:00:00Z' } } }] : payload);
  }, now: () => '2026-10-04T12:00:00Z' });
  return { ledger, urls };
}
test('fetch pins the exact public commit and hashes the complete payload', async () => {
  const { ledger, urls } = await pinned();
  assert.equal(urls[1], `https://raw.githubusercontent.com/chiKeka/ledger/${sha}/ledger.json`);
  assert.equal(ledger.source.commit, sha);
  assert.equal(ledger.source.content_sha256, contentDigest(payload));
  validatePublicSnapshot(ledger);
});
test('fallback rejects missing provenance and changed evidence even with unchanged scoring fields', async () => {
  const { ledger } = await pinned();
  assert.throws(() => validatePublicSnapshot(payload));
  ledger.claims[0].evidence = [{ note: 'different evidence' }];
  assert.throws(() => validatePublicSnapshot(ledger), /provenance/);
});
test('fallback rejects unrelated repository attribution', async () => {
  const { ledger } = await pinned();
  ledger.source.repo = 'another/repo';
  assert.throws(() => validatePublicSnapshot(ledger));
});
test('invalid public metadata and unavailable pinned content fail closed', async () => {
  await assert.rejects(fetchPublicLedger({ fetchImpl: async () => response([{ sha: 'main' }]) }));
  await assert.rejects(fetchPublicLedger({ fetchImpl: async (url) => url.includes('/commits?')
    ? response([{ sha, commit: { committer: { date: '2026-10-03T12:00:00Z' } } }]) : { ok: false, status: 404 } }));
});
