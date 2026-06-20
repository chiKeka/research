// prep-transforms.mjs — pure helpers used by prep-data.mjs. Kept import-free so
// they can be unit-tested with node:test without touching the filesystem.

// Parse a very small subset of YAML front-matter (key: value) from a markdown file.
export function parseFm(raw) {
  if (!raw.startsWith('---')) return { fm: {}, body: raw };
  const lines = raw.split('\n');
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) return { fm: {}, body: raw };
  const fm = {};
  for (const l of lines.slice(1, end)) {
    const m = l.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (m) fm[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return { fm, body: lines.slice(end + 1).join('\n').trim() };
}

export const titleCase = (s) => s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function deriveSummary(fm, body, title) {
  if (fm.topic && fm.topic !== title) return fm.topic;
  const firstLine = body.replace(/[#*_>`]/g, '').split('\n').filter(Boolean)[0] || '';
  return firstLine.trim().slice(0, 180);
}

// Active-only public projection of the framework knowledge graph.
export function buildFrameworks(rows = []) {
  return rows
    .filter((f) => f.status === 'active')
    .map((f) => ({ name: f.name, domain: f.domain || 'general', description: f.description || '' }))
    .sort((a, b) => (a.domain + a.name).localeCompare(b.domain + b.name));
}

// Build the draft_file -> {url, platform, date} map from publish actions only.
export function collectPublished(activityLog = []) {
  const published = new Map();
  for (const a of activityLog) {
    if (a.action !== 'publish') continue;
    const d = a.details || {};
    if (!d.draft_file || !d.post_url) continue;
    published.set(d.draft_file, {
      url: sanitizeUrl(d.post_url),
      platform: d.platform || 'web',
      date: (a.timestamp || '').slice(0, 10),
    });
  }
  return published;
}

// Sanitize an external URL: strip a trailing parenthetical note (e.g.
// "https://…/in/bruno-chikeka (feed post, published via composer)") and return a
// valid http(s) URL, or null. Prevents a malformed value from rendering a broken
// link or failing a url() schema check downstream.
export function sanitizeUrl(value) {
  if (!value || typeof value !== 'string') return null;
  let s = value.trim().replace(/\s*\([^)]*\)\s*$/, '').trim();
  try {
    const u = new URL(s);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
  } catch {
    /* not a URL */
  }
  return null;
}

// Validate the shape of a ledger payload before it is written/consumed.
// Returns { ok, errors }. Intentionally permissive about extra fields.
export function validateLedger(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object') return { ok: false, errors: ['not an object'] };
  if (typeof obj.updated !== 'string') errors.push('missing string `updated`');
  if (!Array.isArray(obj.claims)) errors.push('missing array `claims`');
  else {
    if (obj.claims.length === 0) errors.push('`claims` is empty');
    obj.claims.forEach((c, i) => {
      if (!c || typeof c !== 'object') return errors.push(`claims[${i}] not an object`);
      if (typeof c.id !== 'string') errors.push(`claims[${i}].id not a string`);
      if (typeof c.claim !== 'string') errors.push(`claims[${i}].claim not a string`);
      if (typeof c.confidence !== 'number' || c.confidence < 0 || c.confidence > 1)
        errors.push(`claims[${i}].confidence out of [0,1]`);
      if (!['open', 'resolved'].includes(c.status))
        errors.push(`claims[${i}].status invalid: ${c.status}`);
    });
    // Duplicate ids would collide in getStaticPaths and break the build.
    const ids = obj.claims.map((c) => c?.id).filter((x) => typeof x === 'string');
    if (new Set(ids).size !== ids.length) errors.push('duplicate claim ids');
  }
  if (obj.experiments !== undefined && !Array.isArray(obj.experiments))
    errors.push('`experiments` present but not an array');
  return { ok: errors.length === 0, errors };
}

// Days between an ISO date string and `now` (Date). Returns Infinity if unparseable.
export function ageInDays(isoDate, now = new Date()) {
  const t = Date.parse(isoDate);
  if (Number.isNaN(t)) return Infinity;
  return (now.getTime() - t) / 86_400_000;
}

// A snapshot is stale when its newest provenance date is older than thresholdDays.
// Uses the freshest *parseable* of source.committed_at and updated, so a malformed
// committed_at can't override a valid `updated` date.
export function isStale(snapshot, thresholdDays, now = new Date()) {
  const committed = snapshot?.source?.committed_at;
  const updated = snapshot?.updated;
  if (!committed && !updated) return true;
  const age = Math.min(ageInDays(committed, now), ageInDays(updated, now));
  return age > thresholdDays;
}
