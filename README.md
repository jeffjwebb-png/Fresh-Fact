# Fresh-Fact

## Paid products

All endpoints use x402 v2, Base mainnet USDC, and the configured `FRESHFACT_PAY_TO` wallet. A request without payment returns HTTP 402 and a `PAYMENT-REQUIRED` header. POST requests require `Content-Type: application/json`.

| Product | Request | Price | Coverage |
| --- | --- | ---: | --- |
| Evidence | `GET /api/evidence?url=<public-url>` | $0.01 | One public HTML/plain-text URL; extracted text and source metadata. |
| Verify | `POST /api/verify` with `{"claim":"...","urls":["https://example.com"]}` | $0.03 | One to three supplied public URLs; passages sharing terms with the claim, retrieval time, content hash. No semantic truth verdict. |
| Research | `POST /api/research` with `{"query":"..."}` | $0.05 | Search English Wikipedia and retrieve up to three matching pages. Wikipedia only; not a live-web search. |

Verify and Research return `termCoverage` for matching passages; that number measures overlap with query words, not confidence that the passage supports a claim. A passage may contradict the query. Their SHA-256 hashes cover the normalized text used to find passages. Each fetched page has a 2 MB transfer limit, a 50,000-character text limit, and a ten-second timeout per hop. Failed retrieval after payment returns 502; upstream availability is not guaranteed.

OpenAPI, `llms.txt`, `/.well-known/x402-catalog.json`, and `/.well-known/x402` advertise these products. The new products still need real paid end-to-end checks with owner authorization; unpaid 402 checks validate only payment discovery, not paid fulfillment.

## Distribution targets

FreshFact is prepared for machine discovery through x402 Bazaar-compatible metadata. The current x402 documentation says services become discoverable when the Bazaar extension is declared on the paid route; catalog visibility is facilitator-dependent and a real settled payment carrying the extension may be required. See the official Bazaar specification before changing the payment stack.

Potential distribution indexes:
- x402 Bazaar / facilitator discovery
- x402.new directory
- x402scan and other public x402 indexes that import Bazaar resources

### Listing description

> FreshFact Evidence retrieves a public web page at request time and returns clean machine-readable evidence with source provenance, freshness headers, retrieval timestamp, metadata, redirect history, and a SHA-256 integrity hash. Pay $0.01 USDC on Base per request through x402.

### Commercial validation gate

Do not equate listing with demand. The next commercial milestones are:
1. first independent paid call;
2. first repeat independent buyer;
3. 100 external paid calls;
4. 10 distinct external payers;
5. then test pricing and distribution economics.

Only after those signals should FreshFact invest in more upstream data, paid acquisition, complex accounts, or a larger feature set.
