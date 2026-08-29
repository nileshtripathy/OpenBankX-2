import fs from 'fs';
import path from 'path';
import { cacheGet, cacheSet } from '../utils/cache';
import {
  cosineSimilarity,
  embedCorpusWithVoyage,
  embedQueryWithVoyage,
  isVoyageConfigured,
  tfidfVectorizeCorpus,
  tfidfVectorizeQuery,
  type EmbeddingMode,
} from './embeddings';

export interface KnowledgeChunk {
  id: string;
  source: string;
  title: string;
  content: string;
}

interface IndexedCorpus {
  mode: EmbeddingMode;
  chunks: KnowledgeChunk[];
  vectors: number[][];
  vocab?: string[]; // only present in tfidf mode
}

const KNOWLEDGE_DIR = path.join(__dirname, 'knowledge');
const CACHE_KEY = 'ai:kb:index:v1';
const CACHE_TTL_SECONDS = 60 * 60 * 24; // rebuild daily at most; the corpus is static source, not user data

/** Splits each markdown file on `## ` headings - one retrievable chunk per heading, small enough to be a focused, individually-relevant unit. */
function loadKnowledgeChunks(): KnowledgeChunk[] {
  const files = fs.readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith('.md'));
  const chunks: KnowledgeChunk[] = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(KNOWLEDGE_DIR, file), 'utf-8');
    const sections = raw.split(/\n(?=## )/g);

    sections.forEach((section, i) => {
      const titleMatch = section.match(/^#{1,2}\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1].trim() : file;
      chunks.push({
        id: `${file}#${i}`,
        source: file,
        title,
        content: section.trim(),
      });
    });
  }

  return chunks;
}

let memoryIndex: IndexedCorpus | null = null;

/**
 * Builds (or loads from Redis cache) the vector index for the knowledge
 * base. Cached because computing embeddings - especially real Voyage calls -
 * is unnecessary work to repeat on every server restart for a corpus that
 * only changes when someone edits the markdown files.
 */
async function getIndex(): Promise<IndexedCorpus> {
  if (memoryIndex) return memoryIndex;

  const cached = await cacheGet<IndexedCorpus>(CACHE_KEY);
  if (cached) {
    memoryIndex = cached;
    return cached;
  }

  const chunks = loadKnowledgeChunks();
  const texts = chunks.map((c) => c.content);

  let index: IndexedCorpus;
  if (isVoyageConfigured()) {
    try {
      const { vectors } = await embedCorpusWithVoyage(texts);
      index = { mode: 'voyage', chunks, vectors };
    } catch (err) {
      console.warn(
        `[rag] Voyage embedding failed, falling back to local TF-IDF: ${(err as Error).message}`
      );
      const { vectors, vocab } = tfidfVectorizeCorpus(texts);
      index = { mode: 'tfidf', chunks, vectors, vocab };
    }
  } else {
    const { vectors, vocab } = tfidfVectorizeCorpus(texts);
    index = { mode: 'tfidf', chunks, vectors, vocab };
  }

  memoryIndex = index;
  await cacheSet(CACHE_KEY, index, CACHE_TTL_SECONDS);
  return index;
}

/** Returns the topK knowledge chunks most relevant to `query`, ranked by cosine similarity. */
export async function retrieveRelevantChunks(
  query: string,
  topK = 3
): Promise<(KnowledgeChunk & { score: number })[]> {
  const index = await getIndex();
  if (index.chunks.length === 0) return [];

  let queryVector: number[];
  if (index.mode === 'voyage') {
    queryVector = await embedQueryWithVoyage(query);
  } else {
    queryVector = tfidfVectorizeQuery(query, index.vocab!);
  }

  const scored = index.chunks.map((chunk, i) => ({
    ...chunk,
    score: cosineSimilarity(queryVector, index.vectors[i]),
  }));

  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}

/** Formats retrieved chunks as system-prompt context, with a minimum relevance floor so irrelevant chunks aren't injected for every query. */
export async function buildRagContext(query: string, topK = 3): Promise<string> {
  const chunks = await retrieveRelevantChunks(query, topK);
  const relevant = chunks.filter((c) => c.score > 0.05);
  if (relevant.length === 0) return '';

  return relevant
    .map((c) => `### ${c.title} (source: ${c.source})\n${c.content}`)
    .join('\n\n');
}
