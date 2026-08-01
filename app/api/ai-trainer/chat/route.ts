import { NextRequest, NextResponse } from "next/server";
import { runSelfRAG } from "@/lib/ai-trainer/self-rag";
import { Mistral } from "@mistralai/mistralai";
import { getCache, setCache, CacheKeys, TTL } from "@/lib/cache";

let mistralClient: Mistral | null = null;

function getMistralClient() {
  if (!mistralClient) {
    mistralClient = new Mistral({
      apiKey: process.env.MISTRAL_API_KEY || "",
    });
  }
  return mistralClient;
}

function isQuotaError(e: any): boolean {
  const msg = `${e?.message || ""} ${e?.status || ""} ${JSON.stringify(e || {})}`.toLowerCase()
  return (
    e?.status === 429 ||
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("resource_exhausted") ||
    msg.includes("too many requests")
  )
}

/** Helper: call Mistral for text generation */
async function callGemini(prompt: string) {
  const ai = getMistralClient();
  const res = await ai.chat.complete({
    model: "mistral-small-latest",
    messages: [
      { role: "user", content: prompt },
      { role: "system", content: "You are an expert in fitness and nutrition" },
    ],
  });
  const text = res.choices[0].message.content?.toString();
  return text ?? "";
}

/** Helper: classify query */
async function classifyQuery(query: string): Promise<"fitness" | "general"> {
  const prompt = `
Classify the user message below as "fitness" or "general".
examples of general:
- "How are you?", "Hello, how are you?", "Hello", "Hi"

examples of fitness:
- "What is the best workout for weight loss?"
- "I have some problems in stomach so can you regenerate the plans"
- "I want to lose weight", "I want to build muscle"

Return ONLY the classification word without explanation.

USER MESSAGE:
${query}
`;

  const raw = await callGemini(prompt);
  const cleaned = raw.toLowerCase();
  if (cleaned.includes("fitness")) return "fitness";
  return "general";
}

export async function POST(req: NextRequest) {
  try {
    const { message, images, conversationId, userId, chatHistory } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message must be a non-empty string" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized — userId missing" },
        { status: 401 }
      );
    }

    console.log("[Chat API] User:", userId);
    console.log("[Chat API] Message:", message);

    // ---------------------------------------------------------
    // 1. CLASSIFY QUERY (fitness vs general)
    
    const category = await classifyQuery(message);
    console.log("[Chat API] Query category:", category);

    
    // 2. GENERAL CHAT MODE → check cache, bypass RAG
    
    if (category === "general") {
      const generalCacheKey = CacheKeys.generalChat(message);
      const cachedGeneral = await getCache<string>(generalCacheKey);

      if (cachedGeneral) {
        return NextResponse.json({
          response: cachedGeneral,
          sources: [],
          generatedImages: [],
          conversationId: conversationId || `conv_${Date.now()}`,
        });
      }

      const generalAnswer = await callGemini(
        `You are a friendly fitness coach but now responding casually in general conversation. 
          User asked: "${message}"

          Give a short, warm, conversational response.`
      );

      // Cache general responses for 1 hour
      await setCache(generalCacheKey, generalAnswer, TTL.GENERAL_CHAT);

      return NextResponse.json({
        response: generalAnswer,
        sources: [],
        generatedImages: [],
        conversationId: conversationId || `conv_${Date.now()}`,
      });
    }

    
    // 3. FITNESS MODE → check RAG cache, then run Self-RAG pipeline
    
    const ragCacheKey = CacheKeys.ragResponse(userId, message);
    const cachedRag = await getCache<{ generation: string; sources: any[] }>(ragCacheKey);

    if (cachedRag) {
      return NextResponse.json({
        response: cachedRag.generation,
        sources: cachedRag.sources,
        generatedImages: [],
        conversationId: conversationId || `conv_${Date.now()}`,
      });
    }

    const ragResult = await runSelfRAG(message, userId, images, chatHistory);
    console.log("[Chat API] RAG Completed");

    // Cache the RAG response for 1 hour (user-scoped, cleared on plan regen)
    await setCache(
      ragCacheKey,
      { generation: ragResult.generation, sources: ragResult.sources },
      TTL.RAG
    );

    return NextResponse.json({
      response: ragResult.generation,
      sources: ragResult.sources,
      generatedImages: ragResult.images,
      conversationId: conversationId || ragResult.conversationId,
    });

  } catch (error) {
    console.error("[Chat API] ERROR:", error);

    if (isQuotaError(error)) {
      return NextResponse.json(
        {
          error: "QUOTA_EXCEEDED",
          message: "AI Chat rate limit or quota exceeded. Please try again in a few moments.",
        },
        { status: 429 }
      );
    }

    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", details: msg },
      { status: 500 }
    );
  }
}
