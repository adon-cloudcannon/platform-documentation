export interface Chunk {
  id: string;
  url: string;
  anchor: string;
  headingPath: string[];
  text: string;
  wordCount: number;
}

export interface SemanticIndex {
  model: string;
  dim: number;
  version: number;
  chunks: Array<{
    id: string;
    url: string;
    anchor: string;
    headingPath: string[];
    excerpt: string;
  }>;
  embeddings: string;
}
