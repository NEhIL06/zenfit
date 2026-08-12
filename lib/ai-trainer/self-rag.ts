import { StateGraph, END, START, Annotation } from '@langchain/langgraph'
import { getVectorStore } from './vector-store'
import { getMultimodalProcessor } from './multimodal'
import { webSearchfunc } from '../ddg'
import { generateText } from '../gemini'
import { rerankDocuments } from './reranker'
import { connectToDatabase } from '../mongodb'
import type { SelfRAGResponse, DocumentSource } from '@/types/ai-trainer'

// Configs
const MAX_RETRIEVAL = 6
const LLM_GRADE_MAX_TOKENS = 128
const LLM_GEN_MAX_TOKENS = 1024

// State Shape
const SelfRAGStateAnnotation = Annotation.Root({
  question: Annotation<string>,
  generation: Annotation<string>,
  documents: Annotation<string[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  webSearch: Annotation<boolean>,
  retryCount: Annotation<number>,
  userId: Annotation<string | undefined>,
  userPlanContext: Annotation<string | undefined>,
  chatHistory: Annotation<{ role: string; content: string }[] | undefined>,
})

type SelfRAGState = typeof SelfRAGStateAnnotation.State

// 1. Retrieval Node
async function retrieve(state: SelfRAGState): Promise<Partial<SelfRAGState>> {
  console.log("[Self-RAG] Retrieving docs")

  const vectorStore = getVectorStore()
  const docs = await vectorStore.searchForUser(
    state.question,
    state.userId,
    MAX_RETRIEVAL
  )

  const documents = docs.map((doc) => doc.pageContent ?? "")

  return { documents }
}

// 2. Batched Document Grading Node (1 LLM call instead of 6)
async function gradeDocuments(state: SelfRAGState): Promise<Partial<SelfRAGState>> {
  console.log("[Self-RAG] Batched grading docs")

  if (!state.documents.length) return { documents: [], webSearch: true }

  const prompt = `
You are a strict fitness document grader.
Decide if each document below is relevant to the question: "${state.question}".

${state.documents.map((doc, i) => `[DOC ${i + 1}]:\n${doc.substring(0, 400)}`).join('\n\n')}

Reply ONLY with a JSON array of strings ("yes" or "no") matching each document.
Example: ["yes", "no", "yes"]
`
  try {
    const out = await generateText(prompt, LLM_GRADE_MAX_TOKENS)
    const jsonMatch = out.match(/\[[\s\S]*\]/)
    const grades: string[] = jsonMatch ? JSON.parse(jsonMatch[0]) : []
    
    const filtered = state.documents.filter((_, i) => grades[i]?.toLowerCase() === "yes")
    console.log(`[Self-RAG] Batched grading complete: ${filtered.length}/${state.documents.length} docs relevant`)

    return {
      documents: filtered,
      webSearch: filtered.length === 0,
    }
  } catch (err) {
    console.warn("[Self-RAG] Batched grading parse failed, retaining retrieved docs:", err)
    return { documents: state.documents, webSearch: false }
  }
}

// 2b. Reranking Node — cross-encoder rescoring after grade filter
async function rerankDocs(state: SelfRAGState): Promise<Partial<SelfRAGState>> {
  if (state.documents.length <= 1) return {}

  try {
    const ranked = await rerankDocuments(state.question, state.documents, 4)
    const reranked = ranked.map(r => r.content)
    console.log(`[Self-RAG] Reranked to ${reranked.length} docs`)
    return { documents: reranked }
  } catch (err) {
    console.warn('[Self-RAG] Reranking failed, using original order:', err)
    return {}
  }
}

// 3. Web Search Fallback Node
async function webSearch(state: SelfRAGState): Promise<Partial<SelfRAGState>> {
  console.log("[Self-RAG] Web search fallback")

  const hits = await webSearchfunc(state.question)
  const docs = hits.slice(0, 3).map((r: any) => `${r.title}: ${r.description}`)

  return {
    documents: docs,
    retryCount: (state.retryCount || 0) + 1,
  }
}

// 4. Final Generation Node
async function generate(state: SelfRAGState): Promise<Partial<SelfRAGState>> {
  console.log("[Self-RAG] Generating response")
  const context = state.documents
    .map((d, i) => `Source #${i + 1}:\n${d}`)
    .join("\n\n----------------------\n\n")

  const userPlanContext = state.userPlanContext || ""

  // Bounded Chat History (limit to last 8 messages to save tokens)
  let historyContext = "";
  const recentHistory = (state.chatHistory || []).slice(-8)
  if (recentHistory.length > 0) {
    historyContext = recentHistory.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join("\n");
    historyContext = `\nPREVIOUS CONVERSATION (RECENT):\n${historyContext}\n`;
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
- Use the provided context when relevant
- Be encouraging, specific, and actionable
- Explain proper form & safety when recommending exercises
- Keep responses concise but thorough (aim for 200-300 words)
- **LANGUAGE**: Detect the language of the user's question. You MUST answer in the SAME language as the user's question.

Answer:
`

  const out = await generateText(prompt, LLM_GEN_MAX_TOKENS)
  return { generation: out }
}

// 5. Hallucination / Faithfulness Check Node
async function checkHallucination(state: SelfRAGState): Promise<Partial<SelfRAGState>> {
  if (!state.documents.length || !state.generation) {
    return {}
  }

  try {
    const prompt = `
Verify if the ANSWER contains any dangerous fitness claims or facts directly contradicted by CONTEXT.
ANSWER: ${state.generation.substring(0, 500)}
CONTEXT: ${state.documents.slice(0, 2).join('\n').substring(0, 500)}

Reply ONLY "grounded" or "contradicted":`
    
    const res = await generateText(prompt, 32)
    if (res.toLowerCase().includes("contradicted")) {
      console.warn("[Self-RAG] Hallucination check flagged contradiction. Adding safety disclaimer.")
      return {
        generation: `${state.generation}\n\n*Note: Please consult a certified professional before starting new high-intensity routines.*`
      }
    }
  } catch {
    // Non-blocking check
  }

  return {}
}

// Compiled Module-Level StateGraph Workflow (Compiled ONCE)
const compiledWorkflow = new StateGraph(SelfRAGStateAnnotation)
  .addNode("retrieve_node", retrieve)
  .addNode("grade_node", gradeDocuments)
  .addNode("rerank_node", rerankDocs)
  .addNode("web_node", webSearch)
  .addNode("generate_node", generate)
  .addNode("hallucination_node", checkHallucination)
  .addEdge(START, "retrieve_node")
  .addEdge("retrieve_node", "grade_node")
  .addConditionalEdges(
    "grade_node",
    (state) => {
      if (state.webSearch && (state.retryCount || 0) < 1) {
        return "web_node"
      }
      return "rerank_node" // rerank before generation
    },
    {
      web_node: "web_node",
      rerank_node: "rerank_node",
    }
  )
  .addEdge("rerank_node", "generate_node")
  .addEdge("web_node", "generate_node")
  .addEdge("generate_node", "hallucination_node")
  .addEdge("hallucination_node", END)
  .compile()

// Helper to pre-fetch user plan context before graph execution
async function fetchUserPlanContext(userId: string): Promise<string> {
  try {
    const { db } = await connectToDatabase()
    const plansCollection = db.collection("user_plans")
    const userPlan = await plansCollection.findOne({ userId })

    if (userPlan) {
      const formData = userPlan.formData || {}
      const plan = userPlan.plan || {}

      return `
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
`
    }
  } catch (err) {
    console.warn("[Self-RAG] Pre-fetch user plan failed:", err)
  }
  return ""
}

// Execution function using module-level compiled graph
export async function runSelfRAG(
  question: string,
  userId?: string,
  images?: string[],
  chatHistory?: { role: string, content: string }[]
): Promise<SelfRAGResponse> {
  console.log("[Self-RAG] Start:", question)

  // Append multimodal analysis if images provided
  if (images?.length) {
    const proc = getMultimodalProcessor()
    try {
      const analysis = await proc.analyzeExerciseForm(images[0])
      question += `\n\nUser Image Analysis: ${analysis}`
    } catch {
      console.warn("[Self-RAG] Image analysis failed")
    }
  }

  // Pre-fetch user plan context outside graph node (§3.1 fix)
  let userPlanContext = ""
  if (userId) {
    userPlanContext = await fetchUserPlanContext(userId)
  }

  const initialState = {
    question,
    generation: "",
    documents: [],
    webSearch: false,
    retryCount: 0,
    userId,
    userPlanContext,
    chatHistory,
  }

  const result = await compiledWorkflow.invoke(initialState)

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
