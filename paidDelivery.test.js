const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { paymentMiddlewareFromHTTPServer } = require("@x402/express");

// This exercises the installed middleware's response buffering with a stub
// facilitator boundary. It does not claim to perform an on-chain payment.
test("actual x402 middleware withholds output until successful settlement", async (t) => {
  for (const mode of ["unpaid", "invalid", "failed-settlement", "paid"]) {
    await t.test(mode, async () => {
      let delivered = 0;
      let settled = false;
      const server = {
        routes: {},
        requiresPayment: () => true,
        processHTTPRequest: async () => mode === "unpaid" || mode === "invalid"
          ? { type: "payment-error", response: { status: 402, headers: {}, body: { error: "PAYMENT_REQUIRED" } } }
          : { type: "payment-verified", paymentPayload: {}, paymentRequirements: {}, declaredExtensions: {}, cancellationDispatcher: {} },
        processSettlement: async () => {
          settled = true;
          return mode === "paid"
            ? { success: true, headers: { "PAYMENT-RESPONSE": "stub-settlement-receipt" } }
            : { success: false, response: { status: 402, headers: {}, body: { error: "SETTLEMENT_FAILED" } } };
        },
      };
      const app = express();
      app.use(paymentMiddlewareFromHTTPServer(server, undefined, undefined, false));
      app.get("/api/evidence", (req, res) => {
        delivered += 1;
        assert.equal(settled, false);
        res.json({ service: "FreshFact Evidence", data: { text: "private product content" } });
      });
      const listener = app.listen(0, "127.0.0.1");
      await new Promise((resolve) => listener.once("listening", resolve));
      try {
        const response = await fetch(`http://127.0.0.1:${listener.address().port}/api/evidence`);
        const body = await response.json();
        if (mode === "paid") {
          assert.equal(response.status, 200);
          assert.equal(settled, true);
          assert.equal(body.data.text, "private product content");
          assert.equal(response.headers.get("payment-response"), "stub-settlement-receipt");
        } else {
          assert.equal(response.status, 402);
          assert.equal(body.data, undefined);
          assert.equal(JSON.stringify(body).includes("private product content"), false);
          assert.equal(delivered, mode === "failed-settlement" ? 1 : 0);
        }
      } finally {
        await new Promise((resolve) => listener.close(resolve));
      }
    });
  }
});
