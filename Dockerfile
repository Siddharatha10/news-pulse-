# Bundles the scraper and backend into one image so they can share a
# single SQLite file on a mounted disk. The frontend deploys separately
# (Vercel) since it only talks to the backend over HTTP - it doesn't
# need filesystem access to the database.

FROM node:22-bookworm-slim

# Python is needed because the backend triggers scraper/pipeline.py as
# a subprocess when POST /ingest/trigger is called.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- Scraper ---
COPY scraper ./scraper
RUN pip install --break-system-packages --no-cache-dir -r scraper/requirements.txt

# --- Backend ---
COPY backend ./backend
WORKDIR /app/backend
RUN npm install --omit=dev

ENV DB_PATH=/app/db/news.db
ENV SCRAPER_DIR=/app/scraper
ENV PYTHON_BIN=python3
ENV PORT=4000

EXPOSE 4000
CMD ["node", "src/server.js"]