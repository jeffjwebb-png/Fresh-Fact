const { load } = require("cheerio");
const { extractReadableText } = require("./readableText");

const cases = [
  ["Example", "https://example.com/", /documentation examples/i],
  ["Wikipedia energy", "https://en.wikipedia.org/wiki/Kilowatt-hour", /3\.6.*megajoule/i],
  ["Wikipedia HTTP", "https://en.wikipedia.org/wiki/HTTP_402", /Payment Required/i],
  ["MDN 402", "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/402", /Payment Required/i],
  ["RFC 9110", "https://www.rfc-editor.org/rfc/rfc9110.html", /HTTP Semantics/i],
  ["Node assert", "https://nodejs.org/api/assert.html", /strict assertion mode/i],
  ["Express routing", "https://expressjs.com/en/guide/routing.html", /route methods/i],
  ["npm package.json", "https://docs.npmjs.com/cli/v11/configuring-npm/package-json", /package\.json/i],
  ["GitHub REST", "https://docs.github.com/en/rest?apiVersion=2022-11-28", /REST API/i],
  ["Coinbase x402", "https://docs.cdp.coinbase.com/x402/welcome", /x402/i],
  ["x402", "https://www.x402.org/", /payments?/i],
  ["x402 GitHub", "https://github.com/x402-foundation/x402", /internet.native payments/i],
  ["Cloudflare x402", "https://blog.cloudflare.com/x402/", /x402/i],
  ["W3C HTML", "https://www.w3.org/TR/2017/REC-html52-20171214/", /HTML 5\.2/i],
  ["Python urllib", "https://docs.python.org/3/library/urllib.request.html", /opening URLs/i],
  ["PostgreSQL SELECT", "https://www.postgresql.org/docs/current/sql-select.html", /retrieve rows/i],
  ["SQLite JSON", "https://www.sqlite.org/json1.html", /JSON functions/i],
  ["Redis", "https://redis.io/docs/latest/develop/", /develop with Redis/i],
  ["Kubernetes", "https://kubernetes.io/docs/concepts/overview/", /Kubernetes/i],
  ["AWS S3", "https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html", /object storage/i],
  ["Census API", "https://www.census.gov/data/developers/about.html", /Census Data API/i],
  ["NASA climate", "https://science.nasa.gov/climate-change/", /climate change/i],
  ["NIST SHA", "https://csrc.nist.gov/projects/hash-functions", /hash/i],
  ["Schema WebPage", "https://schema.org/WebPage", /WebPage/i],
  ["IANA media types", "https://www.iana.org/assignments/media-types/media-types.xhtml", /Media Types/i],
];

async function run([name, url, expected]) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: { Accept: "text/html,text/plain", "User-Agent": "FreshFactBenchmark/1.0" },
  });
  if (!response.ok) return { name, url, pass: false, reason: `HTTP ${response.status}` };
  const $ = load(await response.text());
  const result = extractReadableText($, 50000);
  const found = expected.test(result.text);
  return {
    name, url, pass: result.usable && found,
    usable: result.usable, found, rejectionReason: result.rejectionReason,
    chars: result.text.length, words: result.text.split(/\s+/).filter(Boolean).length,
    truncated: result.truncated, sample: result.text.slice(0, 240),
  };
}

(async () => {
  const results = [];
  for (let index = 0; index < cases.length; index += 5) {
    results.push(...await Promise.all(cases.slice(index, index + 5).map(async (item) => {
      try { return await run(item); }
      catch (error) { return { name: item[0], url: item[1], pass: false, reason: error.name || error.message }; }
    })));
  }
  const passed = results.filter((item) => item.pass).length;
  console.log(JSON.stringify({ passed, total: results.length, results }, null, 2));
  process.exitCode = passed === results.length ? 0 : 1;
})();
