const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("cheerio");
const { extractReadableText } = require("./readableText");
const { evidenceFromPage } = require("./products");

test("Evidence delivers the answer from a div-based page in reading order", () => {
  const $ = load(`<main><h1>Return policy</h1>
    <div>Returns are accepted within thirty days with a receipt.</div>
    <h2>Exceptions</h2><p>Damaged items are handled separately.</p></main>`);
  const result = extractReadableText($, 30000);
  assert.equal(result.usable, true);
  assert.equal(result.text,
    "Return policy\n\nReturns are accepted within thirty days with a receipt.\n\nExceptions\n\nDamaged items are handled separately.");
  assert.deepEqual(result.sections.map(({ start, end }) => result.text.slice(start, end)), [
    "Return policy", "Returns are accepted within thirty days with a receipt.",
    "Exceptions", "Damaged items are handled separately.",
  ]);
});

test("a heading-only page is not a usable product", () => {
  const result = extractReadableText(load("<main><h1>Return policy</h1></main>"), 30000);
  assert.equal(result.usable, false);
});

test("nested page blocks are not duplicated", () => {
  const result = extractReadableText(load("<main><section><h1>Guide</h1><div><p>Follow these steps carefully.</p></div></section></main>"), 30000);
  assert.equal(result.text, "Guide\n\nFollow these steps carefully.");
  assert.equal(result.usable, true);
});

test("Verify passages do not assert truth when a page contradicts the claim", () => {
  const page = { finalUrl: "https://example.org/price", retrievedAt: new Date().toISOString(),
    title: "Prices", text: "Prices did not increase by 20 percent last year." };
  const result = evidenceFromPage(page, "Prices increased by 20 percent last year");
  assert.match(result.passages[0].passage, /did not increase/);
  assert.equal(Object.hasOwn(result, "verified"), false);
});
