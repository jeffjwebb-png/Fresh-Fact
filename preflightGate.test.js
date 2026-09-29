const { test } = require("node:test");
const assert = require("node:assert/strict");
const { PreflightError, createPreflightGate, requestKey } = require("./preflightGate");

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function request(overrides = {}) {
  return { method: "GET", path: "/api/evidence", query: { url: "https://example.com" }, body: {}, ...overrides };
}

test("request keys are stable across object key order and ignore payment headers", () => {
  const first = request({ query: { maxChars: "30000", url: "https://example.com" }, headers: { "payment-signature": "one" } });
  const second = request({ query: { url: "https://example.com", maxChars: "30000" }, headers: { "payment-signature": "two" } });
  assert.equal(requestKey(first), requestKey(second));
});

test("failed preparation stops before payment middleware", async () => {
  const gate = createPreflightGate({
    paidPaths: new Set(["/api/evidence"]),
    prepare: async () => { throw new PreflightError(422, "EMPTY_SOURCE", "No usable result; no payment was requested."); },
  });
  const req = request();
  const res = responseRecorder();
  let continued = false;
  await gate(req, res, () => { continued = true; });
  assert.equal(continued, false);
  assert.equal(res.statusCode, 422);
  assert.deepEqual(res.body, { error: "EMPTY_SOURCE", message: "No usable result; no payment was requested." });
});

test("successful preparation is reused for the paid retry", async () => {
  let preparations = 0;
  const prepared = { service: "FreshFact Evidence", data: { text: "Prepared evidence" } };
  const gate = createPreflightGate({
    paidPaths: new Set(["/api/evidence"]),
    prepare: async () => { preparations += 1; return prepared; },
  });
  const first = request();
  const retry = request({ headers: { "payment-signature": "proof" } });
  await gate(first, responseRecorder(), () => {});
  await gate(retry, responseRecorder(), () => {});
  assert.equal(preparations, 1);
  assert.equal(first.preflightCacheHit, false);
  assert.equal(retry.preflightCacheHit, true);
  assert.equal(retry.preparedResponse, prepared);
});

test("expired preparation is rebuilt before payment", async () => {
  let clock = 1000;
  let preparations = 0;
  const gate = createPreflightGate({
    paidPaths: new Set(["/api/evidence"]), ttlMs: 10, now: () => clock,
    prepare: async () => ({ sequence: ++preparations }),
  });
  const first = request();
  await gate(first, responseRecorder(), () => {});
  clock = 1011;
  const retry = request({ headers: { "payment-signature": "proof" } });
  await gate(retry, responseRecorder(), () => {});
  assert.equal(preparations, 2);
  assert.equal(retry.preparedResponse.sequence, 2);
});

test("failed preparation is never cached", async () => {
  let attempts = 0;
  const gate = createPreflightGate({
    paidPaths: new Set(["/api/evidence"]),
    prepare: async () => {
      attempts += 1;
      if (attempts === 1) throw new PreflightError(502, "SOURCE_UNAVAILABLE", "Try again; no payment was requested.");
      return { ok: true };
    },
  });
  await gate(request(), responseRecorder(), () => {});
  const retry = request();
  await gate(retry, responseRecorder(), () => {});
  assert.equal(attempts, 2);
  assert.deepEqual(retry.preparedResponse, { ok: true });
});

test("concurrency limit rejects excess work before payment", async () => {
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  const gate = createPreflightGate({
    paidPaths: new Set(["/api/evidence"]), maxConcurrent: 1,
    prepare: async () => { await blocked; return { ok: true }; },
  });
  const first = gate(request(), responseRecorder(), () => {});
  await Promise.resolve();
  const res = responseRecorder();
  let continued = false;
  await gate(request({ query: { url: "https://example.org" } }), res, () => { continued = true; });
  assert.equal(continued, false);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error, "PREFLIGHT_BUSY");
  release();
  await first;
});

test("unrelated routes bypass preparation", async () => {
  let preparations = 0;
  const gate = createPreflightGate({ paidPaths: new Set(["/api/evidence"]), prepare: async () => { preparations += 1; } });
  let continued = false;
  await gate(request({ path: "/health" }), responseRecorder(), () => { continued = true; });
  assert.equal(continued, true);
  assert.equal(preparations, 0);
});
