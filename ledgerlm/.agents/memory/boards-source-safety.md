---
name: Boards source safety boundary
description: Durable safety rule for Vault tabular sources and spreadsheet parsing
---

Vault-backed Board analysis must use an immutable content identity, authorization at queue and execution time, strict bounded parsing, and deterministic structured output. CSV can use a bounded quoted-field parser; XLSX ingestion must remain disabled until ZIP compressed/uncompressed limits can be enforced before workbook expansion.

**Why:** Spreadsheet packages can contain macros, formulas, hidden sheets, and highly compressed payloads that create execution, injection, or memory-exhaustion risk. Guessing ambiguous mappings also produces unverifiable financial results.

**How to apply:** Preserve fail-closed behavior for unsupported formats and ambiguous mappings. Reuse the deterministic engine and evidence/version checks when enabling additional tabular formats.