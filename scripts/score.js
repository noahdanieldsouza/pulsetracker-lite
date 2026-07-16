import vader from "vader-sentiment";
import { createHash } from "crypto";

const PLACEHOLDER_VALUES = new Set(["NO_ARTICLES_FOUND", "NO_POSTS_FOUND"]);

/**
 * Scores a piece of text with VADER, mirroring the original Foundry UDFs:
 * null/placeholder/error text scores as null (excluded from averages)
 * rather than being coerced to 0.
 */
export function scoreText(text) {
  if (!text || PLACEHOLDER_VALUES.has(text) || text.startsWith("ERROR")) {
    return null;
  }
  return vader.SentimentIntensityAnalyzer.polarity_scores(text).compound;
}

/**
 * Stable synthetic ID, equivalent to the sha2(concat_ws(...)) pattern
 * used in the Foundry transforms to dedupe/identify rows that share a
 * natural key (a post/article can match more than one politician's query).
 */
export function makeId(...parts) {
  return createHash("sha256").update(parts.join("||")).digest("hex");
}

/**
 * Average of an array of numbers, ignoring null/undefined entries.
 * Returns null (not 0) if there is nothing to average, so an empty
 * category doesn't silently drag the overall score toward zero.
 */
export function average(numbers) {
  const valid = numbers.filter((n) => typeof n === "number" && !Number.isNaN(n));
  if (valid.length === 0) return null;
  return valid.reduce((sum, n) => sum + n, 0) / valid.length;
}

export function weightedAverage(pairs) {
  // pairs: [[value, weight], [value, weight], ...]
  const valid = pairs.filter(([v]) => typeof v === "number" && !Number.isNaN(v));
  if (valid.length === 0) return null;
  const weightSum = valid.reduce((sum, [, w]) => sum + w, 0);
  const valueSum = valid.reduce((sum, [v, w]) => sum + v * w, 0);
  return valueSum / weightSum;
}
