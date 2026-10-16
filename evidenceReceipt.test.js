const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createEvidenceReceipt, sha256 } = require("./evidenceReceipt");

test("builds a deterministic audit receipt with independently verifiable citations", () => {
  const text = "Return policy\n\nReturns are accepted within thirty days.";
  const sections = [
    { type: "h1", start: 0, end: 13 },
    { type: "p", start: 15, end: text.length },
  ];
  const input = {
    requestedUrl: "https://example.com/policy",
    finalUrl: "https://example.com/policy",
    retrievedAt: "2026-10-16T15:00:00.000Z",
    contentHash: sha256(text),
    text,
    sections,
    truncated: false,
  };

  const first = createEvidenceReceipt(input);
  const second = createEvidenceReceipt(input);

  assert.equal(first.receiptId, second.receiptId);
  assert.match(first.receiptId, /^ffr_[0-9a-f]{32}$/);
  assert.equal(first.content.hash, sha256(text));
  assert.equal(first.content.field, "data.text");
  assert.equal(first.citations.length, 2);
  assert.equal(first.citations[1].textHash, sha256(text.slice(15)));
});

test("receipt identity changes when delivered text or provenance changes", () => {
  const base = {
    requestedUrl: "https://example.com",
    finalUrl: "https://example.com/",
    retrievedAt: "2026-10-16T15:00:00.000Z",
    text: "A useful source paragraph.",
    sections: [{ type: "p", start: 0, end: 26 }],
    truncated: false,
  };
  const first = createEvidenceReceipt({ ...base, contentHash: sha256(base.text) });
  const changedText = `${base.text} Updated.`;
  const second = createEvidenceReceipt({
    ...base,
    text: changedText,
    sections: [{ type: "p", start: 0, end: changedText.length }],
    contentHash: sha256(changedText),
  });

  assert.notEqual(first.receiptId, second.receiptId);
});
