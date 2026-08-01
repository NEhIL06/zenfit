/**
 * patch-chroma-embed.js
 *
 * Fixes the CJS/ESM module format conflict in @chroma-core/default-embed and chromadb.
 *
 * Root cause: Packages ship `.d.cts` files or reference `.d.cts` in package.json `exports`.
 * `.cts` explicitly forces CommonJS module format in Turbopack, but the files contain ESM `import`/`export` syntax.
 *
 * Fix:
 * 1. Replace all `.d.cts` references with `.d.ts` in package.json files under @chroma-core and chromadb.
 * 2. Neutralize any `.d.cts` files by replacing ESM syntax or replacing content with valid CJS syntax.
 */

const fs = require("fs");
const path = require("path");

function processDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        processDirectory(fullPath);
      } else if (entry.name === "package.json") {
        try {
          let content = fs.readFileSync(fullPath, "utf-8");
          if (content.includes(".d.cts")) {
            content = content.replace(/\.d\.cts/g, ".d.ts");
            fs.writeFileSync(fullPath, content, "utf-8");
            console.log(`[patch-chroma] Fixed .d.cts reference in ${fullPath}`);
          }
        } catch (e) {
          console.warn(`[patch-chroma] Could not patch ${fullPath}:`, e.message);
        }
      } else if (entry.name.endsWith(".d.cts")) {
        try {
          fs.writeFileSync(fullPath, "module.exports = {};", "utf-8");
          console.log(`[patch-chroma] Replaced ESM content in ${fullPath}`);
        } catch (e) {
          console.warn(`[patch-chroma] Could not overwrite ${fullPath}:`, e.message);
        }
      }
    }
  } catch (err) {
    console.warn(`[patch-chroma] Directory error ${dir}:`, err.message);
  }
}

const nodeModules = path.join(__dirname, "..", "node_modules");

try {
  processDirectory(path.join(nodeModules, "@chroma-core"));
  processDirectory(path.join(nodeModules, "chromadb"));
  console.log("[patch-chroma] Postinstall patch completed successfully.");
} catch (err) {
  console.warn("[patch-chroma] Warning: Could not complete patch:", err.message);
}
