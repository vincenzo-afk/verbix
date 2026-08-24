# Review-First Importer Policy

Verbix ingests sources **only when an authorized creator or administrator submits a specific public URL for review**. The initial release runs on demand and does not perform scheduled or autonomous crawling.

Each submitted URL is evaluated against the following boundary before extraction. The importer accepts only publicly accessible pages that the reviewer is authorized to submit and that can be fetched without authentication, payment, technical bypasses, or circumvention of access controls. It preserves the canonical source URL, extraction time, displayed author attribution where available, and any license or reuse statement detected on the page.

The system creates a **candidate**, not an automatically published prompt. An authorized reviewer must approve every candidate before it enters the public library. Example outputs are stored only as a source URL and descriptive metadata when the page makes them publicly available and their origin can be attributed. The importer must not download protected media, claim ownership of creator content, or attach media where reuse rights are unclear.

Future scheduled ingestion requires a separate approval, an explicit source allowlist, and per-source crawl limits.
