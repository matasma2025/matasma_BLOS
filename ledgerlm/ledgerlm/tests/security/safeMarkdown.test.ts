import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedApplicationLink } from "../../client/src/components/SafeMarkdown";

test("allows local application paths and anchors", () => {
  assert.equal(isAllowedApplicationLink("/dashboard"), true);
  assert.equal(isAllowedApplicationLink("/chat/abc?tab=files"), true);
  assert.equal(isAllowedApplicationLink("#summary"), true);
});

test("blocks external, protocol-relative, and executable links", () => {
  assert.equal(isAllowedApplicationLink("https://example.com/report"), false);
  assert.equal(isAllowedApplicationLink("//example.com/report"), false);
  assert.equal(isAllowedApplicationLink("javascript:alert(1)"), false);
  assert.equal(isAllowedApplicationLink("data:text/html,<script>"), false);
  assert.equal(isAllowedApplicationLink("mailto:test@example.com"), false);
});