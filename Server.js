const express = require("express");

const app = express();
app.s app.set('trust proxy', 1);
const port = process.env.PORT || 3000;

async function start() {
  const { paymentMiddleware, x402ResourceServer } =
    await import("@x402/express");

  const { ExactEvmScheme } =
    await import("@x402/evm/exact/server");

  const { createCdpFacilitatorClient } =
    await import("@coinbase/cdp-sdk/x402");

  const { createPaywall } =
    await import("@x402/paywall");

  const { evmPaywall } =
    await import("@x402/paywall/evm");

  const payTo = process.env.FRESHFACT_PAY_TO;

  if (!payTo) {
    throw new Error(
      "FRESHFACT_PAY_TO environment variable is missing"
    );
  }

  const facilitator = createCdpFacilitatorClient();

  const resourceServer = new x402ResourceServer(facilitator)
    .register("eip155:8453", new ExactEvmScheme());

  const paywallConfig = {
    appName: "FreshFact",
    testnet: false,
  };

  const paywall = createPaywall()
    .withNetwork(evmPaywall)
    .withConfig(paywallConfig)
    .build();

  const routes = {
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
  };

  app.get("/", (req, res) => {
    res.json({
      message: "FreshFact API is live",
    });
  });

  app.use(
    paymentMiddleware(
      routes,
      resourceServer,
      paywallConfig,
      paywall
    )
  );

  app.get("/api/data", (req, res) => {
    res.json({
      message: "FreshFact paid API access granted",
      data: "FreshFact is working",
    });
  });

  app.listen(port, () => {
    console.log(
      "FreshFact API is running on port " + port
    );
  });
}

start().catch((error) => {
  console.error(
    "FreshFact failed to start:",
    error
  );
  process.exit(1);
});
