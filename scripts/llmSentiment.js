import axios from "axios";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

// Larger batches = the fixed instruction text is paid for once per batch
// instead of once per item, which is the main cost lever here alongside
// caching. 25 items keeps responses comfortably within max_tokens.
const BATCH_SIZE = 25;

// Identical on every single call, regardless of politician or item
// content -- marked as an ephemeral cache block so repeated calls (e.g.
// back-to-back politicians in the same run, or the every-10-minutes
// social job) reuse it at ~10% of normal input cost instead of paying
// full price each time.
const STATIC_INSTRUCTIONS = `You will be given a numbered list of short news snippets or social media posts, each about or mentioning a specific politician named in the request. For each item, rate the sentiment expressed SPECIFICALLY TOWARD that named politician -- not the sentiment of the topic or event described.

For example: a post praising the politician's handling of a tragedy should score positive, even though the tragedy itself is a negative topic. A post blaming the politician for a scandal should score negative, even if the politician's own words in the quote sound calm. Focus only on how the text portrays or evaluates the named politician.

Score each item from -1 (very negative toward the politician) to 1 (very positive toward the politician), with 0 meaning neutral or no clear sentiment toward them specifically.

Respond with ONLY a JSON array of numbers, one per item, in the same order as given. No other text, no explanation, no markdown formatting.`;

function buildUserMessage(politicianName, items) {
  const list = items.map((item, i) => `${i + 1}. ${item.text.slice(0, 600)}`).join("\n\n");
  return `Politician: ${politicianName}\n\nItems:\n${list}`;
}

async function scoreBatch(politicianName, items, apiKey) {
  const response = await axios.post(
    API_URL,
    {
      model: MODEL,
      max_tokens: Math.min(2048, Math.max(256, items.length * 12)),
      system: [
        {
          type: "text",
          text: STATIC_INSTRUCTIONS,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: buildUserMessage(politicianName, items) }],
    },
    {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
    }
  );

  const textBlock = response.data.content?.find((block) => block.type === "text");
  const raw = (textBlock?.text ?? "[]").trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  const scores = JSON.parse(raw);

  if (!Array.isArray(scores) || scores.length !== items.length) {
    throw new Error(`Expected ${items.length} scores, got ${JSON.stringify(scores).slice(0, 200)}`);
  }

  return scores.map((s) => (typeof s === "number" && !Number.isNaN(s) ? Math.max(-1, Math.min(1, s)) : null));
}

/**
 * Scores `items` (each `{ id, text }`) for sentiment specifically toward
 * `politicianName`. Cached scores are reused as-is; only uncached items
 * are sent to Claude, in batches. If a batch call fails outright, falls
 * back to `fallbackScore(text)` (VADER) for just that batch rather than
 * failing the whole run.
 *
 * Mutates `cache` in place (id -> score) and returns scores in the same
 * order as `items`.
 */
export async function scoreItemsForPolitician(politicianName, items, { apiKey, cache, fallbackScore }) {
  const uncached = items.filter((item) => !(item.id in cache));

  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE);
    try {
      const scores = await scoreBatch(politicianName, batch, apiKey);
      batch.forEach((item, idx) => {
        cache[item.id] = scores[idx];
      });
    } catch (err) {
      console.warn(
        `[llm-sentiment] batch failed for "${politicianName}" (${batch.length} items): ${err.message}. ` +
          `Falling back to VADER for this batch.`
      );
      batch.forEach((item) => {
        cache[item.id] = fallbackScore(item.text);
      });
    }
  }

  return items.map((item) => cache[item.id] ?? null);
}