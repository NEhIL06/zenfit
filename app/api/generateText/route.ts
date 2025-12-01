

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

export async function POST(request: Request) {
    try {
        const { prompt, maxTokens } = await request.json();
        const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY || "",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      },
    )


        const result = await response.json()
        const text = result.response?.candidates?.[0]?.content?.parts?.[0]?.text;
        return text?.trim() || "";
    } catch (err) {
        console.error("[Gemini] generateText error:", err);
        return "";
    }
}   