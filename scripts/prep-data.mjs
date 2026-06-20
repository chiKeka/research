// prep-data.mjs — generate self-contained site data from the BrunoTwin repo.
//
// When this project lives inside bruno-twin-private (../data present) it refreshes
// the snapshots from source. When the project is split into its own repo and the
// parent data is absent, it leaves the committed snapshots in place so the site
// still builds. Public ledger content is ALWAYS sourced from render-scoreboard.py
// (the renderer owns sanitization) — never from raw ledger.jsonl.

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(PROJECT, '..');
const DATA = path.join(REPO, 'data');
const OUT_DATA = path.join(PROJECT, 'src', 'data');
const OUT_WRITING = path.join(PROJECT, 'src', 'content', 'writing');

fs.mkdirSync(OUT_DATA, { recursive: true });
fs.mkdirSync(OUT_WRITING, { recursive: true });

const haveSource = fs.existsSync(DATA);
if (!haveSource) {
  console.log('[prep] parent repo data not found — using committed snapshots (detached mode).');
  process.exit(0);
}

const readJsonl = (p) =>
  fs.existsSync(p)
    ? fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];

// 1) Public ledger — from the renderer's sanitized output only.
try {
  const tmp = fs.mkdtempSync(path.join('/tmp', 'hub-sb-'));
  execSync(`python3 scripts/render-scoreboard.py --out ${tmp}`, { cwd: REPO, stdio: 'ignore' });
  const ledger = JSON.parse(fs.readFileSync(path.join(tmp, 'ledger.json'), 'utf8'));
  fs.writeFileSync(path.join(OUT_DATA, 'ledger.json'), JSON.stringify(ledger, null, 2));
  console.log(`[prep] ledger.json: ${ledger.claims?.length ?? 0} public claims (sanitized via renderer).`);
} catch (e) {
  console.warn('[prep] render-scoreboard failed; keeping existing ledger.json snapshot.', e.message);
}

// 2) Frameworks — active only, public-facing fields.
try {
  const fw = readJsonl(path.join(DATA, 'knowledge-graph', 'frameworks.jsonl'))
    .filter((f) => f.status === 'active')
    .map((f) => ({ name: f.name, domain: f.domain || 'general', description: f.description || '' }))
    .sort((a, b) => (a.domain + a.name).localeCompare(b.domain + b.name));
  fs.writeFileSync(path.join(OUT_DATA, 'frameworks.json'), JSON.stringify(fw, null, 2));
  console.log(`[prep] frameworks.json: ${fw.length} active frameworks.`);
} catch (e) {
  console.warn('[prep] frameworks build failed; keeping snapshot.', e.message);
}

// 3) Writing — ONLY pieces with a recorded publish action (respects the per-piece gate).
try {
  const acts = readJsonl(path.join(DATA, 'activity-log.jsonl'));
  const published = new Map(); // draft_file -> {url, platform, date}
  for (const a of acts) {
    if (a.action !== 'publish') continue;
    const d = a.details || {};
    if (!d.draft_file || !d.post_url) continue;
    published.set(d.draft_file, {
      url: d.post_url,
      platform: d.platform || 'web',
      date: (a.timestamp || '').slice(0, 10),
    });
  }

  // Clear previously generated pieces so unpublishing is reflected.
  for (const f of fs.existsSync(OUT_WRITING) ? fs.readdirSync(OUT_WRITING) : []) {
    if (f.endsWith('.md')) fs.unlinkSync(path.join(OUT_WRITING, f));
  }

  const parseFm = (raw) => {
    if (!raw.startsWith('---')) return { fm: {}, body: raw };
    const lines = raw.split('\n');
    let end = -1;
    for (let i = 1; i < lines.length; i++) if (lines[i].trim() === '---') { end = i; break; }
    if (end === -1) return { fm: {}, body: raw };
    const fm = {};
    for (const l of lines.slice(1, end)) {
      const m = l.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
      if (m) fm[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
    return { fm, body: lines.slice(end + 1).join('\n').trim() };
  };
  const titleCase = (s) =>
    s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  let n = 0;
  for (const [draftRel, meta] of published) {
    const abs = path.join(REPO, draftRel);
    if (!fs.existsSync(abs)) continue;
    const { fm, body } = parseFm(fs.readFileSync(abs, 'utf8'));
    const slug = path.basename(draftRel).replace(/\.md$/, '');
    const title = fm.title || fm.topic || titleCase(slug.replace(/^\d{4}-\d{2}-\d{2}-/, ''));
    const summary =
      fm.topic && fm.topic !== title
        ? fm.topic
        : body.replace(/[#*_>`]/g, '').split('\n').filter(Boolean)[0]?.slice(0, 180) || '';
    const yaml = [
      '---',
      `title: ${JSON.stringify(title)}`,
      `date: ${JSON.stringify(meta.date || fm.date || '')}`,
      `platform: ${JSON.stringify(meta.platform)}`,
      `external_url: ${JSON.stringify(meta.url)}`,
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
