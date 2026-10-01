const { evidenceFromPage } = require("./products");
const { PreflightError } = require("./preflightGate");

function createProductPreparers({ readEvidencePage, searchWikipedia }) {
  async function prepareVerifyResponse(req) {
    try {
      const pages = await Promise.all(req.validatedUrls.map(readEvidencePage));
      const sources = pages.map((page) => evidenceFromPage(page, req.validatedClaim));
      if (!sources.some((source) => source.passages.length)) {
        throw new PreflightError(422, "NO_RELEVANT_PASSAGES", "Sources contained no passages matching the claim; no payment was requested.");
      }
      return {
        service: "FreshFact Verify", version: "1.0.0", claim: req.validatedClaim,
        assessment: "related_passages_found",
        scope: "Supplied URLs only; lexical matching, not semantic fact checking.",
        sources,
        note: "Related passages may contradict or merely mention the claim. Read each source before treating it as support.",
      };
    } catch (error) {
      if (error instanceof PreflightError) throw error;
      throw new PreflightError(502, "SOURCE_UNAVAILABLE", "Could not retrieve all supplied sources; no payment was requested.");
    }
  }


  async function prepareResearchResponse(req) {
    try {
      const urls = await searchWikipedia(req.validatedQuery);
      if (!urls.length) {
        throw new PreflightError(422, "NO_RESULTS", "No Wikipedia articles matched this query; no payment was requested.");
      }
      const results = await Promise.allSettled(urls.map(readEvidencePage));
      const sources = results.filter((result) => result.status === "fulfilled")
        .map((result) => evidenceFromPage(result.value, req.validatedQuery));
      if (!sources.length && urls.length) throw new Error("SOURCE_UNAVAILABLE");
      if (!sources.some((source) => source.passages.length)) {
        throw new PreflightError(422, "NO_RELEVANT_PASSAGES", "Retrieved articles contained no passages matching the query; no payment was requested.");
      }
      return {
        service: "FreshFact Research", version: "1.0.0", query: req.validatedQuery,
        scope: "English Wikipedia only", searchedAt: new Date().toISOString(),
        sources, unavailableSourceCount: results.length - sources.length,
        note: "Passages are lexical matches, not a truth assessment. Wikipedia coverage and article update times vary.",
      };
    } catch (error) {
      if (error instanceof PreflightError) throw error;
      throw new PreflightError(502, "RESEARCH_UNAVAILABLE", "Could not complete Wikipedia research; no payment was requested.");
    }
  }



  return { prepareVerifyResponse, prepareResearchResponse };
}
module.exports = { createProductPreparers };
