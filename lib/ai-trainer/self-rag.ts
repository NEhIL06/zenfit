import { StateGraph, END, START, Annotation } from '@langchain/langgraph'
import { getVectorStore } from './vector-store'
import { getMultimodalProcessor } from './multimodal'
import { duckSearch } from '../ddg'
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

  const hits = await duckSearch(state.question)
  const docs = hits.slice(0, 3).map(
    (r: any) => `${r.title}\n${r.description}\n${r.url}`
  )

  return {
    documents: docs,
    retryCount: (state.retryCount || 0) + 1,

  }
}



// ------------------------
// 5️⃣ FINAL GENERATION
// ------------------------
async function generate(state: SelfRAGState, userId?: string): Promise<Partial<SelfRAGState>> {
  const context = state.documents
    .map((d, i) => `Source #${i + 1}:\n${d}`)
    .join("\n\n----------------------\n\n")

  const prompt = `
You are an expert AI fitness trainer. Use ONLY the context below.

CONTEXT:
${context || "No relevant context retrieved."}

QUESTION:
${state.question}

RULES:
- Be encouraging + specific
- Explain proper form & safety when recommending exercises
- Keep it concise but helpful
- If insufficient context → ask a clarifying question

Answer:
`

  const out = await generateText(prompt, LLM_GEN_MAX_TOKENS)
  return { generation: out }
}

// ------------------------
// WORKFLOW BUILD
// ------------------------
export async function runSelfRAG(question: string, userId?: string, images?: string[]): Promise<SelfRAGResponse> {
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
    .addNode("generate_node", (s) => generate(s, userId))
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
