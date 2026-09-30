const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("cheerio");
const { extractReadableText } = require("./readableText");

test("energy conversions keep exponents and chemical subscripts in plain text", () => {
  const $ = load('<main><p>3.6 × 10<sup>13</sup> erg; m<sup>2</sup> s<sup>−2</sup>; H<sub>2</sub>O.<sup class="reference">[1]</sup></p></main>');
  const first = extractReadableText($, 30000);
  assert.equal(first.text, "3.6 × 10^(13) erg; m^(2) s^(−2); H_(2)O.[1]");
  assert.deepEqual(extractReadableText($, 30000), first);
  assert.equal(first.sections[0].end, first.text.length);
});
