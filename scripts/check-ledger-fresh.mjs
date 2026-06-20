// check-ledger-fresh.mjs — compare the committed ledger snapshot with the live
// public ledger HEAD. Warns by default (the Vercel build fetches live anyway and
// the weekly mirror refreshes the committed fallback); pass --strict to fail CI.
import fs from 'node:fs';
import crypto from 'node:crypto';

const STRICT = process.argv.includes('--strict');
const REPO = 'chiKeka/ledger';
const FILE = 'ledger.json';

const local = JSON.parse(
  fs.readFileSync(new URL('../src/data/ledger.json', import.meta.url), 'utf8'),
);

// A stable signal: updated date, claim count, and the scoring-relevant fields of
// each claim. Ignores formatting and the injected `source` block.
const signature = (l) => {
  const claims = (l.claims || [])
    .map((c) => ({
      id: c.id,
      status: c.status,
      confidence: c.confidence,
      outcome: c.resolution?.outcome ?? null,
      validity: c.validity?.status ?? null,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({ updated: l.updated, n: (l.claims || []).length, claims }))
    .digest('hex');
};

try {
  const res = await fetch(`https://raw.githubusercontent.com/${REPO}/main/${FILE}`, {
    headers: { 'User-Agent': 'ledger-fresh' },
  });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const remote = await res.json();

  if (signature(local) === signature(remote)) {
    console.log(`[fresh] committed snapshot matches ${REPO}@main (${remote.claims.length} claims).`);
    process.exit(0);
  }

  const msg =
    `committed snapshot (${local.updated}, ${local.claims.length} claims) differs from ` +
    `${REPO}@main (${remote.updated}, ${remote.claims.length} claims). The Vercel build fetches ` +
    `live, but the offline fallback is behind — re-run the weekly mirror to refresh it.`;
  if (STRICT) {
    console.error(`[fresh] STALE: ${msg}`);
    process.exit(1);
  }
  console.log(`::warning::[ledger-fresh] ${msg}`);
  process.exit(0);
} catch (e) {
  console.log(`::warning::[ledger-fresh] could not compare with the live ledger (${e.message}).`);
  process.exit(STRICT ? 1 : 0);
}
