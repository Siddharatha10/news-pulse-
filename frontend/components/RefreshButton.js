import { useEffect, useRef, useState } from "react";
import { getIngestStatus, triggerIngest } from "../lib/api";

const POLL_INTERVAL_MS = 2000;

export default function RefreshButton({ onDone }) {
  const [status, setStatus] = useState("idle"); // idle | running | done | failed
  const [message, setMessage] = useState("");
  const pollRef = useRef(null);

  useEffect(() => {
    return () => clearInterval(pollRef.current);
  }, []);

  async function handleClick() {
    if (status === "running") return;

    setStatus("running");
    setMessage("Starting ingestion job...");

    try {
      const { jobId } = await triggerIngest();
      pollRef.current = setInterval(() => pollJob(jobId), POLL_INTERVAL_MS);
    } catch (err) {
      setStatus("failed");
      setMessage(err.message);
    }
  }

  async function pollJob(jobId) {
    try {
      const job = await getIngestStatus(jobId);

      if (job.status === "running" || job.status === "queued") {
        setMessage("Pulling and clustering new articles...");
        return;
      }

      clearInterval(pollRef.current);

      if (job.status === "done") {
        setStatus("done");
        setMessage(job.message || "Feed is up to date.");
        onDone();
      } else {
        setStatus("failed");
        setMessage(job.message || "Couldn't refresh the feed.");
      }
    } catch (err) {
      clearInterval(pollRef.current);
      setStatus("failed");
      setMessage(err.message);
    }
  }

  return (
    <div className="refresh">
      <button
        type="button"
        className={`refresh__button refresh__button--${status}`}
        onClick={handleClick}
        disabled={status === "running"}
      >
        <span className="refresh__button-dot" aria-hidden="true" />
        {status === "running" ? "Refreshing" : "Refresh data"}
      </button>
      {message && <span className={`refresh__message refresh__message--${status}`}>{message}</span>}
    </div>
  );
}
