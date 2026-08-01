/**
 * patch-chroma-embed.js
 *
 * Fixes the CJS/ESM module format conflict in @chroma-core/default-embed.
 *
 * Root cause: The package ships `dist/cjs/default-embed.d.cts` which has a
 * `.cts` extension (explicitly marks it as CommonJS) but the file content
 * uses ESM `export` syntax. Turbopack treats this as a fatal conflict.
 *
 * Fix: Patch the package.json of @chroma-core/default-embed to change
 * `"type": "commonjs"` → `"type": "module"` so the package-level format
 * matches the ESM source code.
 */

const fs = require("fs");
const path = require("path");

const PKG_PATH = path.join(
  __dirname,
  "..",
  "node_modules",
  "@chroma-core",
  "default-embed",
  "package.json"
);

try {
  if (!fs.existsSync(PKG_PATH)) {
    console.log("[patch-chroma-embed] Package not found, skipping.");
    process.exit(0);
  }

  const raw = fs.readFileSync(PKG_PATH, "utf-8");
  const pkg = JSON.parse(raw);

  if (pkg.type === "commonjs") {
    pkg.type = "module";
    fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2));
    console.log(
      "[patch-chroma-embed] ✓ Fixed @chroma-core/default-embed package.json: type commonjs → module"
    );
  } else {
    console.log(
      `[patch-chroma-embed] Already OK (type="${pkg.type}"), no patch needed.`
    );
  }
} catch (err) {
  // Non-fatal — don't fail the install
  console.warn("[patch-chroma-embed] Warning: Could not apply patch:", err.message);
}
