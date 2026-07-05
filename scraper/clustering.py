"""
Groups articles into topic clusters using keyword overlap - Option A
from the assessment. No NLP libraries, no vectors: just count how many
meaningful words two pieces of text have in common.

Approach, in plain terms:
  1. Turn each article's title + summary into a small set of meaningful
     words (its "fingerprint"), with stopwords and short junk stripped out.
  2. For each new article, compare its fingerprint against every existing
     cluster's fingerprint (the union of words shared by articles already
     in that cluster). If the overlap crosses a threshold, drop the
     article into that cluster.
  3. If nothing matches well enough, the article starts a brand new
     cluster, labelled with its own top keywords.

This runs incrementally (new articles are compared against existing
clusters) so re-running the pipeline doesn't have to re-cluster
everything from scratch.
"""
import re
from collections import Counter

from config import CLUSTER_OVERLAP_THRESHOLD, KEYWORDS_PER_ARTICLE
from stopwords import STOPWORDS

WORD_RE = re.compile(r"[a-zA-Z]{3,}")


def extract_keywords(title, summary, limit=KEYWORDS_PER_ARTICLE):
    """
    Returns the most frequent meaningful words in the given text, as a
    list ordered by frequency (most common first). Title words are
    weighted double since they're the strongest signal of what a story
    is actually about.
    """
    text = f"{title} {title} {summary or ''}".lower()
    words = [w for w in WORD_RE.findall(text) if w not in STOPWORDS]
    counts = Counter(words)
    return [word for word, _ in counts.most_common(limit)]


def overlap_score(words_a, words_b):
    """Number of meaningful words two keyword sets have in common."""
    return len(set(words_a) & set(words_b))


def best_matching_cluster(article_keywords, clusters):
    """
    clusters: list of dicts with at least {"id", "keywords": [...]}.
    Returns (cluster, score) for the best match, or (None, 0) if no
    cluster meets the overlap threshold.
    """
    best_cluster = None
    best_score = 0

    for cluster in clusters:
        score = overlap_score(article_keywords, cluster["keywords"])
        if score > best_score:
            best_score = score
            best_cluster = cluster

    if best_score >= CLUSTER_OVERLAP_THRESHOLD:
        return best_cluster, best_score
    return None, 0


def merge_cluster_keywords(existing_keywords, new_article_keywords, max_keywords=15):
    """
    A cluster's keyword set grows as articles join it, but we cap it so
    a large cluster doesn't just accumulate noise and match everything.
    Keeps the words that appear most often across the cluster's articles.
    """
    combined = Counter(existing_keywords)
    combined.update(new_article_keywords)
    return [word for word, _ in combined.most_common(max_keywords)]


def label_from_keywords(keywords, max_words=3):
    """Turns a cluster's top keywords into a human-readable label."""
    top = keywords[:max_words]
    return " / ".join(word.capitalize() for word in top) if top else "Uncategorized"
