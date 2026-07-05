function formatDateTime(iso) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function ClusterDetailPanel({ cluster, loading, activeSources, onClose }) {
  if (loading) {
    return (
      <div className="detail-panel">
        <p className="detail-panel__loading">Pulling this dispatch...</p>
      </div>
    );
  }

  if (!cluster) {
    return (
      <div className="detail-panel detail-panel--placeholder">
        <p>Select a storyline on the timeline to read its articles.</p>
      </div>
    );
  }

  const visibleArticles = cluster.articles.filter((a) => activeSources.has(a.source));

  return (
    <div className="detail-panel">
      <div className="detail-panel__header">
        <h2>{cluster.label}</h2>
        <button type="button" className="detail-panel__close" onClick={onClose} aria-label="Close">
          &times;
        </button>
      </div>

      <p className="detail-panel__count">
        Showing {visibleArticles.length} of {cluster.articles.length} article
        {cluster.articles.length === 1 ? "" : "s"}
      </p>

      <ul className="detail-panel__articles">
        {visibleArticles.map((article) => (
          <li key={article.id} className="article-card">
            <a href={article.link} target="_blank" rel="noopener noreferrer" className="article-card__title">
              {article.title}
            </a>
            <div className="article-card__meta">
              <span className="article-card__source">{article.source}</span>
              <span className="article-card__dot">&bull;</span>
              <span>{formatDateTime(article.publishedAt)}</span>
            </div>
            {article.summary && <p className="article-card__summary">{article.summary}</p>}
          </li>
        ))}

        {visibleArticles.length === 0 && (
          <li className="article-card article-card--empty">
            No articles from the selected sources for this storyline. Toggle a source above to see it here.
          </li>
        )}
      </ul>
    </div>
  );
}
