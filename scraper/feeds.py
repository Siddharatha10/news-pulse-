"""
Pulls entries out of the configured RSS feeds and normalizes them into
one consistent shape, regardless of how each outlet structures its feed.

Different feeds disagree on almost everything: some put the body in
<description>, others in <content:encoded>; pubDate formats vary; some
entries are missing a date entirely. feedparser handles most of the raw
parsing for us, so this module's job is just to reconcile the field
naming and fill in sane defaults when something is missing.
"""
import html
import re
from datetime import datetime, timezone

import feedparser
from dateutil import parser as date_parser

from config import FEEDS, USER_AGENT

TAG_RE = re.compile(r"<[^>]+>")
WHITESPACE_RE = re.compile(r"\s+")


def _strip_html(raw_text):
    """
    Some feeds (NPR in particular) put raw HTML - <img>, <a>, entities -
    directly in the summary/description field instead of plain text.
    Left as-is, tag names like "img" and "src" end up as high-frequency
    "keywords" and pollute cluster labels. Stripping tags + unescaping
    entities here means every downstream consumer (clustering, the
    frontend detail view) just sees clean text.
    """
    if not raw_text:
        return ""
    without_tags = TAG_RE.sub(" ", raw_text)
    unescaped = html.unescape(without_tags)
    return WHITESPACE_RE.sub(" ", unescaped).strip()


def _best_summary(entry):
    """Different feeds stash the body text under different keys."""
    if "content" in entry and entry["content"]:
        raw = entry["content"][0].get("value", "")
    else:
        raw = ""
        for key in ("summary", "description"):
            if entry.get(key):
                raw = entry[key]
                break
    return _strip_html(raw)


def _parse_published(entry):
    """
    Normalize whatever date format a feed gives us into an ISO 8601 UTC
    string. Some entries have no date at all - we fall back to "now"
    rather than dropping the article, since a missing timestamp
    shouldn't sink an otherwise usable article.
    """
    for key in ("published", "updated", "pubDate"):
        raw = entry.get(key)
        if not raw:
            continue
        try:
            parsed = date_parser.parse(raw)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc).isoformat()
        except (ValueError, OverflowError):
            continue
    return datetime.now(timezone.utc).isoformat()


def fetch_feed(source_name, feed_url):
    """
    Returns a list of normalized article dicts for a single feed.
    A feed that fails to load (network issue, malformed XML) is skipped
    rather than crashing the whole run.
    """
    parsed = feedparser.parse(feed_url, agent=USER_AGENT)

    if parsed.bozo and not parsed.entries:
        print(f"  [warn] could not parse feed for {source_name}: {parsed.bozo_exception}")
        return []

    articles = []
    for entry in parsed.entries:
        link = entry.get("link")
        title = entry.get("title", "").strip()
        if not link or not title:
            continue  # not enough to work with

        articles.append({
            "source": source_name,
            "title": title,
            "summary": _best_summary(entry),
            "link": link,
            "published_at": _parse_published(entry),
        })

    return articles


def fetch_all_feeds():
    """Fetches every configured feed and returns one flat list of articles."""
    all_articles = []
    for feed in FEEDS:
        print(f"Fetching {feed['source']}...")
        articles = fetch_feed(feed["source"], feed["url"])
        print(f"  got {len(articles)} entries")
        all_articles.extend(articles)
    return all_articles
