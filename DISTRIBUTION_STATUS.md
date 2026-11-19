# FreshFact distribution — November 18, 2026

## Completed

- Agent402: registered https://fresh-fact.onrender.com with POST /api/index/register. Response confirmed listed=true, three tools, Base network, and successful rechecks. Subsequent GET /api/index?seller=fresh-fact.onrender.com confirms all three, known prices, health=1, and executeViaCallableNow=true in the Base unproven tier. This is not proven-seller eligibility or a paid purchase. Evidence's empty-parameter probe yields HTTP 400 as intended by input validation; actual well-formed unpaid calls return correct 402s. Existing service prices and payout wallet remain unchanged.
- Agent Bazaar by Saylor Innovations: POST https://bazaar.saylorinnovations.com/submit with manifestUrl=https://fresh-fact.onrender.com/.well-known/x402.json returned {"ok":true,"host":"fresh-fact.onrender.com","resourceCount":3}. Independent discovery/search?query=freshfact returned Evidence ID 81876 ($0.01), Verify ID 81877 ($0.03), Research ID 81878 ($0.05), correct Base USDC recipient and amounts. Its verified flag is manifest validation, not paid fulfillment. No listing fee or wallet spending.

## Deployment

Release bf1cbddf6300f8657e282119caefe1e38f8ebe7d adds a compatible x402 v2 manifest at /.well-known/x402.json without changing existing discovery documents or payment handling. It derives exact atomic amounts and recipient from the production route configuration, retains method/descriptions/discovery extensions, and excludes paused products. All 67 tests pass. Live health confirms the exact release. Every manifest offer was compared against its route's actual unpaid 402 quote, with matching scheme, network, asset, recipient, amount and timeout. No paid call was made during these checks.

## Other candidates researched

- x402.pub developer registration currently advertises $99/year; deferred, no purchase.
- AgentBuy supports digital-asset licensing with Solana USDC and fees; potential separate artwork channel, not a direct listing for this Base API. No signup or asset upload made.
- Agent Soul at agentsoul.art is an art/NFT platform with paid Solana writes; deferred, no wallet or minting action.
- Coglings at coglings.io is an invite beta on WAX; no demonstrated fit for FreshFact API sales, no signup made.
- The separate agent-bazaar.com skill marketplace is not the Saylor Innovations Agent Bazaar above. Its marketing and example traffic are not verified buyer evidence. No submission made there.

## Next checks

Recheck both catalogs for persistence and attribution of genuinely paid calls. Never count free listing validation, crawls or a verified badge as revenue. Preserve four previously recorded external paid calls totaling $0.18 as the existing commercial baseline; no new revenue or organic buyer is established by this work. Moltbook is a separate outreach channel, with no purchase attributed to it.
