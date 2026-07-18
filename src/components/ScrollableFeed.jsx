import SentimentBadge from "./SentimentBadge.jsx";

function formatDate(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function NewsItem({ item }) {
  return (
    <li className="feed-item">
      <div className="feed-item__header">
        <span className="feed-item__source">{item.sourceName ?? "Unknown source"}</span>
        <span className="feed-item__date">{formatDate(item.publishedAt)}</span>
      </div>
      <a className="feed-item__title" href={item.url} target="_blank" rel="noreferrer">
        {item.title ?? "Untitled article"}
      </a>
      {item.description && <p className="feed-item__body">{item.description}</p>}
      <SentimentBadge score={item.sentiment} size="sm" />
    </li>
  );
}

function SocialItem({ item }) {
  const rkey = item.uri.split("/").pop();
  const postUrl = `https://bsky.app/profile/${item.authorHandle}/post/${rkey}`;
  return (
    <li className="feed-item">
      <div className="feed-item__header">
        <span className="feed-item__source">@{item.authorHandle ?? "unknown"}</span>
        <span className="feed-item__date">{formatDate(item.createdAt)}</span>
      </div>
      <a className="feed-item__body" href={postUrl} target="_blank" rel="noreferrer">
        {item.postText}
      </a>
      <SentimentBadge score={item.sentiment} size="sm" />
    </li>
  );
}

function YoutubeItem({ item }) {
  const commentUrl = `https://www.youtube.com/watch?v=${item.videoId}&lc=${item.commentId}`;
  return (
    <li className="feed-item">
      <div className="feed-item__header">
        <span className="feed-item__source">{item.authorName ?? "Unknown commenter"}</span>
        <span className="feed-item__date">{formatDate(item.publishedAt)}</span>
      </div>
      <a className="feed-item__body" href={commentUrl} target="_blank" rel="noreferrer">
        {item.commentText}
      </a>
      <SentimentBadge score={item.sentiment} size="sm" />
    </li>
  );
}

export default function ScrollableFeed({ items, type, emptyMessage }) {
  if (!items || items.length === 0) {
    return <p className="feed-empty">{emptyMessage}</p>;
  }

  return (
    <ul className="feed-list">
      {items.map((item) => {
        if (type === "news") return <NewsItem key={item.id} item={item} />;
        if (type === "youtube") return <YoutubeItem key={item.id} item={item} />;
        return <SocialItem key={item.id} item={item} />;
      })}
    </ul>
  );
}
