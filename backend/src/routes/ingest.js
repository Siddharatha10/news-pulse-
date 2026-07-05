const express = require("express");
const crypto = require("crypto");
const path = require("path");
const { spawn } = require("child_process");
const db = require("../db");

const router = express.Router();

const PYTHON_BIN = process.env.PYTHON_BIN || "python3";
const SCRAPER_DIR = path.resolve(__dirname, "..", "..", process.env.SCRAPER_DIR || "../scraper");

// A safety net independent of anything the Python side does: if a job
// hasn't finished within this window, something is wrong (hung feed,
// unexpected crash that skipped our own error handling, etc) and we'd
// rather report a clear failure than have the frontend poll forever.
const MAX_JOB_RUNTIME_MS = 5 * 60 * 1000;

// POST /ingest/trigger - kicks off the Python pipeline as a subprocess
// and returns immediately with a job ID the frontend can poll.
router.post("/ingest/trigger", (req, res) => {
  const jobId = crypto.randomUUID();

  db.prepare(
    "INSERT INTO ingest_jobs (id, status, started_at) VALUES (?, 'queued', datetime('now'))"
  ).run(jobId);

  const child = spawn(PYTHON_BIN, ["pipeline.py", "--job-id", jobId], {
    cwd: SCRAPER_DIR,
    detached: true,
    // Piping stdout/stderr into this process means the scraper's own
    // print() progress lines ("Fetching BBC News...", "Processing new
    // article...") show up in the platform's log viewer, which is the
    // only way to see what a deployed run is actually doing.
    stdio: ["ignore", "inherit", "inherit"],
  });

  // Let it run independently of this request/response cycle.
  child.unref();

  child.on("error", (err) => {
    // Covers the case where PYTHON_BIN doesn't exist at all - the
    // pipeline itself handles its own internal failures.
    db.prepare(
      "UPDATE ingest_jobs SET status = 'failed', message = ?, finished_at = datetime('now') WHERE id = ?"
    ).run(`Failed to start pipeline: ${err.message}`, jobId);
  });

  const watchdog = setTimeout(() => {
    const job = db.prepare("SELECT status FROM ingest_jobs WHERE id = ?").get(jobId);
    if (job && (job.status === "queued" || job.status === "running")) {
      db.prepare(
        "UPDATE ingest_jobs SET status = 'failed', message = ?, finished_at = datetime('now') WHERE id = ?"
      ).run("Timed out - the pipeline took too long and was marked as failed.", jobId);
      try {
        process.kill(-child.pid, "SIGKILL"); // negative pid: whole process group
      } catch {
        // already exited on its own - nothing to clean up
      }
    }
  }, MAX_JOB_RUNTIME_MS);
  watchdog.unref();

  res.status(202).json({ jobId, status: "queued" });
});

// GET /ingest/status/:jobId - lets the frontend poll until the job
// finishes (or fails).
router.get("/ingest/status/:jobId", (req, res) => {
  const job = db
    .prepare(
      "SELECT id, status, started_at, finished_at, message, new_articles FROM ingest_jobs WHERE id = ?"
    )
    .get(req.params.jobId);

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  res.json({
    jobId: job.id,
    status: job.status,
    startedAt: job.started_at,
    finishedAt: job.finished_at,
    message: job.message,
    newArticles: job.new_articles,
  });
});

module.exports = router;