/**
 * lib/chroma-embed-stub.ts
 *
 * Local stub for @chroma-core/default-embed.
 *
 * This project uses GeminiEmbeddingFunction (in lib/chroma.ts) for all
 * vector embeddings. The default chromadb embedding function is never used.
 *
 * This stub exists so Turbopack can resolve the package alias without
 * touching the broken CJS/ESM @chroma-core/default-embed package in
 * node_modules, which causes a hard build error in Next.js 16 Turbopack.
 */

export class DefaultEmbeddingFunction {
  async generate(texts: string[]): Promise<number[][]> {
    throw new Error(
      "[chroma-embed-stub] DefaultEmbeddingFunction is not available. " +
        "This project uses GeminiEmbeddingFunction instead."
    );
  }
}

export default DefaultEmbeddingFunction;
