// prep-data.mjs — generate self-contained site data.
//
// Two modes:
//  * Inside bruno-twin-private (../data present): the Weekly Reckoning mirror runs
//    here. The public ledger is rendered by scripts/render-scoreboard.py (the
//    renderer owns sanitization — never raw ledger.jsonl), frameworks are the
//    active set, writing respects the activity-log publish gate. The committed
//    snapshots are refreshed from source.
//  * Standalone (../data absent — e.g. Vercel building this repo alone): the
//    ledger is FETCHED at build time from the PUBLIC chiKeka/ledger repo, pinned
//    to a commit SHA, schema-validated, and stamped with provenance. If the fetch
//    fails (e.g. an unauthenticated GitHub API rate-limit), the committed snapshot
//    is shipped — the weekly mirror keeps it fresh and CI flags drift. The build
//    only FAILS when there is no usable snapshot at all. Set GITHUB_TOKEN in the
//    build env to lift the 60 req/hr unauthenticated API limit.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseFm,
  titleCase,
  deriveSummary,
  buildFrameworks,
  collectPublished,
  validateLedger,
  isStale,
  ageInDays,
} from './lib/prep-transforms.mjs';

const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(PROJECT, '..');
const DATA = path.join(REPO, 'data');
const OUT_DATA = path.join(PROJECT, 'src', 'data');
const OUT_WRITING = path.join(PROJECT, 'src', 'content', 'writing');

const LEDGER_REPO = 'chiKeka/ledger';
const LEDGER_FILE = 'ledger.json';
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

// Fetch the authoritative ledger from the public repo, pinned to its latest
// commit SHA. Returns { ledger, source } or throws.
async function fetchAuthoritativeLedger() {
  const commitsUrl = `https://api.github.com/repos/${LEDGER_REPO}/commits?path=${LEDGER_FILE}&per_page=1`;
  const cRes = await fetch(commitsUrl, { headers: ghHeaders() });
  if (!cRes.ok) throw new Error(`commits API ${cRes.status}`);
  const commits = await cRes.json();
  const sha = commits?.[0]?.sha;
  const committed_at = commits?.[0]?.commit?.committer?.date || commits?.[0]?.commit?.author?.date;
  if (!sha) throw new Error('no commit sha for ledger.json');

  const rawUrl = `https://raw.githubusercontent.com/${LEDGER_REPO}/${sha}/${LEDGER_FILE}`;
  const rRes = await fetch(rawUrl, { headers: { 'User-Agent': 'research-prep-data' } });
  if (!rRes.ok) throw new Error(`raw fetch ${rRes.status}`);
  const ledger = await rRes.json();

  const { ok, errors } = validateLedger(ledger);
  if (!ok) throw new Error(`schema validation failed: ${errors.slice(0, 3).join('; ')}`);

  ledger.source = {
    repo: LEDGER_REPO,
    commit: sha,
    commit_short: sha.slice(0, 7),
    committed_at: committed_at || null,
    fetched_at: new Date().toISOString(),
    url: `https://github.com/${LEDGER_REPO}/commit/${sha}`,
  };
  return ledger;
}

const haveSource = fs.existsSync(DATA);

if (!haveSource) {
  // ---- Standalone build: fetch live, fall back to snapshot, fail if stale ----
  try {
    const ledger = await fetchAuthoritativeLedger();
    fs.writeFileSync(LEDGER_OUT, JSON.stringify(ledger, null, 2));
    console.log(
      `[prep] ledger.json: fetched ${ledger.claims.length} claims from ${LEDGER_REPO}@${ledger.source.commit_short} (live).`,
    );
  } catch (e) {
    let snapshot = null;
    try {
      snapshot = JSON.parse(fs.readFileSync(LEDGER_OUT, 'utf8'));
    } catch {
      /* no snapshot */
    }
    // A static deploy shipping the last-good snapshot beats a failed deploy, so we
    // never hard-fail when a snapshot exists — only when there is no data at all.
    if (!snapshot) {
      console.error(
        `[prep] FATAL: could not fetch ${LEDGER_REPO} ledger (${e.message}) and no committed snapshot exists.`,
      );
      process.exit(1);
    }
    const stamp = snapshot.source?.committed_at || snapshot.updated;
    const staleNote = isStale(snapshot, STALE_DAYS)
      ? ` — snapshot is ~${Math.round(ageInDays(stamp))}d old; the weekly mirror may be paused (CI freshness check flags real drift)`
      : '';
    console.warn(
      `[prep] ledger fetch failed (${e.message}); shipping committed snapshot from ${stamp}${staleNote}.`,
    );
  }
  console.log('[prep] standalone mode — frameworks & writing use committed snapshots.');
  process.exit(0);
}

// ---- In-repo build (Weekly Reckoning mirror): render from source ----------
const readJsonl = (p) =>
  fs.existsSync(p)
    ? fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];

// 1) Public ledger — from the renderer's sanitized output only, stamped with the
//    public-repo commit SHA when reachable (provenance for the detail pages).
try {
  const tmp = fs.mkdtempSync(path.join('/tmp', 'hub-sb-'));
  execFileSync('python3', ['scripts/render-scoreboard.py', '--out', tmp], {
    cwd: REPO,
    stdio: 'ignore',
  });
  const ledger = JSON.parse(fs.readFileSync(path.join(tmp, 'ledger.json'), 'utf8'));
  try {
    const commitsUrl = `https://api.github.com/repos/${LEDGER_REPO}/commits?path=${LEDGER_FILE}&per_page=1`;
    const cRes = await fetch(commitsUrl, { headers: ghHeaders() });
    if (cRes.ok) {
      const sha = (await cRes.json())?.[0]?.sha;
      if (sha) {
        ledger.source = {
          repo: LEDGER_REPO,
          commit: sha,
          commit_short: sha.slice(0, 7),
          committed_at: ledger.updated || null,
          fetched_at: new Date().toISOString(),
          url: `https://github.com/${LEDGER_REPO}/commit/${sha}`,
        };
      }
    }
  } catch {
    /* provenance stamp is best-effort in source mode */
  }
  fs.writeFileSync(LEDGER_OUT, JSON.stringify(ledger, null, 2));
  console.log(`[prep] ledger.json: ${ledger.claims?.length ?? 0} public claims (sanitized via renderer).`);
} catch (e) {
  console.warn('[prep] render-scoreboard failed; keeping existing ledger.json snapshot.', e.message);
}

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
