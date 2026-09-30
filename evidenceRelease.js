function evidenceIsEnabled(env = process.env) {
  return env.FRESHFACT_EVIDENCE_ENABLED === "true";
}

function isPublicEvidenceRequest(req, env = process.env) {
  return evidenceIsEnabled(env) && req.method === "GET" && req.path === "/api/evidence";
}

module.exports = { evidenceIsEnabled, isPublicEvidenceRequest };
