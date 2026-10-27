// Run via: npm run test:safe
import assert from "node:assert/strict";
import { safeHttpUrl, safeInternalPath, cleanIncidents } from "../.test-build/safe.mjs";

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log("pass:", name);
}

check("http and https links are kept", () => {
  assert.equal(safeHttpUrl("https://example.com/a?b=1"), "https://example.com/a?b=1");
  assert.equal(safeHttpUrl("http://example.com/"), "http://example.com/");
});

check("script and data schemes are rejected", () => {
  for (const bad of [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "//evil.com",
    "",
    "not a url",
  ]) {
    assert.equal(safeHttpUrl(bad), null, bad);
  }
});

check("links with embedded credentials or huge length are rejected", () => {
  assert.equal(safeHttpUrl("https://user:pass@example.com/"), null);
  assert.equal(safeHttpUrl("https://example.com/" + "a".repeat(3000)), null);
  assert.equal(safeHttpUrl(undefined), null);
  assert.equal(safeHttpUrl(42), null);
});

check("redirect target stays on the site", () => {
  assert.equal(safeInternalPath("/preferences"), "/preferences");
  assert.equal(safeInternalPath("/preferences?tab=1#x"), "/preferences?tab=1#x");
  assert.equal(safeInternalPath(null), "/preferences");
  assert.equal(safeInternalPath(undefined, "/"), "/");
});

check("open-redirect tricks fall back", () => {
  for (const bad of [
    "@evil.com",
    ".evil.com",
    "//evil.com",
    "/\\evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "/\r\nSet-Cookie: x=1",
    "evil.com",
  ]) {
    assert.equal(safeInternalPath(bad), "/preferences", JSON.stringify(bad));
  }
});

check("cleanIncidents drops unsafe links and keeps the rest", () => {
  const base = { title: "t", source: "s", category: "cyber", severity: "high", publishedAt: "2026-01-01T00:00:00Z" };
  const out = cleanIncidents([
    { ...base, id: "1", url: "https://ok.example/a" },
    { ...base, id: "2", url: "javascript:alert(1)" },
    { ...base, id: "3", url: "  https://ok.example/b  " },
  ]);
  assert.deepEqual(out.map((i) => i.id), ["1", "3"]);
  assert.equal(out[1].url, "https://ok.example/b");
});

console.log(`\nAll ${passed} checks passed.`);
