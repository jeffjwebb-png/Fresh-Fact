const { test } = require("node:test");
const assert = require("node:assert/strict");
const { isPrivateDeliveryTest } = require("./privateDeliveryTest");

const token = "a".repeat(64);
const env = { FRESHFACT_DELIVERY_TEST_TOKEN: token, FRESHFACT_DELIVERY_TEST_EXPIRES: "2030-01-01T00:00:00Z" };
const request = { method: "GET", path: "/api/evidence", query: { deliveryTest: token } };

test("only the private evidence GET is allowed during its configured window", () => {
  assert.equal(isPrivateDeliveryTest(request, env, 0), true);
  for (const bad of [
    { ...request, method: "POST" },
    { ...request, path: "/api/verify" },
    { ...request, path: "/api/research" },
    { ...request, query: {} },
    { ...request, query: { deliveryTest: "b".repeat(64) } },
    { ...request, query: { deliveryTest: [token, token] } },
  ]) assert.equal(isPrivateDeliveryTest(bad, env, 0), false);
});

test("missing configuration, short tokens, and expired access fail closed", () => {
  assert.equal(isPrivateDeliveryTest(request, {}, 0), false);
  assert.equal(isPrivateDeliveryTest(request, { ...env, FRESHFACT_DELIVERY_TEST_TOKEN: "short" }, 0), false);
  assert.equal(isPrivateDeliveryTest(request, { ...env, FRESHFACT_DELIVERY_TEST_EXPIRES: "invalid" }, 0), false);
  assert.equal(isPrivateDeliveryTest(request, env, Date.parse(env.FRESHFACT_DELIVERY_TEST_EXPIRES)), false);
});
