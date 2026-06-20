# Security Policy

## Scope

This repository is a **static** Astro site. The deployed output is HTML/CSS/JS
with no server-side runtime and no secrets in the build. Ledger content is
published, machine-readable, in the public [`chiKeka/ledger`](https://github.com/chiKeka/ledger)
repository; the build fetches it read-only over HTTPS and sanitization is owned
by the upstream renderer, not this site.

## Supported versions

Only the current `main` (the live deploy) is supported. There are no
maintenance branches.

## Reporting a vulnerability

Please report security issues privately via GitHub's
**[Report a vulnerability](https://github.com/chiKeka/research/security/advisories/new)**
(Security → Advisories). Do not open a public issue for a suspected
vulnerability.

Useful things to include: affected URL or file, reproduction steps, and the
impact you observed. We aim to acknowledge within a few days.

## Out of scope

- Findings that require a compromised build environment or maintainer machine.
- Best-practice suggestions without a concrete security impact (use a normal issue/PR).
- Vulnerabilities in third-party hosts (Vercel, GitHub) — report to those vendors.
