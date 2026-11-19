# 402 Registry review fixes — November 18, 2026

Jeff authorized completing all eight findings from the November 11 review (77/100). This change implements:

1. XML sitemap at /sitemap.xml and discovery through /robots.txt; only the public homepage is indexed, excluding paid requests and checkout.
2. JSON-LD WebSite metadata matching the service's documented capabilities.
3. Open Graph and Twitter sharing tags with an actual 1200×630 PNG preview.
4. Absolute canonical homepage and checkout URLs.
5. SVG and ICO favicons.
6. max-image-preview:large robots directives; checkout remains noindex.
7. One-year HSTS for HTTPS, without opting the shared hosting domain into preload.
8. Security headers: nosniff, frame denial, referrer and permissions policies; nonce-scoped homepage CSP alongside existing checkout CSP.

Validation: all 65 tests pass, including expanded production-server integration checks for sitemap XML, robots discovery, JSON-LD, canonical/social tags, nonce agreement, icon/image routes, and HTTPS security headers. Existing settlement, delivery, browser wallet and payment compatibility tests pass. No payment was sent and no new review score is claimed. Confirm the deployed commit through /health and recheck public routes before marking live. Registry rescoring is a separate step; no paid rescore was purchased.
