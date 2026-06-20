import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateLedger } from '../scripts/lib/prep-transforms.mjs';

const ledger = JSON.parse(
  readFileSync(fileURLToPath(new URL('../src/data/ledger.json', import.meta.url)), 'utf8'),
);

test('committed ledger snapshot passes schema validation', () => {
  const { ok, errors } = validateLedger(ledger);
  assert.equal(ok, true, `schema errors: ${errors.join('; ')}`);
});

test('every claim has the fields the pages rely on', () => {
  for (const c of ledger.claims) {
    assert.equal(typeof c.id, 'string');
    assert.equal(typeof c.claim, 'string');
    assert.ok(typeof c.confidence === 'number' && c.confidence >= 0 && c.confidence <= 1, `bad confidence on ${c.id}`);
    assert.ok(['open', 'resolved'].includes(c.status), `bad status on ${c.id}`);
    assert.ok(['twin', 'bruno'].includes(c.committed_by), `bad committed_by on ${c.id}`);
    assert.equal(typeof c.resolve_by, 'string');
  }
});

test('resolved+valid claims carry a resolution outcome (so they can be scored)', () => {
  for (const c of ledger.claims) {
    const valid = c?.validity?.status !== 'invalid' && !c?.withdrawal;
    if (c.status === 'resolved' && valid) {
      assert.ok(c.resolution && typeof c.resolution.outcome === 'string', `resolved claim ${c.id} missing resolution.outcome`);
    }
  }
});

test('claim ids are unique (detail pages need unique routes)', () => {
  const ids = ledger.claims.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});
