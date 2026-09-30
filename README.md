# Fresh-Fact

## Paid products

FreshFact Evidence uses x402 v2, Base mainnet USDC, and the existing `FRESHFACT_PAY_TO` receiving wallet. Public Evidence purchases remain paused until `FRESHFACT_EVIDENCE_ENABLED=true` is explicitly set after the release check. Verify and Research stay paused regardless of that flag.

When Evidence is active, a valid source request without payment returns HTTP 402 and a `PAYMENT-REQUIRED` header. FreshFact prepares the deliverable privately first and only releases it after successful settlement. Invalid or unusable sources are rejected before requesting payment. Browser downloads use ASCII-safe JSON escapes, preserving the exact decoded Unicode text and content hash. Superscripts and subscripts retain their meaning in plain text, for example `10^(13)`.

| Product | Request | Price | Coverage |
| --- | --- | ---: | --- |
| Evidence | `GET /api/evidence?url=<public-url>` | $0.01 | One public HTML/plain-text URL; extracted text and source metadata. |
| Verify | `POST /api/verify` with `{"claim":"...","urls":["https://example.com"]}` | $0.03 | One to three supplied public URLs; passages sharing terms with the claim, retrieval time, content hash. No semantic truth verdict. |
| Research | `POST /api/research` with `{"query":"..."}` | $0.05 | Search English Wikipedia and retrieve up to three matching pages. Wikipedia only; not a live-web search. |

Evidence separates headings, paragraphs, and list items in `data.text`. `data.sections` gives each block's type and start/end character offsets into that exact text, so an agent can locate a passage without guessing where HTML elements ended. A page with no usable extracted text returns `EMPTY_SOURCE` instead of an empty successful result. The hash still covers `data.text`; it is not independent proof that the source page is authentic.

Verify and Research return `termCoverage` for matching passages; that number measures overlap with query words, not confidence that the passage supports a claim. A passage may contradict the query. Their SHA-256 hashes cover the normalized text used to find passages. Each fetched page has a 2 MB transfer limit, a 50,000-character text limit, and a ten-second timeout per hop. Failed retrieval returns an error before payment is requested. Source retrieval can fail; the payment middleware never releases product output when settlement fails.

OpenAPI, `llms.txt`, `/.well-known/x402-catalog.json`, and `/.well-known/x402` reflect the current Evidence activation state. Active discovery lists Evidence only; the other products are planned and unavailable for purchase.

Retrieval time and source cache age are separate: `freshness.sourceCacheAgeSeconds` reports the upstream HTTP Age header, or null when unknown. FreshFact sends cache-revalidation headers but does not claim verified origin revalidation or that source facts were updated at retrieval time.

## Paid path status

The original Evidence payment flow was exercised by eight owner test transactions on Base mainnet. A further owner test on September 29, 2026 confirmed a $0.01 USDC transfer to the receiving wallet and delivery of 2,450 words of Wikipedia source text with a matching SHA-256 hash. Transaction: `0xf0d9e2ecc60e828374e88aaaf43398ba45ae4b4f6ea2e69b5f3cb3ef78415829`. That review found browser Unicode display and flattened-exponent defects; fixes and regression tests were deployed. A final corrected-output wallet test remains the activation gate. Verify and Research paid fulfillment remains unconfirmed. Those transactions came from the project owner's own wallet and settled into the project's own receiving wallet; they confirm the integration works, not that a market exists.

No independent paid call has occurred yet. The open commercial milestones are:
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
