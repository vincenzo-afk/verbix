# Contributing to Verbix

Thank you for helping improve Verbix. This guide describes the development workflow supported by the current repository.

## Before you begin

Read the [Code of Conduct](./CODE_OF_CONDUCT.md) and [Security Policy](./SECURITY.md). Do not submit secrets, private data, access tokens, credentials, or material that violates third-party rights.

## Development setup

Verbix uses Node.js and pnpm. The repository declares pnpm `10.4.1` in its package-manager metadata.

```bash
git clone https://github.com/vincenzo-afk/verbix.git
cd verbix
pnpm install
pnpm dev
```

Configuration requirements are documented in the [README](./README.md#getting-started). Keep local environment files outside version control.

## Development standards

Verbix is TypeScript-first. Authorization belongs on the server; hiding a client-side action is not a security boundary. Database changes follow the existing Drizzle workflow: update `drizzle/schema.ts`, generate a migration, review the resulting SQL, and apply it through the managed database process.

Changes to the source importer must retain its documented limits. Do not introduce access to credentialed, paywalled, private-network, bypassed, or `robots.txt`-disallowed sources. Preserve attribution and never copy externally hosted media into the repository or application storage without a documented right to do so.

## Branches and commits

Create a focused branch from `main`:

```text
feature/short-description
fix/short-description
docs/short-description
chore/short-description
```

Use concise, imperative commit subjects. Conventional Commit-style prefixes such as `feat:`, `fix:`, `docs:`, `test:`, and `chore:` are recommended.

## Validation

Run the complete check sequence before opening a pull request:

```bash
pnpm test
pnpm check
pnpm build
```

Add or update Vitest coverage when a change affects a router procedure, authorization rule, parsing behavior, importer safeguard, or service fallback.

## Pull requests

Keep each pull request focused. Explain its user impact, validation completed, documentation changes, migration effects, breaking-change risk, and security or source-rights implications. Use the pull-request template and provide rollback considerations for material data-model or operational changes.
