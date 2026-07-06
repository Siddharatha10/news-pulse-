# News Pulse

A full-stack system that pulls live articles from three news RSS feeds,
extracts full article text, groups related articles into topic
clusters using keyword-overlap analysis, and displays those clusters
as an interactive timeline.

Built for the Xponentium full-stack internship assessment.

**Live:**
- Frontend: https://news-scrap.netlify.app
- Backend API: https://news-pulse-2bog.onrender.com

## Architecture

The three services share one SQLite file (`db/news.db`) instead of
each other's APIs. The scraper is the only writer; the backend reads
from it and does small status writes for tracking ingest jobs.

## Why SQLite, not MongoDB/Postgres

The scraper and the API both need to read/write the same dataset. A
standalone hosted database (MongoDB Atlas, Postgres) adds a network
hop, connection-string management, and a separate service to provision
— overhead that buys nothing at this scale. SQLite as a single shared
file lets both services read/write directly with zero additional
infrastructure, while still being a completely valid production choice
up to a reasonable scale. The trade-off (no concurrent multi-writer
support) was a conscious decision, not an oversight.

## Why Docker

Render (and most hosts) expect one runtime per service. This project
needs two — Python for scraping/clustering, Node for the API — sharing
one database file. Docker builds a single custom image with both
runtimes installed, so the scraper and backend share a filesystem
instead of needing a network protocol between them. The root
`Dockerfile` installs Python via `apt-get` on top of a Node base
image, installs both sets of dependencies, and points both services at
the same `DB_PATH`.

## No third-party news API

This project doesn't use any paid/third-party news API (NewsAPI,
GNews, etc.) — it parses raw public RSS feeds directly (BBC, NPR, Al
Jazeera), per the assessment brief. The Node backend is itself a REST
API that the frontend consumes.

## Setup (local development)

### 1. Scraper

```bash
cd scraper
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python pipeline.py
```

First run creates `db/news.db` and populates it. Re-running only
processes articles that aren't already stored (matched by link), so
it's safe to schedule on a cron.

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
npm start
```

Runs on `http://localhost:4000`. Requires Node 22.5+ (uses the
built-in `node:sqlite` module, no native build step).

### 3. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Runs on `http://localhost:3000`. Point `NEXT_PUBLIC_API_URL` in
`.env.local` at wherever the backend is deployed.

## Topic grouping approach

Used **keyword-overlap grouping** (Option A), not TF-IDF.

- Each article's title (weighted double) + summary is tokenized,
  lowercased, and stripped of stopwords plus a handful of news-specific
  filler words ("says", "report", "update") that would otherwise
  register as false overlap.
- The top 12 remaining words by frequency become the article's keyword
  fingerprint.
- A new article is compared against every existing cluster's
  fingerprint (the accumulated keywords of everything already in that
  cluster). If it shares **3 or more** words with a cluster, it joins
  that cluster; otherwise it starts a new one.
- A cluster's label is its three most common keywords, capitalized.

**Why 3 words:** tested against a real pipeline run — a threshold of 2
merged some clearly unrelated stories that happened to share generic
words like "government" and "week"; 3 kept clusters coherent without
being so strict that near-duplicate coverage of the same story (e.g.
different outlets' headlines on the same bill) ended up split apart.

**Known limitation:** this approach clusters on vocabulary, not
meaning, so it doesn't catch two articles about the same event if they
happen to use different words for it (e.g. "wildfire" vs "blaze"). It
also has no sense of *when* a topic should be considered over — a
cluster can keep absorbing loosely related articles indefinitely
rather than "closing" once a story is old news. A TF-IDF + similarity
threshold approach would handle synonymy better; a decay on cluster
matching (e.g. don't match against clusters whose last article is
weeks old) would help with the second problem.

## Deployment

| Component | Platform | Why |
|---|---|---|
| Backend + scraper | Render (Docker Web Service) | One container, shared disk - avoids two services needing the same file |
| Frontend | Netlify (static export) | No server-side rendering needed; ships as plain HTML/JS/CSS |
| Ingestion trigger | The app's own "Refresh data" button (`POST /ingest/trigger`) | Reuses the same endpoint built for the UI - no separate scheduler needed |

## Engineering notes: bugs found and fixed during deployment

Real issues caught through actual testing, not assumed away:

- **HTML leakage in clustering** - NPR's feed embeds raw `<img>` tags
  in the summary field; left unhandled, tag attributes ("img", "src")
  polluted cluster keywords. Fixed with an HTML-stripping
  normalization step in `feeds.py`.
- **CORS misconfiguration** - a wildcard-origin fallback silently broke
  when passed as an array instead of a string to the `cors` package.
- **Missing directory crash on deploy** - `node:sqlite` doesn't
  auto-create a missing parent directory the way the Python side does;
  fixed in `db.js`.
- **Indefinite hang under real network conditions** - `feedparser`'s
  network call has no timeout in this version, so an unresponsive feed
  could block the whole pipeline forever. Fixed by fetching feed bytes
  via `requests` (which does support a timeout) and only handing
  feedparser the already-downloaded content.
- **Silent dependency break** - a newer `lxml` release split
  `html.clean` into a separate package, breaking `trafilatura` on a
  fresh install. Fixed by pinning `lxml_html_clean` explicitly.
- **Job observability** - subprocess output was initially fully
  suppressed, making failures invisible in production logs. Changed to
  inherit stdout/stderr, plus added a watchdog timeout so a stuck job
  can't poll forever regardless of cause.

## Assumptions made

- Feeds with no publish date on an entry fall back to "now" rather
  than being dropped, since a missing timestamp shouldn't cost an
  otherwise usable article a place in the timeline.
- Cross-source story merging (recognizing the same real-world event
  across two outlets as one logical thing) was left as the stretch
  goal it's described as — the keyword approach already causes
  same-story articles from different outlets to usually land in the
  same cluster, which covers most of the practical benefit without
  the added complexity of dedicated entity/event matching.