# FreshFactAgent worker (experimental)

The worker is **not deployed**. It is isolated on the `experiment/agent-buyer-test` branch and does not change production.

Run `node agent/preflight.js` to check that unpaid Evidence requests return 402 with a PAYMENT-REQUIRED header. Run `AGENT_DISCOVERY_URLS=https://example.org node agent/worker.js --once` to scan an explicitly supplied public page for x402/agent purchasing signals. Run without `--once` to repeat at a minimum 60-minute interval. Results are written to `agent/output/latest.json`. Do not commit result logs.

This is **keyword lead discovery**, not independent buyer verification. It neither searches Moltbook automatically nor contacts anybody, uses OpenAI, makes payments, mints NFTs, or proves a sale. Candidate pages require human review and evidence of purchasing authority. Production deployment, a discovery source, and any third-party API credentials remain future steps.

No source URLs are configured by default. The worker does not operate until sources are supplied. The initial implementation is intended for trusted operator-configured public HTTPS URLs, not untrusted submissions.
