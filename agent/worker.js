"use strict";
// FreshFactAgent buyer-discovery worker. Read-only; never posts or spends.
// Run: node agent/worker.js --once
// Optional: AGENT_DISCOVERY_URLS='https://example.org/page,https://example.net/page'
// Optional: AGENT_INTERVAL_MINUTES=60 (minimum 60)
const fs = require("node:fs");
const { URL } = require("node:url");
const { get } = require("./preflight");
const sources = (process.env.AGENT_DISCOVERY_URLS || "").split(",").map(x => x.trim()).filter(Boolean);
const interval = Math.max(60, Number(process.env.AGENT_INTERVAL_MINUTES) || 60) * 60000;
const terms = ["x402", "usdc", "base", "agent", "wallet", "pay per call", "paid api", "evidence"];
function safeUrl(value) {
  const u = new URL(value);
  if (u.protocol !== "https:" || u.username || u.password) throw new Error("HTTPS URL required");
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(u.hostname)) throw new Error("private target");
  return u.toString();
}
function score(body) {
  const s = body.toLowerCase();
  const matched = terms.filter(t => s.includes(t));
  return { matched, score: matched.length, potentialBuyer: matched.includes("agent") && (matched.includes("x402") || matched.includes("wallet")) };
}
async function cycle() {
  const leads = [];
  for (const source of sources.slice(0, 20)) {
    try {
      const url = safeUrl(source);
      const result = await get(url);
      const match = score(result.body.slice(0, 100000));
      leads.push({ url, status: result.status, ...match, independentlyVerifiedBuyer: false });
    } catch (error) {
      leads.push({ url: source, error: error.message, independentlyVerifiedBuyer: false });
    }
  }
  const report = { checkedAt: new Date().toISOString(), sourcesChecked: leads.length,
    candidates: leads.filter(x => x.potentialBuyer), leads,
    note: "Keyword discovery only. No buyer, wallet authorization, purchase or outreach verified." };
  fs.mkdirSync("agent/output", { recursive: true });
  fs.writeFileSync("agent/output/latest.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ checkedAt: report.checkedAt, sourcesChecked: leads.length, candidates: report.candidates.length }));
}
async function main() {
  await cycle();
  if (!process.argv.includes("--once")) setInterval(() => cycle().catch(e => console.error(e.message)), interval);
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { score, safeUrl, cycle };
