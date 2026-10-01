# Fresh-Fact

## Paid products

FreshFact Evidence uses x402 v2, Base mainnet USDC, and the existing `FRESHFACT_PAY_TO` receiving wallet. As checked October 1, 2026, all three products are active in production. Evidence is controlled by `FRESHFACT_EVIDENCE_ENABLED=true`; Verify and Research by `FRESHFACT_PRODUCTS_ENABLED=true`. Read [PROJECT_STATUS.md](PROJECT_STATUS.md) for the current deployment and paid-delivery evidence.

When Evidence is active, a valid source request without payment returns HTTP 402 and a `PAYMENT-REQUIRED` header. FreshFact prepares the deliverable privately first and only releases it after successful settlement. Invalid or unusable sources are rejected before requesting payment. Browser downloads use ASCII-safe JSON escapes, preserving the exact decoded Unicode text and content hash. Superscripts and subscripts retain their meaning in plain text, for example `10^(13)`.

| Product | Request | Price | Coverage |
| --- | --- | ---: | --- |
| Evidence | `GET /api/evidence?url=<public-url>` | $0.01 | One public HTML/plain-text URL; extracted text and source metadata. |
| Verify | `POST /api/verify` with `{"claim":"...","urls":["https://example.com"]}` | $0.03 | One to three supplied public URLs; passages sharing terms with the claim, retrieval time, content hash. No semantic truth verdict. |
| Research | `POST /api/research` with `{"query":"..."}` | $0.05 | Search English Wikipedia and retrieve up to three matching pages. Wikipedia only; not a live-web search. |

Evidence separates headings, paragraphs, and list items in `data.text`. `data.sections` gives each block's type and start/end character offsets into that exact text, so an agent can locate a passage without guessing where HTML elements ended. A page with no usable extracted text returns `EMPTY_SOURCE` instead of an empty successful result. The hash still covers `data.text`; it is not independent proof that the source page is authentic.

Verify and Research return `termCoverage` for matching passages; that number measures overlap with query words, not confidence that the passage supports a claim. A passage may contradict the query. Their SHA-256 hashes cover the normalized text used to find passages. Each fetched page has a 2 MB transfer limit, a 50,000-character text limit, and a ten-second timeout per hop. Failed retrieval returns an error before payment is requested. Source retrieval can fail; the payment middleware never releases product output when settlement fails.

OpenAPI, `llms.txt`, `/.well-known/x402-catalog.json`, and `/.well-known/x402` reflect the current activation flags. Production discovery advertises all three active products.

Retrieval time and source cache age are separate: `freshness.sourceCacheAgeSeconds` reports the upstream HTTP Age header, or null when unknown. FreshFact sends cache-revalidation headers but does not claim verified origin revalidation or that source facts were updated at retrieval time.

## Paid path status

The original Evidence payment flow was exercised by eight owner test transactions on Base mainnet. A further owner test on September 29, 2026 confirmed a $0.01 USDC transfer to the receiving wallet and delivery of 2,450 words of Wikipedia source text with a matching SHA-256 hash. Transaction: `0xf0d9e2ecc60e828374e88aaaf43398ba45ae4b4f6ea2e69b5f3cb3ef78415829`. That review found browser Unicode display and flattened-exponent defects; fixes and regression tests were deployed. Two successful September 29 Evidence deliveries are recorded in PROJECT_STATUS.md, and the owner reports ten one-cent transactions total. Verify and Research paid fulfillment remains unconfirmed. Those transactions came from the project owner's own wallet and settled into the project's own receiving wallet; they confirm the integration works, not that a market exists.

No independent paid call has been verified yet. The open commercial milestones are:
1. first independent paid call;
2. first repeat independent buyer;
3. 100 external paid calls;
4. 10 distinct external payers;
5. then test pricing and distribution economics.

Only after those signals should FreshFact invest in more upstream data, paid acquisition, complex accounts, or a larger feature set.

## Distribution targets

FreshFact is prepared for machine discovery through x402 Bazaar-compatible metadata. The current x402 documentation says services become discoverable when the Bazaar extension is declared on the paid route; catalog visibility is facilitator-dependent and a real settled payment carrying the extension may be required. See the official Bazaar specification before changing the payment stack.

Potential distribution indexes:
- x402 Bazaar / facilitator discovery
- x402.new directory
- x402scan and other public x402 indexes that import Bazaar resources

### Listing description

> FreshFact Evidence retrieves a public web page at request time and returns clean machine-readable evidence with source provenance, freshness headers, retrieval timestamp, metadata, redirect history, and a SHA-256 integrity hash. Pay $0.01 USDC on Base per request through x402.

### Note on listing

Do not equate listing with demand. Listing generates no traffic on its own; the milestones above are the only signals that count.


## Testing without changing the API

Verify and Research require POST; opening their endpoint addresses directly in a browser sends GET and returns 405. Agent clients can use the official [x402 fetch client](https://github.com/x402-foundation/x402/tree/main/examples/typescript/clients/fetch). Coinbase also documents [paid POST calls through its agentic wallet CLI](https://docs.cdp.coinbase.com/agentic-wallet/cli/skills/pay-for-service); use a wallet you control, and approve spending yourself.

The x402Instant browser client can submit POST requests from a wallet-enabled browser. A normal mobile browser may not expose a wallet provider. FreshFact includes narrowly scoped compatibility for its legacy display labels; the v2 amount, recipient, asset, network and signed authorization remain authoritative. Do not use the playground faucet: FreshFact accepts real Base mainnet USDC, not test tokens.

Verify example (Content-Type: application/json):
```json
{"claim":"A kilowatt hour is equal to 3.6 megajoules","urls":["https://en.wikipedia.org/wiki/Kilowatt-hour"]}
```
Research example:
```json
{"query":"kilowatt hour"}
```
An unpaid 402 is a quote, not a purchased result. Paid success requires HTTP 200, the actual source/passages JSON and a successful PAYMENT-RESPONSE settlement receipt. A failed paid retry exposes a safe `paymentError` reason and records `payment_rejected` without logging signatures or credentials. Automated settlement tests use a stub facilitator and do not prove on-chain fulfillment. Owner tests are excluded from commercial metrics.
