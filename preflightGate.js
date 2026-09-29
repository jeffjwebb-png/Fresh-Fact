const crypto = require("crypto");

class PreflightError extends Error {
  constructor(statusCode, code, message, details = {}) {
    super(code);
    this.name = "PreflightError";
    this.statusCode = statusCode;
    this.code = code;
    this.publicMessage = message;
    this.details = details;
  }
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort()
      .map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function requestKey(req) {
  const input = JSON.stringify(stableValue({
    method: req.method,
    path: req.path,
    query: req.query || {},
    body: req.body || {},
  }));
  return crypto.createHash("sha256").update(input).digest("hex");
}

function createPreflightGate({
  paidPaths,
  prepare,
  ttlMs = 330000,
  maxEntries = 100,
  maxConcurrent = 4,
  now = Date.now,
}) {
  const cache = new Map();
  const inFlight = new Map();

  function prune(timestamp) {
    for (const [key, entry] of cache) {
      if (entry.expiresAt <= timestamp) cache.delete(key);
    }
    while (cache.size > maxEntries) {
      cache.delete(cache.keys().next().value);
    }
  }

  return async function preflightGate(req, res, next) {
    if (!paidPaths.has(req.path)) return next();

    const key = requestKey(req);
    const timestamp = now();
    prune(timestamp);
    const cached = cache.get(key);
    if (cached) {
      req.preparedResponse = cached.response;
      req.preflightCacheHit = true;
      return next();
    }

    let preparation = inFlight.get(key);
    if (!preparation) {
      if (inFlight.size >= maxConcurrent) {
        return res.status(503).json({
          error: "PREFLIGHT_BUSY",
          message: "FreshFact is validating other sources. Retry shortly; no payment was requested.",
        });
      }
      preparation = Promise.resolve().then(() => prepare(req));
      inFlight.set(key, preparation);
    }

    try {
      const response = await preparation;
      cache.set(key, { response, expiresAt: now() + ttlMs });
      prune(now());
      req.preparedResponse = response;
      req.preflightCacheHit = false;
      return next();
    } catch (error) {
      const known = error instanceof PreflightError;
      return res.status(known ? error.statusCode : 502).json({
        error: known ? error.code : "PREFLIGHT_FAILED",
        message: known ? error.publicMessage : "FreshFact could not prepare a deliverable result. No payment was requested.",
        ...(known ? error.details : {}),
      });
    } finally {
      if (inFlight.get(key) === preparation) inFlight.delete(key);
    }
  };
}

module.exports = { PreflightError, createPreflightGate, requestKey };
