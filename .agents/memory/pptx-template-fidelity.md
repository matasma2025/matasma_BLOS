---
name: Uploaded PPTX fidelity
description: The Board KPI export must preserve uploaded PowerPoint archives when visual fidelity is required.
---

The Board template upload has two separate responsibilities: extracted text guides analysis, while the original PPTX bytes are required for a faithful export. Rebuilding slides with a new renderer is not equivalent to applying the uploaded template.

**Why:** A prior export stored only extracted slide text and redrew the deck with hard-coded shapes, so the downloaded presentation lost the uploaded theme, geometry, branding, and placeholder composition.

**How to apply:** Retain bounded original PPTX bytes with the Board template settings, replace placeholders in the original slide XML for summary and selected-scope exports, and keep a generated fallback only for legacy Boards that have no retained template bytes.