# Verbix — Intelligent Prompt Universe

Verbix is a full-stack prompt platform for discovering, improving, versioning, sharing, and executing reusable AI prompts. It provides a responsive public library, authenticated creator workspaces, community reviews, public creator profiles, controlled prompt agents, and role-gated moderation.

## Core capabilities

| Area | What Verbix provides |
| --- | --- |
| Prompt enhancement | A server-only adapter named **`free-chatbot`** that tries Phind, DuckDuckGo, and Blackbox providers through a fallback chain. It applies request timeouts, lightweight rate limiting, normalized structured results, and an explicit editable fallback when providers are unavailable. |
| Prompt composition | Original prompt text remains editable and is never overwritten automatically. The improvement response identifies intent, assumptions, missing information, constraints, variables, output format, acceptance criteria, and agent notes. |
| Prompt variables | Exact `{{variable}}` parsing; generated text, number, and select controls; inline accessible validation; live compilation; copy; reset; and text/JSON export. |
| Public discovery | Separate featured, trending, and recent sections; full search; category, tag, model-compatibility, and sort filters; prompt detail pages; related prompts; attribution; and public creator profiles. |
| Creator workspace | Authenticated draft creation, private editing, variable persistence, manual versions, accepted-improvement versions, submission for moderation, creator metrics, and shareable deployed agents. |
| Execution | Authenticated `free-chatbot` runs with persisted run metadata and history. Public deployed agents compile variables server-side and execute through the same controlled adapter. |
| Community | Saves, ratings/reviews, prompt reports, prompt attribution, creator metrics, and public creator collections. |
| Moderation | Server-side administrator procedures for submitted prompts, reviews, reports, categories, and tags. Every moderation action is recorded. |

## Technical architecture

Verbix uses React 19, Tailwind CSS 4, Express 4, tRPC 11, Drizzle ORM, and a MySQL/TiDB-compatible database. Manus OAuth supplies authenticated users and roles. All product APIs are typed tRPC procedures under `/api/trpc`.

The application stores durable records for prompts, versions, variables, improvements, saves, reviews, reports, prompt runs, daily creator analytics, deployed agents, moderation records, categories, tags, and provider credentials. Ownership is enforced server-side for workspace mutations and deployments; administrator procedures require the `admin` role.

> **Provider security:** the current execution path requires no downstream provider credential because it uses the keyless `free-chatbot` package. The application additionally includes a server-only AES-256-GCM credential vault foundation for future provider adapters. It stores encrypted values and hint-only metadata; plaintext secrets are never returned by API procedures or rendered in the UI.

## Local development

Install dependencies and run the development server:

```bash
pnpm install
pnpm dev
```

Run the validation suite:

```bash
pnpm test
pnpm check
pnpm build
```

Database changes are represented in `drizzle/schema.ts` and the generated Drizzle migration files. Apply generated migrations through the managed project database workflow rather than bypassing the schema.

## Important operational notes

The `free-chatbot` providers are third-party free services and can become unavailable, rate-limited, or alter their response behavior. Verbix deliberately reports a clear unavailable-provider state and offers a structured local fallback for improvement requests rather than silently losing the user’s original prompt. The original prompt is preserved independently from all accepted improvement versions.

Public agents and interactive execution flows should be monitored for provider availability and abuse patterns. The built-in application limits are intentionally conservative and suitable as an initial serverless deployment foundation; production traffic may require stronger distributed rate limiting and additional observability.

## Validation coverage

The current Vitest suite covers:

- Auth logout cookie behavior.
- `{{variable}}` parsing, compilation, and typed validation.
- `free-chatbot` structured-result normalization and fallback behavior.
- Server-only credential encryption, decryption, and masked hints.

## User flow summary

1. Browse featured, trending, recent, or filtered public prompts.
2. Open a prompt to inspect variables, compile a private instance, save it, review it, report it, or view its creator.
3. Create a private prompt in Compose and use the `free-chatbot` enhancement layer.
4. Save the draft into Workspace, where manual edits and accepted improvements create versions.
5. Submit a prompt for review or deploy an owned prompt as a controlled shareable agent.
6. Use the Admin console to approve, reject, hide, restore, archive, or resolve moderated content.
