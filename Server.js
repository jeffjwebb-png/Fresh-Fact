const express = require("express");
const crypto = require("crypto");
const dns = require("dns").promises;
const net = require("net");
const { Agent } = require("undici");
const { validateSources, validateClaim, validateQuery, evidenceFromPage, searchWikipedia } = require("./products");

const app = express();
app.set("trust proxy", 1);

const port = process.env.PORT || 3000;
const MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_CHARS = 30000;
const MAX_CHARS = 50000;
const FETCH_TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 5;
// Validate the address used by the socket itself, including after DNS changes.
const publicDispatcher = new Agent({
  connect: {
    lookup(hostname, options, callback) {
      dns.lookup(hostname, options).then((result) => {
        const addresses = Array.isArray(result) ? result : [result];
        if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
          callback(new Error("PRIVATE_TARGET"));
          return;
        }
        if (options.all) callback(null, addresses);
        else callback(null, addresses[0].address, addresses[0].family);
      }).catch(callback);
    },
  },
});

function isPrivateIPv4(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n))) {
    return false;
  }

  const [a, b] = parts;

  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 0 && parts[2] === 2) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && parts[2] === 100) ||
    (a === 203 && b === 0 && parts[2] === 113) ||
    a >= 224
  );
}

function isPrivateIPv6(ip) {
  const normalized = ip.toLowerCase();
  if (normalized.startsWith("::ffff:")) {
    const embedded = normalized.slice(7);
    if (net.isIP(embedded) === 4) return isPrivateIPv4(embedded);
  }

  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

function isPrivateAddress(ip) {
  const family = net.isIP(ip);

  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);

  return true;
}

async function assertPublicUrl(rawUrl) {
  let parsed;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("INVALID_URL");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("UNSUPPORTED_PROTOCOL");
  }

  if (
    parsed.username ||
    parsed.password ||
    parsed.hostname === "localhost"
  ) {
    throw new Error("PRIVATE_TARGET");
  }

  const addresses = await dns.lookup(parsed.hostname, {
    all: true,
    verbatim: true,
  });

  if (!addresses.length) {
    throw new Error("DNS_LOOKUP_FAILED");
  }

  if (addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("PRIVATE_TARGET");
  }

  return parsed;
}

function collapseWhitespace(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .replace(/ *\n */g, "\n")
    .trim();
}

function firstNonEmpty(values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function toIsoOrNull(value) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

async function fetchPublicText(initialUrl) {
  let current = await assertPublicUrl(initialUrl);
  const redirectChain = [];

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      FETCH_TIMEOUT_MS
    );

    const started = Date.now();

    let response;

    try {
      response = await fetch(current.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        dispatcher: publicDispatcher,
        headers: {
          Accept: "text/html,text/plain,application/xhtml+xml;q=0.9,*/*;q=0.1",
          "User-Agent": "FreshFactEvidenceBot/1.0 (+https://fresh-fact.onrender.com)",
        },
      });
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }

    const fetchMs = Date.now() - started;

    if (
      [301, 302, 303, 307, 308].includes(response.status)
    ) {
      const location = response.headers.get("location");

      if (!location) {
        clearTimeout(timeout);
        throw new Error("REDIRECT_WITHOUT_LOCATION");
      }

      if (hop >= MAX_REDIRECTS) {
        clearTimeout(timeout);
        throw new Error("TOO_MANY_REDIRECTS");
      }

      const next = new URL(location, current);
      clearTimeout(timeout);
      await assertPublicUrl(next.toString());

      redirectChain.push({
        from: current.toString(),
        status: response.status,
        to: next.toString(),
      });

      current = next;
      continue;
    }

    const contentType =
      response.headers.get("content-type") || "";

    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain") &&
      !contentType.includes("application/xhtml+xml")
    ) {
      clearTimeout(timeout);
      throw new Error("UNSUPPORTED_CONTENT_TYPE");
    }

    const declaredLength = Number(
      response.headers.get("content-length")
    );

    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_BYTES
    ) {
      clearTimeout(timeout);
      throw new Error("CONTENT_TOO_LARGE");
    }

    const chunks = [];
    let received = 0;
    try {
      for await (const chunk of response.body) {
        received += chunk.length;
        if (received > MAX_BYTES) {
          await response.body.cancel().catch(() => {});
          throw new Error("CONTENT_TOO_LARGE");
        }
        chunks.push(chunk);
      }
    } finally {
      clearTimeout(timeout);
    }
    const buffer = Buffer.concat(chunks);

    return {
      response,
      body: buffer.toString("utf8"),
      finalUrl: current.toString(),
      redirectChain,
      fetchMs,
      bytes: buffer.length,
      contentType,
    };
  }

  throw new Error("TOO_MANY_REDIRECTS");
}

