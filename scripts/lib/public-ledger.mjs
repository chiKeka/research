import { createHash } from 'node:crypto';
import { validateLedger } from './prep-transforms.mjs';

export const PUBLIC_REPO = 'chiKeka/ledger';
const stable = (v) => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])])) : v;
export function contentDigest(ledger) {
  const { source, ...payload } = ledger;
  return createHash('sha256').update(JSON.stringify(stable(payload))).digest('hex');
}
export function validatePublicSnapshot(ledger) {
  const result = validateLedger(ledger);
  if (!result.ok) throw new Error(`ledger schema: ${result.errors.join('; ')}`);
  const s = ledger.source;
  if (!s || s.repo !== PUBLIC_REPO || !/^[0-9a-f]{40}$/.test(s.commit ?? '') ||
      s.url !== `https://github.com/${PUBLIC_REPO}/commit/${s.commit}` ||
      s.commit_short !== s.commit.slice(0, 7) || !Number.isFinite(Date.parse(s.committed_at)) ||
      !Number.isFinite(Date.parse(s.fetched_at)) || s.content_sha256 !== contentDigest(ledger)) {
    throw new Error('missing or inconsistent canonical public provenance/content digest');
  }
  return ledger;
}
export async function fetchPublicLedger({ fetchImpl = fetch, headers = {}, now = () => new Date().toISOString() } = {}) {
  const response = await fetchImpl(`https://api.github.com/repos/${PUBLIC_REPO}/commits?path=ledger.json&per_page=1`, { headers });
  if (!response.ok) throw new Error(`commits API ${response.status}`);
  const commit = (await response.json())?.[0];
  const sha = commit?.sha;
  const date = commit?.commit?.committer?.date || commit?.commit?.author?.date;
  if (!/^[0-9a-f]{40}$/.test(sha ?? '') || !Number.isFinite(Date.parse(date))) throw new Error('invalid public commit metadata');
  const raw = await fetchImpl(`https://raw.githubusercontent.com/${PUBLIC_REPO}/${sha}/ledger.json`, { headers: { 'User-Agent': 'research-prep-data' } });
  if (!raw.ok) throw new Error(`pinned ledger fetch ${raw.status}`);
  const ledger = await raw.json();
  // An upstream source block cannot override this exact fetch's provenance.
  delete ledger.source;
  ledger.source = { repo: PUBLIC_REPO, commit: sha, commit_short: sha.slice(0, 7), committed_at: date,
    fetched_at: now(), url: `https://github.com/${PUBLIC_REPO}/commit/${sha}`, content_sha256: contentDigest(ledger) };
  return validatePublicSnapshot(ledger);
}
