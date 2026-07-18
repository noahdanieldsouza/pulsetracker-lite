import axios from "axios";

const SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const COMMENT_THREADS_URL = "https://www.googleapis.com/youtube/v3/commentThreads";
const MAX_VIDEOS_PER_QUERY = 15;
const MAX_COMMENT_PAGES = 4;

/**
 * search.list only matches the politician's name against a video's
 * title/description, not its comments -- so a single video (e.g. a
 * multi-candidate debate) can surface for several politicians' searches,
 * and every comment on it would otherwise get attributed to all of them
 * even when a given comment is a generic reaction that never mentions
 * that specific person. Mirrors fetchNews.js's exact-phrase NewsData
 * query (`q: "${politicianName}"`) by requiring the name to appear in
 * the comment text itself before it's considered "about" them.
 *
 * Matches on the first name, last name, or full name as whole words
 * (case-insensitive).
 */
function buildNameMatcher(politicianName) {
  const escape = (s) => s.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = politicianName.trim().split(/\s+/);
  const first = parts[0];
  const last = parts[parts.length - 1];
  const alternatives = [...new Set([first, last, politicianName])].map((s) => escape(s).replace(/\s+/g, "\\s+"));
  const pattern = new RegExp(`\\b(${alternatives.join("|")})\\b`, "i");
  return (text) => pattern.test(text ?? "");
}

/**
 * Finds videos relevant to `politicianName` for a given result ordering.
 * Costs 100 quota units per call regardless of maxResults (up to the API's
 * cap of 50), so raising MAX_VIDEOS_PER_QUERY is effectively free -- the
 * real quota cost is the number of *calls*, not results per call.
 */
async function searchVideos(politicianName, apiKey, order) {
  const response = await axios.get(SEARCH_URL, {
    params: {
      key: apiKey,
      q: politicianName,
      part: "snippet",
      type: "video",
      order,
      maxResults: MAX_VIDEOS_PER_QUERY,
    },
  });
  return (response.data.items ?? []).map((item) => ({
    videoId: item.id?.videoId ?? null,
    videoTitle: item.snippet?.title ?? null,
  }));
}

/**
 * Combines relevance- and date-ordered searches to widen video discovery:
 * "relevance" alone favors long-established, highly-viewed videos (e.g.
 * one shared debate clip) and can miss smaller/newer coverage of a given
 * candidate (local news segments, fresh interviews) that hasn't
 * accumulated engagement yet. Two search calls per politician (200 units)
 * x 5 politicians x 1 run/day = 1,000/10,000 daily quota units, still
 * well within budget alongside the commentThreads calls below.
 */
async function findVideos(politicianName, apiKey) {
  const [byRelevance, byDate] = await Promise.all([
    searchVideos(politicianName, apiKey, "relevance"),
    searchVideos(politicianName, apiKey, "date"),
  ]);

  const seen = new Set();
  return [...byRelevance, ...byDate].filter((video) => {
    if (!video.videoId || seen.has(video.videoId)) return false;
    seen.add(video.videoId);
    return true;
  });
}

/**
 * Fetches top-level comments for a single video, paginating newest-first
 * (order=time) and stopping early once a page's oldest comment predates
 * `sinceIso` -- mirrors fetchNews.js's pubDate cutoff optimization. Skips
 * videos with comments disabled (or any other per-video failure) rather
 * than failing the whole run, mirroring fetchBluesky.js's per-page
 * try/catch.
 */
async function fetchCommentsForVideo(videoId, videoTitle, apiKey, sinceIso) {
  const comments = [];
  let pageToken = undefined;

  for (let page = 0; page < MAX_COMMENT_PAGES; page++) {
    let response;
    try {
      response = await axios.get(COMMENT_THREADS_URL, {
        params: {
          key: apiKey,
          videoId,
          part: "snippet",
          order: "time",
          maxResults: 100,
          ...(pageToken ? { pageToken } : {}),
        },
      });
    } catch (err) {
      console.warn(
        `[youtube] commentThreads failed for video "${videoId}" (${videoTitle ?? "untitled"}): ${err.message}`
      );
      break;
    }

    const pageItems = response.data.items ?? [];
    for (const item of pageItems) {
      const top = item.snippet?.topLevelComment?.snippet;
      if (!top) continue;
      comments.push({
        authorName: top.authorDisplayName ?? null,
        commentText: top.textDisplay ?? null,
        publishedAt: top.publishedAt ? String(top.publishedAt) : null,
        videoId,
        videoTitle,
        commentId: item.snippet?.topLevelComment?.id ?? item.id ?? null,
      });
    }

    const oldestOnPage = pageItems[pageItems.length - 1]?.snippet?.topLevelComment?.snippet;
    const hitCutoff = sinceIso && oldestOnPage?.publishedAt && new Date(oldestOnPage.publishedAt) < new Date(sinceIso);

    pageToken = response.data.nextPageToken;
    if (!pageToken || pageItems.length === 0 || hitCutoff) break;
  }

  return comments;
}

/**
 * Finds relevant videos for `politicianName` and fetches recent top-level
 * comments across them, filtered to comments published within the last
 * `sinceIso` window (regardless of when the video itself was published --
 * an older video can still get fresh comments today) and to comments that
 * actually mention the politician by name (see buildNameMatcher above).
 */
export async function fetchCommentsForPolitician(politicianName, { apiKey, sinceIso }) {
  let videos;
  try {
    videos = await findVideos(politicianName, apiKey);
  } catch (err) {
    console.warn(`[youtube] search failed for "${politicianName}": ${err.message}`);
    return [];
  }

  const allComments = [];
  for (const video of videos) {
    if (!video.videoId) continue;
    const comments = await fetchCommentsForVideo(video.videoId, video.videoTitle, apiKey, sinceIso);
    allComments.push(...comments);
  }

  const mentionsPolitician = buildNameMatcher(politicianName);

  return allComments.filter((comment) => {
    if (!mentionsPolitician(comment.commentText)) return false;
    if (!sinceIso) return true;
    if (!comment.publishedAt) return false;
    return new Date(comment.publishedAt) >= new Date(sinceIso);
  });
}
