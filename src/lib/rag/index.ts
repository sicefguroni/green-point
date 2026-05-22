/**
 * RAG Engine for Green-Point
 *
 * Retrieves semantically relevant research chunks for a given context query,
 * then provides them as grounded context for generative AI recommendations.
 *
 * Embeddings: OpenAI text-embedding-3-small (1536 dims)
 * Generation: OpenAI gpt-4o-mini (high quota, fast, cited)
 */

import {
  retrieveRelevantChunks,
  retrieveRelevantChunksByQuery,
  buildRAGQuery,
} from "./query";
import type {
  LocationContext,
  RetrievedChunk,
  RAGResult,
} from "./query";

export type { LocationContext, RetrievedChunk, RAGResult };
export {
  buildRAGQuery,
  retrieveRelevantChunksByQuery,
  retrieveRelevantChunks,
};

// Re-export prompt modules so consumers importing from "@/lib/rag" keep working
export {
  buildGenerationPrompt,
  buildSiteUrbanFormGuidance,
  formatLocationContextBlock,
  formatPrimaryChallengesBlock,
} from "./prompts";


