"""
Entry point for the whole scrape -> extract -> cluster -> store run.

Usage:
    python pipeline.py                # plain run, prints progress
    python pipeline.py --job-id abc12 # run tracked as an ingest job
                                       # (this is how the Node backend
                                       # triggers it from POST /ingest/trigger)

Re-running this script is safe: articles already stored (matched by
their link) are skipped, and only genuinely new articles go through
extraction and clustering.
"""
import argparse
import sys
import uuid
from datetime import datetime, timezone

from clustering import (
    best_matching_cluster,
    extract_keywords,
    label_from_keywords,
    merge_cluster_keywords,
)
from db import article_exists, get_connection, init_db
from extractor import enrich_with_full_text
from feeds import fetch_all_feeds


def _now():
    return datetime.now(timezone.utc).isoformat()


def _load_existing_clusters(conn):
    rows = conn.execute("SELECT id, keywords FROM clusters").fetchall()
    return [
        {"id": row["id"], "keywords": (row["keywords"] or "").split(",")}
        for row in rows
    ]


def _store_article(conn, article):
    article_id = str(uuid.uuid4())
    conn.execute(
        """
        INSERT INTO articles (id, source, title, summary, content, link,
                               keywords, published_at, fetched_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            article_id,
            article["source"],
            article["title"],
            article["summary"],
            article["content"],
            article["link"],
            ",".join(article["keywords"]),
            article["published_at"],
            _now(),
        ),
    )
    return article_id


def _assign_to_cluster(conn, article_id, article_keywords, clusters):
    """
    Finds (or creates) the right cluster for this article, writes the
    link, and returns the updated in-memory cluster list so the next
    article in this run sees the change too.
    """
    match, _score = best_matching_cluster(article_keywords, clusters)

    if match:
        new_keywords = merge_cluster_keywords(match["keywords"], article_keywords)
        conn.execute(
            "UPDATE clusters SET keywords = ?, label = ? WHERE id = ?",
            (",".join(new_keywords), label_from_keywords(new_keywords), match["id"]),
        )
        match["keywords"] = new_keywords
        cluster_id = match["id"]
    else:
        cluster_id = str(uuid.uuid4())
        label = label_from_keywords(article_keywords)
        conn.execute(
            "INSERT INTO clusters (id, label, keywords, created_at) VALUES (?, ?, ?, ?)",
            (cluster_id, label, ",".join(article_keywords), _now()),
        )
        clusters.append({"id": cluster_id, "keywords": article_keywords})

    conn.execute(
        "INSERT OR IGNORE INTO cluster_articles (cluster_id, article_id) VALUES (?, ?)",
        (cluster_id, article_id),
    )


def run_pipeline(job_id=None):
    conn = get_connection()

    if job_id:
        conn.execute(
            "UPDATE ingest_jobs SET status = 'running', started_at = ? WHERE id = ?",
            (_now(), job_id),
        )
        conn.commit()

    try:
        raw_articles = fetch_all_feeds()
        new_count = 0
        clusters = _load_existing_clusters(conn)

        for raw in raw_articles:
            if article_exists(conn, raw["link"]):
                continue  # already ingested on a previous run

            print(f"Processing new article: {raw['title'][:70]}")
            enriched = enrich_with_full_text(raw)
            enriched["keywords"] = extract_keywords(
                enriched["title"], enriched["summary"]
            )

            article_id = _store_article(conn, enriched)
            _assign_to_cluster(conn, article_id, enriched["keywords"], clusters)
            conn.commit()
            new_count += 1

        if job_id:
            conn.execute(
                """UPDATE ingest_jobs
                   SET status = 'done', finished_at = ?, new_articles = ?,
                       message = ?
                   WHERE id = ?""",
                (_now(), new_count, f"Ingested {new_count} new articles.", job_id),
            )
            conn.commit()

        print(f"Done. {new_count} new articles ingested.")
        return new_count

    except Exception as exc:  # noqa: BLE001 - top-level run, we want to log and record
        print(f"Pipeline failed: {exc}", file=sys.stderr)
        if job_id:
            conn.execute(
                "UPDATE ingest_jobs SET status = 'failed', finished_at = ?, message = ? WHERE id = ?",
                (_now(), str(exc), job_id),
            )
            conn.commit()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the News Pulse ingestion pipeline")
    parser.add_argument("--job-id", default=None, help="Ingest job ID to track progress against")
    args = parser.parse_args()

    init_db()
    run_pipeline(job_id=args.job_id)
