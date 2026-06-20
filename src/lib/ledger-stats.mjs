// ledger-stats.mjs — pure, dependency-free helpers for classifying and scoring
// prediction-ledger claims. Imported by the ledger pages/components AND by the
// node:test suite, so it must stay free of Astro/runtime imports.

export const isInvalid = (c) => c?.validity?.status === 'invalid';
export const isWithdrawn = (c) => Boolean(c?.withdrawal);
export const isLive = (c) => !isInvalid(c) && !isWithdrawn(c);

// Split a claim set into the buckets the site renders. `live` excludes
// invalidated and withdrawn claims (they stay visible but never score).
export function classify(claims = []) {
  const live = claims.filter(isLive);
  const open = live
    .filter((c) => c.status === 'open')
    .sort((a, b) => (a.resolve_by || '').localeCompare(b.resolve_by || ''));
  const resolved = live.filter((c) => c.status === 'resolved');
  const invalid = claims.filter(isInvalid);
  const withdrawn = claims.filter(isWithdrawn);
  return { live, open, resolved, invalid, withdrawn };
}

export function counts(claims = []) {
  const { open, resolved, invalid, withdrawn } = classify(claims);
  return {
    open: open.length,
    resolved: resolved.length,
    invalid: invalid.length,
    withdrawn: withdrawn.length,
  };
}

// Map a resolution outcome to a binary realization. `confidence` is always the
// probability that the claim AS STATED is true, so "confirmed" → 1, a refutation
// → 0, and anything unrecognised → null (unscored).
const POSITIVE = new Set(['confirmed', 'true', 'correct', 'yes']);
const NEGATIVE = new Set(['refuted', 'disconfirmed', 'false', 'incorrect', 'missed', 'no']);
export function outcomeBinary(c) {
  const o = (c?.resolution?.outcome || '').toString().toLowerCase().trim();
  if (POSITIVE.has(o)) return 1;
  if (NEGATIVE.has(o)) return 0;
  return null;
}

// Scored population: resolved, still valid, with a numeric confidence and a
// recognised binary outcome. Invalidated/withdrawn claims are never scored.
export function scoredClaims(claims = []) {
  return classify(claims).resolved.filter(
    (c) => typeof c.confidence === 'number' && outcomeBinary(c) !== null,
  );
}

// Per-claim Brier contribution: (probability − outcome)². Lower is better.
export function brierContribution(c) {
  const o = outcomeBinary(c);
  if (o === null || typeof c?.confidence !== 'number') return null;
  return (c.confidence - o) ** 2;
}

export function brierScore(claims = []) {
  const scored = scoredClaims(claims);
  if (!scored.length) return { n: 0, mean: null };
  const sum = scored.reduce((a, c) => a + brierContribution(c), 0);
  return { n: scored.length, mean: sum / scored.length };
}

// Histogram of confidences into ten 10-point buckets [0,10)…[90,100].
export function confidenceBuckets(claims = []) {
  const buckets = Array.from({ length: 10 }, (_, i) => ({ lo: i * 10, hi: i * 10 + 10, n: 0 }));
  for (const c of claims) {
    if (typeof c?.confidence !== 'number') continue;
    let idx = Math.floor(c.confidence * 10);
    if (idx > 9) idx = 9;
    if (idx < 0) idx = 0;
    buckets[idx].n += 1;
  }
  return buckets;
}

// Count claims by a categorical field (e.g. 'committed_by', 'frame', 'tier').
export function groupCount(claims = [], field) {
  const out = {};
  for (const c of claims) {
    const k = c?.[field] ?? 'unknown';
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

// Open claims grouped by resolve-by month (YYYY-MM) — the forecast horizon.
export function horizonByMonth(claims = []) {
  const out = {};
  for (const c of claims) {
    const m = (c?.resolve_by || '').slice(0, 7);
    if (!m) continue;
    out[m] = (out[m] || 0) + 1;
  }
  return Object.entries(out)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, n]) => ({ month, n }));
}

// Display helpers (kept here so the page and tests agree on formatting).
export const pct = (c) =>
  typeof c?.confidence === 'number' ? Math.round(c.confidence * 100) + '%' : '—';
export const truncate = (s, n) => {
  if (!s || s.length <= n) return s;
  const cut = s.slice(0, n - 1);
  // Trim back to the last word boundary so we never cut mid-word.
  const atSpace = cut.replace(/\s+\S*$/, '');
  return (atSpace.length > n * 0.6 ? atSpace : cut).trimEnd() + '…';
};
// Attribution reads committed_by (twin | bruno). The previous view keyed on
// confidence_source === 'bruno-stated', which never matches the data and so
// always showed "twin"; committed_by is the correct field.
export const attribution = (c) => (c?.committed_by === 'bruno' ? 'bruno' : 'twin');
