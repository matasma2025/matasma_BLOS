---
name: Terms acceptance versioning
description: Compliance rule for changing LedgerLM Terms and Conditions after database-backed acceptance was introduced.
---

Any material change to the LedgerLM Terms and Conditions must increment the current terms version. Acceptance is per user and per version; never edit the legal text materially while leaving the version unchanged.

**Why:** The stored acceptance date is evidence that a user accepted a specific revision. Reusing a version after changing its content would make that record ambiguous and would prevent returning users from being asked to accept the revised terms.

**How to apply:** When legal text changes materially, update the shared terms version and effective date together. Existing acceptance records remain historical, and users must accept the new version once.