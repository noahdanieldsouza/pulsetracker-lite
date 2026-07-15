import CandidateCard from "./CandidateCard.jsx";

export default function CandidateGrid({ politicians, onSelect }) {
  return (
    <div className="candidate-grid">
      {politicians.map((politician) => (
        <CandidateCard key={politician.id} politician={politician} onSelect={onSelect} />
      ))}
    </div>
  );
}
