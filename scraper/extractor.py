"""
RSS feeds only give a summary. To get real body text for clustering we
fetch the actual article page and pull out the main content, skipping
nav bars, ads, and related-article widgets.

trafilatura does the heavy lifting. If a page fails to load or parse
(paywall, weird markup, timeout) we just fall back to the RSS summary
instead of failing the whole run - one bad page shouldn't take down
the rest of the pipeline.
"""
import requests
import trafilatura

from config import FETCH_TIMEOUT_SECONDS, USER_AGENT


def fetch_article_body(url):
    """Returns extracted body text, or None if extraction wasn't possible."""
    try:
        response = requests.get(
            url,
            headers={"User-Agent": USER_AGENT},
            timeout=FETCH_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        print(f"    [skip] fetch failed for {url}: {exc}")
        return None

    text = trafilatura.extract(response.text, include_comments=False)
    if not text:
        print(f"    [skip] could not extract body for {url}")
        return None

    return text.strip()


def enrich_with_full_text(article):
    """
    Mutates nothing - returns a new dict with `content` filled in.
    Falls back to the RSS summary if full-text extraction fails, so
    downstream clustering always has *something* to work with.
    """
    body = fetch_article_body(article["link"])
    article["content"] = body if body else article["summary"]
    return article
