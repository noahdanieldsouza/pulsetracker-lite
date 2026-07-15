import SentimentBadge from "./SentimentBadge.jsx";

export default function CandidateCard({ politician, onSelect }) {
  return (
    <button className="candidate-card" onClick={() => onSelect(politician.id)}>
      <div className="candidate-card__top">
        <h3 className="candidate-card__name">{politician.name}</h3>
        <SentimentBadge score={politician.overallSentiment} />
      </div>
      <div className="candidate-card__mentions">
        <span className="candidate-card__mentions-count">{politician.mentions.total}</span>
        <span className="candidate-card__mentions-label">mentions · last 24h</span>
      </div>
    </button>
  );
}
