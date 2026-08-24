# Review-First Importer Implementation

The importer accepts a public URL only after it is submitted by an authenticated user and the corresponding domain is explicitly approved by an administrator with a public terms or reuse-policy URL. It runs on demand; it does not crawl automatically or on a schedule.

Before extracting, the server rejects credentialed URLs, non-HTTP(S) schemes, private-network targets, redirect chains beyond three hops, non-HTML responses, and pages larger than 1.5 MB. It checks `robots.txt`, stores only a bounded text excerpt and source metadata, and creates a private moderation candidate rather than publishing source material directly.

Prompt normalization uses the server-side `free-chatbot` adapter and retains the extracted source prompt verbatim alongside the structured result. Candidate modalities include text, image, video, code, audio, and 3D. Publicly available images, video, or audio are stored as **external references only** for administrator review; no third-party media bytes are copied into Verbix storage.

HTML parsing uses [Cheerio](https://github.com/cheeriojs/cheerio), a maintained server-side HTML/XML parser with an MIT license. Its project documentation describes its selector-based API and supports the bounded extraction approach used here. [1]

## Operational flow

| Stage | Control |
|---|---|
| Source submission | Authenticated creator submits one public URL. |
| Domain eligibility | Administrator approves or blocks the domain and records a public policy URL. |
| On-demand import | Server enforces network, robots, MIME type, size, redirect, and duplicate guards. |
| AI structuring | Extracted prompt blocks are normalized as private candidates with provenance. |
| Moderation | Administrator approves/rejects candidates and example references independently. |
| Publication | An approved candidate is promoted to an attributed public Verbix prompt. |

## Reference

[1] [Cheerio GitHub repository](https://github.com/cheeriojs/cheerio)
