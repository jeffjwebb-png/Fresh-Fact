# FreshFact project status

Updated 2026-10-01. Read this before choosing new work. Do not reset completed milestones because conversation context is missing.

## Completed paid delivery milestone

Owner private tests on September 29 Pacific time succeeded. Render application logs record GET /api/evidence HTTP 200, paymentPresented=true and deliverySucceeded=true at 2026-09-30T04:08:23.692Z and 2026-09-30T04:11:14.830Z. These are owner tests, excluded from external buyers and revenue, in addition to the eight previously reported owner tests.

The user pasted the delivered Kilowatt-hour Wikipedia Evidence JSON: retrievedAt 2026-09-30T04:11:06.117Z; wordCount 2450; truncated=false; SHA-256 9c80ba044ce7732f58b474e5b169f5af39227d572a156495355cc7d953b0390c. Prior conversation recorded payment confirmation and matching text hash. This demonstrates delivery on the tested version; it is not a claim that all future sources or releases are error-free.

## Current release — October 1, 2026

Active code: 74772428a5c1056675bdee29ba7e74a13875708c. Render deployment dep-dauremjm8hqs7390vst0 completed successfully at 2026-10-01T01:29:45.863Z. All three routes are active: Evidence $0.01, Verify $0.03, Research $0.05 USDC on Base mainnet. User explicitly authorized enabling all three on September 30. Earlier paused-release instructions are superseded.

49 tests pass, including strict installed x402 requirements matching and unchanged authorization after client-label normalization. Settlement buffering tests use a stub facilitator; they do not perform an on-chain payment. Production npm audit on October 1 reports zero known vulnerabilities.

At 2026-10-01T15:51Z, health, landing page, OpenAPI, llms.txt and both discovery documents returned 200. Live Verify and Research POST challenges returned x402 v2, eip155:8453, 30000/50000 atomic USDC respectively, and Bazaar metadata. No error-level Render logs found since 2026-10-01T01:30Z.

## Current blocker and next objective

Real paid Verify and Research delivery remains unverified. Available logs since the compatibility fix contain only our intentional invalid-signature probe (2026-10-01T01:30:26.464Z); exclude that probe from buyers and payments. The probe passed requirements matching and failed signature verification, as expected. Do not ask to repeat completed Evidence tests. Owner retains wallet custody and spending approval.

Verify returns lexical passage matches, not a semantic truth verdict. Research searches English Wikipedia only. Do not advertise broader capabilities. Source failures occur before payment requests.

Discovery remains unconfirmed: October 1 web searches found no FreshFact listing, but this is not exhaustive catalog evidence. The fetched x402.new API response was only page 1 (24 of 14,201 listings); absence from that page cannot establish absence from the directory. No distribution submissions or paid promotion performed.

Highest-value objective: complete one wallet-approved Verify delivery and one Research delivery, inspect the delivered passages/settlement receipts, and then test one specific independent agent task. Avoid adding products until usefulness and buyer demand are demonstrated.

Gross-revenue target math, not a forecast: $0.01 × 1,000 customers × 100 calls/day = $1,000/day; $0.03 × 1,000 × 34 = $1,020/day; $0.05 × 1,000 × 20 = $1,000/day. Costs and fees reduce net income.

## Commercial evidence

No independent paid buyer, repeat buyer or outside revenue verified. Owner payments are excluded. Maintain this distinction when reading payment telemetry.

## Verify and Research validation — September 30 Pacific evening

User authorized completing and enabling both products autonomously. Tested production preparation functions with contradictory passages, exact decimal quantities, unavailable sources and no matches. Live Wikipedia retrieval returned the correct 3.6 megajoules conversion and three article sources for Research. Fixed decimal sentence splitting and scores counting hidden truncated words. Tests expanded to 45 including installed x402 middleware tests for all three routes using a stub facilitator (not an on-chain transaction). Activate FRESHFACT_PRODUCTS_ENABLED=true after deployment and verify live POST challenges and before-payment errors. Verify is lexical passage retrieval, not a truth verdict. Research is English Wikipedia only. No paid transaction for these new endpoints has been performed by the assistant. Continue these recorded milestones rather than requesting repeat Evidence tests.


## September 30 payment-client compatibility checkpoint
- All three products activated and deployed in 6ac6890. Owner reports ten one-cent transactions total; no three-cent Verify settlement reported.
- Browser CORS and method reporting deployed in faa5fc2.
- x402Instant UI crashed reading legacy maxAmountRequired; identical display alias scoped to its origin deployed in f7c86ed. Verified unpaid Verify challenge renders 0.03 and Connect Wallet in Chrome.
- Owner paid retry at 2026-10-01T01:19:58.819Z returned 402, paymentPresented=true, deliverySucceeded=false. This is not a sale.
- Safe rejection diagnostics deployed in 271aa6d. Subsequent owner screenshot shows No matching payment requirements.
- Reproduced strict installed x402 requirements matcher rejecting legacy client labels. Normalize only redundant maxAmountRequired/name/version when identical to canonical amount/domain; signed authorization remains unchanged. 49 tests pass, including installed matcher accepting normalized terms and rejecting changed amounts.
- Real paid Verify and Research fulfillment remains unverified. Do not reset prior Evidence payment evidence or count owner tests as external revenue.
