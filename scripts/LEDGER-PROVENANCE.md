# Ledger publication contract

Every generated ledger uses the canonical public `chiKeka/ledger` payload fetched
at an immutable commit. Parent/source builds do not render private ledger data.
They block if that public fetch fails. Standalone builds can use a prior snapshot
only when its public provenance and full-content digest validate; a legacy
unstamped snapshot needs a successful public fetch before it can serve as fallback.

`source.content_sha256` is SHA256 of UTF-8 JSON with recursively sorted object
keys, original array ordering, and the root `source` field excluded. The digest
covers all evidence, relationships and other payload fields, not only scores.
Commit metadata comes from the same public commit selected for the raw fetch.
`npm run ledger:provenance` verifies the final snapshot offline; build runs this
after generation. A digest detects subsequent drift, not malicious alteration of
both content and metadata, nor source freshness. Network fetching establishes the
public source binding; no private source identifiers are published.

Mirror callers must not backfill a source block from an independent latest-commit
query. A stale but accurately pinned public snapshot remains stale until the
sanctioned public-ledger publication succeeds. This code change does not publish
or restore any current data snapshot.
