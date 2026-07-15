// Maps a VADER compound score (-1..1) to a label + CSS class.
// Thresholds follow VADER's own conventional cutoffs.
function classify(score) {
  if (score === null || score === undefined) return { label: "No data", tone: "neutral-tone" };
  if (score >= 0.05) return { label: "Positive", tone: "positive-tone" };
  if (score <= -0.05) return { label: "Negative", tone: "negative-tone" };
  return { label: "Neutral", tone: "neutral-tone" };
}

export default function SentimentBadge({ score, size = "md" }) {
  const { label, tone } = classify(score);
  const display = score === null || score === undefined ? "—" : score.toFixed(2);

  return (
    <span className={`sentiment-badge sentiment-badge--${size} ${tone}`}>
      <span className="sentiment-badge__value">{display}</span>
      <span className="sentiment-badge__label">{label}</span>
    </span>
  );
}
