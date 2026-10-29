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
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  assert.fail("FreshFact did not become healthy within 10 seconds:\n" + output);
});
