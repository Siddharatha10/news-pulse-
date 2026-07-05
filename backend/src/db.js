const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const dbPath = path.resolve(__dirname, "..", process.env.DB_PATH || "../db/news.db");


fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL");


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