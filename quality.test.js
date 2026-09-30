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

test("an upstream soft-error page is not a billable product", () => {
  for (const message of [
    "Site Unavailable Unable to access this site.",
    "Access Denied You do not have permission to view this page.",
    "Just a moment Checking your browser before accessing the site.",
  ]) {
    const result = extractReadableText(load(`<main><p>${message}</p></main>`), 30000);
    assert.equal(result.usable, false);
    assert.equal(result.rejectionReason, "SOURCE_ERROR_PAGE");
  }
});

test("nested page blocks are not duplicated", () => {
  const result = extractReadableText(load("<main><section><h1>Guide</h1><div><p>Follow these steps carefully.</p></div></section></main>"), 30000);
  assert.equal(result.text, "Guide\n\nFollow these steps carefully.");
  assert.equal(result.usable, true);
});

test("direct text around nested blocks keeps its order and inline wording", () => {
  const result = extractReadableText(load(`<main><div>Refunds are <strong>available</strong>.
    <p>Keep your receipt.</p>Contact us within thirty days.</div></main>`), 30000);
  assert.equal(result.text, "Refunds are available.\n\nKeep your receipt.\n\nContact us within thirty days.");
  assert.equal(result.usable, true);
});

test("navigation text does not count as a delivered answer", () => {
  const result = extractReadableText(load(`<main><nav><p>Click here to see the return policy.</p></nav><h1>Returns</h1></main>`), 30000);
  assert.equal(result.usable, false);
});

test("Wikipedia article content takes precedence over navigation in main", () => {
  const result = extractReadableText(load(`<main><div>160 languages and navigation</div>
    <div id="mw-content-text"><p>Photosynthesis converts light energy into chemical energy.</p></div></main>`), 30000);
  assert.equal(result.usable, true);
  assert.equal(result.text, "Photosynthesis converts light energy into chemical energy.");
});

test("lists preserve one item per section", () => {
  const result = extractReadableText(load(`<main><h1>Included</h1><ul>
    <li>Priority email support</li><li>Five team members</li></ul></main>`), 30000);
  assert.equal(result.usable, true);
  assert.equal(result.text, "Included\n\nPriority email support\n\nFive team members");
});

test("table cells preserve field and value boundaries", () => {
  const result = extractReadableText(load(`<main><h1>Plan</h1><table><tbody>
    <tr><th>Price</th><td>$19 per month</td></tr>
    <tr><th>Users</th><td>Five included</td></tr></tbody></table></main>`), 30000);
  assert.equal(result.usable, true);
  assert.equal(result.text, "Plan\n\nPrice\n\n$19 per month\n\nUsers\n\nFive included");
});

test("definition lists preserve specification boundaries", () => {
  const result = extractReadableText(load(`<main><h1>Specifications</h1><dl>
    <dt>Battery life</dt><dd>Up to eighteen hours</dd>
    <dt>Weight</dt><dd>Three pounds</dd></dl></main>`), 30000);
  assert.equal(result.usable, true);
  assert.equal(result.text,
    "Specifications\n\nBattery life\n\nUp to eighteen hours\n\nWeight\n\nThree pounds");
});

test("FAQ summaries and answers remain separate", () => {
  const result = extractReadableText(load(`<main><h1>FAQ</h1><details>
    <summary>How long does delivery take?</summary>
    <p>Delivery takes three business days.</p></details></main>`), 30000);
  assert.equal(result.usable, true);
  assert.equal(result.text,
    "FAQ\n\nHow long does delivery take?\n\nDelivery takes three business days.");
});

test("Verify passages do not assert truth when a page contradicts the claim", () => {
  const page = { finalUrl: "https://example.org/price", retrievedAt: new Date().toISOString(),
    title: "Prices", text: "Prices did not increase by 20 percent last year." };
  const result = evidenceFromPage(page, "Prices increased by 20 percent last year");
  assert.match(result.passages[0].passage, /did not increase/);
  assert.equal(Object.hasOwn(result, "verified"), false);
});
