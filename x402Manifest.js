const { SITE_URL } = require("./siteMetadata");
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

function buildX402Manifest(routes, { evidenceEnabled, productsEnabled }) {
  return {
    x402Version: 2,
    name: "FreshFact",
    description: "Web evidence receipts and source passages with retrieval timestamps and content hashes.",
    homepage: SITE_URL + "/",
    documentationUrl: SITE_URL + "/openapi.json",
    resources: Object.entries(routes)
      .filter(([key]) => evidenceEnabled && (key === "GET /api/evidence" || productsEnabled))
      .map(([key, route]) => {
        const [method, pathname] = key.split(" ");
        const price = /^\$(\d+)(?:\.(\d{1,6}))?$/.exec(route.accepts.price);
        if (!price) throw new Error("Manifest requires an exact USD price with at most six decimals");
        const amount = (BigInt(price[1]) * 1000000n + BigInt((price[2] || "").padEnd(6, "0"))).toString();
        return {
          url: SITE_URL + pathname,
          method,
          name: route.serviceName,
          description: route.description,
          mimeType: route.mimeType,
          tags: route.tags,
          accepts: [{
            scheme: route.accepts.scheme,
            network: route.accepts.network,
            payTo: route.accepts.payTo,
            asset: BASE_USDC,
            amount,
            maxTimeoutSeconds: route.accepts.maxTimeoutSeconds,
            extra: { name: "USD Coin", version: "2" },
          }],
          extensions: route.extensions,
        };
      }),
  };
}

module.exports = { buildX402Manifest };
