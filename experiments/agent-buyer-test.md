# FreshFact agent-to-agent sales experiment

Goal: test whether an independent AI agent will actually purchase FreshFact Evidence ($0.01) with its own authorized funds. This is **not** a claim of market demand until an unrelated buyer pays.

## Controlled experiment
1. Verify production /health and GET /api/evidence?url=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FKilowatt-hour. Without a payment signature, a valid request should receive HTTP 402 and a PAYMENT-REQUIRED header. Do not interpret a 402 as a sale.
2. Prepare a short, accurate offer for agents that retrieve public sources: FreshFact Evidence fetches readable text, source metadata, retrieval timestamp and SHA-256 hash for $0.01 USDC on Base. It does not verify factual truth.
3. Identify **one** agent developer with documented x402 buying capability and a genuine source-retrieval use case. No automated unsolicited mass posting.
4. Invite them to perform **one** paid request with a wallet they independently control. Never ask for their keys or fund their wallet. Record only public consent and publicly shareable evidence.
5. Verify a successful HTTP 200 payload, PAYMENT-RESPONSE settlement receipt, and independent payer. Exclude owner-funded tests. Do not call it revenue until settlement is verified.
6. Stop if payment fails, delivery is incomplete, or public products are paused. Fix product quality before inviting additional buyers.

## Optional NFT hypothesis
Do not mint, list, buy, or transfer NFTs during this experiment. First validate whether agent buyers exist and whether they prefer paid API calls or NFT-based access. NFTs may incur fees and add entitlement complexity.

## Agent constraints
- No wallet private keys, spending, signing, minting, deployments, or external posts without separately configured authorization.
- Respect platform rules, rate limits, and opt-outs.
- Never promise verified facts; FreshFact's matching passages are not a truth verdict.
- Keep the production paid service unchanged during initial testing.

## Result log
- Date:
- Candidate buyer / public evidence of agent purchasing ability:
- Use case:
- Offer delivered with permission?:
- HTTP response and delivery validation:
- Settlement receipt / independent payer confirmed?:
- Next decision:

**Current result:** experiment prepared; no independent buyer or paid transaction established by this document.
