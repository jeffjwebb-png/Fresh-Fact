const crypto = require("crypto");

const BASE_CHAIN_ID = 8453;
const BASE_CHAIN_HEX = "0x2105";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const EVIDENCE_AMOUNT = "10000";

function quoteMatchesExpected(option, expected) {
  return option?.scheme === "exact" &&
    option?.network === `eip155:${expected.chainId}` &&
    option?.amount === expected.amount &&
    String(option?.asset).toLowerCase() === expected.asset &&
    String(option?.payTo).toLowerCase() === expected.payTo &&
    option?.maxTimeoutSeconds === 300 &&
    option?.extra?.name === "USD Coin" &&
    option?.extra?.version === "2" &&
    (option?.extra?.assetTransferMethod === undefined || option.extra.assetTransferMethod === "eip3009");
}

function buildCheckoutPage({ payTo, nonce }) {
  if (!/^0x[0-9a-f]{40}$/i.test(payTo)) throw new Error("Invalid checkout recipient");
  if (typeof nonce !== "string" || nonce.length < 16) throw new Error("Invalid checkout nonce");

  const config = JSON.stringify({
    chainId: BASE_CHAIN_ID,
    chainHex: BASE_CHAIN_HEX,
    asset: BASE_USDC.toLowerCase(),
    amount: EVIDENCE_AMOUNT,
    payTo: payTo.toLowerCase(),
  }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>FreshFact Evidence Checkout</title>
  <meta name="description" content="Secure Base USDC checkout for a FreshFact Evidence Receipt.">
  <style nonce="${nonce}">
    :root{color-scheme:light dark;font-family:system-ui,-apple-system,sans-serif}
    body{max-width:720px;margin:0 auto;padding:36px 20px;line-height:1.5}
    main{border:1px solid #8886;border-radius:16px;padding:24px}
    label{display:block;font-weight:650;margin:18px 0 6px}
    input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #8888;border-radius:8px;font:inherit}
    button{margin:14px 8px 0 0;padding:12px 16px;border:0;border-radius:9px;font:inherit;font-weight:700;cursor:pointer}
    button:disabled{cursor:not-allowed;opacity:.5}
    .primary{background:#155eef;color:#fff}.secondary{background:#7772}
    .facts{display:grid;grid-template-columns:max-content 1fr;gap:6px 14px;margin:18px 0}
    .facts dt{font-weight:700}.facts dd{margin:0;overflow-wrap:anywhere}
    #status{min-height:1.5em;font-weight:650}#status.error{color:#c62828}#status.ok{color:#16813b}
    pre{display:none;white-space:pre-wrap;overflow-wrap:anywhere;background:#7771;border-radius:8px;padding:12px;max-height:320px;overflow:auto}
    .fine{font-size:.9rem;color:#777}
  </style>
</head>
<body>
<main>
  <h1>FreshFact Evidence Receipt</h1>
  <p>Purchase one audit-ready evidence receipt with USDC on Base. FreshFact never receives or stores your wallet key.</p>
  <dl class="facts">
    <dt>Price</dt><dd>$0.01 USDC</dd>
    <dt>Network</dt><dd>Base mainnet</dd>
    <dt>Product</dt><dd>Evidence Receipt</dd>
  </dl>
  <label for="source">Public source URL</label>
  <input id="source" type="url" inputmode="url" value="https://example.com" autocomplete="off" spellcheck="false">
  <button id="connect" class="secondary" type="button">Connect wallet</button>
  <button id="pay" class="primary" type="button" disabled>Pay $0.01 and retrieve</button>
  <p id="status" role="status" aria-live="polite">Preparing a live payment quote…</p>
  <pre id="result"></pre>
  <p class="fine">Your wallet will ask you to sign a USDC authorization for exactly 10,000 atomic units ($0.01), payable only to FreshFact. No seed phrase or private key is requested.</p>
</main>
<script nonce="${nonce}">
${quoteMatchesExpected.toString()}
(() => {
  "use strict";
  const expected = ${config};
  const source = document.getElementById("source");
  const connectButton = document.getElementById("connect");
  const payButton = document.getElementById("pay");
  const status = document.getElementById("status");
  const result = document.getElementById("result");
  let account = null;
  let authorizationSigned = false;

  function setStatus(message, kind = "") {
    status.textContent = message;
    status.className = kind;
  }

  function decodeBase64Json(value) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function encodeBase64Json(value) {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    }
    return btoa(binary);
  }

  function endpointFor(url) {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("Use a public HTTP or HTTPS URL.");
    }
    return "/api/evidence?" + new URLSearchParams({ url: parsed.href }).toString();
  }

  function validateQuote(paymentRequired) {
    if (paymentRequired?.x402Version !== 2 || !Array.isArray(paymentRequired.accepts)) {
      throw new Error("FreshFact returned an invalid x402 quote.");
    }
    const accepted = paymentRequired.accepts.find(option => quoteMatchesExpected(option, expected));
    if (!accepted) throw new Error("The live payment quote does not match the displayed price, network, token, and recipient.");
    return accepted;
  }

  async function getQuote(endpoint) {
    const response = await fetch(endpoint, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (response.status !== 402) throw new Error("Expected a payment quote but received HTTP " + response.status + ".");
    const header = response.headers.get("PAYMENT-REQUIRED");
    if (!header) throw new Error("The payment quote header is missing.");
    const paymentRequired = decodeBase64Json(header);
    const accepted = validateQuote(paymentRequired);
    return { paymentRequired, accepted };
  }

  async function ensureBase() {
    const current = await window.ethereum.request({ method: "eth_chainId" });
    if (String(current).toLowerCase() === expected.chainHex) return;
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: expected.chainHex }] });
    const switched = await window.ethereum.request({ method: "eth_chainId" });
    if (String(switched).toLowerCase() !== expected.chainHex) throw new Error("Wallet did not switch to Base mainnet.");
  }

  async function connectWallet() {
    if (!window.ethereum?.request) {
      throw new Error("Open this checkout in a wallet browser that supports Base, such as Coinbase Wallet.");
    }
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (!Array.isArray(accounts) || !/^0x[0-9a-f]{40}$/i.test(accounts[0] || "")) {
      throw new Error("No compatible wallet account was returned.");
    }
    await ensureBase();
    account = accounts[0];
    connectButton.textContent = "Wallet connected";
    payButton.disabled = false;
    setStatus("Ready. Your wallet will show the exact one-cent authorization before anything is signed.", "ok");
  }

  async function pay() {
    if (!account) throw new Error("Connect a wallet first.");
    authorizationSigned = false;
    await ensureBase();
    const endpoint = endpointFor(source.value.trim());
    const { paymentRequired, accepted } = await getQuote(endpoint);
    const now = Math.floor(Date.now() / 1000);
    const nonceBytes = crypto.getRandomValues(new Uint8Array(32));
    const paymentNonce = "0x" + Array.from(nonceBytes, byte => byte.toString(16).padStart(2, "0")).join("");
    const authorization = {
      from: account,
      to: accepted.payTo,
      value: accepted.amount,
      validAfter: "0",
      validBefore: String(now + accepted.maxTimeoutSeconds),
      nonce: paymentNonce,
    };
    const typedData = {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
        TransferWithAuthorization: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      },
      primaryType: "TransferWithAuthorization",
      domain: {
        name: accepted.extra.name,
        version: accepted.extra.version,
        chainId: expected.chainId,
        verifyingContract: accepted.asset,
      },
      message: authorization,
    };

    setStatus("Review the one-cent USDC authorization in your wallet. Nothing is sent until you approve it.");
    const signature = await window.ethereum.request({
      method: "eth_signTypedData_v4",
      params: [account, JSON.stringify(typedData)],
    });
    authorizationSigned = true;
    const paymentPayload = {
      x402Version: 2,
      resource: paymentRequired.resource,
      accepted,
      payload: { authorization, signature },
      extensions: paymentRequired.extensions || {},
    };
    setStatus("Authorization signed. Requesting and settling the Evidence Receipt…");
    const paid = await fetch(endpoint, {
      headers: { Accept: "application/json", "PAYMENT-SIGNATURE": encodeBase64Json(paymentPayload) },
      cache: "no-store",
    });
    const body = await paid.json().catch(() => ({}));
    if (!paid.ok) throw new Error(body.message || body.paymentError || "Paid request failed with HTTP " + paid.status + ".");
    const settlement = paid.headers.get("PAYMENT-RESPONSE");
    if (!settlement) throw new Error("FreshFact delivered a response without a settlement receipt.");
    setStatus("Payment settled and Evidence Receipt delivered.", "ok");
    result.style.display = "block";
    result.textContent = JSON.stringify({ settlementReceipt: settlement, evidence: body }, null, 2);
  }

  connectButton.addEventListener("click", async () => {
    connectButton.disabled = true;
    try { await connectWallet(); }
    catch (error) { setStatus(error?.message || "Wallet connection failed.", "error"); connectButton.disabled = false; }
  });
  payButton.addEventListener("click", async () => {
    payButton.disabled = true;
    result.style.display = "none";
    try { await pay(); }
    catch (error) {
      if (authorizationSigned) {
        setStatus("Payment outcome could not be confirmed after signing. Do not pay again. FreshFact must check settlement before another attempt.", "error");
        return;
      }
      setStatus(error?.message || "Payment was not completed.", "error");
      payButton.disabled = false;
    }
  });

  getQuote(endpointFor(source.value)).then(
    () => setStatus("Live one-cent quote verified. Connect your wallet when ready.", "ok"),
    error => setStatus(error?.message || "Could not prepare the live quote.", "error"),
  );
})();
</script>
</body>
</html>`;
}

function sendCheckoutPage(res, { payTo, evidenceEnabled, nonce = crypto.randomBytes(18).toString("base64") }) {
  if (!evidenceEnabled) {
    return res.status(503).type("text/plain").send("FreshFact Evidence purchases are temporarily unavailable.");
  }
  res.set({
    "Cache-Control": "private, no-store",
    "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  });
  return res.type("html").send(buildCheckoutPage({ payTo, nonce }));
}

module.exports = { buildCheckoutPage, sendCheckoutPage, quoteMatchesExpected, BASE_CHAIN_ID, BASE_USDC, EVIDENCE_AMOUNT };

