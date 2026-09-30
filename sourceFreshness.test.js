const { test } = require("node:test");
const assert = require("node:assert/strict");
const { SOURCE_CACHE_HEADERS, sourceFreshness } = require("./sourceFreshness");

test("retrieval time and upstream cache age remain distinct", () => {
  const result = sourceFreshness(new Headers({ age: "27702", "last-modified": "Tue, 29 Sep 2026 18:58:20 GMT" }), "2026-09-30T04:11:06.117Z");
  assert.equal(result.retrievedAt, "2026-09-30T04:11:06.117Z");
  assert.equal(result.sourceCacheAgeSeconds, 27702);
  assert.equal(result.ageSeconds, 27702);
  assert.equal(result.originRevalidation, "not_verified");
  assert.equal(SOURCE_CACHE_HEADERS["Cache-Control"], "no-cache");
});

test("missing or invalid source age is unknown, never claimed as zero", () => {
  for (const age of [null, "invalid", "-1"]) {
    const headers = new Headers(age === null ? {} : { age });
    assert.equal(sourceFreshness(headers).sourceCacheAgeSeconds, null);
  }
  assert.equal(sourceFreshness(new Headers({ age: "0" })).sourceCacheAgeSeconds, 0);
});
