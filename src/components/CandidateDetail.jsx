import { useState } from "react";
import SentimentBadge from "./SentimentBadge.jsx";
import ScrollableFeed from "./ScrollableFeed.jsx";

export default function CandidateDetail({ politician, onBack }) {
  const [tab, setTab] = useState("news");

  return (
    <div className="candidate-detail">
      <button className="back-link" onClick={onBack}>
        ← All candidates
      </button>

      <h2 className="candidate-detail__name">{politician.name}</h2>

      <div className="score-row">
        <div className="score-row__item">
          <span className="score-row__label">Overall</span>
          <SentimentBadge score={politician.overallSentiment} size="lg" />
        </div>
        <div className="score-row__item">
          <span className="score-row__label">News</span>
          <SentimentBadge score={politician.newsSentiment} size="lg" />
        </div>
        <div className="score-row__item">
          <span className="score-row__label">Social</span>
          <SentimentBadge score={politician.socialSentiment} size="lg" />
        </div>
        <div className="score-row__item">
          <span className="score-row__label">Mentions (24h)</span>
          <span className="mentions-figure">
            {politician.mentions.total}
            <span className="mentions-figure__breakdown">
              {politician.mentions.news} news · {politician.mentions.social} social
            </span>
          </span>
        </div>
      </div>

      <div className="feed-tabs">
        <button className={tab === "news" ? "feed-tab feed-tab--active" : "feed-tab"} onClick={() => setTab("news")}>
          News ({politician.news.length})
        </button>
        <button
          className={tab === "social" ? "feed-tab feed-tab--active" : "feed-tab"}
          onClick={() => setTab("social")}
        >
          Social ({politician.social.length})
        </button>
      </div>

      {tab === "news" ? (
        <ScrollableFeed items={politician.news} type="news" emptyMessage="No news articles in the last 24 hours." />
      ) : (
        <ScrollableFeed
          items={politician.social}
          type="social"
          emptyMessage="No social posts in the last 24 hours."
        />
      )}
    </div>
  );
}
