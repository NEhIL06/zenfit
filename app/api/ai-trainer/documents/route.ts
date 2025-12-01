import { NextRequest, NextResponse } from "next/server";
import { getVectorStore } from "@/lib/ai-trainer/vector-store";
import { Document } from "@langchain/core/documents";

/**
 * POST /api/ai-trainer/documents
 * Upload and ingest documents (Global or User-specific)
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const isUserSpecific = formData.get("userSpecific") === "true";
    const userId = formData.get("userId") as string;

    if (!file) {
      return NextResponse.json(
        { error: "File is required" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized — userId missing" },
        { status: 401 }
      );
    }

    console.log(`[Docs API] Uploading file "${file.name}" for user "${userId}"`);

    // Read raw text
    let text = await file.text();

    // (Optional) PDF text extraction placeholder
    if (file.type === "application/pdf") {
      console.warn("[Docs API] PDF detected — add PDF extraction logic");
      // TODO: PDF parsing — e.g., pdf-parse
      // text = await extractPdfText(file);
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "File contains no readable text." },
        { status: 400 }
      );
    }

    // Build LangChain Document
    const document = new Document({
      pageContent: text,
      metadata: {
        filename: file.name,
        uploadedAt: new Date().toISOString(),
        uploadedBy: userId,
        scope: isUserSpecific ? "user" : "global",
      },
    });

    const vectorStore = getVectorStore();
    let documentIds: string[] = [];

    if (isUserSpecific) {
      console.log(`[Docs API] Adding to USER collection: ${userId}`);
      documentIds = await vectorStore.addUserDocuments(userId, [document]);
    } else {
      console.log(`[Docs API] Adding to GLOBAL collection`);
      documentIds = await vectorStore.addGlobalDocuments([document]);
    }

    console.log(
      `[Docs API] Successfully added document "${file.name}" → ${documentIds.length} chunks`
    );

    return NextResponse.json({
      success: true,
      filename: file.name,
      documentIds,
      chunkCount: documentIds.length,
      scope: isUserSpecific ? "user" : "global",
    });
  } catch (error) {
    console.error("[Docs API] ERROR:", error);

    return NextResponse.json(
      {
        error: "Failed to upload/injest document",
        details: error instanceof Error ? error.message : "Unknown",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai-trainer/documents
 * List documents uploaded by a user
 * (Add DB logic later — placeholder for now)
 */
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

    console.log(`[Docs API] Listing documents for ${userId}`);

    // TODO: integrate MongoDB storing metadata about documents
    return NextResponse.json({
      documents: [],
      note: "Document listing DB not implemented yet.",
    });
  } catch (error) {
    console.error("[Docs API] Error listing documents:", error);
    return NextResponse.json(
      {
        error: "Failed to list documents",
        details: error instanceof Error ? error.message : "Unknown",
      },
      { status: 500 }
    );
  }
}
