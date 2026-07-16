import { POLITICIANS } from "./politicians.js";
import { fetchNewsForPolitician } from "./fetchNews.js";
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
  const newsDataApiKey = requireEnv("NEWSDATA_API_KEY");
  const anthropicApiKey = requireEnv("ANTHROPIC_API_KEY");

  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const data = await loadData();
  const cache = await loadCache();

  for (const politician of POLITICIANS) {
    console.log(`[news] Fetching for ${politician.name}...`);
    const record = findOrCreatePolitician(data, politician);

    try {
      const rawArticles = await fetchNewsForPolitician(politician.name, {
        apiKey: newsDataApiKey,
        sinceIso,
      });

      const scorable = rawArticles.map((article) => ({
        id: makeId(politician.id, article.url ?? "", article.title ?? ""),
        text: [article.title, article.description].filter(Boolean).join(". "),
        article,
      }));

      const scores = await scoreItemsForPolitician(politician.name, scorable, {
        apiKey: anthropicApiKey,
        cache,
        fallbackScore: scoreText,
      });

      const news = scorable.map((item, i) => ({
        id: item.id,
        title: item.article.title,
        description: item.article.description,
        sourceName: item.article.sourceName,
        url: item.article.url,
        publishedAt: item.article.publishedAt,
        sentiment: scores[i],
      }));
      news.sort((a, b) => new Date(b.publishedAt ?? 0) - new Date(a.publishedAt ?? 0));

      record.news = news;
      record.newsSentiment = average(news.map((n) => n.sentiment));
      console.log(`  -> ${news.length} articles`);
    } catch (err) {
      console.error(`[news] Failed for ${politician.name}: ${err.message}`);
      // Leave record.news as-is from the last successful run rather than
      // wiping it out over a transient fetch failure.
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
  console.log("Wrote public/data.json and data/sentiment-cache.json (news refresh)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});