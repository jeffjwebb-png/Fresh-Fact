const { once } = require("node:events");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

async function reservePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  await new Promise((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve())
  );
  return port;
}

test("production server imports its complete dependency graph and becomes healthy", async (t) => {
  const port = await reservePort();
  const child = spawn(process.execPath, [path.join(__dirname, "Server.js")], {
    env: {
      ...process.env,
      PORT: String(port),
      FRESHFACT_PAY_TO: "0xdc379f04221295e2394FA6B6118b0913a73C5197",
      FRESHFACT_EVIDENCE_ENABLED: "false",
      CDP_API_KEY_ID: "startup-test",
      CDP_API_KEY_SECRET: "startup-test",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  t.after(() => child.kill("SIGTERM"));

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      assert.fail("FreshFact exited during startup:\n" + output);
    }

    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      assert.equal(response.status, 200);
      const health = await response.json();
      assert.equal(health.ok, true);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  assert.ok(Date.now() < deadline, "FreshFact did not become healthy within 10 seconds:\n" + output);

  const base = `http://127.0.0.1:${port}`;
  const home = await fetch(base + "/", { headers: { "X-Forwarded-Proto": "https" } });
  assert.equal(home.status, 200);
  assert.equal(home.headers.get("strict-transport-security"), "max-age=31536000");
  assert.equal(home.headers.get("x-content-type-options"), "nosniff");
  assert.equal(home.headers.get("x-frame-options"), "DENY");
  assert.ok(home.headers.get("referrer-policy"));
  assert.ok(home.headers.get("permissions-policy"));
  assert.equal(home.headers.get("x-powered-by"), null);
  const $ = require("cheerio").load(await home.text());
  const canonical = "https://fresh-fact.onrender.com/";
  assert.equal($('link[rel="canonical"]').attr("href"), canonical);
  assert.match($('meta[name="robots"]').attr("content"), /max-image-preview:large/);
  assert.equal($('meta[property="og:url"]').attr("content"), canonical);
  assert.equal($('meta[name="twitter:card"]').attr("content"), "summary_large_image");
  const data = JSON.parse($('script[type="application/ld+json"]').text());
  assert.equal(data["@type"], "WebSite");
  assert.equal(data.url, canonical);
  const nonce = $("style").attr("nonce");
  assert.ok(nonce);
  assert.equal($('script[type="application/ld+json"]').attr("nonce"), nonce);
  assert.ok(home.headers.get("content-security-policy").includes(`'nonce-${nonce}'`));

  const sitemap = await fetch(base + "/sitemap.xml");
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.headers.get("content-type"), /application\/xml/);
  const xml = require("cheerio").load(await sitemap.text(), { xmlMode: true });
  assert.equal(xml("urlset").attr("xmlns"), "http://www.sitemaps.org/schemas/sitemap/0.9");
  assert.deepEqual(xml("loc").map((i, el) => xml(el).text()).get(), [canonical]);
  const robots = await fetch(base + "/robots.txt");
  assert.equal(robots.status, 200);
  assert.ok((await robots.text()).includes("Sitemap: " + canonical + "sitemap.xml"));
  for (const [asset, type] of [["favicon.ico", "image/"], ["favicon.svg", "image/svg+xml"], ["social-preview.png", "image/png"]]) {
    const response = await fetch(base + "/" + asset);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get("content-type").startsWith(type));
    assert.ok((await response.arrayBuffer()).byteLength > 100);
  }
});
