const crypto = require("crypto");

const MAX_SOURCES = 3;
const MAX_QUERY_LENGTH = 300;

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function validateSources(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_SOURCES ||
      value.some((url) => typeof url !== "string" || url.length > 2048)) {
    throw new Error("Provide 1 to 3 public source URLs.");
  }
  return value;
}

function validateClaim(value) {
  const claim = cleanText(value);
  if (typeof value !== "string" || claim.length < 8 || claim.length > MAX_QUERY_LENGTH) {
    throw new Error("Provide a claim of 8 to 300 characters.");
  }
  return claim;
}

function validateQuery(value) {
  const query = cleanText(value);
  if (typeof value !== "string" || query.length < 3 || query.length > MAX_QUERY_LENGTH) {
    throw new Error("Provide a research query of 3 to 300 characters.");
  }
  return query;
}

function passageMatches(query, text, limit = 3) {
  const terms = [...new Set((query.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [])
    .filter((term) => !new Set(["the", "and", "for", "with", "from", "that", "this", "was", "were", "are", "has", "have", "had", "not", "but"]).has(term)))];
  if (terms.length === 0) return [];
  const passages = cleanText(text).match(/[^.!?]+(?:[.!?]+|$)/g) || [];
  return passages.map((passage, index) => {
    const exact = passage.toLowerCase();
    const matchedTerms = terms.filter((term) => new RegExp(`(^|[^\\p{L}\\p{N}])${term}([^\\p{L}\\p{N}]|$)`, "u").test(exact));
    return { passage: passage.trim().slice(0, 700), matchedTerms, score: matchedTerms.length / terms.length, index };
  }).filter((item) => item.score > 0 && item.passage)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ passage, matchedTerms, score }) => ({ passage, matchedTerms, termCoverage: Number(score.toFixed(3)) }));
}

function evidenceFromPage(page, query) {
  return {
    sourceUrl: page.finalUrl,
    retrievedAt: page.retrievedAt,
    title: page.title,
    contentHashSha256: crypto.createHash("sha256").update(page.text, "utf8").digest("hex"),
    passages: passageMatches(query, page.text),
  };
}

async function searchWikipedia(query) {
  const endpoint = new URL("https://en.wikipedia.org/w/api.php");
  endpoint.searchParams.set("action", "query");
  endpoint.searchParams.set("list", "search");
  endpoint.searchParams.set("srsearch", query);
  endpoint.searchParams.set("srnamespace", "0");
  endpoint.searchParams.set("srlimit", String(MAX_SOURCES));
  endpoint.searchParams.set("format", "json");
  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(10000),
    headers: { "User-Agent": "FreshFactEvidenceBot/1.0 (https://fresh-fact.onrender.com)", Accept: "application/json" },
  });
  if (!response.ok) throw new Error("SEARCH_UNAVAILABLE");
  const body = await response.text();
  if (body.length > 100000) throw new Error("SEARCH_UNAVAILABLE");
  const result = JSON.parse(body);
  return (result.query?.search || []).slice(0, MAX_SOURCES)
    .filter((item) => Number.isSafeInteger(item.pageid))
    .map((item) => `https://en.wikipedia.org/?curid=${item.pageid}`);
}

module.exports = { validateSources, validateClaim, validateQuery, passageMatches, evidenceFromPage, searchWikipedia };
