const BLOCK_SELECTOR = "h1,h2,h3,h4,h5,h6,p,li,blockquote,pre";

function normalize(value) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function extractReadableText($, maxChars) {
  const root = $("main").first().length ? $("main").first()
    : $("article").first().length ? $("article").first() : $("body");
  const blocks = [];
  root.find(BLOCK_SELECTOR).each((_, element) => {
    // Nested block tags (especially list items containing paragraphs) must not repeat text.
    if ($(element).parents(BLOCK_SELECTOR).length) return;
    const text = normalize($(element).text());
    if (text) blocks.push({ type: element.name, text });
  });

  if (!blocks.length) {
    const fallback = normalize(root.text());
    if (fallback) blocks.push({ type: "body", text: fallback });
  }

  const fullText = blocks.map((block) => block.text).join("\n\n");
  const text = fullText.slice(0, maxChars);
  const sections = [];
  let cursor = 0;
  for (const block of blocks) {
    const start = cursor;
    const end = Math.min(start + block.text.length, text.length);
    if (start >= text.length) break;
    sections.push({ type: block.type, start, end });
    cursor += block.text.length + 2;
  }
  return { text, sections, truncated: fullText.length > text.length };
}

module.exports = { extractReadableText };
