const test = require("node:test");
const assert = require("node:assert/strict");
const { buildX402Manifest } = require("./x402Manifest");

const payTo = "0xdc379f04221295e2394FA6B6118b0913a73C5197";
const routes = Object.fromEntries([
  ["GET /api/evidence", "$0.01"],
  ["POST /api/verify", "$0.02"],
  ["POST /api/research", "$0.02"],
].map(([key, price]) => [key, {
  accepts: { scheme: "exact", network: "eip155:8453", payTo, price, maxTimeoutSeconds: 300 },
  extensions: { bazaar: { info: { input: { method: key.split(" ")[0] } } } },
}]));

test("manifest preserves exact six-decimal payment amounts, configured recipient and request methods", () => {
  const result = buildX402Manifest(routes, { evidenceEnabled: true, productsEnabled: true });
  assert.equal(result.x402Version, 2);
  assert.deepEqual(result.resources.map(r => r.accepts[0].amount), ["10000", "20000", "20000"]);
  assert.deepEqual(result.resources.map(r => r.method), ["GET", "POST", "POST"]);
  for (const resource of result.resources) {
    assert.equal(resource.accepts[0].payTo, payTo);
    assert.equal(resource.accepts[0].network, "eip155:8453");
    assert.equal(resource.accepts[0].extra.name, "USD Coin");
    assert.ok(resource.url.startsWith("https://fresh-fact.onrender.com/api/"));
    assert.ok(resource.extensions.bazaar);
  }
});

test("manifest never advertises paused products", () => {
  assert.equal(buildX402Manifest(routes, { evidenceEnabled: false, productsEnabled: true }).resources.length, 0);
  assert.deepEqual(buildX402Manifest(routes, { evidenceEnabled: true, productsEnabled: false }).resources.map(r => r.method), ["GET"]);
});
