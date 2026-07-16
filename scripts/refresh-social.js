import { POLITICIANS } from "./politicians.js";
import { fetchPostsForPolitician } from "./fetchBluesky.js";
import { scoreText, makeId, average } from "./score.js";
import { scoreItemsForPolitician } from "./llmSentiment.js";
import { loadData, saveData, findOrCreatePolitician, collectLiveItemIds } from "./dataStore.js";
import { loadCache, saveCache, pruneCache } from "./sentimentCache.js";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function main() {
  const blueskyHandle = requireEnv("BLUESKY_HANDLE");
  const blueskyAppPassword = requireEnv("BLUESKY_APP_PASSWORD");
  const anthropicApiKey = requireEnv("ANTHROPIC_API_KEY");

  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const data = await loadData();
  const cache = await loadCache();

  for (const politician of POLITICIANS) {
    console.log(`[social] Fetching for ${politician.name}...`);
    const record = findOrCreatePolitician(data, politician);

    try {
      const rawPosts = await fetchPostsForPolitician(politician.name, {
        handle: blueskyHandle,
        appPassword: blueskyAppPassword,
        sinceIso,
      });

      const scorable = rawPosts.map((post) => ({
        id: makeId(politician.id, post.uri ?? "", post.postText ?? ""),
        text: post.postText ?? "",
        post,
      }));

      const scores = await scoreItemsForPolitician(politician.name, scorable, {
        apiKey: anthropicApiKey,
        cache,
        fallbackScore: scoreText,
      });

      const social = scorable.map((item, i) => ({
        id: item.id,
        authorHandle: item.post.authorHandle,
        postText: item.post.postText,
        createdAt: item.post.createdAt,
        uri: item.post.uri,
        sentiment: scores[i],
      }));
      social.sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0));

      record.social = social;
      record.socialSentiment = average(social.map((s) => s.sentiment));
      console.log(`  -> ${social.length} social posts`);
    } catch (err) {
      console.error(`[social] Failed for ${politician.name}: ${err.message}`);
      // Leave record.social as whatever it was from the last successful
      // run rather than wiping it out over a transient fetch failure.
    }

    record.mentions = {
      news: record.news?.length ?? 0,
      social: record.social?.length ?? 0,
      total: (record.news?.length ?? 0) + (record.social?.length ?? 0),
    };
    record.overallSentiment = average([record.newsSentiment, record.socialSentiment]);
  }

  pruneCache(cache, collectLiveItemIds(data));

  data.lastUpdated = new Date().toISOString();
  data.windowHours = 24;

  await saveData(data);
  await saveCache(cache);
  console.log("Wrote public/data.json and data/sentiment-cache.json (social refresh)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});