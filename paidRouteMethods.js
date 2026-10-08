const REQUIRED_METHODS = new Map([
  ["/api/evidence", "GET"],
  ["/api/verify", "POST"],
  ["/api/research", "POST"],
]);

function methodRequirement(path) {
  return REQUIRED_METHODS.get(path) || null;
}

function methodIsAllowed(req) {
  const required = methodRequirement(req.path);
  return !required || req.method === required || req.method === "OPTIONS";
}

module.exports = { methodRequirement, methodIsAllowed };
