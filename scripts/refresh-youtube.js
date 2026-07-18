import { POLITICIANS } from "./politicians.js";
import { fetchCommentsForPolitician } from "./fetchYoutube.js";
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
  const youtubeApiKey = requireEnv("YOUTUBE_API_KEY");
  const anthropicApiKey = requireEnv("ANTHROPIC_API_KEY");

  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const data = await loadData();
  const cache = await loadCache();

  for (const politician of POLITICIANS) {
    console.log(`[youtube] Fetching for ${politician.name}...`);
    const record = findOrCreatePolitician(data, politician);

    try {
      const rawComments = await fetchCommentsForPolitician(politician.name, {
        apiKey: youtubeApiKey,
        sinceIso,
      });

      const scorable = rawComments.map((comment) => ({
        id: makeId(politician.id, comment.commentId ?? "", comment.commentText ?? ""),
        text: comment.commentText ?? "",
        comment,
      }));

      const scores = await scoreItemsForPolitician(politician.name, scorable, {
        apiKey: anthropicApiKey,
        cache,
        fallbackScore: scoreText,
      });

      const youtube = scorable.map((item, i) => ({
        id: item.id,
        authorName: item.comment.authorName,
        commentText: item.comment.commentText,
        publishedAt: item.comment.publishedAt,
        videoId: item.comment.videoId,
        videoTitle: item.comment.videoTitle,
        commentId: item.comment.commentId,
        sentiment: scores[i],
      }));
      youtube.sort((a, b) => new Date(b.publishedAt ?? 0) - new Date(a.publishedAt ?? 0));

      record.youtube = youtube;
      record.youtubeSentiment = average(youtube.map((y) => y.sentiment));
      console.log(`  -> ${youtube.length} comments`);
    } catch (err) {
      console.error(`[youtube] Failed for ${politician.name}: ${err.message}`);
      // Leave record.youtube as whatever it was from the last successful
      // run rather than wiping it out over a transient fetch failure.
    }

    record.mentions = {
      news: record.news?.length ?? 0,
      social: record.social?.length ?? 0,
      youtube: record.youtube?.length ?? 0,
      total: (record.news?.length ?? 0) + (record.social?.length ?? 0) + (record.youtube?.length ?? 0),
    };
    record.overallSentiment = average([record.newsSentiment, record.socialSentiment, record.youtubeSentiment]);
  }

  pruneCache(cache, collectLiveItemIds(data));

  data.lastUpdated = new Date().toISOString();
  data.windowHours = 24;

  await saveData(data);
  await saveCache(cache);
  console.log("Wrote public/data.json and data/sentiment-cache.json (youtube refresh)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
