import { NextRequest, NextResponse } from "next/server";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

import { embedText } from "@/lib/gemini";
import { getCollection } from "@/lib/chroma";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const userId = formData.get("userId") as string;
    const isUserSpecific = formData.get("userSpecific") === "true";

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized — userId required" },
        { status: 401 }
      );
    }

    console.log(`
[Docs API] Upload request:
  file: ${file.name}
  user: ${userId}
  scope: ${isUserSpecific ? "USER" : "GLOBAL"}
    `);

    // Read file contents
    let text = await file.text();

    // PDF Placeholder
    if (file.type === "application/pdf") {
      console.warn("[Docs API] PDF detected — implement PDF extraction later.");
      // TODO: pdf-parse or pdf.js pipeline
    }

    if (!text.trim()) {
      return NextResponse.json(
        { error: "File contains no readable text." },
        { status: 400 }
      );
    }

    // ---------- CHUNKING ----------
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 3000,
      chunkOverlap: 200,
    });

    const chunks = await splitter.splitText(text);
    console.log(`[Docs API] Split into ${chunks.length} chunks.`);

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "Document could not be chunked properly." },
        { status: 400 }
      );
    }

    // ---------- COLLECTION ----------
    const collectionName = isUserSpecific
      ? `user_${userId}`
      : "global_documents";

    const collection = await getCollection(collectionName);

    // ---------- EMBEDDINGS ----------
    const embeddings: number[][] = [];

    for (const chunk of chunks) {
      const vec = await embedText(chunk);

      if (!vec || vec.length === 0) {
        console.warn("[Docs API] Empty embedding skipped.");
        continue;
      }
      embeddings.push(vec);
    }

    console.log(`[Docs API] Generated ${embeddings.length} embeddings.`);

    if (embeddings.length === 0) {
      return NextResponse.json(
        { error: "Embedding generation failed." },
        { status: 500 }
      );
    }

    // ---------- IDS + METADATA ----------
    const ids = chunks.map((_, i) => `${file.name}-${userId}-${Date.now()}-${i}`);

    const metadatas = chunks.map((_, i) => ({
      filename: file.name,
      chunk: i,
      userId,
      scope: isUserSpecific ? "user" : "global",
      uploadedAt: new Date().toISOString(),
    }));

    // ---------- ADD TO CHROMA ----------
    await collection.add({
      ids,
      documents: chunks,
      embeddings,
      metadatas,
    });

    console.log(
      `[Docs API] Stored ${chunks.length} chunks into collection "${collectionName}".`
    );

    return NextResponse.json({
      success: true,
      filename: file.name,
      chunks: chunks.length,
      collection: collectionName,
    });
  } catch (error: any) {
    console.error("[Docs API] ERROR:", error);

    return NextResponse.json(
      {
        error: "Failed to upload document",
        details: error?.message || "Unknown",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized — userId required" },
        { status: 401 }
      );
    }

    // TODO: Store metadata in MongoDB
    return NextResponse.json({
      documents: [],
      message: "Document listing not implemented yet.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to list documents" },
      { status: 500 }
    );
  }
}
