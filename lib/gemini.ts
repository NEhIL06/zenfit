interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string
      }>
    }
  }>
}

// import { GoogleGenAI } from "@google/genai";
import { Mistral } from "@mistralai/mistralai";



const MODEL = "sentence-transformers/all-MiniLM-L6-v2";

// const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const HF_API_KEY = process.env.HF_API_KEY;


export async function generateMotivationalQuote(): Promise<string> {
  try {
    const response = await fetch("/api/generate-quote", {
      method: "GET",
    })

    const data = await response.json()
    return data.quote || "Your fitness journey starts today."
  } catch (error) {
    console.error("Error generating quote:", error)
    throw error
  }
}


export async function generateText(prompt: string, maxTokens = 512): Promise<string> {
  // If running on server, use SDK directly to avoid loopback fetch issues
  if (typeof window === 'undefined') {
    return generateTextServer(prompt, maxTokens);
  }

  try {
    const res = await fetch("/api/generateText", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, maxTokens }),
    });

    const data = await res.json();
    return data.text || "";
  } catch (err) {
    console.error("[Gemini] generateText error:", err);
    return "";
  }
}

export async function generateTextServer(prompt: string, maxTokens = 512): Promise<string> {
  try {
    const ai = new Mistral({
      apiKey: MISTRAL_API_KEY || "",
    });

    // const res = await AI.models.generateContent({
    //   model: "gemini-2.5-flash",
    //   contents: [{ parts: [{ text: prompt }] }],
    //   config: {
    //     maxOutputTokens: maxTokens,
    //   }
    // });

    const res = await ai.chat.complete({
      model: "mistral-small-latest",
      messages: [
        {
          role: "user",
          content: prompt,
        }
      ],
      maxTokens: maxTokens,
    });

    const text = res.choices[0].message.content?.toString() || "";
    return text || "";
  } catch (err) {
    console.error("[Gemini] generateTextServer error:", err);
    return "";
  }
}


export async function analyzeImageBase64(imageBase64: string): Promise<string> {
  try {
    // const response = await fetch(
    //   "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    //   {
    //     method: "POST",
    //     headers: {
    //       "Content-Type": "application/json",
    //       "x-goog-api-key": GEMINI_API_KEY || "",
    //     },
    //     body: JSON.stringify({
    //       contents: [
    //         {
    //           parts: [
    //             {
    //               text: "Generate one short original motivational quote about fitness, discipline, or self-improvement (1-2 lines max). Return only the quote, no attribution.",
    //             },
    //             { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
    //           ],
    //         },
    //       ],
    //     }),
    //   },
    // )

    const ai = new Mistral({
      apiKey: MISTRAL_API_KEY || "",
    });

    
    const response = await ai.chat.complete({
      model: "mistral-small-latest",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze the following image and provide insights related to fitness and health."  },
            {
              type: "image_url",
              imageUrl: "data:image/jpeg;base64," + imageBase64,
            },
          ],
        }
      ],
    });

    const result = response as any;
    const text = result.choices[0].message.content?.toString();
    return text?.trim() || "Could not analyze the image.";
  } catch (err) {
    console.error("[Gemini] analyzeImageBase64 error:", err);
    return "Image analysis failed.";
  }
}

export async function generateFitnessPlan(userDetails: any): Promise<any> {
  try {
    const response = await fetch("/api/generate-plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userDetails),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error generating plan:", error)
    throw error
  }
}

export async function embedText(text: string): Promise<number[]> {
  try {
    const res = await fetch(
      `https://api-inference.huggingface.co/pipeline/feature-extraction/${MODEL}`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${HF_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(text),
      }
    );
    console.log("[Embedding Response :", res)

    if (!res.ok) {
      throw new Error(`HF Error ${res.status}`);
    }

    const data = await res.json();
    const vector = Array.isArray(data[0]) ? data[0] : data;

    return vector;
  } catch (err) {
    console.error("[Gemini] embedText error:", err);
    return [];
  }
}



export async function generatePersonalizedQuote(userData: any): Promise<string> {
  try {
    const response = await fetch("/api/personalized-quote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    })

    const data = await response.json()
    return data.quote || "You are stronger than you think!"
  } catch (error) {
    console.error("[v0] Error generating personalized quote:", error)
    throw error
  }
}
