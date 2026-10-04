// Generate ledger data only from a pinned canonical PUBLIC ledger snapshot.
// Parent/source mode requires that fetch to succeed; standalone builds may use
// a previously content-verified public snapshot. Framework/writing gates remain.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseFm,
  titleCase,
  deriveSummary,
  buildFrameworks,
  collectPublished,
  isStale,
  ageInDays,
} from './lib/prep-transforms.mjs';
import { fetchPublicLedger, validatePublicSnapshot } from './lib/public-ledger.mjs';

const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(PROJECT, '..');
const DATA = path.join(REPO, 'data');
const OUT_DATA = path.join(PROJECT, 'src', 'data');
const OUT_WRITING = path.join(PROJECT, 'src', 'content', 'writing');

const LEDGER_REPO = 'chiKeka/ledger';
const STALE_DAYS = 14; // build fails if an offline snapshot is older than this

fs.mkdirSync(OUT_DATA, { recursive: true });
fs.mkdirSync(OUT_WRITING, { recursive: true });

const LEDGER_OUT = path.join(OUT_DATA, 'ledger.json');
const ghHeaders = () => {
  const h = { 'User-Agent': 'research-prep-data', Accept: 'application/vnd.github+json' };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
};

const haveSource = fs.existsSync(DATA);
try {
  const ledger = await fetchPublicLedger({ headers: ghHeaders() });
  fs.writeFileSync(LEDGER_OUT, JSON.stringify(ledger, null, 2));
  console.log(`[prep] ledger.json: ${ledger.claims.length} claims pinned to ${LEDGER_REPO}@${ledger.source.commit_short}.`);
} catch (e) {
  if (haveSource) throw new Error(`public ledger unavailable; source mirror blocked: ${e.message}`);
  let snapshot;
  try {
    snapshot = JSON.parse(fs.readFileSync(LEDGER_OUT, 'utf8'));
    validatePublicSnapshot(snapshot);
  } catch (invalid) {
    throw new Error(`public ledger unavailable (${e.message}); no verified fallback: ${invalid.message}`);
  }
  const stamp = snapshot.source.committed_at;
  const staleNote = isStale(snapshot, STALE_DAYS)
    ? ` — snapshot is ~${Math.round(ageInDays(stamp))}d old; CI freshness check flags drift`
    : '';
  console.warn(`[prep] fetch failed (${e.message}); using verified public snapshot ${snapshot.source.commit_short} from ${stamp}${staleNote}.`);
}
if (!haveSource) {
  console.log('[prep] standalone mode — frameworks & writing use committed snapshots.');
  process.exit(0);
}
const readJsonl = (p) =>
  fs.existsSync(p)
    ? fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];

// 2) Frameworks — active only, public-facing fields.
try {
  const fw = buildFrameworks(readJsonl(path.join(DATA, 'knowledge-graph', 'frameworks.jsonl')));
  fs.writeFileSync(path.join(OUT_DATA, 'frameworks.json'), JSON.stringify(fw, null, 2));
  console.log(`[prep] frameworks.json: ${fw.length} active frameworks.`);
} catch (e) {
  console.warn('[prep] frameworks build failed; keeping snapshot.', e.message);
}

// 3) Writing — ONLY pieces with a recorded publish action (per-piece gate).
try {
  const published = collectPublished(readJsonl(path.join(DATA, 'activity-log.jsonl')));

  // Clear previously generated pieces so unpublishing is reflected.
  for (const f of fs.existsSync(OUT_WRITING) ? fs.readdirSync(OUT_WRITING) : []) {
    if (f.endsWith('.md')) fs.unlinkSync(path.join(OUT_WRITING, f));
  }

  let n = 0;
  for (const [draftRel, meta] of published) {
    const abs = path.join(REPO, draftRel);
    if (!fs.existsSync(abs)) continue;
    const { fm, body } = parseFm(fs.readFileSync(abs, 'utf8'));
    const slug = path.basename(draftRel).replace(/\.md$/, '');
    const title = fm.title || fm.topic || titleCase(slug.replace(/^\d{4}-\d{2}-\d{2}-/, ''));
    const summary = deriveSummary(fm, body, title);
    const yaml = [
      '---',
      `title: ${JSON.stringify(title)}`,
      `date: ${JSON.stringify(meta.date || fm.date || '')}`,
      `platform: ${JSON.stringify(meta.platform)}`,
      `external_url: ${JSON.stringify(meta.url || '')}`,
      `summary: ${JSON.stringify(summary)}`,
      'published: true',
      '---',
      '',
      body,
      '',
    ].join('\n');
    fs.writeFileSync(path.join(OUT_WRITING, `${slug}.md`), yaml);
    n++;
  }
  console.log(`[prep] writing: ${n} published piece(s).`);
} catch (e) {
  console.warn('[prep] writing build failed; keeping snapshots.', e.message);
}
