/**
 * FreshFact MCP server.
 *
 * Exposes the FreshFact Evidence, Verify and Research endpoints as MCP tools
 * so MCP-compatible clients (Claude Desktop, Cursor, and others) can discover
 * and call them.
 *
 * Payment is x402 on Base mainnet. The unpaid 402 response carries the price
 * in a PAYMENT-REQUIRED header and in a readable JSON body. To actually pay,
 * set FRESHFACT_X402_FETCH to the module path of an x402-capable fetch
 * implementation (see README). Without it, tools run in discovery mode: they
 * return the payment requirements instead of the paid result.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const ORIGIN = process.env.FRESHFACT_ORIGIN || "https://fresh-fact.onrender.com";

/**
 * Optional x402 paying fetch. Set FRESHFACT_X402_FETCH to a module specifier
 * exporting `x402Fetch` (or a default function) with the signature
 * (url, init) => Promise<Response>. When unset, callFreshFact reports the
 * payment requirements rather than attempting a paid call.
 */
let payingFetch = globalThis.fetch;
try {
  if (process.env.FRESHFACT_X402_FETCH) {
    const mod = await import(process.env.FRESHFACT_X402_FETCH);
    payingFetch = mod.x402Fetch || mod.default || globalThis.fetch;
  }
} catch (error) {
  console.error(
    `FreshFact MCP: could not load FRESHFACT_X402_FETCH module (${error.message}). ` +
      "Running in discovery mode."
  );
}

/** Decode the base64url PAYMENT-REQUIRED header into readable JSON. */
function decodePaymentRequired(headerValue) {
  if (!headerValue) return null;
  try {
    const json = Buffer.from(headerValue, "base64url").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Call FreshFact. Returns either the paid result or, when no payment could be
 * made, the decoded payment requirements so the client can see the price.
 */
async function callFreshFact(path, init = {}) {
  const url = `${ORIGIN}${path}`;

  let response;
  try {
    response = await payingFetch(url, init);
  } catch (error) {
    return {
      paid: false,
      reason: "network_error",
      message: `Could not reach FreshFact at ${url}: ${error.message}`,
    };
  }

  if (response.status === 402) {
    const requirements =
      decodePaymentRequired(response.headers.get("payment-required")) || null;
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return {
      paid: false,
      reason: "payment_required",
      price: requirements?.accepts?.[0]?.amount
        ? `${Number(requirements.accepts[0].amount) / 1e6} USDC`
        : null,
      network: requirements?.accepts?.[0]?.network || null,
      paymentHeader: "PAYMENT-SIGNATURE",
      service: requirements?.resource?.serviceName || null,
      description: requirements?.resource?.description || null,
      quote: body,
      note:
        "This endpoint is paid per request via x402. To complete a call, " +
        "configure FRESHFACT_X402_FETCH with an x402-capable fetch, or pay " +
        "the requirements above and retry with a PAYMENT-SIGNATURE header.",
    };
  }

  let payload;
  const text = await response.text();
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    return {
      paid: null,
      paymentStatus: "unknown",
      ok: false,
      status: response.status,
      body: payload,
    };
  }

  return { paid: true, ok: true, status: response.status, body: payload };
}

/** Wrap a result as MCP text content. */
function asContent(result) {
  return {
    // A 402 quote is the expected discovery-mode result, not an MCP failure.
    isError: result.reason !== "payment_required" && result.ok !== true,
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

const server = new McpServer({
  name: "freshfact",
  version: "1.0.0",
});

server.tool(
  "freshfact_evidence",
  "Fetch a public web page and return extracted text, final URL, HTTP status, retrieval timestamp, redirect chain, and a SHA-256 hash of the returned text. Paid per call in USDC on Base via x402 ($0.01). Retrieval may fail after payment. Returns no verdict on whether the page content is true.",
  {
    url: z
      .string()
      .url()
      .describe("Public HTTP or HTTPS URL to retrieve."),
    maxChars: z
      .number()
      .int()
      .min(1000)
      .max(50000)
      .optional()
      .describe("Maximum extracted text characters. Defaults to 30000."),
  },
  async ({ url, maxChars }) => {
    const params = new URLSearchParams({ url });
    if (maxChars !== undefined) params.set("maxChars", String(maxChars));
    return asContent(await callFreshFact(`/api/evidence?${params.toString()}`));
  }
);

server.tool(
  "freshfact_verify",
  "Given a claim and one to three public source URLs, retrieve those pages and return passages sharing significant terms with the claim, each with its source URL, retrieval timestamp and SHA-256 content hash. Returns lexical term overlap only: termCoverage is not a truth verdict and a returned passage may contradict the claim. Use to locate citable passages, not to adjudicate. Paid per call in USDC on Base via x402 ($0.03).",
  {
    claim: z
      .string()
      .min(8)
      .max(300)
      .describe("The claim to look for passages about."),
    urls: z
      .array(z.string().url())
      .min(1)
      .max(3)
      .describe("One to three public HTTP/HTTPS source URLs."),
  },
  async ({ claim, urls }) => {
    return asContent(
      await callFreshFact("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim, urls }),
      })
    );
  }
);

server.tool(
  "freshfact_research",
  "Search English Wikipedia for a query and retrieve up to three matching pages, returning related passages with source URLs, retrieval timestamps and SHA-256 content hashes. Coverage is English Wikipedia only: this is not a live-web search and returns no truth verdict. Paid per call in USDC on Base via x402 ($0.05).",
  {
    query: z
      .string()
      .min(3)
      .max(300)
      .describe("Research query. English Wikipedia coverage only."),
  },
  async ({ query }) => {
    return asContent(
      await callFreshFact("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      })
    );
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
