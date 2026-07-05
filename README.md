# News Pulse

A small system that pulls live articles from three news RSS feeds, groups
related articles into topic clusters, and displays those clusters as a
timeline.

Built for the Xponentium full-stack internship assessment.

## Architecture

```
scraper/    Python - pulls RSS feeds, extracts full article text,
            clusters articles by topic, writes everything to SQLite
backend/    Node.js / Express - reads the same SQLite file, serves
            clusters/articles/timeline data, and can trigger the
            scraper on demand
frontend/   Next.js / React - the timeline UI
db/         Shared SQLite database file (created on first run)
```

The three services share one SQLite file (`db/news.db`) instead of
each other's APIs. The scraper is the only writer; the backend reads
from it and does small status writes for tracking ingest jobs.

## Why SQLite

Postgres/MongoDB were both fine per the brief, but a single file that
Python and Node can both open directly removes an entire layer of
plumbing (no connection strings, no separate hosted service to spin
up) for a dataset this size. It's a reasonable production choice too,
up to a point — just not one that scales to concurrent writers.

## Setup

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

## What runs where (suggested deployment)

| Component | Platform | Why |
|---|---|---|
| Frontend | Vercel | Native Next.js support, generous free tier |
| Backend | Render | Simple Node deploys, persistent disk for the SQLite file |
| Scraper | GitHub Actions cron (or Render scheduled job) | Doesn't need to run continuously — just needs to run and write to the same disk/volume the backend reads |
| Database | SQLite file on a Render persistent disk mounted to both backend and scraper | Avoids standing up a separate hosted DB for this scale |

The important constraint: the scraper and backend need to see the
**same** `db/news.db` file, so they should share a persistent volume
if deployed as separate services, or the scraper should run as a
scheduled job within the backend's own service/container.

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