async function start() {
  const { load } = await import("cheerio");

  const { paymentMiddleware, x402ResourceServer } =
    await import("@x402/express");

  const { ExactEvmScheme } =
    await import("@x402/evm/exact/server");

  const { createCdpFacilitatorClient } =
    await import("@coinbase/cdp-sdk/x402");

  const { declareDiscoveryExtension, bazaarResourceServerExtension } =
    await import("@x402/extensions/bazaar");

  const payTo = process.env.FRESHFACT_PAY_TO;

  if (!payTo) {
    throw new Error(
      "FRESHFACT_PAY_TO environment variable is missing"
    );
  }

  const facilitator = createCdpFacilitatorClient();

  const resourceServer = new x402ResourceServer(facilitator)
    .register("eip155:8453", new ExactEvmScheme())
    .registerExtension(bazaarResourceServerExtension);

  const evidenceDiscovery = declareDiscoveryExtension({
    input: {
      url: "https://example.com",
      maxChars: DEFAULT_MAX_CHARS,
    },
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          format: "uri",
          description: "Public HTTP or HTTPS URL to retrieve.",
        },
        maxChars: {
          type: "integer",
          minimum: 1000,
          maximum: MAX_CHARS,
          default: DEFAULT_MAX_CHARS,
        },
      },
      required: ["url"],
    },
    output: {
      type: "json",
      example: {
        service: "FreshFact Evidence",
        source: {
          finalUrl: "https://example.com/",
          httpStatus: 200,
        },
        freshness: {
          retrievedAt: "2026-01-01T00:00:00.000Z",
        },
        integrity: {
          algorithm: "sha256",
          contentHash: "sha256-hex",
        },
        data: {
          text: "Current extracted source text",
        },
      },
      schema: {
        type: "object",
        properties: {
          service: { type: "string" },
          source: { type: "object" },
          freshness: { type: "object" },
          integrity: { type: "object" },
          data: { type: "object" },
        },
        required: ["service", "source", "freshness", "integrity", "data"],
      },
    },
  });

  const verifyDiscovery = declareDiscoveryExtension({
    method: "POST",
    bodyType: "json",
    input: { claim: "A sample claim to check against supplied sources", urls: ["https://example.com"] },
    inputSchema: {
      type: "object",
      properties: {
        claim: { type: "string", minLength: 8, maxLength: 300 },
        urls: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" } },
      },
      required: ["claim", "urls"],
    },
    output: {
      type: "json",
      example: { service: "FreshFact Verify", assessment: "related_passages_found", sources: [] },
      schema: { type: "object", properties: {
        service: { type: "string" }, assessment: { type: "string" }, sources: { type: "array" },
      }, required: ["service", "assessment", "sources"] },
    },
  });

  const researchDiscovery = declareDiscoveryExtension({
    method: "POST",
    bodyType: "json",
    input: { query: "solar power" },
    inputSchema: { type: "object", properties: {
      query: { type: "string", minLength: 3, maxLength: 300 },
    }, required: ["query"] },
    output: { type: "json", example: { service: "FreshFact Research", scope: "English Wikipedia", sources: [] },
      schema: { type: "object", properties: {
        service: { type: "string" }, scope: { type: "string" }, sources: { type: "array" },
      }, required: ["service", "scope", "sources"] } },
  });

  const routes = {
    "GET /api/evidence": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo,
        maxTimeoutSeconds: 300,
      },
      description:
        "FreshFact Evidence: retrieve a public web page as clean machine-readable evidence with freshness metadata, content hash, source URL, redirects, page metadata and extracted text.",
      mimeType: "application/json",
      serviceName: "FreshFact Evidence",
      tags: ["web", "evidence", "freshness", "research", "agents"],
      extensions: evidenceDiscovery,
    },
    "POST /api/verify": {
      accepts: { scheme: "exact", price: "$0.03", network: "eip155:8453", payTo, maxTimeoutSeconds: 300 },
      description: "Compare a claim with 1 to 3 public source URLs. Return related passages, source URLs, retrieval timestamps and content hashes. Lexical relevance is not a truth verdict.",
      mimeType: "application/json", serviceName: "FreshFact Verify",
      tags: ["evidence", "claim", "source", "verification", "agents"], extensions: verifyDiscovery,
    },
    "POST /api/research": {
      accepts: { scheme: "exact", price: "$0.05", network: "eip155:8453", payTo, maxTimeoutSeconds: 300 },
      description: "Search English Wikipedia for a query and retrieve up to 3 pages with related passages, source URLs, retrieval timestamps and content hashes. Wikipedia-only coverage; no current web or truth guarantees.",
      mimeType: "application/json", serviceName: "FreshFact Research",
      tags: ["research", "wikipedia", "evidence", "agents"], extensions: researchDiscovery,
    },
  };

  app.use((req, res, next) => {
    const started = Date.now();

    res.on("finish", () => {
      console.log(
        JSON.stringify({
          type: "request",
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Date.now() - started,
          at: new Date().toISOString(),
        })
      );
    });

    next();
  });

  app.use(express.json({ limit: "16kb", type: "application/json" }));

  app.post(["/api/verify", "/api/research"], async (req, res, next) => {
    try {
      if (req.path === "/api/verify") {
        req.validatedClaim = validateClaim(req.body?.claim);
        req.validatedUrls = validateSources(req.body?.urls);
        await Promise.all(req.validatedUrls.map((url) => assertPublicUrl(url)));
      } else {
        req.validatedQuery = validateQuery(req.body?.query);
      }
      next();
    } catch (error) {
      const invalid = ["INVALID_URL", "UNSUPPORTED_PROTOCOL", "PRIVATE_TARGET"].includes(error.message) ||
        error.message.startsWith("Provide ");
      res.status(invalid ? 400 : 502).json({
        error: invalid ? "INVALID_INPUT" : "SOURCE_UNAVAILABLE",
        message: invalid ? error.message : "Could not validate source availability.",
      });
    }
  });

  app.get("/", (req, res) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>FreshFact Evidence</title>
  <meta name="description" content="Fresh web evidence for AI agents and software.">
  <style>
    body{font-family:system-ui,-apple-system,sans-serif;max-width:900px;margin:0 auto;padding:48px 22px;line-height:1.55}
    code,pre{background:#f3f3f3;border-radius:8px}pre{padding:14px;overflow:auto}
    .price{font-size:1.25rem;font-weight:700}
  </style>
</head>
<body>
  <h1>FreshFact Evidence</h1>
  <p>Fresh web evidence for AI agents and software.</p>
  <p>Give FreshFact a public URL and receive clean extracted text, provenance, freshness signals, metadata and an integrity hash in machine-readable JSON.</p>
  <p class="price">$0.01 USDC per successful request · Base mainnet · x402</p>

  <h2>Paid endpoint</h2>
  <pre>GET ${baseUrl}/api/evidence?url=https%3A%2F%2Fexample.com</pre>

  <h2>Additional products under review</h2>
  <p>Verify and Research are temporarily unavailable while their results are reviewed. They cannot be purchased.</p>

  <h2>What you receive</h2>
  <ul>
    <li>Current source retrieval</li>
    <li>Clean extracted page text</li>
    <li>Source and final URLs plus redirects</li>
    <li>Page metadata and dates when available</li>
    <li>HTTP freshness signals</li>
    <li>SHA-256 hash of returned normalized text</li>
    <li>Retrieval timestamp and fetch timing</li>
  </ul>

  <h2>Machine access</h2>
  <p><a href="/openapi.json">OpenAPI</a> · <a href="/llms.txt">llms.txt</a> · <a href="/.well-known/x402-catalog.json">Discovery metadata</a> · <a href="/health">Health</a></p>

  <p>A request without a valid x402 payment returns HTTP 402 with payment requirements. No API-key signup is required.</p>
</body>
</html>`);
  });

  app.get("/robots.txt", (req, res) => {
    res.type("text/plain").send("User-agent: *\nAllow: /\n");
  });

  app.get("/health", (req, res) => {
    res.json({
      ok: true,
      service: "FreshFact",
      product: "FreshFact Evidence",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/llms.txt", (req, res) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    res.type("text/plain").send(
`# FreshFact

FreshFact sells fresh web evidence to software agents over x402.

## Paid endpoint
GET ${baseUrl}/api/evidence?url=<public-http-or-https-url>&maxChars=30000

Price: $0.01 USDC
Network: Base mainnet (eip155:8453)

POST ${baseUrl}/api/verify with {"claim":"...","urls":["https://example.com"]}: $0.03 USDC. Finds related passages in supplied public pages. Passage overlap is not verification of truth.
POST ${baseUrl}/api/research with {"query":"..."}: $0.05 USDC. Searches English Wikipedia only and retrieves up to three pages; not current-web search.

Returns clean page text plus title, description, canonical URL, published/modified dates when available, HTTP freshness headers, redirect chain, word count, SHA-256 content hash, source URL and retrieval timestamp.

## Discovery
${baseUrl}/openapi.json
${baseUrl}/.well-known/x402-catalog.json
`
    );
  });

  app.get("/.well-known/x402-catalog.json", (req, res) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    res.json({
      name: "FreshFact",
      version: "1.0.0",
      description:
        "Fresh web evidence for agents: URL in, clean current evidence out.",
      paymentProtocol: "x402",
      network: "eip155:8453",
      asset: "USDC",
      resources: [
        {
          method: "GET",
          url: `${baseUrl}/api/evidence`,
          price: "$0.01",
          input: {
            url:
              "Required public HTTP/HTTPS URL",
            maxChars:
              "Optional maximum extracted text characters, 1000-50000",
          },
          output: [
            "final source URL",
            "HTTP status and content type",
            "title and description",
            "canonical URL",
            "published and modified timestamps when present",
            "clean text",
            "word count",
            "SHA-256 content hash",
            "ETag and Last-Modified freshness signals",
            "redirect chain",
            "retrieval timestamp",
          ],
        },
        { method: "POST", url: `${baseUrl}/api/verify`, price: "$0.03", input: { claim: "Required claim", urls: "1 to 3 public URLs" }, output: ["source passages", "retrieval timestamp", "content hash", "lexical assessment"] },
        { method: "POST", url: `${baseUrl}/api/research`, price: "$0.05", input: { query: "Required query; English Wikipedia only" }, output: ["up to three article sources", "related passages", "retrieval timestamps", "content hashes"] },
      ],
      docs: `${baseUrl}/openapi.json`,
      llms: `${baseUrl}/llms.txt`,
    });
  });

  // Compatibility discovery document consumed by x402scan and other crawlers.
  app.get("/.well-known/x402", (req, res) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    res.json({ version: 1, resources: [`${baseUrl}/api/evidence`, `${baseUrl}/api/verify`, `${baseUrl}/api/research`] });
  });

  app.get("/openapi.json", (req, res) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    res.json({
      openapi: "3.1.0",
      info: {
        title: "FreshFact Evidence API",
        version: "1.0.0",
        description:
          "Pay-per-request fresh web evidence over x402.",
      },
      servers: [{ url: baseUrl }],
      components: {
        securitySchemes: {
          x402Payment: {
            type: "apiKey",
            in: "header",
            name: "PAYMENT-SIGNATURE",
            description: "x402 v2 payment payload; obtain requirements from an unpaid HTTP 402 response.",
          },
        },
      },
      paths: {
        "/api/evidence": {
          get: {
            summary:
              "Retrieve current clean evidence from a public web URL",
            security: [{ x402Payment: [] }],
            "x-payment-info": {
              protocols: ["x402"],
              price: { mode: "fixed", currency: "USD", amount: "0.01" },
              network: "eip155:8453",
              asset: "USDC",
            },
            parameters: [
              {
                name: "url",
                in: "query",
                required: true,
                schema: {
                  type: "string",
                  format: "uri",
                  example:
                    "https://example.com",
                },
              },
              {
                name: "maxChars",
                in: "query",
                required: false,
                schema: {
                  type: "integer",
                  minimum: 1000,
                  maximum: MAX_CHARS,
                  default: DEFAULT_MAX_CHARS,
                },
              },
            ],
            responses: {
              "200": {
                description:
                  "Paid evidence response",
              },
              "400": {
                description:
                  "Invalid or unsafe URL",
              },
              "402": {
                description:
                  "Payment required via x402",
              },
              "413": {
                description:
                  "Source content too large",
              },
              "415": {
                description:
                  "Unsupported source content type",
              },
              "502": {
                description:
                  "Unable to retrieve source",
              },
            },
          },
        },
        "/api/verify": {
          post: {
            summary: "Find passages related to a claim in supplied source URLs",
            description: "Lexical matches do not establish whether a claim is true or supported; inspect the cited passage.",
            security: [{ x402Payment: [] }],
            "x-payment-info": { protocols: ["x402"], price: { mode: "fixed", currency: "USD", amount: "0.03" }, network: "eip155:8453", asset: "USDC" },
            requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: {
              claim: { type: "string", minLength: 8, maxLength: 300 },
              urls: { type: "array", minItems: 1, maxItems: 3, items: { type: "string", format: "uri" } },
            }, required: ["claim", "urls"] } } } },
            responses: { "200": { description: "Source evidence and related passages" }, "400": { description: "Invalid input" }, "402": { description: "Payment required via x402" }, "502": { description: "Source unavailable" } },
          },
        },
        "/api/research": {
          post: {
            summary: "Search English Wikipedia and retrieve up to three source pages",
            description: "Coverage is limited to English Wikipedia. Results are not a live-web search or a truth verdict.",
            security: [{ x402Payment: [] }],
            "x-payment-info": { protocols: ["x402"], price: { mode: "fixed", currency: "USD", amount: "0.05" }, network: "eip155:8453", asset: "USDC" },
            requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: {
              query: { type: "string", minLength: 3, maxLength: 300 },
            }, required: ["query"] } } } },
            responses: { "200": { description: "Wikipedia results with related passages" }, "400": { description: "Invalid input" }, "402": { description: "Payment required via x402" }, "502": { description: "Search or source unavailable" } },
          },
        },
      },
    });
  });

  // Pause the unvalidated products before x402 can request or settle payment.
  app.post(["/api/verify", "/api/research"], (req, res) => {
    res.status(503).json({
      error: "PRODUCT_UNAVAILABLE",
      message: "This product is temporarily unavailable while its results are reviewed.",
    });
  });

  app.use(paymentMiddleware(routes, resourceServer));

  async function readEvidencePage(url) {
    const fetched = await fetchPublicText(url);
    if (!fetched.response.ok) throw new Error("SOURCE_HTTP_ERROR");
    const $ = load(fetched.body);
    const title = $("title").first().text().trim() || null;
    $("script,style,noscript,svg,canvas,template").remove();
    const text = collapseWhitespace($("main").first().text() || $("article").first().text() || $("body").text()).slice(0, MAX_CHARS);
    return { finalUrl: fetched.finalUrl, retrievedAt: new Date().toISOString(), title, text };
  }

  app.post("/api/verify", async (req, res) => {
    try {
      const pages = await Promise.all(req.validatedUrls.map(readEvidencePage));
      const sources = pages.map((page) => evidenceFromPage(page, req.validatedClaim));
      res.json({
        service: "FreshFact Verify", version: "1.0.0", claim: req.validatedClaim,
        assessment: sources.some((source) => source.passages.length) ? "related_passages_found" : "no_matching_passages",
        scope: "Supplied URLs only; lexical matching, not semantic fact checking.",
        sources,
        note: "Related passages may contradict or merely mention the claim. Read each source before treating it as support.",
      });
    } catch (error) {
      console.error("Verify source retrieval error:", error);
      res.status(502).json({ error: "SOURCE_UNAVAILABLE", message: "Could not retrieve all supplied sources." });
    }
  });

  app.post("/api/research", async (req, res) => {
    try {
      const urls = await searchWikipedia(req.validatedQuery);
      const results = await Promise.allSettled(urls.map(readEvidencePage));
      const sources = results.filter((result) => result.status === "fulfilled")
        .map((result) => evidenceFromPage(result.value, req.validatedQuery));
      if (!sources.length && urls.length) throw new Error("SOURCE_UNAVAILABLE");
      res.json({
        service: "FreshFact Research", version: "1.0.0", query: req.validatedQuery,
        scope: "English Wikipedia only", searchedAt: new Date().toISOString(),
        sources, unavailableSourceCount: results.length - sources.length,
        note: "Passages are lexical matches, not a truth assessment. Wikipedia coverage and article update times vary.",
      });
    } catch (error) {
      console.error("Research retrieval error:", error);
      res.status(502).json({ error: "RESEARCH_UNAVAILABLE", message: "Could not complete Wikipedia research." });
    }
  });

  app.get("/api/evidence", async (req, res) => {
    const requestedUrl =
      typeof req.query.url === "string"
        ? req.query.url.trim()
        : "";

    const requestedMaxChars =
      Number.parseInt(req.query.maxChars, 10);

    const maxChars =
      Number.isFinite(requestedMaxChars)
        ? Math.min(
            MAX_CHARS,
            Math.max(1000, requestedMaxChars)
          )
        : DEFAULT_MAX_CHARS;

    if (!requestedUrl) {
      return res.status(400).json({
        error: "MISSING_URL",
        message:
          "Provide a public URL with ?url=https%3A%2F%2Fexample.com",
      });
    }

    try {
      await assertPublicUrl(requestedUrl);

      const fetched =
        await fetchPublicText(requestedUrl);

      const {
        response,
        body,
        finalUrl,
        redirectChain,
        fetchMs,
        bytes,
        contentType,
      } = fetched;

      const $ = load(body);

      const title = firstNonEmpty([
        $("meta[property='og:title']").attr("content"),
        $("meta[name='twitter:title']").attr("content"),
        $("title").first().text(),
      ]);

      const description = firstNonEmpty([
        $("meta[property='og:description']").attr("content"),
        $("meta[name='description']").attr("content"),
        $("meta[name='twitter:description']").attr("content"),
      ]);

      const canonicalRaw = firstNonEmpty([
        $("link[rel='canonical']").attr("href"),
        $("meta[property='og:url']").attr("content"),
      ]);

      let canonicalUrl = null;

      if (canonicalRaw) {
        try {
          canonicalUrl =
            new URL(
              canonicalRaw,
              finalUrl
            ).toString();
        } catch {
          canonicalUrl = null;
        }
      }

      const publishedRaw = firstNonEmpty([
        $("meta[property='article:published_time']").attr("content"),
        $("meta[name='date']").attr("content"),
        $("meta[name='pubdate']").attr("content"),
        $("time[datetime]").first().attr("datetime"),
      ]);

      const modifiedRaw = firstNonEmpty([
        $("meta[property='article:modified_time']").attr("content"),
        $("meta[name='last-modified']").attr("content"),
      ]);

      const jsonLd = [];

      $("script[type='application/ld+json']").each((_, element) => {
        if (jsonLd.length >= 10) return;

        const raw = $(element).text().trim();

        if (!raw) return;

        try {
          const parsed = JSON.parse(raw);
          jsonLd.push(parsed);
        } catch {
          // Ignore malformed JSON-LD.
        }
      });

      $("script,style,noscript,svg,canvas,template").remove();

      const bodyText =
        collapseWhitespace(
          $("main").first().text() ||
          $("article").first().text() ||
          $("body").text()
        );

      const text =
        bodyText.slice(0, maxChars);

      const wordCount =
        text.length === 0
          ? 0
          : text.split(/\s+/).length;

      const contentHashSha256 =
        crypto
          .createHash("sha256")
          .update(text, "utf8")
          .digest("hex");

      const retrievedAt =
        new Date().toISOString();

      return res.json({
        service: "FreshFact Evidence",
        version: "1.0.0",

        source: {
          requestedUrl,
          finalUrl,
          canonicalUrl,
          httpStatus: response.status,
          contentType,
          bytesFetched: bytes,
          redirectChain,
        },

        freshness: {
          retrievedAt,
          fetchMs,
          etag:
            response.headers.get("etag"),
          lastModified:
            response.headers.get(
              "last-modified"
            ),
          cacheControl:
            response.headers.get(
              "cache-control"
            ),
          date:
            response.headers.get("date"),
        },

        page: {
          title,
          description,
          language:
            $("html").attr("lang") || null,
          publishedAt:
            toIsoOrNull(publishedRaw),
          modifiedAt:
            toIsoOrNull(modifiedRaw),
          wordCount,
          truncated:
            bodyText.length > text.length,
          maxChars,
        },

        integrity: {
          algorithm: "sha256",
          contentHash: contentHashSha256,
          scope:
            "normalized extracted text returned in data.text",
        },

        structuredData: {
          jsonLdCount: jsonLd.length,
          jsonLd,
        },

        data: {
          text,
        },

        note:
          "FreshFact reports evidence retrieved from the supplied public URL at request time. The source remains authoritative.",
      });
    } catch (error) {
      const code = error?.message || "FETCH_FAILED";

      if (
        [
          "INVALID_URL",
          "UNSUPPORTED_PROTOCOL",
          "PRIVATE_TARGET",
          "DNS_LOOKUP_FAILED",
        ].includes(code)
      ) {
        return res.status(400).json({
          error: code,
          message:
            "FreshFact only retrieves publicly routable HTTP/HTTPS URLs.",
        });
      }

      if (code === "CONTENT_TOO_LARGE") {
        return res.status(413).json({
          error: code,
          message:
            "Source content exceeded the 2 MB FreshFact retrieval limit.",
        });
      }

      if (
        code === "UNSUPPORTED_CONTENT_TYPE"
      ) {
        return res.status(415).json({
          error: code,
          message:
            "FreshFact Evidence currently supports HTML and plain-text sources.",
        });
      }

      console.error(
        "FreshFact evidence error:",
        error
      );

      return res.status(502).json({
        error: code,
        message:
          "FreshFact could not retrieve this source.",
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
