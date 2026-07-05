export default function SourceFilter({ sources, activeSources, onToggle }) {
  if (sources.length === 0) return null;

  return (
    <div className="source-filter">
      <span className="source-filter__label">Sources</span>
      <div className="source-filter__chips">
        {sources.map((source) => {
          const active = activeSources.has(source);
          return (
            <button
              key={source}
              type="button"
              className={`chip ${active ? "chip--active" : ""}`}
              onClick={() => onToggle(source)}
              aria-pressed={active}
            >
              <span className="chip__dot" aria-hidden="true" />
              {source}
            </button>
          );
        })}
      </div>
    </div>
  );
}
