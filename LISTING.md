# FreshFact — listing copy

Copy for x402 Bazaar listing metadata, the directory listings, and the outreach message. The Bazaar search ranks partly on "completeness of the description, output schema, and service metadata," so the description fields below are written to be scored, not just read.

---

## 1. Bazaar listing descriptions

These replace the `description` and `serviceName` fields on each route in `Server.js`. Each is one sentence, front-loaded with the terms an agent or developer would search for, and ends with the failure posture.

### Evidence — `GET /api/evidence` — $0.01

**serviceName:** `FreshFact Evidence`

**description:**

> Fetch a public web page at request time and return retrieved page data: extracted text, final URL, HTTP status, retrieval timestamp, redirect chain, and a SHA-256 hash of the returned text. Use when an agent needs a dated snapshot of extracted page text. Priced $0.01 per call in USDC on Base. FreshFact validates and prepares the result before requesting payment; the response carries no truth verdict about the page's contents.

### Verify — `POST /api/verify` — $0.03

**serviceName:** `FreshFact Verify`

**description:**

> Given a claim and one to three public source URLs, retrieve those pages and return passages that share significant terms with the claim, each with its source URL, retrieval timestamp, and a SHA-256 content hash. Returns lexical term overlap only — `termCoverage` is not a truth verdict, and a returned passage may contradict the claim. Use to locate citable passages, not to adjudicate. Priced $0.03 per call in USDC on Base.

### Research — `POST /api/research` — $0.05

**serviceName:** `FreshFact Research`

**description:**

> Search English Wikipedia for a query and retrieve up to three matching pages, returning related passages with source URLs, retrieval timestamps, and SHA-256 content hashes. Coverage is English Wikipedia only — this is not a live-web search and returns no truth verdict. Use when an agent needs Wikipedia-sourced passages with provenance attached. Priced $0.05 per call in USDC on Base.

---

## 2. Directory listing — Evidence as the headline product

For x402.new, x402scan, and indexes that import Bazaar resources. Leads with the verification use case rather than the feature list.

### Short form (one line, for card layouts)

> Web evidence with provenance. Fetch any public page and get its text, retrieval timestamp, redirect chain, and SHA-256 hash — a dated snapshot of extracted text, at $0.01 a call on Base.

### Long form (for a directory detail page)

> **FreshFact Evidence** retrieves a public web page at request time and returns machine-readable extracted page data: the extracted text, the final URL after redirects, the HTTP status, the retrieval timestamp, the full redirect chain, and a SHA-256 hash over the returned text.
>
> Store the returned text and metadata if an agent needs to review what it received later. The response is not independently authenticated or archived by FreshFact.
>
> - **Price:** $0.01 per call in USDC on Base
> - **No account, no API key** — x402 payment on the request
> - **Failure policy:** Invalid, unavailable, or unusable sources fail before payment is requested; failed settlement releases no product output
> - **Scope:** public HTML and plain-text URLs, 2 MB transfer limit, 50,000-character text limit, ten-second timeout per hop, up to five redirects
> - **Not included:** any verdict on whether the page's content is true, accurate, or current
>
> Discovery: `https://fresh-fact.onrender.com/llms.txt` · `/openapi.json` · `/.well-known/x402-catalog.json`

---

## 3. Outreach message

For an individual building retrieval agents. Short, no pitch-deck register. Send one of these to one person at a time; the point is a second call, not a reply.

### Subject line options

- Paid fetch with provenance — $0.01, live on Base
- Dated page extraction for your retrieval pipeline

### Body

> Hi — I built something at the edge of what you're working on, and I'd rather show you than describe it.
>
> Most retrieval APIs return what's relevant now. A stored response can help an operator review the text their agent received. FreshFact Evidence returns: extracted text, retrieval timestamp, redirect chain, and a SHA-256 hash over the exact text.
>
> It's live, it's $0.01 a call in USDC on Base, and there's no key or signup — your agent gets a 402, pays, retries, and gets the result. FreshFact prepares and validates the result before requesting payment; failed settlement releases no product output.
>
> ```
> curl -i 'https://fresh-fact.onrender.com/api/evidence?url=https%3A%2F%2Fexample.com'
> ```
>
> That returns the payment requirements without paying anything. Would this result be useful in your pipeline? If the provenance block doesn't earn its place in your pipeline, tell me and I'll leave you alone.

### What not to send

- No "would you use this?" — the polite yes tells you nothing.
- No feature list. One capability, stated once.
- No free-credit offer longer than a sentence; it invites speculation, not usage.
- Don't ask for feedback. Ask for a call, then watch whether a second one happens unprompted.

---

## 4. PayAPI Market submission package

PayAPI's form probes the exact paid URL before it creates a listing. Submit a complete Evidence request, not the homepage or the bare route.

- **API name:** `FreshFact Evidence`
- **Paid route:** `https://fresh-fact.onrender.com/api/evidence?url=https%3A%2F%2Fexample.com`
- **Base URL:** `https://fresh-fact.onrender.com`
- **Price:** `$0.01` USDC per request on Base
- **Suggested category:** web/data extraction or data intelligence, whichever label the form currently offers
- **Description:** Use the long-form Evidence description in section 2
- **Expected unpaid check:** HTTP 402 with x402 v2, network `eip155:8453`, amount `10000`, asset Base USDC, and `extra.name` equal to `USD Coin`
- **Expected paid result:** HTTP 200 JSON containing extracted text, source/final URL, HTTP status, retrieval timestamp, redirect history, structured sections, and a SHA-256 content hash

The owner must enter and confirm the provider name, contact email, and Base payout wallet. The wallet must exactly match the live challenge's `payTo`. Never paste a seed phrase or private key into a listing form.
