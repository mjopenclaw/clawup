/**
 * Similarity Service
 * Check content similarity to avoid duplicate posts
 */

import stringSimilarity from 'string-similarity';
import { getPostsForSimilarityCheck } from './database.js';
import { loadValidator } from '../core/config-loader.js';
import logger from '../utils/logger.js';

// ============================================
// Types
// ============================================

export interface SimilarityResult {
  isSimilar: boolean;
  highestSimilarity: number;
  similarPost?: string;
  threshold: number;
}

export interface SimilarityOptions {
  threshold?: number;
  platform?: string;
  comparePosts?: string[];
  method?: 'dice' | 'cosine' | 'jaccard';
}

// ============================================
// Text Preprocessing
// ============================================

function preprocessText(text: string): string {
  let processed = text.toLowerCase();

  // Remove URLs
  processed = processed.replace(/https?:\/\/[^\s]+/g, '');

  // Remove mentions (@username)
  processed = processed.replace(/@\w+/g, '');

  // Remove hashtags
  processed = processed.replace(/#\w+/g, '');

  // Remove extra whitespace
  processed = processed.replace(/\s+/g, ' ').trim();

  return processed;
}

// ============================================
// Similarity Calculation
// ============================================

export function calculateSimilarity(text1: string, text2: string): number {
  const processed1 = preprocessText(text1);
  const processed2 = preprocessText(text2);

  if (processed1.length === 0 || processed2.length === 0) {
    return 0;
  }

  // Use Dice coefficient (default in string-similarity)
  return stringSimilarity.compareTwoStrings(processed1, processed2);
}

export function findMostSimilar(
  content: string,
  compareTo: string[]
): { similarity: number; match: string | null } {
  if (compareTo.length === 0) {
    return { similarity: 0, match: null };
  }

  const processed = preprocessText(content);

  if (processed.length === 0) {
    return { similarity: 0, match: null };
  }

  const processedComparisons = compareTo.map((t) => preprocessText(t));
  const result = stringSimilarity.findBestMatch(processed, processedComparisons);

  return {
    similarity: result.bestMatch.rating,
    match: compareTo[result.bestMatchIndex],
  };
}

// ============================================
// Main Check Function
// ============================================

export async function checkSimilarity(
  content: string,
  options: SimilarityOptions = {}
): Promise<SimilarityResult> {
  // Load validator config for default threshold
  const validatorConfig = loadValidator('similarity');
  const defaultThreshold = validatorConfig?.validator?.threshold ?? 0.6;

  const threshold = options.threshold ?? defaultThreshold;
  const platform = options.platform ?? 'x';

  // Get comparison posts
  let comparePosts = options.comparePosts;

  if (!comparePosts) {
    comparePosts = getPostsForSimilarityCheck(platform);
  }

  if (comparePosts.length === 0) {
    logger.debug('No posts to compare against');
    return {
      isSimilar: false,
      highestSimilarity: 0,
      threshold,
    };
  }

  // Find most similar
  const { similarity, match } = findMostSimilar(content, comparePosts);

  const isSimilar = similarity >= threshold;

  if (isSimilar) {
    logger.warn(
      `Similar content detected: ${(similarity * 100).toFixed(1)}% match`
    );
  }

  return {
    isSimilar,
    highestSimilarity: similarity,
    similarPost: match ?? undefined,
    threshold,
  };
}

// ============================================
// Batch Similarity Check
// ============================================

export function checkBatchSimilarity(
  contents: string[],
  threshold = 0.6
): Array<{ index1: number; index2: number; similarity: number }> {
  const duplicates: Array<{ index1: number; index2: number; similarity: number }> =
    [];

  for (let i = 0; i < contents.length; i++) {
    for (let j = i + 1; j < contents.length; j++) {
      const similarity = calculateSimilarity(contents[i], contents[j]);

      if (similarity >= threshold) {
        duplicates.push({
          index1: i,
          index2: j,
          similarity,
        });
      }
    }
  }

  return duplicates;
}

// ============================================
// TF-IDF Based Similarity (Optional)
// ============================================

interface TermFrequency {
  [term: string]: number;
}

function tokenize(text: string): string[] {
  return preprocessText(text)
    .split(/\s+/)
    .filter((word) => word.length > 1);
}

function calculateTF(tokens: string[]): TermFrequency {
  const tf: TermFrequency = {};
  const totalTerms = tokens.length;

  for (const token of tokens) {
    tf[token] = (tf[token] || 0) + 1;
  }

  // Normalize by total terms
  for (const term in tf) {
    tf[term] = tf[term] / totalTerms;
  }

  return tf;
}

function calculateIDF(documents: string[][]): TermFrequency {
  const idf: TermFrequency = {};
  const numDocs = documents.length;

  // Count document frequency for each term
  const docFreq: TermFrequency = {};

  for (const doc of documents) {
    const uniqueTerms = new Set(doc);
    for (const term of uniqueTerms) {
      docFreq[term] = (docFreq[term] || 0) + 1;
    }
  }

  // Calculate IDF
  for (const term in docFreq) {
    idf[term] = Math.log(numDocs / (docFreq[term] + 1)) + 1;
  }

  return idf;
}

function cosineSimilarity(vec1: TermFrequency, vec2: TermFrequency): number {
  const allTerms = new Set([...Object.keys(vec1), ...Object.keys(vec2)]);

  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (const term of allTerms) {
    const v1 = vec1[term] || 0;
    const v2 = vec2[term] || 0;

    dotProduct += v1 * v2;
    magnitude1 += v1 * v1;
    magnitude2 += v2 * v2;
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  return dotProduct / (magnitude1 * magnitude2);
}

export function calculateTFIDFSimilarity(text1: string, text2: string): number {
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);

  if (tokens1.length === 0 || tokens2.length === 0) {
    return 0;
  }

  // Calculate TF
  const tf1 = calculateTF(tokens1);
  const tf2 = calculateTF(tokens2);

  // Calculate IDF
  const idf = calculateIDF([tokens1, tokens2]);

  // Calculate TF-IDF vectors
  const tfidf1: TermFrequency = {};
  const tfidf2: TermFrequency = {};

  for (const term in tf1) {
    tfidf1[term] = tf1[term] * (idf[term] || 1);
  }

  for (const term in tf2) {
    tfidf2[term] = tf2[term] * (idf[term] || 1);
  }

  return cosineSimilarity(tfidf1, tfidf2);
}

// ============================================
// Advanced Similarity with TF-IDF
// ============================================

export async function checkSimilarityAdvanced(
  content: string,
  options: SimilarityOptions = {}
): Promise<SimilarityResult> {
  const threshold = options.threshold ?? 0.6;
  const platform = options.platform ?? 'x';
  const method = options.method ?? 'dice';

  let comparePosts = options.comparePosts;

  if (!comparePosts) {
    comparePosts = getPostsForSimilarityCheck(platform);
  }

  if (comparePosts.length === 0) {
    return {
      isSimilar: false,
      highestSimilarity: 0,
      threshold,
    };
  }

  let highestSimilarity = 0;
  let similarPost: string | undefined;

  for (const post of comparePosts) {
    let similarity: number;

    switch (method) {
      case 'cosine':
        similarity = calculateTFIDFSimilarity(content, post);
        break;
      case 'jaccard':
        similarity = calculateJaccardSimilarity(content, post);
        break;
      case 'dice':
      default:
        similarity = calculateSimilarity(content, post);
    }

    if (similarity > highestSimilarity) {
      highestSimilarity = similarity;
      similarPost = post;
    }
  }

  return {
    isSimilar: highestSimilarity >= threshold,
    highestSimilarity,
    similarPost,
    threshold,
  };
}

function calculateJaccardSimilarity(text1: string, text2: string): number {
  const tokens1 = new Set(tokenize(text1));
  const tokens2 = new Set(tokenize(text2));

  if (tokens1.size === 0 || tokens2.size === 0) {
    return 0;
  }

  const intersection = new Set([...tokens1].filter((x) => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size;
}

// Default export
export default {
  calculateSimilarity,
  findMostSimilar,
  checkSimilarity,
  checkBatchSimilarity,
  calculateTFIDFSimilarity,
  checkSimilarityAdvanced,
};
