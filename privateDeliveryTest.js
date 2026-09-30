const crypto = require("crypto");

function isPrivateDeliveryTest(req, env = process.env, now = Date.now()) {
  if (req.method !== "GET" || req.path !== "/api/evidence") return false;
  const expected = env.FRESHFACT_DELIVERY_TEST_TOKEN;
  const supplied = req.query?.deliveryTest;
  const expiry = Date.parse(env.FRESHFACT_DELIVERY_TEST_EXPIRES || "");
  if (!expected || expected.length < 32 || typeof supplied !== "string" ||
      !Number.isFinite(expiry) || now >= expiry) return false;
  const first = Buffer.from(expected);
  const second = Buffer.from(supplied);
  return first.length === second.length && crypto.timingSafeEqual(first, second);
}

module.exports = { isPrivateDeliveryTest };
