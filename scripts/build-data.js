import { writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { POLITICIANS } from "./politicians.js";
import { fetchNewsForPolitician } from "./fetchNews.js";
import { fetchPostsForPolitician } from "./fetchBluesky.js";
import { scoreText, makeId, average, weightedAverage } from "./score.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, "..", "public", "data.json");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function buildPoliticianRecord(politician, { sinceIso, newsDataApiKey, blueskyHandle, blueskyAppPassword }) {
  const [rawArticles, rawPosts] = await Promise.all([
    fetchNewsForPolitician(politician.name, { apiKey: newsDataApiKey }),
    fetchPostsForPolitician(politician.name, {
      handle: blueskyHandle,
      appPassword: blueskyAppPassword,
      sinceIso,
    }),
  ]);

  const news = rawArticles.map((article) => {
    const combinedText = [article.title, article.description].filter(Boolean).join(". ");
    return {
      id: makeId(politician.id, article.url ?? "", article.title ?? ""),
      title: article.title,
      description: article.description,
      sourceName: article.sourceName,
      url: article.url,
      publishedAt: article.publishedAt,
      sentiment: scoreText(combinedText),
    };
  });

  const social = rawPosts.map((post) => ({
    id: makeId(politician.id, post.uri ?? "", post.postText ?? ""),
    authorHandle: post.authorHandle,
    postText: post.postText,
    createdAt: post.createdAt,
    uri: post.uri,
    sentiment: scoreText(post.postText),
  }));

  // Sort most-recent first for the frontend feeds.
  news.sort((a, b) => new Date(b.publishedAt ?? 0) - new Date(a.publishedAt ?? 0));
  social.sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0));

  const newsSentiment = average(news.map((n) => n.sentiment));
  const socialSentiment = average(social.map((s) => s.sentiment));
  const overallSentiment = weightedAverage([
  [newsSentiment, 1],
  [socialSentiment, 2],
   ]);

  // Mentions is its own data point: total volume across both platforms in
  // the last 24 hours, plus the per-platform breakdown, independent of
  // sentiment (a candidate can be talked about a lot without it being
  // positive or negative).
  const mentions = {
    total: news.length + social.length,
    news: news.length,
    social: social.length,
  };

  return {
    id: politician.id,
    name: politician.name,
    overallSentiment,
    newsSentiment,
    socialSentiment,
    mentions,
    news,
    social,
  };
}

async function main() {
  const newsDataApiKey = requireEnv("NEWSDATA_API_KEY");
  const blueskyHandle = requireEnv("BLUESKY_HANDLE");
  const blueskyAppPassword = requireEnv("BLUESKY_APP_PASSWORD");

  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const politicians = [];
  for (const politician of POLITICIANS) {
    console.log(`Fetching data for ${politician.name}...`);
    try {
      const record = await buildPoliticianRecord(politician, {
        sinceIso,
        newsDataApiKey,
        blueskyHandle,
        blueskyAppPassword,
      });
      politicians.push(record);
      console.log(
        `  -> ${record.mentions.total} mentions (news: ${record.mentions.news}, social: ${record.mentions.social})`
      );
    } catch (err) {
      console.error(`Failed to build record for ${politician.name}: ${err.message}`);
      // Keep going for the other 4 politicians rather than failing the
      // whole run over one politician's transient API error.
      politicians.push({
        id: politician.id,
        name: politician.name,
        overallSentiment: null,
        newsSentiment: null,
        socialSentiment: null,
        mentions: { total: 0, news: 0, social: 0 },
        news: [],
        social: [],
      });
    }
  }

  const output = {
    lastUpdated: new Date().toISOString(),
    windowHours: 24,
    politicians,
  };

  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
