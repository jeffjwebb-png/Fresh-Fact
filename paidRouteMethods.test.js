const { test } = require("node:test");
const assert = require("node:assert/strict");
const { methodRequirement, methodIsAllowed } = require("./paidRouteMethods");

test("paid routes accept only their documented HTTP methods", () => {
  assert.equal(methodRequirement("/api/evidence"), "GET");
  assert.equal(methodRequirement("/api/verify"), "POST");
  assert.equal(methodRequirement("/api/research"), "POST");
  assert.equal(methodRequirement("/health"), null);

  assert.equal(methodIsAllowed({ path: "/api/evidence", method: "GET" }), true);
  assert.equal(methodIsAllowed({ path: "/api/evidence", method: "POST" }), false);
  assert.equal(methodIsAllowed({ path: "/api/verify", method: "GET" }), false);
  assert.equal(methodIsAllowed({ path: "/api/verify", method: "POST" }), true);
  assert.equal(methodIsAllowed({ path: "/api/research", method: "OPTIONS" }), true);
});
