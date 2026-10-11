// scripts/upload-documents.ts
// RUN: npx ts-node --project tsconfig.ts-node.json scripts/upload-documents.ts

import "dotenv/config"; // load env first

// --- tiny polyfills required by some pdfjs builds (no real DOM used) ---
;(globalThis as any).DOMMatrix = (globalThis as any).DOMMatrix ?? class {};
;(globalThis as any).HTMLCanvasElement = (globalThis as any).HTMLCanvasElement ?? class {};
;(globalThis as any).HTMLImageElement = (globalThis as any).HTMLImageElement ?? class {};

import fs from "fs";
import path from "path";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

import { addToCollection, getCollection } from "../lib/chroma";
import { embedText } from "../lib/gemini";

const TARGET_COLLECTION = "global_documents";
const FILES_DIR = "scripts/data";

/**
 * Try several possible pdfjs-dist import specifiers and return getDocument
 */
async function loadGetDocument(): Promise<any> {
  const candidates = [
    "pdfjs-dist/legacy/build/pdf.js",
    "pdfjs-dist/legacy/build/pdf",
    "pdfjs-dist/build/pdf.js",
    "pdfjs-dist/build/pdf",
    "pdfjs-dist"
  ];

  let lastErr: any = null;
  for (const spec of candidates) {
    try {
      const mod = await import(spec);
      if (typeof (mod as any).getDocument === "function") return (mod as any).getDocument;
      if ((mod as any).default && typeof (mod as any).default.getDocument === "function")
        return (mod as any).default.getDocument;
      if (typeof (mod as any).default === "function") return (mod as any).default;
      lastErr = new Error(`module loaded but getDocument not found in ${spec}`);
    } catch (err) {
      lastErr = err;
    }
  }

  throw new Error(
    "Could not load pdfjs-dist getDocument. Tried multiple specifiers. Last error: " +
      (lastErr && (lastErr as Error).message)
  );
}

async function extractPdfText(buffer: Buffer, getDocument: any): Promise<string> {
  // FIX: wrap Node Buffer into a real Uint8Array *with proper offset*
  const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  const pdf = await getDocument({ data: uint8 }).promise;
  let text = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item: any) => (item && item.str) || "").join(" ");
    text += strings + "\n\n";
  }

  return text;
}

async function readFileContent(filePath: string, getDocument: any) {
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".pdf") {
    console.log("📄 Extracting PDF using pdfjs-dist...");
    return await extractPdfText(buffer, getDocument);
  }

  return buffer.toString("utf-8");
}

async function processFile(fileName: string, getDocument: any) {
  const filePath = path.join(FILES_DIR, fileName);
  console.log(`\n📄 Reading file: ${fileName}`);

  let text = await readFileContent(filePath, getDocument);
  if (!text || !text.trim()) {
    console.log(`⚠️ ${fileName}: empty file`);
    return;
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 3000,
    chunkOverlap: 200,
  });

  const chunks = await splitter.splitText(text);
  console.log(`🔹 ${fileName}: ${chunks.length} chunks`);

  const embeddings: number[][] = [];

  for (const chunk of chunks) {
    const vec = await embedText(chunk);
    if (!vec?.length) continue;
    embeddings.push(vec);
  }

  if (embeddings.length === 0) {
    console.log(`❌ Failed embeddings for ${fileName}`);
    return;
  }

  const ids = chunks.map((_, idx) => `${fileName}-${Date.now()}-${idx}`);

  const metadatas = chunks.map((_, idx) => ({
    filename: fileName,
    chunk: idx,
    scope: "global",
    uploadedAt: new Date().toISOString(),
  }));

  await addToCollection(TARGET_COLLECTION, ids, chunks, embeddings, metadatas);

  console.log(`✅ Uploaded ${chunks.length} chunks for ${fileName}`);
}

async function main() {
  console.log("🚀 Starting bulk upload to ChromaDB Cloud...");
  console.log("Collection:", TARGET_COLLECTION);
  console.log("Reading directory:", FILES_DIR);

  // load pdf getDocument once
  const getDocument = await loadGetDocument();

  const files = fs.readdirSync(FILES_DIR);
  if (files.length === 0) return console.log("No files found.");

  for (const file of files) {
    await processFile(file, getDocument);
  }

  console.log("\n🎉 Upload Complete!");
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
