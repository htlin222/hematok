// Minimal ambient types for the Vectorize binding (avoids pulling in
// @cloudflare/workers-types just for two method signatures).
interface VectorizeVector {
  id: string;
  values?: number[];
  metadata?: Record<string, unknown>;
}
interface VectorizeMatch {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}
interface VectorizeMatches {
  matches: VectorizeMatch[];
  count: number;
}
interface VectorizeQueryOptions {
  topK?: number;
  returnValues?: boolean;
  returnMetadata?: boolean | "all" | "indexed" | "none";
}
interface VectorizeIndex {
  getByIds(ids: string[]): Promise<VectorizeVector[]>;
  query(vector: number[], options?: VectorizeQueryOptions): Promise<VectorizeMatches>;
}
