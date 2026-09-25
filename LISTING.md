# FreshFact — listing copy

Copy for x402 Bazaar listing metadata, the directory listings, and the outreach message. The Bazaar search ranks partly on "completeness of the description, output schema, and service metadata," so the description fields below are written to be scored, not just read.

---

## 1. Bazaar listing descriptions

These replace the `description` and `serviceName` fields on each route in `Server.js`. Each is one sentence, front-loaded with the terms an agent or developer would search for, and ends with the failure posture.

### Evidence — `GET /api/evidence` — $0.01

**serviceName:** `FreshFact Evidence`

**description:**

> Fetch a public web page at request time and return retrieved page data: extracted text, final URL, HTTP status, retrieval timestamp, redirect chain, and a SHA-256 hash of the returned text. Use when an agent needs a dated snapshot of extracted page text. Priced $0.01 per call in USDC on Base. Retrieval can fail after payment; the response carries no truth verdict about the page's contents.

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
> - **Failure policy:** Retrieval may fail after payment; a 502 does not establish whether payment settled
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
> It's live, it's $0.01 a call in USDC on Base, and there's no key or signup — your agent gets a 402, pays, retries, and gets the result. A fetch can fail after payment; check the response before using the result.
>
> ```
> curl -i https://fresh-fact.onrender.com/api/evidence
> ```
>
> That returns the payment requirements without paying anything. Would this result be useful in your pipeline? If the provenance block doesn't earn its place in your pipeline, tell me and I'll leave you alone.

### What not to send

- No "would you use this?" — the polite yes tells you nothing.
- No feature list. One capability, stated once.
- No free-credit offer longer than a sentence; it invites speculation, not usage.
- Don't ask for feedback. Ask for a call, then watch whether a second one happens unprompted.

---

## 4. Two fixes that affect listing quality

Findings from checking the live 402. Neither is in this file — they're for you to decide on.

**HTTPS redirect.** `GET /api/evidence` returns a 301 before the real 402. An agent pays an extra round trip on every call. Worth forcing HTTPS at the Render or Cloudflare level instead of redirecting, since latency is one of the constraints buyers select on.

**No receipt or job identifier.** Buyers test "settlement succeeded, job failed" and want payment state and execution state as separate signals. Right now a 502 after payment is documented in the README but not distinguishable in the response itself. Returning a payment reference alongside the error would close a real gap against Tavily, which advertises refunds for upstream failure.
