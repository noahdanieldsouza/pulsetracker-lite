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
  return (
    <li className="feed-item">
      <div className="feed-item__header">
        <span className="feed-item__source">@{item.authorHandle ?? "unknown"}</span>
        <span className="feed-item__date">{formatDate(item.createdAt)}</span>
      </div>
      <p className="feed-item__body feed-item__body--post">{item.postText}</p>
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
      {items.map((item) =>
        type === "news" ? <NewsItem key={item.id} item={item} /> : <SocialItem key={item.id} item={item} />
      )}
    </ul>
  );
}
