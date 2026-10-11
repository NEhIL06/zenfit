import { Mistral } from '@mistralai/mistralai'

let mistralClient: Mistral | null = null

/**
 * Global singleton instance for Mistral AI client.
 * Reuses HTTP connection pools and prevents redundant instantiations across routes.
 */
export function getMistralClient(): Mistral {
  if (!mistralClient) {
    const apiKey = process.env.MISTRAL_API_KEY || ''
    if (!apiKey) {
      console.warn('[Mistral Singleton] MISTRAL_API_KEY is missing or empty.')
    }
    mistralClient = new Mistral({ apiKey })
  }
  return mistralClient
}
