import { useEffect, useState } from "react";
import CandidateGrid from "./components/CandidateGrid.jsx";
import CandidateDetail from "./components/CandidateDetail.jsx";
import { applyRollingWindow } from "./rollingWindow.js";

function formatLastUpdated(iso) {
  if (!iso) return "unknown";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load data.json (${res.status})`);
        return res.json();
      })
      .then((json) =>
        setData({ ...json, politicians: applyRollingWindow(json.politicians, json.windowHours ?? 24) })
      )
      .catch((err) => setError(err.message));
  }, []);

  const selected = data?.politicians.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__pulse-line" aria-hidden="true">
          <svg viewBox="0 0 400 40" preserveAspectRatio="none">
            <polyline points="0,20 60,20 75,5 90,35 105,20 160,20 175,8 190,32 205,20 260,20 275,5 290,35 305,20 400,20" />
          </svg>
        </div>
        <h1 className="app__title">PulseTracker</h1>
        <p className="app__subtitle">News &amp; social sentiment, tracked daily</p>
      </header>

      <main className="app__main">
        {error && <p className="app__error">Couldn't load data: {error}</p>}

        {!data && !error && <p className="app__loading">Loading...</p>}

        {data && !selected && <CandidateGrid politicians={data.politicians} onSelect={setSelectedId} />}

        {data && selected && <CandidateDetail politician={selected} onBack={() => setSelectedId(null)} />}
      </main>

      {data && (
        <footer className="app__footer">
          Last updated {formatLastUpdated(data.lastUpdated)} · reflects mentions in the last{" "}
          {data.windowHours ?? 24} hours
        </footer>
      )}
    </div>
  );
}
