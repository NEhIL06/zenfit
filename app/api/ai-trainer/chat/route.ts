import { NextRequest, NextResponse } from "next/server";
import { runSelfRAG } from "@/lib/ai-trainer/self-rag";
import { GoogleGenAI } from "@google/genai";

const GEMINI_MODEL = "gemini-2.5-flash";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

/** Helper: call Gemini Flash  */
async function callGemini(prompt: string) {
  const res = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      systemInstruction: "You are an expert in fitness and nutrition",
    },
  });

  const text = res.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  return text ?? "";
}

/** Helper: classify query */
async function classifyQuery(query: string): Promise<"fitness" | "general"> {
  const prompt = `
Classify the user message below as "fitness" or "general".
examples of general:
- "How are you?",
- "Hello, how are you?",
- "Hello",
- "Hi",

examples of fitness:
- "What is the best workout for weight loss?",
- "I have some problems in stomach(i got stomach erosion) so can you regerate the plans according to that",
- "I want to lose weight",
- "I want to gain weight",
- "I want to build muscle",
- "I want to lose weight",

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
    // 1️⃣ CLASSIFY QUERY (fitness vs general)
    // ---------------------------------------------------------
    const category = await classifyQuery(message);
    console.log("[Chat API] Query category:", category);

    // ---------------------------------------------------------
    // 2️⃣ GENERAL CHAT MODE → bypass RAG
    // ---------------------------------------------------------
    if (category === "general") {
      const generalAnswer = await callGemini(
        `You are a friendly fitness coach but now responding casually in general conversation. 
User asked: "${message}"

Give a short, warm, conversational response.`
      );

      return NextResponse.json({
        response: generalAnswer,
        sources: [],
        generatedImages: [],
        conversationId: conversationId || `conv_${Date.now()}`,
      });
    }

    // ---------------------------------------------------------
    // 3️⃣ FITNESS MODE → RUN SELF-RAG PIPELINE
    // ---------------------------------------------------------


    const ragResult = await runSelfRAG(message, userId, images, chatHistory);

    console.log("[Chat API] RAG Completed");

    return NextResponse.json({
      response: ragResult.generation,
      sources: ragResult.sources,
      generatedImages: ragResult.images,
      conversationId: conversationId || ragResult.conversationId,
    });
  } catch (error) {
    console.error("[Chat API] ERROR:", error);

    const msg = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: "Internal Server Error", details: msg },
      { status: 500 }
    );
  }
}
