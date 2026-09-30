const SOURCE_CACHE_HEADERS = Object.freeze({
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
});

function sourceFreshness(headers, retrievedAt = new Date().toISOString()) {
  const rawAge = headers.get("age");
  const age = rawAge === null ? null : Number(rawAge);
  const sourceCacheAgeSeconds = Number.isFinite(age) && age >= 0 ? age : null;
  return {
    retrievedAt,
    etag: headers.get("etag") || null,
    lastModified: headers.get("last-modified") || null,
    ageSeconds: sourceCacheAgeSeconds,
    sourceCacheAgeSeconds,
    cacheRevalidationRequested: true,
    originRevalidation: "not_verified",
    explanation: "retrievedAt records when FreshFact fetched the returned source copy. sourceCacheAgeSeconds is the source's reported HTTP cache age, not retrieval duration or proof of when its facts changed. A source can still return a cached copy despite revalidation headers.",
  };
}

module.exports = { SOURCE_CACHE_HEADERS, sourceFreshness };
