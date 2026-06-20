# Contributing

This is a personal research site, but issues and PRs that fix bugs or improve
the design/build are welcome.

## Important: some files are generated, not authored here

The site is a **data mirror** of an upstream private repo (the cognitive twin).
A weekly job regenerates and force-pushes these paths, so **do not hand-edit
them — changes will be overwritten**:

- `src/data/ledger.json` — the public prediction ledger (source of truth: [`chiKeka/ledger`](https://github.com/chiKeka/ledger))
- `src/data/frameworks.json` — the active framework set
- `src/content/writing/*.md` — published pieces (gated upstream by a publish action)

Everything else is fair game: `src/pages`, `src/layouts`, `src/components`,
`src/styles`, `scripts/`, config, and docs.

## Develop

```bash
npm install
npm run dev      # prep data, then serve on http://localhost:4321
```

In a standalone checkout, `npm run prep` (run by `dev`/`build`) fetches the live
ledger from the public `chiKeka/ledger` repo, validates it, and stamps the source
commit. With no network it falls back to the committed snapshot (the build fails
only if there is no snapshot at all).

## Before opening a PR

```bash
npm run check        # astro check (type/diagnostics)
npm test             # node:test unit tests (ledger stats, prep transforms, schema)
npm run build        # must report "N page(s) built", 0 errors
npm run ledger:fresh # optional: is the committed snapshot behind the live ledger?
```

CI runs all of the above on every PR. Keep changes focused and the build green.
