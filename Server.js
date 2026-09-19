const express = require("express");

const app = express();
const port = process.env.PORT || 3000;

async function start() {
  const { paymentMiddleware, x402ResourceServer } =
    await import("@x402/express");

  const { HTTPFacilitatorClient } =
    await import("@x402/core/server");

  const { ExactEvmScheme } =
    await import("@x402/evm/exact/server");

  const payTo = process.env.FRESHFACT_PAY_TO;

  if (!payTo) {
    throw new Error("FRESHFACT_PAY_TO environment variable is missing");
  }

  const facilitator = new HTTPFacilitatorClient({
    url: "https://api.cdp.coinbase.com/platform/v2/x402",
  });

  const resourceServer = new x402ResourceServer(facilitator)
    .register("eip155:8453", new ExactEvmScheme());

  app.get("/", (req, res) => {
    res.json({ message: "FreshFact API is live" });
  });

  app.use(
    paymentMiddleware(
      {
        "GET /api/data": {
          accepts: {
            scheme: "exact",
            price: "$0.01",
            network: "eip155:8453",
            payTo: payTo,
            maxTimeoutSeconds: 60,
          },
          description: "FreshFact factual data API access",
          mimeType: "application/json",
        },
      },
      resourceServer
    )
  );

  app.get("/api/data", (req, res) => {
    res.json({
      message: "FreshFact paid API access granted",
      data: "FreshFact is working",
    });
  });

  app.listen(port, () => {
    console.log("FreshFact API is running on port " + port);
  });
}

start().catch((error) => {
  console.error("FreshFact failed to start:", error);
  process.exit(1);
});
