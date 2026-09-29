---
name: PowerPoint native-table compatibility
description: Microsoft PowerPoint compatibility findings for Entity P&L exports
---

For standalone Entity P&L exports generated with PptxGenJS, avoid native PowerPoint tables; render grids with standard text boxes and rectangle shapes.

**Why:** The native-table control failed in Microsoft PowerPoint, including with ASCII-only content, while a Unicode text-only control opened. ZIP/XML validation, python-pptx parsing, and LibreOffice acceptance were not sufficient to establish PowerPoint compatibility.

**How to apply:** Keep a regression assertion that Entity P&L slides contain no native table element, preserve visible cell text and borders, and use Microsoft PowerPoint to confirm compatibility when this export path changes.