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
        "FreshFact live market data API",
      mimeType: "application/json",
    },
  };

  app.get("/", (req, res) => {
    res.json({
      name: "FreshFact",
      status: "live",
      description:
        "Pay-per-request live market data for AI agents",
      price: "$0.01 USDC",
      network: "Base",
      endpoint:
        "/api/data?symbol=BTC-USD",
      instructions:
        "Provide a trading symbol such as BTC-USD or ETH-USD, complete the payment, and receive current market data.",
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
      const suppliedSymbol =
        typeof req.query.symbol === "string"
          ? req.query.symbol.trim().toUpperCase()
          : "BTC-USD";

      if (
        !/^[A-Z0-9]+-[A-Z0-9]+$/.test(
          suppliedSymbol
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid symbol. Use a format such as BTC-USD or ETH-USD.",
          example:
            "/api/data?symbol=BTC-USD",
        });
      }

      const tickerUrl =
        "https://api.exchange.coinbase.com/products/" +
        encodeURIComponent(suppliedSymbol) +
        "/ticker";

      const statsUrl =
        "https://api.exchange.coinbase.com/products/" +
        encodeURIComponent(suppliedSymbol) +
        "/stats";

      const [tickerResponse, statsResponse] =
        await Promise.all([
          fetch(tickerUrl, {
            headers: {
              Accept: "application/json",
              "User-Agent":
                "FreshFact/1.0",
            },
          }),
          fetch(statsUrl, {
            headers: {
              Accept: "application/json",
              "User-Agent":
                "FreshFact/1.0",
            },
          }),
        ]);

      if (!tickerResponse.ok) {
        return res.status(404).json({
          error:
            "Market data unavailable for this symbol.",
          symbol: suppliedSymbol,
        });
      }

      if (!statsResponse.ok) {
        return res.status(502).json({
          error:
            "Market statistics are temporarily unavailable.",
          symbol: suppliedSymbol,
        });
      }

      const ticker =
        await tickerResponse.json();

      const stats =
        await statsResponse.json();

      const bid = Number(ticker.bid);
      const ask = Number(ticker.ask);
      const price = Number(ticker.price);
      const volume24h = Number(stats.volume);
      const high24h = Number(stats.high);
      const low24h = Number(stats.low);
      const open24h = Number(stats.open);

      const spread =
        Number.isFinite(ask) &&
        Number.isFinite(bid)
          ? ask - bid
          : null;

      const spreadPercent =
        Number.isFinite(spread) &&
        Number.isFinite(price) &&
        price !== 0
          ? (spread / price) * 100
          : null;

      const change24h =
        Number.isFinite(price) &&
        Number.isFinite(open24h)
          ? price - open24h
          : null;

      const change24hPercent =
        Number.isFinite(change24h) &&
        Number.isFinite(open24h) &&
        open24h !== 0
          ? (change24h / open24h) * 100
          : null;

      return res.json({
        service: "FreshFact Live Market Snapshot",
        symbol: suppliedSymbol,

        market: {
          price: Number.isFinite(price)
            ? price
            : null,

          bid: Number.isFinite(bid)
            ? bid
            : null,

          ask: Number.isFinite(ask)
            ? ask
            : null,

          spread: Number.isFinite(spread)
            ? spread
            : null,

          spreadPercent:
            Number.isFinite(spreadPercent)
              ? Number(
                  spreadPercent.toFixed(6)
                )
              : null,

          open24h:
            Number.isFinite(open24h)
              ? open24h
              : null,

          high24h:
            Number.isFinite(high24h)
              ? high24h
              : null,

          low24h:
            Number.isFinite(low24h)
              ? low24h
              : null,

          volume24h:
            Number.isFinite(volume24h)
              ? volume24h
              : null,

          change24h:
            Number.isFinite(change24h)
              ? change24h
              : null,

          change24hPercent:
            Number.isFinite(
              change24hPercent
            )
              ? Number(
                  change24hPercent.toFixed(6)
                )
              : null,
        },

        latestTrade: {
          tradeId:
            ticker.trade_id || null,

          size:
            ticker.size || null,

          time:
            ticker.time || null,
        },

        source: {
          name: "Coinbase Exchange",
          tickerUrl: tickerUrl,
          statsUrl: statsUrl,
        },

        retrievedAt:
          new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "FreshFact data error:",
        error
      );

      return res.status(502).json({
        error:
          "FreshFact could not retrieve live market data.",
        message: error.message,
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
