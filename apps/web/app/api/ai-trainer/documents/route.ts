import { NextRequest, NextResponse } from "next/server";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

import { requireAuthUser } from "@/lib/api-security";
import { getCollection } from "@/lib/chroma";
import { toSafeErrorMessage } from "@/lib/error-handler";
import { embedText } from "@/lib/gemini";
import { logger } from "@/lib/logger";

const ALLOWED_TYPES = ["text/plain", "text/markdown"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthUser(req);
    if (!auth.ok) return auth.response;

    const userId = auth.user.userId;
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const isUserSpecific = formData.get("userSpecific") === "true";

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (!isUserSpecific) {
      return NextResponse.json(
        { error: "Global document uploads require an admin workflow." },
        { status: 403 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Only .txt and .md files are accepted." },
        { status: 415 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File exceeds the 5 MB size limit." },
        { status: 413 }
      );
    }

    logger.info({ userId, filename: file.name, size: file.size }, "[Docs API] Upload request");

    const text = await file.text();
    if (!text.trim()) {
      return NextResponse.json(
        { error: "File contains no readable text." },
        { status: 400 }
      );
    }

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 3000,
      chunkOverlap: 200,
    });

    const chunks = await splitter.splitText(text);
    logger.info({ userId, chunks: chunks.length }, "[Docs API] Split document");

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "Document could not be chunked properly." },
        { status: 400 }
      );
    }

    const collectionName = `fitness_user_${userId}`;
    const collection = await getCollection(collectionName);

    const successfulChunks: string[] = [];
    const embeddings: number[][] = [];

    for (const chunk of chunks) {
      const vec = await embedText(chunk);
      if (!vec || vec.length === 0) {
        logger.warn({ userId }, "[Docs API] Empty embedding skipped");
        continue;
      }
      successfulChunks.push(chunk);
      embeddings.push(vec);
    }

    logger.info(
      { userId, embeddings: embeddings.length, chunks: chunks.length },
      "[Docs API] Generated embeddings"
    );

    if (embeddings.length === 0) {
      return NextResponse.json(
        { error: "Embedding generation failed for all chunks." },
        { status: 500 }
      );
    }

    const uploadedAt = new Date().toISOString();
    const ids = successfulChunks.map((_, i) => `${file.name}-${userId}-${uploadedAt}-${i}`);
    const metadatas = successfulChunks.map((_, i) => ({
      filename: file.name,
      chunk: i,
      userId,
      scope: "user",
      uploadedAt,
    }));

    await collection.add({
      ids,
      documents: successfulChunks,
      embeddings,
      metadatas,
    });

    logger.info(
      { userId, stored: successfulChunks.length, chunks: chunks.length, collectionName },
      "[Docs API] Stored chunks"
    );

    return NextResponse.json({
      success: true,
      filename: file.name,
      chunksTotal: chunks.length,
      chunksStored: successfulChunks.length,
      collection: collectionName,
    });
  } catch (error: unknown) {
    logger.error({ err: toSafeErrorMessage(error) }, "[Docs API] Upload error");
    return NextResponse.json({ error: "Failed to upload document" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthUser(req);
    if (!auth.ok) return auth.response;

    return NextResponse.json({
      documents: [],
      message: "Document listing not implemented yet.",
    });
  } catch (error: unknown) {
    logger.error({ err: toSafeErrorMessage(error) }, "[Docs API] List error");
    return NextResponse.json({ error: "Failed to list documents" }, { status: 500 });
  }
}
