// Small wrapper around fetch so the rest of the app doesn't repeat
// base-URL handling and error checking everywhere.
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function request(path, options) {
  const res = await fetch(`${API_URL}${path}`, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request to ${path} failed (${res.status})`);
  }
  return res.json();
}

export function getTimeline() {
  return request("/timeline");
}

export function getClusters() {
  return request("/clusters");
}

export function getClusterDetail(id) {
  return request(`/clusters/${id}`);
}

export function triggerIngest() {
  return request("/ingest/trigger", { method: "POST" });
}

export function getIngestStatus(jobId) {
  return request(`/ingest/status/${jobId}`);
}
