"use strict";
// FreshFactAgent v0: read-only discovery and offer preparation.
// No credentials, purchases, posts, or wallet operations.
const https = require("node:https");
const TARGET = "https://fresh-fact.onrender.com";
function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 12000, headers: { "User-Agent": "FreshFactAgent/0.1" } }, (res) => {
      let body = "";
      res.on("data", chunk => { body += chunk; if (body.length > 100000) req.destroy(new Error("response too large")); });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}
async function main() {
  const url = TARGET + "/api/evidence?url=" + encodeURIComponent("https://en.wikipedia.org/wiki/Kilowatt-hour");
  const result = await get(url);
  const paymentRequired = result.status === 402 && !!result.headers["payment-required"];
  const report = {
    checkedAt: new Date().toISOString(),
    target: TARGET,
    product: "Evidence",
    expectedPrice: "$0.01 USDC on Base",
    unpaidStatus: result.status,
    paymentRequiredHeaderPresent: !!result.headers["payment-required"],
    paywallHealthy: paymentRequired,
    independentBuyerFound: false,
    independentSaleVerified: false,
    nextStep: paymentRequired
      ? "Find a willing independent x402 buyer; require approval before external outreach."
      : "Investigate the payment challenge or product availability before outreach."
  };
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  if (!paymentRequired) process.exitCode = 1;
}
if (require.main === module) main().catch(error => {
  process.stderr.write("FreshFactAgent preflight failed: " + error.message + "\n");
  process.exitCode = 1;
});
module.exports = { get };
