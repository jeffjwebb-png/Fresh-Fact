const express = require("express");
const crypto = require("crypto");
const dns = require("dns").promises;
const net = require("net");

const app = express();
app.set("trust proxy", 1);

const port = process.env.PORT || 3000;
const MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_CHARS = 30000;
const MAX_CHARS = 50000;
const FETCH_TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 5;

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
        headers: {
          Accept: "text/html,text/plain,application/xhtml+xml;q=0.9,*/*;q=0.1",
          "User-Agent": "FreshFactEvidenceBot/1.0 (+https://fresh-fact.onrender.com)",
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    const fetchMs = Date.now() - started;

    if (
      [301, 302, 303, 307, 308].includes(response.status)
    ) {
      const location = response.headers.get("location");

      if (!location) {
        throw new Error("REDIRECT_WITHOUT_LOCATION");
      }

      if (hop >= MAX_REDIRECTS) {
        throw new Error("TOO_MANY_REDIRECTS");
      }

      const next = new URL(location, current);
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
      throw new Error("UNSUPPORTED_CONTENT_TYPE");
    }

    const declaredLength = Number(
      response.headers.get("content-length")
    );

    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_BYTES
    ) {
      throw new Error("CONTENT_TOO_LARGE");
    }

    const buffer = Buffer.from(
      await response.arrayBuffer()
    );

    if (buffer.length > MAX_BYTES) {
      throw new Error("CONTENT_TOO_LARGE");
    }

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

  const { createPaywall } =
    await import("@x402/paywall");

  const { evmPaywall } =
    await import("@x402/paywall/evm");

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
    .useExtension(bazaarResourceServerExtension);

  const paywallConfig = {
    appName: "FreshFact",
    testnet: false,
  };

  const paywall = createPaywall()
    .withNetwork(evmPaywall)
    .withConfig(paywallConfig)
    .build();

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
    },
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

  app.get("/", (req, res) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    res.json({
      name: "FreshFact",
      status: "live",
      product: "FreshFact Evidence",
      description:
        "Pay-per-request fresh web evidence for AI agents and software: clean text, provenance, freshness signals and a tamper-detectable content hash.",
      price: "$0.01 USDC",
      network: "Base",
      paidEndpoint:
        `${baseUrl}/api/evidence?url=https%3A%2F%2Fexample.com`,
      health: `${baseUrl}/health`,
      openapi: `${baseUrl}/openapi.json`,
      discovery:
        `${baseUrl}/.well-known/x402-catalog.json`,
      llms: `${baseUrl}/llms.txt`,
    });
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
      ],
      docs: `${baseUrl}/openapi.json`,
      llms: `${baseUrl}/llms.txt`,
    });
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
      paths: {
        "/api/evidence": {
          get: {
            summary:
              "Retrieve current clean evidence from a public web URL",
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
      },
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

      $("script,style,noscript,svg,canvas,template").remove();

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
