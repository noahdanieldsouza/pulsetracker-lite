import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.join(__dirname, "..", "data", "sentiment-cache.json");

/**
 * The cache is what keeps Claude Haiku costs low: it's a committed JSON
 * file mapping item id -> sentiment score. Both refresh-news.js and
 * refresh-social.js load it, only call the LLM for ids they haven't seen
 * before, and write it back. Without this, running every 10 minutes
 * would re-score the same unchanged posts 144 times a day.
 */
export async function loadCache() {
  try {
    const raw = await readFile(CACHE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function saveCache(cache) {
  await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2));
}

/**
 * Drops cache entries for ids that no longer appear anywhere in the
 * current data.json (i.e. items that have aged out of the 24h window),
 * so the cache file doesn't grow forever.
 */
export function pruneCache(cache, liveIds) {
  const liveSet = new Set(liveIds);
  for (const id of Object.keys(cache)) {
    if (!liveSet.has(id)) delete cache[id];
  }
}