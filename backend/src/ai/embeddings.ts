import { env } from '../config/env';

/**
 * Two interchangeable ways to turn text into a vector for similarity search:
 *
 *  - Voyage AI (real dense embeddings) when VOYAGE_API_KEY is set. Anthropic
 *    doesn't run its own embeddings endpoint; Voyage is the provider they
 *    recommend for RAG alongside Claude.
 *  - A local TF-IDF vectorizer otherwise, so retrieval still works with zero
 *    external dependencies or API keys - same "fail open, degrade gracefully"
 *    pattern used for Redis elsewhere in this codebase (see config/redis.ts).
 *
 * Whichever one built the corpus's vectors also has to build the query
 * vector - the two aren't compatible with each other - so `embedTexts`
 * always reports which mode it used via the `mode` field, and callers keep
 * corpus + query vectors from the same mode together.
 */

export type EmbeddingMode = 'voyage' | 'tfidf';

export interface EmbeddingResult {
  mode: EmbeddingMode;
  vectors: number[][];
}

async function embedWithVoyage(texts: string[]): Promise<number[][]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.ai.voyageApiKey}`,
    },
    body: JSON.stringify({ input: texts, model: env.ai.embeddingModel }),
  });

  if (!res.ok) {
    throw new Error(`Voyage embeddings request failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as { data: { embedding: number[] }[] };
  return body.data.map((d) => d.embedding);
}

const TOKEN_RE = /[a-z0-9]+/g;

function tokenize(text: string): string[] {
  return text.toLowerCase().match(TOKEN_RE) ?? [];
}

/**
 * Builds TF-IDF vectors for a whole corpus at once (needs document
 * frequencies across the corpus, so single texts can't be vectorized in
 * isolation the way Voyage's per-text API allows).
 */
export function tfidfVectorizeCorpus(texts: string[]): { vectors: number[][]; vocab: string[] } {
  const docsTokens = texts.map(tokenize);
  const vocabSet = new Set<string>();
  for (const tokens of docsTokens) for (const t of tokens) vocabSet.add(t);
  const vocab = Array.from(vocabSet);
  const vocabIndex = new Map(vocab.map((term, i) => [term, i]));

  const docFreq = new Array(vocab.length).fill(0);
  for (const tokens of docsTokens) {
    const seen = new Set(tokens);
    for (const term of seen) {
      const idx = vocabIndex.get(term);
      if (idx !== undefined) docFreq[idx]++;
    }
  }

  const n = texts.length;
  const vectors = docsTokens.map((tokens) => {
    const vec = new Array(vocab.length).fill(0);
    const termCounts = new Map<string, number>();
    for (const t of tokens) termCounts.set(t, (termCounts.get(t) ?? 0) + 1);

    for (const [term, count] of termCounts) {
      const idx = vocabIndex.get(term);
      if (idx === undefined) continue;
      const tf = count / tokens.length;
      const idf = Math.log((n + 1) / (docFreq[idx] + 1)) + 1; // smoothed idf
      vec[idx] = tf * idf;
    }
    return vec;
  });

  return { vectors, vocab };
}

/** Vectorizes a single query against an already-built vocabulary (a query can't introduce new dimensions). */
export function tfidfVectorizeQuery(text: string, vocab: string[]): number[] {
  const vocabIndex = new Map(vocab.map((term, i) => [term, i]));
  const tokens = tokenize(text);
  const vec = new Array(vocab.length).fill(0);
  const termCounts = new Map<string, number>();
  for (const t of tokens) termCounts.set(t, (termCounts.get(t) ?? 0) + 1);
  for (const [term, count] of termCounts) {
    const idx = vocabIndex.get(term);
    if (idx !== undefined) vec[idx] = count / tokens.length;
  }
  return vec;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function isVoyageConfigured(): boolean {
  return Boolean(env.ai.voyageApiKey);
}

export async function embedCorpusWithVoyage(texts: string[]): Promise<EmbeddingResult> {
  const vectors = await embedWithVoyage(texts);
  return { mode: 'voyage', vectors };
}

export async function embedQueryWithVoyage(text: string): Promise<number[]> {
  const [vector] = await embedWithVoyage([text]);
  return vector;
}
