const BLOCK_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "blockquote", "pre"]);
const SKIP_TAGS = new Set(["nav", "footer", "aside", "script", "style", "noscript", "svg", "canvas", "template", "form", "button"]);

function normalize(value) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function extractReadableText($, maxChars) {
  const root = $("#mw-content-text").first().length ? $("#mw-content-text").first()
    : $("main").first().length ? $("main").first()
    : $("article").first().length ? $("article").first() : $("body");
  const blocks = [];
  function visit(node) {
    if (node.type === "text") return node.data || "";
    if (node.type !== "tag" && node.type !== "root") return "";
    if (SKIP_TAGS.has(node.name)) return "";
    if (BLOCK_TAGS.has(node.name)) {
      const text = normalize($(node).text());
      if (text) blocks.push({ type: node.name, text });
      return "";
    }
    let inline = "";
    const flush = () => {
      const text = normalize(inline);
      if (text) blocks.push({ type: node.name || "body", text });
      inline = "";
    };
    for (const child of node.children || []) {
      if (child.type === "tag" && (BLOCK_TAGS.has(child.name) ||
          ["div", "section", "article", "main"].includes(child.name))) {
        flush();
        visit(child);
      } else if (child.type === "tag" && SKIP_TAGS.has(child.name)) {
        continue;
      } else if (child.type === "tag") {
        inline += $(child).text();
      } else {
        inline += visit(child);
      }
    }
    flush();
    return "";
  }
  root.each((_, element) => visit(element));

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
  // A title or navigation label alone is not a delivered page extract.
  // A short prose paragraph can still be useful, so reject only when there
  // is no substantive non-heading block at all.
  const usable = sections.some(({ type, start, end }) =>
    !/^h[1-6]$/.test(type) && end - start >= 20 &&
    text.slice(start, end).split(/\s+/).length >= 4
  );
  return { text, sections, truncated: fullText.length > text.length, usable };
}

module.exports = { extractReadableText };
