const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { buildCheckoutPage, sendCheckoutPage, quoteMatchesExpected, BASE_CHAIN_ID, BASE_USDC, EVIDENCE_AMOUNT } = require("./checkoutPage");

const payTo = "0xdc379f04221295e2394FA6B6118b0913a73C5197";

test("checkout is dependency-free, Base-only, and pins the exact Evidence price and recipient", () => {
  const html = buildCheckoutPage({ payTo, nonce: "test-nonce-123456" });
  assert.match(html, /eth_signTypedData_v4/);
  assert.match(html, /wallet_switchEthereumChain/);
  assert.match(html, /PAYMENT-SIGNATURE/);
  assert.match(html, new RegExp(String(BASE_CHAIN_ID)));
  assert.match(html, new RegExp(BASE_USDC.slice(2), "i"));
  assert.match(html, new RegExp(EVIDENCE_AMOUNT));
  assert.match(html, new RegExp(payTo.slice(2), "i"));
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.doesNotMatch(html, /type=["']password["']/i);
  assert.match(html, /No seed phrase or private key is requested/i);
});

test("checkout rejects unsafe server interpolation values", () => {
  assert.throws(() => buildCheckoutPage({ payTo: "<script>alert(1)</script>", nonce: "test-nonce-123456" }), /recipient/);
  assert.throws(() => buildCheckoutPage({ payTo, nonce: "short" }), /nonce/);
});

test("generated checkout browser script is valid JavaScript", () => {
  const html = buildCheckoutPage({ payTo, nonce: "test-nonce-123456" });
  const script = html.match(/<script[^>]*>([\s\S]*)<\/script>/)?.[1];
  assert.ok(script);
  assert.doesNotThrow(() => new Function(script));
});

test("checkout signs a fresh authorization before sending the paid retry", () => {
  const html = buildCheckoutPage({ payTo, nonce: "test-nonce-123456" });
  const signaturePosition = html.indexOf("eth_signTypedData_v4");
  const retryPosition = html.indexOf('"PAYMENT-SIGNATURE": encodeBase64Json');
  assert.ok(signaturePosition > 0);
  assert.ok(retryPosition > signaturePosition);
  assert.match(html, /crypto\.getRandomValues\(new Uint8Array\(32\)\)/);
  assert.match(html, /paymentRequired\.extensions \|\| \{\}/);
  assert.match(html, /authorizationSigned = true/);
  assert.match(html, /if \(authorizationSigned\)[\s\S]*Do not pay again[\s\S]*return;/);
  assert.match(html, /if \(!settlement\) throw new Error\("FreshFact delivered a response without a settlement receipt\."\)/);
});

test("checkout accepts only the exact FreshFact Base USDC quote", () => {
  const expected = {
    chainId: BASE_CHAIN_ID,
    asset: BASE_USDC.toLowerCase(),
    amount: EVIDENCE_AMOUNT,
    payTo: payTo.toLowerCase(),
  };
  const quote = {
    scheme: "exact",
    network: "eip155:8453",
    amount: "10000",
    asset: BASE_USDC,
    payTo,
    maxTimeoutSeconds: 300,
    extra: { name: "USD Coin", version: "2" },
  };
  assert.equal(quoteMatchesExpected(quote, expected), true);
  for (const mutation of [
    { amount: "100000" },
    { network: "eip155:1" },
    { asset: "0x0000000000000000000000000000000000000000" },
    { payTo: "0x0000000000000000000000000000000000000000" },
    { maxTimeoutSeconds: 3600 },
    { extra: { name: "Fake Coin", version: "2" } },
    { extra: { name: "USD Coin", version: "2", assetTransferMethod: "permit2" } },
  ]) assert.equal(quoteMatchesExpected({ ...quote, ...mutation }, expected), false);
});

test("checkout response is non-cacheable and allows only its nonce-scoped local code", () => {
  const response = {
    statusCode: 200,
    headers: {},
    body: "",
    status(code) { this.statusCode = code; return this; },
    set(headers) { Object.assign(this.headers, headers); return this; },
    type(value) { this.headers["Content-Type"] = value; return this; },
    send(value) { this.body = value; return this; },
  };
  sendCheckoutPage(response, { payTo, evidenceEnabled: true, nonce: "fixed-test-nonce-123" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["Cache-Control"], "private, no-store");
  assert.equal(response.headers["X-Frame-Options"], "DENY");
  assert.match(response.headers["Content-Security-Policy"], /default-src 'none'/);
  assert.match(response.headers["Content-Security-Policy"], /script-src 'nonce-fixed-test-nonce-123'/);
  assert.doesNotMatch(response.headers["Content-Security-Policy"], /unsafe-inline|https?:/);
  assert.match(response.body, /<script nonce="fixed-test-nonce-123">/);
});

test("checkout fails closed while Evidence purchases are paused", () => {
  const response = {
    statusCode: 200,
    typeValue: "",
    body: "",
    status(code) { this.statusCode = code; return this; },
    type(value) { this.typeValue = value; return this; },
    send(value) { this.body = value; return this; },
  };
  sendCheckoutPage(response, { payTo, evidenceEnabled: false, nonce: "fixed-test-nonce-123" });
  assert.equal(response.statusCode, 503);
  assert.equal(response.typeValue, "text/plain");
  assert.doesNotMatch(response.body, /Connect wallet/);
});

test("browser flow signs the pinned one-cent terms and sends the x402 retry", async () => {
  const html = buildCheckoutPage({ payTo, nonce: "fixed-test-nonce-123" });
  const script = html.match(/<script[^>]*>([\s\S]*)<\/script>/)?.[1];
  const account = "0x1111111111111111111111111111111111111111";
  const quote = {
    x402Version: 2,
    resource: { url: "https://fresh-fact.onrender.com/api/evidence?url=https%3A%2F%2Fexample.com", description: "Evidence", mimeType: "application/json" },
    accepts: [{
      scheme: "exact",
      network: "eip155:8453",
      amount: "10000",
      asset: BASE_USDC,
      payTo,
      maxTimeoutSeconds: 300,
      extra: { name: "USD Coin", version: "2" },
    }],
    extensions: { bazaar: { info: { input: { type: "http" } } } },
  };
  const quoteHeader = Buffer.from(JSON.stringify(quote), "utf8").toString("base64");
  const elements = Object.fromEntries(["source", "connect", "pay", "status", "result"].map(id => [id, {
    id,
    value: id === "source" ? "https://example.com" : "",
    textContent: "",
    className: "",
    disabled: id === "pay",
    style: {},
    listeners: {},
    addEventListener(name, handler) { this.listeners[name] = handler; },
  }]));
  const fetchCalls = [];
  const rpcCalls = [];
  const fetch = async (url, options = {}) => {
    fetchCalls.push({ url, options });
    if (fetchCalls.length < 3) {
      return { status: 402, ok: false, headers: { get: name => name.toLowerCase() === "payment-required" ? quoteHeader : null } };
    }
    return {
      status: 200,
      ok: true,
      headers: { get: name => name.toLowerCase() === "payment-response" ? "settlement-receipt" : null },
      json: async () => ({ receipt: { receiptId: "ffr_test" }, data: { text: "evidence" } }),
    };
  };
  const ethereum = {
    async request(request) {
      rpcCalls.push(request);
      if (request.method === "eth_chainId") return "0x2105";
      if (request.method === "eth_requestAccounts") return [account];
      if (request.method === "eth_signTypedData_v4") return `0x${"11".repeat(65)}`;
      throw new Error(`Unexpected wallet method ${request.method}`);
    },
  };
  const context = vm.createContext({
    window: { ethereum },
    document: { getElementById: id => elements[id] },
    fetch,
    crypto: { getRandomValues: array => { array.fill(7); return array; } },
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    Array,
    JSON,
    Math,
    Date,
    String,
    Error,
    atob,
    btoa,
  });
  vm.runInContext(script, context);
  await new Promise(resolve => setImmediate(resolve));
  await elements.connect.listeners.click();
  await elements.pay.listeners.click();

  const signCall = rpcCalls.find(call => call.method === "eth_signTypedData_v4");
  assert.ok(signCall);
  const typedData = JSON.parse(signCall.params[1]);
  assert.equal(typedData.domain.chainId, 8453);
  assert.equal(typedData.domain.verifyingContract.toLowerCase(), BASE_USDC.toLowerCase());
  assert.equal(typedData.message.to.toLowerCase(), payTo.toLowerCase());
  assert.equal(typedData.message.value, "10000");

  assert.equal(fetchCalls.length, 3);
  const header = fetchCalls[2].options.headers["PAYMENT-SIGNATURE"];
  const payload = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  assert.equal(payload.x402Version, 2);
  assert.equal(payload.accepted.amount, "10000");
  assert.equal(payload.payload.authorization.from, account);
  assert.equal(payload.payload.authorization.to.toLowerCase(), payTo.toLowerCase());
  assert.equal(payload.extensions.bazaar.info.input.type, "http");
  assert.equal(elements.status.textContent, "Payment settled and Evidence Receipt delivered.");
  assert.match(elements.result.textContent, /settlement-receipt/);
});

test("an ambiguous failure after signing never enables a second authorization", async () => {
  const html = buildCheckoutPage({ payTo, nonce: "fixed-test-nonce-123" });
  const script = html.match(/<script[^>]*>([\s\S]*)<\/script>/)?.[1];
  const quote = {
    x402Version: 2,
    resource: { url: "https://fresh-fact.onrender.com/api/evidence?url=https%3A%2F%2Fexample.com", description: "Evidence", mimeType: "application/json" },
    accepts: [{ scheme: "exact", network: "eip155:8453", amount: "10000", asset: BASE_USDC, payTo, maxTimeoutSeconds: 300, extra: { name: "USD Coin", version: "2" } }],
    extensions: {},
  };
  const quoteHeader = Buffer.from(JSON.stringify(quote), "utf8").toString("base64");
  const elements = Object.fromEntries(["source", "connect", "pay", "status", "result"].map(id => [id, {
    value: id === "source" ? "https://example.com" : "",
    textContent: "",
    className: "",
    disabled: id === "pay",
    style: {},
    listeners: {},
    addEventListener(name, handler) { this.listeners[name] = handler; },
  }]));
  let fetchCount = 0;
  const fetch = async () => {
    fetchCount += 1;
    if (fetchCount < 3) return { status: 402, ok: false, headers: { get: name => name.toLowerCase() === "payment-required" ? quoteHeader : null } };
    throw new Error("response lost after request was sent");
  };
  const ethereum = { request: async request => {
    if (request.method === "eth_chainId") return "0x2105";
    if (request.method === "eth_requestAccounts") return ["0x1111111111111111111111111111111111111111"];
    if (request.method === "eth_signTypedData_v4") return `0x${"11".repeat(65)}`;
    throw new Error(`Unexpected wallet method ${request.method}`);
  } };
  vm.runInContext(script, vm.createContext({
    window: { ethereum },
    document: { getElementById: id => elements[id] },
    fetch,
    crypto: { getRandomValues: array => { array.fill(7); return array; } },
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    Array,
    JSON,
    Math,
    Date,
    String,
    Error,
    atob,
    btoa,
  }));
  await new Promise(resolve => setImmediate(resolve));
  await elements.connect.listeners.click();
  await elements.pay.listeners.click();

  assert.equal(fetchCount, 3);
  assert.equal(elements.pay.disabled, true);
  assert.match(elements.status.textContent, /Do not pay again/);
});
