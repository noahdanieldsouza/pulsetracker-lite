import axios from "axios";

const NEWSDATA_URL = "https://newsdata.io/api/1/latest";

/**
 * Fetches every news article mentioning `politicianName` from the last 24
 * hours via NewsData.io, paginating through all pages using the API's
 * `nextPage` cursor token (not a page number) instead of capping results.
 *
 * Why NewsData.io instead of NewsAPI.org: NewsAPI.org's free "Developer"
 * plan (a) delays articles by ~24 hours, which made a strict
 * "from = now - 24h" filter return nothing, and (b) is explicitly
 * restricted to local development only -- it isn't meant to be called
 * from a non-localhost environment like a GitHub Actions runner.
 * NewsData.io's free tier allows non-localhost/production use, with
 * only a ~12 hour delay. Note: NewsData.io's `timeframe` parameter is a
 * paid-plan-only feature (free requests return 422 InvalidRequest), so
 * instead we take its default recent-articles window and filter to the
 * last 24 hours ourselves, client-side.
 */
export async function fetchNewsForPolitician(politicianName, { apiKey, sinceIso }) {
  const articles = [];
  let page = undefined; // NewsData.io's nextPage cursor, not a page number

  while (true) {
    let response;
    try {
      response = await axios.get(NEWSDATA_URL, {
        params: {
          apikey: apiKey,
          q: `"${politicianName}"`,
          language: "en",
          ...(page ? { page } : {}),
        },
      });
    } catch (err) {
      console.warn(
        `[news] request failed for "${politicianName}" (page ${page ?? "start"}): ${err.message}`
      );
      if (err.response) {
        console.warn(`[news]   status: ${err.response.status}`);
        console.warn(`[news]   body: ${JSON.stringify(err.response.data)}`);
      }
      break;
    }

    const data = response.data;

    if (data.status !== "success") {
      console.warn(`[news] non-success response for "${politicianName}": ${JSON.stringify(data)}`);
      break;
    }

    if (!page && (data.results ?? []).length === 0) {
      console.log(`[news] "${politicianName}": 0 articles returned.`);
    }

    const pageArticles = data.results ?? [];
    articles.push(...pageArticles);

    // NewsData.io's /latest results are sorted newest-first by default,
    // so once we see an article older than our 24h cutoff, everything
    // after it on this and later pages will also be too old -- stop
    // paginating instead of burning quota on pages we'll filter out anyway.
    const oldestOnPage = pageArticles[pageArticles.length - 1];
    const hitCutoff =
      sinceIso && oldestOnPage?.pubDate && new Date(`${oldestOnPage.pubDate} UTC`) < new Date(sinceIso);

    page = data.nextPage;
    if (!page || pageArticles.length === 0 || hitCutoff) break;
  }

  const withinWindow = sinceIso
    ? articles.filter((article) => {
        if (!article.pubDate) return false;
        return new Date(`${article.pubDate} UTC`) >= new Date(sinceIso);
      })
    : articles;

  return withinWindow.map((article) => ({
    title: article.title ?? null,
    description: article.description ?? null,
    sourceName: article.source_name ?? article.source_id ?? null,
    url: article.link ?? null,
    publishedAt: article.pubDate ? new Date(`${article.pubDate} UTC`).toISOString() : null,
  }));
}