# Bruno Chikeka — Research Hub

A personal research site built with [Astro](https://astro.build). Sections: Home,
Writing, the public Prediction Ledger, Frameworks, Projects, and About/Now.

It is **self-contained**: the data it needs (`src/data/*.json`,
`src/content/writing/*.md`) is committed. A build-time step
(`scripts/prep-data.mjs`) refreshes those snapshots from the BrunoTwin repo when
this project sits inside it. Standalone, it **fetches the live ledger** from the
public [`chiKeka/ledger`](https://github.com/chiKeka/ledger) repo at build time —
schema-validated and stamped with the source commit — and falls back to the
committed snapshot if the fetch fails (the weekly mirror keeps it fresh and CI
flags drift). The build fails only if there is no snapshot at all. Set
`GITHUB_TOKEN` in the build env to lift the unauthenticated API rate limit.

## Develop

```bash
npm install
npm run dev      # refreshes data, then serves at http://localhost:4321
```

## Build

```bash
npm run build    # → dist/  (static)
```

## Deploy (one-click, no CI to babysit)

The site is fully static, so any host works. Configs are included:

- **Vercel** — import the repo at [vercel.com/new](https://vercel.com/new).
  `vercel.json` sets the framework, build command, and `dist` output. If you
  deploy from inside `bruno-twin-private` (before splitting), set the project's
  **Root Directory** to `research-hub`. Add your custom domain in the dashboard.
- **Netlify** — "Add new site → Import" at [app.netlify.com](https://app.netlify.com).
  `netlify.toml` pins Node 22, the build command, and the publish dir. Base
  directory `research-hub` if deploying from the monorepo.
- **GitHub Pages** — works too; for a project page (not a custom domain) set
  `base: '/<repo>'` in `astro.config.mjs` and add a Pages deploy workflow at the
  repo root.

The canonical origin is set in `astro.config.mjs` (`site:`). It currently points
at the live Vercel host; repoint it to a custom domain once DNS is attached, and
the canonical tags, sitemap, and RSS URLs follow automatically.

## Data sources (sanitization rules)

- **Ledger** content is always the renderer's sanitized output
  (`scripts/render-scoreboard.py`) — never the raw ledger. In a standalone build
  it is fetched from the public `chiKeka/ledger` repo, schema-validated, and
  stamped with the source commit SHA. The site shows nothing the renderer did
  not produce.
- **Writing** only includes pieces with a recorded `publish` action in the
  BrunoTwin activity log — the per-piece publish gate is respected.
- **Frameworks** are the active set from the knowledge graph.

## Test & check

```bash
npm run check        # astro check — type/diagnostic pass
npm test             # node:test — ledger stats, prep transforms, schema
npm run ledger:fresh # compare the committed snapshot with the live ledger
```

CI (`.github/workflows/ci.yml`) runs `astro check → test → build → link check →
ledger freshness → Lighthouse budget` on every push and PR. Dependabot keeps npm
and Actions up to date.

## License

Code is **MIT**; the editorial content (essays, frameworks, ledger text) is
**CC BY 4.0**. See [`LICENSE`](./LICENSE).
