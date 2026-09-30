const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { serializeDelivery } = require("./deliveryJson");

test("browser blob JSON preserves symbols, non-Latin text, offsets, and the content hash", () => {
  const text = "kW⋅h × 10⁻³ ≈ 3.6 MJ; µW; 中文; ⚡; \"quoted\"\nnext line";
  const contentHash = crypto.createHash("sha256").update(text, "utf8").digest("hex");
  const original = { data: { text, sections: [{ start: 0, end: text.length }] }, integrity: { contentHash } };
  const transport = serializeDelivery(original);
  assert.match(transport, /^[\x00-\x7f]*$/);
  const displayed = Buffer.from(transport, "utf8").toString("latin1");
  const parsed = JSON.parse(displayed);
  assert.deepEqual(parsed, original);
  assert.equal(crypto.createHash("sha256").update(parsed.data.text, "utf8").digest("hex"), contentHash);
  assert.equal(parsed.data.sections[0].end, parsed.data.text.length);
});
