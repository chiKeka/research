// Offline integrity gate for the final generated snapshot. This verifies the
// recorded fetch binding; it does not claim freshness or re-fetch the source.
import fs from 'node:fs';
import { validatePublicSnapshot } from './lib/public-ledger.mjs';
const snapshot = JSON.parse(fs.readFileSync(new URL('../src/data/ledger.json', import.meta.url), 'utf8'));
validatePublicSnapshot(snapshot);
console.log(`[provenance] verified public snapshot ${snapshot.source.commit_short}, ${snapshot.claims.length} claims.`);
