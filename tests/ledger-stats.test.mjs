import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classify,
  counts,
  outcomeBinary,
  scoredClaims,
  brierContribution,
  brierScore,
  confidenceBuckets,
  groupCount,
  horizonByMonth,
  attribution,
} from '../src/lib/ledger-stats.mjs';

const fixtures = [
  { id: 'a', status: 'open', confidence: 0.6, committed_by: 'twin', frame: 'in', resolve_by: '2026-09-30' },
  { id: 'b', status: 'resolved', confidence: 0.8, committed_by: 'twin', resolution: { outcome: 'confirmed' } },
  { id: 'c', status: 'resolved', confidence: 0.3, committed_by: 'bruno', resolution: { outcome: 'refuted' } },
  // resolved but invalid → excluded from live + scoring:
  { id: 'd', status: 'resolved', confidence: 0.9, committed_by: 'twin', validity: { status: 'invalid' }, resolution: { outcome: 'confirmed' } },
  // withdrawn → excluded:
  { id: 'e', status: 'open', confidence: 0.5, committed_by: 'twin', withdrawal: { reason: 'x' } },
  // open with unknown outcome shape:
  { id: 'f', status: 'open', confidence: 0.95, committed_by: 'twin', frame: 'out', resolve_by: '2026-12-01' },
];

test('classify separates live/open/resolved/invalid/withdrawn', () => {
  const c = classify(fixtures);
  assert.deepEqual(c.open.map((x) => x.id), ['a', 'f']);
  assert.deepEqual(c.resolved.map((x) => x.id), ['b', 'c']);
  assert.deepEqual(c.invalid.map((x) => x.id), ['d']);
  assert.deepEqual(c.withdrawn.map((x) => x.id), ['e']);
});

test('counts excludes invalid+withdrawn from open/resolved', () => {
  assert.deepEqual(counts(fixtures), { open: 2, resolved: 2, invalid: 1, withdrawn: 1 });
});

test('outcomeBinary maps confirmed→1, refuted→0, unknown→null', () => {
  assert.equal(outcomeBinary({ resolution: { outcome: 'confirmed' } }), 1);
  assert.equal(outcomeBinary({ resolution: { outcome: 'REFUTED' } }), 0);
  assert.equal(outcomeBinary({ resolution: { outcome: 'pending' } }), null);
  assert.equal(outcomeBinary({}), null);
});

test('scoredClaims = resolved, valid, with known outcome', () => {
  assert.deepEqual(scoredClaims(fixtures).map((x) => x.id), ['b', 'c']);
});

test('brierContribution and mean Brier', () => {
  assert.ok(Math.abs(brierContribution(fixtures[1]) - 0.04) < 1e-9); // (0.8-1)^2
  assert.ok(Math.abs(brierContribution(fixtures[2]) - 0.09) < 1e-9); // (0.3-0)^2
  const b = brierScore(fixtures);
  assert.equal(b.n, 2);
  assert.ok(Math.abs(b.mean - 0.065) < 1e-9);
});

test('brierScore on empty/unscored set returns null mean', () => {
  assert.deepEqual(brierScore([]), { n: 0, mean: null });
  assert.deepEqual(brierScore([{ status: 'open', confidence: 0.5 }]), { n: 0, mean: null });
});

test('confidenceBuckets places values into 10-pt buckets', () => {
  const b = confidenceBuckets([{ confidence: 0.0 }, { confidence: 0.65 }, { confidence: 1.0 }]);
  assert.equal(b[0].n, 1); // 0%
  assert.equal(b[6].n, 1); // 60–70
  assert.equal(b[9].n, 1); // 100% clamps into last bucket
  assert.equal(b.length, 10);
});

test('groupCount tallies a categorical field', () => {
  assert.deepEqual(groupCount(fixtures, 'committed_by'), { twin: 5, bruno: 1 });
});

test('horizonByMonth groups open resolve_by months sorted', () => {
  assert.deepEqual(horizonByMonth(classify(fixtures).open), [
    { month: '2026-09', n: 1 },
    { month: '2026-12', n: 1 },
  ]);
});

test('attribution reads committed_by (the bug fix), defaulting to twin', () => {
  assert.equal(attribution({ committed_by: 'bruno' }), 'bruno');
  assert.equal(attribution({ committed_by: 'twin' }), 'twin');
  // The old code keyed on confidence_source==='bruno-stated'; ensure that no
  // longer drives attribution:
  assert.equal(attribution({ committed_by: 'bruno', confidence_source: 'twin-estimated' }), 'bruno');
  assert.equal(attribution({}), 'twin');
});
