const crypto = require("crypto");

const RECEIPT_VERSION = "1.0";

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function createEvidenceReceipt({
  requestedUrl,
  finalUrl,
  retrievedAt,
  contentHash,
  text,
  sections,
  truncated,
}) {
  const citations = sections.map(({ type, start, end }, index) => {
    const passage = text.slice(start, end);
    return {
      id: `section-${index + 1}`,
      type,
      start,
      end,
      textHash: sha256(passage),
    };
  });

  const receiptBasis = {
    receiptVersion: RECEIPT_VERSION,
    requestedUrl,
    finalUrl,
    retrievedAt,
    contentHash,
    truncated: Boolean(truncated),
    citations,
  };

  return {
    receiptId: `ffr_${sha256(JSON.stringify(receiptBasis)).slice(0, 32)}`,
    receiptVersion: RECEIPT_VERSION,
    purpose: "Audit-ready record of the exact normalized source text delivered to an agent.",
    createdAt: retrievedAt,
    subjectUrl: finalUrl,
    content: {
      field: "data.text",
      algorithm: "sha256",
      hash: contentHash,
      truncated: Boolean(truncated),
    },
    citations,
    verification: {
      method: "Compute SHA-256 over the UTF-8 bytes of data.text and compare it with content.hash.",
    },
    limitations: [
      "The receipt records delivered text and provenance; it does not prove that the source is truthful or authentic.",
      "Store the response if later review is required; FreshFact does not archive source pages.",
    ],
  };
}

module.exports = { RECEIPT_VERSION, createEvidenceReceipt, sha256 };
