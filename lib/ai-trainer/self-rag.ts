import { StateGraph, END, START, Annotation } from '@langchain/langgraph'
import { getVectorStore } from './vector-store'
import { getMultimodalProcessor } from './multimodal'
import { webSearchfunc } from '../ddg'
import { generateText } from '../gemini'
import type { SelfRAGResponse, DocumentSource } from '@/types/ai-trainer'

// Configs
const MAX_RETRIEVAL = 6
const LLM_GRADE_MAX_TOKENS = 64
const LLM_GEN_MAX_TOKENS = 1024

// ---------------
// STATE SHAPE
// ---------------
const SelfRAGStateAnnotation = Annotation.Root({
  question: Annotation<string>,
  generation: Annotation<string>,
  documents: Annotation<string[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  webSearch: Annotation<boolean>,
  retryCount: Annotation<number>,
})

type SelfRAGState = typeof SelfRAGStateAnnotation.State

// ------------------------
// 2️⃣ RETRIEVAL
// ------------------------
async function retrieve(state: SelfRAGState, userId?: string): Promise<Partial<SelfRAGState>> {
  console.log("[Self-RAG] Retrieving docs")

  const vectorStore = getVectorStore()
  const docs = await vectorStore.searchForUser(
    state.question,
    userId,
    MAX_RETRIEVAL
  )

  const documents = docs.map((doc) => doc.pageContent ?? "")

  return { documents }
}

// ------------------------
// 3️⃣ DOC GRADING
// ------------------------
async function gradeDocuments(state: SelfRAGState): Promise<Partial<SelfRAGState>> {
  console.log("[Self-RAG] Grading docs")

  const filtered: string[] = []
  if (!state.documents.length) return { documents: [], webSearch: true }

  for (const doc of state.documents) {
    const prompt = `
You are a strict grader. Decide if DOCUMENT is relevant to QUESTION.
Reply ONLY: "yes" or "no".

QUESTION:
${state.question}

DOCUMENT:
${doc}

Relevant? Answer:`
    const out = await generateText(prompt, LLM_GRADE_MAX_TOKENS)
    const ans = out.trim().toLowerCase()

    if (ans.includes("yes")) filtered.push(doc)
  }

  return {
    documents: filtered,
    webSearch: filtered.length === 0,
  }
}

// ------------------------
// 4️⃣ WEB SEARCH
// ------------------------

async function webSearch(state: SelfRAGState): Promise<Partial<SelfRAGState>> {
  console.log("[Self-RAG] Web search fallback")

  const hits = await webSearchfunc(state.question)
  const docs = hits.slice(0, 3).map(
    (r: any) => `${r.title}\n${r.description}\n${r.url}`
  )

  console.log("[Self-RAG] Web search results:", docs)
  return {
    documents: docs,
    retryCount: (state.retryCount || 0) + 1,

  }
}

// ------------------------
// 5️⃣ FINAL GENERATION
// ------------------------
async function generate(state: SelfRAGState, userId?: string, chatHistory?: { role: string, content: string }[]): Promise<Partial<SelfRAGState>> {

  console.log("[Self-RAG] Generating response")
  const context = state.documents
    .map((d, i) => `Source #${i + 1}:\n${d}`)
    .join("\n\n----------------------\n\n")

  // Fetch user's plan from MongoDB
  let userPlanContext = "";
  console.log("[Self-RAG] User ID:", userId)
  if (userId) {
    try {
      const { connectToDatabase } = await import('@/lib/mongodb');
      const { db } = await connectToDatabase();
      const plansCollection = db.collection("user_plans");

      const userPlan = await plansCollection.findOne({ userId });

      if (userPlan) {
        console.log("[Self RAG : user plan recieved]")
        const formData = userPlan.formData || {};
        const plan = userPlan.plan || {};

        userPlanContext = `

        USER PROFILE:
        - Name: ${formData.name || 'N/A'}
        - Age: ${formData.age || 'N/A'}
        - Gender: ${formData.gender || 'N/A'}
        - Height: ${formData.height || 'N/A'}cm
        - Weight: ${formData.weight || 'N/A'}kg
        - Fitness Goal: ${formData.fitnessGoal || 'N/A'}
        - Fitness Level: ${formData.fitnessLevel || 'N/A'}
        - Workout Location: ${formData.workoutLocation || 'N/A'}
        - Dietary Preference: ${formData.dietaryPreference || 'N/A'}

        CURRENT PLAN SUMMARY:
        ${plan.summary || 'No plan generated yet'}
        `;

        console.log(`[Self-RAG] Added user plan context for ${userId}`);
      }
    } catch (err) {
      console.warn("[Self-RAG] Failed to fetch user plan:", err);
    }
  }

  // Format chat history
  let historyContext = "";
  if (chatHistory && chatHistory.length > 0) {
    historyContext = chatHistory.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join("\n");
    historyContext = `\nPREVIOUS CONVERSATION:\n${historyContext}\n`;
  }

  const prompt = `
You are an expert AI fitness trainer with comprehensive knowledge of nutrition, exercise science, and wellness.

${userPlanContext ? 'USER PROFILE:\n' + userPlanContext : ''}

${historyContext}

${context ? 'ADDITIONAL CONTEXT:\n' + context + '\n' : ''}

QUESTION:
${state.question}

INSTRUCTIONS:
- ALWAYS prioritize the user's profile, goals, and current plan when giving advice
- Use the provided context when relevant, but don't limit yourself to it
- Draw from your expertise in fitness, nutrition, and exercise science to provide comprehensive answers
- Be encouraging, specific, and actionable
- Explain proper form & safety when recommending exercises
- For meal plans: provide specific foods, portions, and macros tailored to the user's goals
- For workout plans: include exercises, sets, reps, and rest periods
- Keep responses concise but thorough (aim for 200-300 words)
- If you need more information about the user's specific situation, ask clarifying questions
- If the user asks a follow-up question, refer to the previous conversation context
- **LANGUAGE**: Detect the language of the user's question. You MUST answer in the SAME language as the user's question.

Answer:
`

  console.log("[Self-RAG] Prompt:", prompt)
  const out = await generateText(prompt, LLM_GEN_MAX_TOKENS)
  return { generation: out }
}

// ------------------------
// WORKFLOW BUILD
// ------------------------
export async function runSelfRAG(question: string, userId?: string, images?: string[], chatHistory?: { role: string, content: string }[]): Promise<SelfRAGResponse> {
  console.log("[Self-RAG] Start:", question)

  // 1. CLASSIFY


  // 2. Append multimodal analysis
  if (images?.length) {
    const proc = getMultimodalProcessor()
    try {
      const analysis = await proc.analyzeExerciseForm(images[0])
      question += `\n\nUser Image Analysis: ${analysis}`
    } catch {
      console.warn("[Self-RAG] Image analysis failed")
    }
  }

  const workflow = new StateGraph(SelfRAGStateAnnotation)
    .addNode("retrieve_node", (s) => retrieve(s, userId))
    .addNode("grade_node", gradeDocuments)
    .addNode("web_node", webSearch)
    .addNode("generate_node", (s) => generate(s, userId, chatHistory))
    .addEdge(START, "retrieve_node")
    .addEdge("retrieve_node", "grade_node")
    .addConditionalEdges(
      "grade_node",
      (state) => {
        if (state.webSearch && (state.retryCount || 0) < 1) {
          return "web_node"
        }
        return "generate_node"
      },
      {
        web_node: "web_node",
        generate_node: "generate_node",
      }
    )
    .addEdge("web_node", "generate_node")
    .addEdge("generate_node", END)

  const app = workflow.compile()

  const initialState = {
    question,
    generation: "",
    documents: [],
    webSearch: false,
    retryCount: 0,
  }

  const result = await app.invoke(initialState)

  const sources: DocumentSource[] = (result.documents || []).map((doc, i) => ({
    content: doc,
    score: i + 1,
    metadata: {},
  }))

  return {
    generation: result.generation,
    sources,
    images: [],
    conversationId: `conv_${Date.now()}`,
  }
}
