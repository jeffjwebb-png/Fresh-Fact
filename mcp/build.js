/**
 * Build step: copies src/index.js to dist/index.js.
 *
 * There is nothing to transpile — the source is plain ESM and node >=18 runs
 * it directly. This exists so `npm publish` has a predictable dist/ artifact
 * and so the package has no build-time dependencies.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "src", "index.js");
const target = join(here, "dist", "index.js");

await mkdir(join(here, "dist"), { recursive: true });

const code = await readFile(source, "utf8");
const banner = [
  "#!/usr/bin/env node",
  "// Generated from src/index.js by build.js. Do not edit directly.",
  "",
].join("\n");

await writeFile(target, banner + code, { mode: 0o755 });
console.log(`Wrote ${target}`);
