const DEFAULT_WINDOW_HOURS = 24;

function average(numbers) {
  const valid = numbers.filter((n) => typeof n === "number" && !Number.isNaN(n));
  if (valid.length === 0) return null;
  return valid.reduce((sum, n) => sum + n, 0) / valid.length;
}

/**
 * News refreshes once a day while social/YouTube refresh far more often,
 * so a backend snapshot's "last 24 hours" is only accurate as of its own
 * last refresh -- by the end of a news refresh cycle, articles in the
 * committed data.json can be pushing 48h old by the time a viewer loads
 * the page. Re-filtering every category to a genuine rolling window here
 * (based on the viewer's own clock) keeps what's displayed, and its
 * derived sentiment/mentions, honestly scoped to "now - windowHours"
 * regardless of how stale any one backend refresh has gotten.
 */
export function applyRollingWindow(politicians, windowHours = DEFAULT_WINDOW_HOURS) {
  const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
  const isRecent = (iso) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return !Number.isNaN(t) && t >= cutoff;
  };

  return politicians.map((p) => {
    const news = (p.news ?? []).filter((item) => isRecent(item.publishedAt));
    const social = (p.social ?? []).filter((item) => isRecent(item.createdAt));
    const youtube = (p.youtube ?? []).filter((item) => isRecent(item.publishedAt));

    const newsSentiment = average(news.map((n) => n.sentiment));
    const socialSentiment = average(social.map((s) => s.sentiment));
    const youtubeSentiment = average(youtube.map((y) => y.sentiment));

    return {
      ...p,
      news,
      social,
      youtube,
      newsSentiment,
      socialSentiment,
      youtubeSentiment,
      overallSentiment: average([newsSentiment, socialSentiment, youtubeSentiment]),
      mentions: {
        news: news.length,
        social: social.length,
        youtube: youtube.length,
        total: news.length + social.length + youtube.length,
      },
    };
  });
}
