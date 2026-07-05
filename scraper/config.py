"""
Central place for the few knobs this pipeline needs. Everything here can
be overridden with environment variables so nothing sensitive/hardcoded
has to live in the code.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent

DB_PATH = os.getenv("DB_PATH", str(BASE_DIR / ".." / "db" / "news.db"))

# Three public feeds across three different outlets, as required.
FEEDS = [
    {"source": "BBC News", "url": "http://feeds.bbci.co.uk/news/rss.xml"},
    {"source": "NPR", "url": "https://feeds.npr.org/1001/rss.xml"},
    {"source": "Al Jazeera", "url": "https://www.aljazeera.com/xml/rss/all.xml"},
]

# How many meaningful words two articles need to share before we treat
# them as the same story. Tuned by hand against a real pipeline run -
# see README for the reasoning.
CLUSTER_OVERLAP_THRESHOLD = int(os.getenv("CLUSTER_OVERLAP_THRESHOLD", "3"))

# How many keywords we keep per article when building its fingerprint.
KEYWORDS_PER_ARTICLE = int(os.getenv("KEYWORDS_PER_ARTICLE", "12"))

# Requests to article pages shouldn't hang forever.
FETCH_TIMEOUT_SECONDS = 10

USER_AGENT = (
    "NewsPulseBot/1.0 (+https://github.com/; internship assessment project)"
)
