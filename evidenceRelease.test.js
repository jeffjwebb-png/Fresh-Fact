const { test } = require("node:test");
const assert = require("node:assert/strict");
const { evidenceIsEnabled, isPublicEvidenceRequest } = require("./evidenceRelease");

test("public Evidence requires explicit activation; other products stay paused", () => {
  const req = { method: "GET", path: "/api/evidence" };
  for (const flag of [undefined, "", "false", "TRUE", "1"]) {
    const env = { FRESHFACT_EVIDENCE_ENABLED: flag };
    assert.equal(evidenceIsEnabled(env), false);
    assert.equal(isPublicEvidenceRequest(req, env), false);
  }
  const env = { FRESHFACT_EVIDENCE_ENABLED: "true" };
  assert.equal(isPublicEvidenceRequest(req, env), true);
  for (const path of ["/api/verify", "/api/research", "/api/evidence/extra"]) {
    assert.equal(isPublicEvidenceRequest({ ...req, path }, env), false);
  }
  assert.equal(isPublicEvidenceRequest({ ...req, method: "POST" }, env), false);
});
