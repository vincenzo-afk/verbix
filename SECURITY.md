# Security Policy

## Reporting a vulnerability

Do not disclose suspected vulnerabilities in a public GitHub issue. Use the repository’s private vulnerability-reporting channel when available in GitHub’s **Security** tab. If private reporting is unavailable, contact the repository owner through the [GitHub profile](https://github.com/vincenzo-afk) with a concise description, affected component, safe reproduction steps, and potential impact.

Do not include live credentials, personal data, or destructive payloads in public reports or pull requests.

## Scope

Security-relevant areas include authentication and administrator role enforcement, tRPC procedure authorization, session and credential handling, input validation, source-import network restrictions, database queries, and dependency changes.

The actively developed `main` branch is the supported version. Historical versions are not maintained as separate release lines.

## Practices implemented in this repository

Verbix applies server-side authentication and role checks for protected and administrator procedures. Workspace and deployed-agent changes perform server-side ownership checks. The importer limits sources to public URLs, blocks private-address resolution, evaluates `robots.txt`, follows a bounded redirect chain, accepts only HTML, and records source attribution.

The credential-vault helper encrypts provider secrets server-side with AES-256-GCM derived from the configured session secret. Credential procedures return masked hints, not plaintext stored secrets.

## Responsible disclosure

Provide sufficient information for safe reproduction, including affected code path and observed behavior. Do not test against third-party systems without authorization or publish instructions that could expose users to harm.
