declare module 'ml-kmeans' {
  interface KMeansResult {
    clusters: number[];
    centroids: number[][];
    converged: boolean;
    iterations: number;
  }

  interface KMeansOptions {
    maxIterations?: number;
    tolerance?: number;
    seed?: number;
  }

  function kmeans(data: number[][], k: number, options?: KMeansOptions): KMeansResult;
  export = kmeans;
}

declare module 'ml-kmeans';

declare module 'natural' {
  export class WordTokenizer {
    tokenize(text: string): string[] | null;
  }
} 