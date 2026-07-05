// Opens the same SQLite file the Python pipeline writes to. We only
// ever read + do small status writes here (for ingest_jobs) - the
// actual scraping/clustering writes are the pipeline's job.
//
// Uses Node's built-in node:sqlite instead of a native addon like
// better-sqlite3, so there's nothing to compile on deploy.
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const dbPath = path.resolve(__dirname, "..", process.env.DB_PATH || "../db/news.db");

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL");

// Mirrors scraper/db.py so the API works even before the pipeline has
// run for the first time (e.g. fresh deploy, empty database).
db.exec(`
  CREATE TABLE IF NOT EXISTS articles (
    id           TEXT PRIMARY KEY,
    source       TEXT NOT NULL,
    title        TEXT NOT NULL,
    summary      TEXT,
    content      TEXT,
    link         TEXT NOT NULL UNIQUE,
    keywords     TEXT,
    published_at TEXT,
    fetched_at   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS clusters (
    id         TEXT PRIMARY KEY,
    label      TEXT NOT NULL,
    keywords   TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cluster_articles (
    cluster_id TEXT NOT NULL,
    article_id TEXT NOT NULL,
    PRIMARY KEY (cluster_id, article_id)
  );

  CREATE TABLE IF NOT EXISTS ingest_jobs (
    id           TEXT PRIMARY KEY,
    status       TEXT NOT NULL,
    started_at   TEXT,
    finished_at  TEXT,
    message      TEXT,
    new_articles INTEGER DEFAULT 0
  );
`);

module.exports = db;
