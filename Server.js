const express = require("express");

const app = express();
app.set("trust proxy", 1);

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
    .register(
      "eip155:8453",
      new ExactEvmScheme()
    );

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
        maxTimeoutSeconds: 300,
      },
      description:
        "FreshFact sourced factual data API access",
      mimeType: "application/json",
    },
  };

  app.get("/", (req, res) => {
    res.json({
      name: "FreshFact",
      status: "live",
      description:
        "Pay-per-request sourced factual data API",
      price: "$0.01 USDC",
      network: "Base",
      endpoint: "/api/data?topic=solar+energy",
      instructions:
        "Add a topic to the URL, complete the payment, and receive sourced factual data.",
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

  app.get("/api/data", async (req, res) => {
    try {
      const suppliedTopic =
        typeof req.query.topic === "string"
          ? req.query.topic.trim()
          : "";

      const topic = suppliedTopic
        ? suppliedTopic.slice(0, 200)
        : "artificial intelligence";

      const params = new URLSearchParams({
        action: "query",
        generator: "search",
        gsrsearch: topic,
        gsrlimit: "1",
        prop: "extracts|info",
        exintro: "1",
        explaintext: "1",
        exsentences: "5",
        inprop: "url",
        format: "json",
        formatversion: "2",
      });

      const sourceUrl =
        "https://en.wikipedia.org/w/api.php?" +
        params.toString();

      const response = await fetch(sourceUrl, {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "FreshFact/1.0 (factual data API)",
        },
      });

      if (!response.ok) {
        throw new Error(
          "Data source returned status " +
            response.status
        );
      }

      const result = await response.json();
      const page = result?.query?.pages?.[0];

      if (!page || page.missing) {
        return res.status(404).json({
          message: "No factual data found",
          query: topic,
        });
      }

      return res.json({
        message:
          "FreshFact paid API access granted",
        query: topic,
        data: {
          title: page.title,
          summary: page.extract,
          source: "Wikipedia",
          sourceUrl: page.fullurl,
          retrievedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error(
        "FreshFact data error:",
        error
      );

      return res.status(502).json({
        message:
          "FreshFact could not retrieve data",
        error: error.message,
      });
    }
  });

  app.listen(port, () => {
    console.log(
      "FreshFact API is running on port " +
        port
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
