"""
Thin wrapper around sqlite3. Kept deliberately simple - this is the same
file the Node backend reads from, so the schema is the real contract
between the two services.
"""
import sqlite3
from pathlib import Path

from config import DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS articles (
    id           TEXT PRIMARY KEY,
    source       TEXT NOT NULL,
    title        TEXT NOT NULL,
    summary      TEXT,
    content      TEXT,
    link         TEXT NOT NULL UNIQUE,
    keywords     TEXT,              -- comma separated, used for clustering
    published_at TEXT,              -- ISO 8601, UTC
    fetched_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clusters (
    id         TEXT PRIMARY KEY,
    label      TEXT NOT NULL,
    keywords   TEXT,                -- top shared keywords, comma separated
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cluster_articles (
    cluster_id TEXT NOT NULL REFERENCES clusters(id),
    article_id TEXT NOT NULL REFERENCES articles(id),
    PRIMARY KEY (cluster_id, article_id)
);

CREATE TABLE IF NOT EXISTS ingest_jobs (
    id          TEXT PRIMARY KEY,
    status      TEXT NOT NULL,      -- queued | running | done | failed
    started_at  TEXT,
    finished_at TEXT,
    message     TEXT,
    new_articles INTEGER DEFAULT 0
);
"""


def get_connection():
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_connection()
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()


def article_exists(conn, link):
    row = conn.execute(
        "SELECT 1 FROM articles WHERE link = ?", (link,)
    ).fetchone()
    return row is not None


if __name__ == "__main__":
    init_db()
    print(f"Initialised database at {DB_PATH}")
