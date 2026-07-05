const express = require("express");
const db = require("../db");

const router = express.Router();

// Shared by /clusters and /timeline - pulls every cluster along with
// its article count and the earliest/latest published_at in one query
// rather than N+1'ing it per cluster.
const CLUSTER_SUMMARY_SQL = `
  SELECT
    c.id,
    c.label,
    c.keywords,
    COUNT(a.id)                        AS article_count,
    MIN(a.published_at)                AS starts_at,
    MAX(a.published_at)                AS ends_at,
    GROUP_CONCAT(DISTINCT a.source)    AS sources
  FROM clusters c
  LEFT JOIN cluster_articles ca ON ca.cluster_id = c.id
  LEFT JOIN articles a ON a.id = ca.article_id
  GROUP BY c.id
  HAVING article_count > 0
  ORDER BY ends_at DESC
`;

// GET /clusters - list of topic clusters with article count + time range
router.get("/clusters", (req, res) => {
  const rows = db.prepare(CLUSTER_SUMMARY_SQL).all();
  res.json(
    rows.map((row) => ({
      id: row.id,
      label: row.label,
      articleCount: row.article_count,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      sources: (row.sources || "").split(",").filter(Boolean),
    }))
  );
});

// GET /clusters/:id - full detail with articles sorted chronologically
router.get("/clusters/:id", (req, res) => {
  const cluster = db
    .prepare("SELECT id, label, keywords, created_at FROM clusters WHERE id = ?")
    .get(req.params.id);

  if (!cluster) {
    return res.status(404).json({ error: "Cluster not found" });
  }

  const articles = db
    .prepare(
      `SELECT a.id, a.source, a.title, a.summary, a.link, a.published_at
       FROM articles a
       JOIN cluster_articles ca ON ca.article_id = a.id
       WHERE ca.cluster_id = ?
       ORDER BY a.published_at ASC`
    )
    .all(cluster.id);

  res.json({
    id: cluster.id,
    label: cluster.label,
    keywords: (cluster.keywords || "").split(",").filter(Boolean),
    articles: articles.map((a) => ({
      id: a.id,
      source: a.source,
      title: a.title,
      summary: a.summary,
      link: a.link,
      publishedAt: a.published_at,
    })),
  });
});

// GET /timeline - clusters shaped for a charting library: explicit
// start/end so the frontend doesn't have to derive a range from a raw
// list, plus a size metric it can use for marker weight.
router.get("/timeline", (req, res) => {
  const rows = db.prepare(CLUSTER_SUMMARY_SQL).all();

  const maxCount = Math.max(1, ...rows.map((r) => r.article_count));

  const timeline = rows.map((row) => ({
    id: row.id,
    label: row.label,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    articleCount: row.article_count,
    sources: (row.sources || "").split(",").filter(Boolean),
    // 0-1 scale so the frontend can size markers without knowing the
    // dataset's max count itself.
    intensity: Number((row.article_count / maxCount).toFixed(2)),
  }));

  res.json(timeline);
});

module.exports = router;
