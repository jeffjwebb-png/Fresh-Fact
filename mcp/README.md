# FreshFact MCP

An MCP server that exposes [FreshFact](https://fresh-fact.onrender.com) as tools, so MCP-compatible clients — Claude Desktop, Cursor, and others — can discover and call it.

FreshFact fetches a public web page and returns extracted text, the final URL, the HTTP status, the retrieval timestamp, the redirect chain, and a SHA-256 hash of the returned text. These fields alone do not prove the source was authentic or unchanged.

Payment is per request in USDC on Base, via [x402](https://x402.org). No account and no API key.

## Tools

| Tool | What it does | Price |
| --- | --- | ---: |
| `freshfact_evidence` | Fetch a public page and return its text with provenance and integrity hash | $0.01 |
| `freshfact_verify` | Find passages in one to three supplied URLs that share terms with a claim | $0.03 |
| `freshfact_research` | Search English Wikipedia and retrieve up to three pages with related passages | $0.05 |

`freshfact_verify` and `freshfact_research` return **lexical term overlap only**. `termCoverage` is not a truth verdict, and a returned passage may contradict the claim. Neither tool adjudicates whether something is true.

## Current installation status

The package name is reserved in this repository, but it is **not yet published to npm**. Do not use the `npx @jeffjwebb/freshfact-mcp` command until the package is published; npm currently returns 404 for it.

For source testing, clone this repository and build the MCP package:

```bash
git clone https://github.com/jeffjwebb-png/Fresh-Fact.git
cd Fresh-Fact/mcp
npm ci
npm run build
```

Then add the built server to your MCP client config, replacing the path with the absolute path on your computer:

```json
{
  "mcpServers": {
    "freshfact": {
      "command": "node",
      "args": ["/absolute/path/to/Fresh-Fact/mcp/dist/index.js"]
    }
  }
}
```

## Payment

Out of the box the server runs in **discovery mode**: when you call a tool, it reaches FreshFact, receives the HTTP 402 payment challenge, decodes it, and returns the price, network, and payment instructions to you. No money moves and nothing is charged. This is enough to see exactly what each endpoint costs and what it returns.

To make paid calls, set `FRESHFACT_X402_FETCH` to the module path of an x402-capable fetch implementation that exports `x402Fetch` (or a default function) with the signature `(url, init) => Promise<Response>`:

```json
{
  "mcpServers": {
    "freshfact": {
      "command": "node",
      "args": ["/absolute/path/to/Fresh-Fact/mcp/dist/index.js"],
      "env": {
        "FRESHFACT_X402_FETCH": "/absolute/path/to/your-x402-fetch.js"
      }
    }
  }
}
```

That module handles the wallet and the payment signing. The buyer pays no gas; the CDP facilitator settles on Base.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `FRESHFACT_ORIGIN` | `https://fresh-fact.onrender.com` | Override the FreshFact base URL |
| `FRESHFACT_X402_FETCH` | unset | Module exporting an x402-capable fetch, for paid calls |

## Discovery

FreshFact publishes machine-readable discovery documents:

- `https://fresh-fact.onrender.com/llms.txt`
- `https://fresh-fact.onrender.com/openapi.json`
- `https://fresh-fact.onrender.com/.well-known/x402-catalog.json`

## Limits

- Public HTML and plain-text sources only
- 2 MB transfer limit per page
- 50,000-character extracted text limit
- Ten-second timeout per hop, up to five redirects
- Failed retrieval after payment returns 502
- No verdict on whether any page's content is true, accurate, or current

## License

MIT
