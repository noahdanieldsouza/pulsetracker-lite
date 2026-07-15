import { BskyAgent } from "@atproto/api";

const PAGE_LIMIT = 100; // Bluesky's max allowed page size for searchPosts

let agentPromise = null;

// Reuse a single logged-in agent across all 5 politicians in a run,
// rather than logging in once per politician.
function getAgent({ handle, appPassword }) {
  if (!agentPromise) {
    agentPromise = (async () => {
      const agent = new BskyAgent({ service: "https://bsky.social" });
      await agent.login({ identifier: handle, password: appPassword });
      return agent;
    })();
  }
  return agentPromise;
}

/**
 * Fetches every Bluesky post mentioning `politicianName` created in the
 * last 24 hours, paginating via cursor through all pages instead of
 * capping at a fixed count.
 */
export async function fetchPostsForPolitician(politicianName, { handle, appPassword, sinceIso }) {
  const agent = await getAgent({ handle, appPassword });
  const posts = [];
  let cursor = undefined;

  while (true) {
    let response;
    try {
      response = await agent.app.bsky.feed.searchPosts({
        q: politicianName,
        sort: "latest",
        since: sinceIso,
        limit: PAGE_LIMIT,
        cursor,
      });
    } catch (err) {
      console.warn(
        `[bluesky] request failed for "${politicianName}" (cursor ${cursor ?? "start"}): ${err.message}`
      );
      break;
    }

    const pagePosts = response.data.posts ?? [];
    posts.push(...pagePosts);

    cursor = response.data.cursor;
    if (!cursor || pagePosts.length === 0) break;
  }

  return posts.map((post) => ({
    authorHandle: post.author?.handle ?? null,
    postText: post.record?.text ?? null,
    createdAt: post.record?.createdAt ? String(post.record.createdAt) : null,
    uri: post.uri ?? null,
  }));
}
