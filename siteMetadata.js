const path = require("node:path");

const SITE_URL = "https://fresh-fact.onrender.com";

function siteHead({ checkout = false, nonce = "" } = {}) {
  const url = SITE_URL + (checkout ? "/checkout" : "/");
  const title = checkout ? "FreshFact Evidence Checkout" : "FreshFact Evidence";
  const description = "Web evidence receipts for AI agents, with source URLs, retrieval timestamps and content hashes. USDC payments on Base.";
  const structured = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "FreshFact",
    url: SITE_URL + "/",
    description,
  };
  return `<link rel="canonical" href="${url}">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <meta name="robots" content="${checkout ? "noindex, follow" : "index, follow"}, max-image-preview:large">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="FreshFact">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${SITE_URL}/social-preview.png">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="FreshFact: Web evidence for AI agents">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${SITE_URL}/social-preview.png">
  <meta name="twitter:image:alt" content="FreshFact: Web evidence for AI agents">
  ${checkout ? "" : `<script nonce="${nonce}" type="application/ld+json">${JSON.stringify(structured)}</script>`}`;
}

function siteSecurity(req, res, next) {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "X-DNS-Prefetch-Control": "off",
  });
  // HSTS applies to HTTPS only. Do not opt Render's shared domain into preload.
  if (req.secure) res.set("Strict-Transport-Security", "max-age=31536000");
  next();
}

function registerSiteAssets(app) {
  for (const name of ["favicon.svg", "favicon.ico", "social-preview.png"]) {
    app.get("/" + name, (req, res) => {
      res.set("Cache-Control", "public, max-age=3600");
      res.sendFile(path.join(__dirname, "public", name));
    });
  }
}

module.exports = { siteHead, siteSecurity, registerSiteAssets, SITE_URL };
