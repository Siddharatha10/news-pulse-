import { useCallback, useEffect, useMemo, useState } from "react";
import Timeline from "../components/Timeline";
import SourceFilter from "../components/SourceFilter";
import ClusterDetailPanel from "../components/ClusterDetailPanel";
import RefreshButton from "../components/RefreshButton";
import { getClusterDetail, getTimeline } from "../lib/api";

function useClock() {
  // Starts as null so the server render and the client's first render
  // match exactly (both show nothing). The actual time is only set
  // after mount, avoiding a hydration mismatch - the server and the
  // browser can disagree on locale-based date formatting (e.g. day/month
  // order), and React requires the very first client render to match
  // the server output byte-for-byte.
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function Home() {
  const [timeline, setTimeline] = useState([]);
  const [loadingTimeline, setLoadingTimeline] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [activeSources, setActiveSources] = useState(new Set());

  const [selectedClusterId, setSelectedClusterId] = useState(null);
  const [clusterDetail, setClusterDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const clock = useClock();

  const loadTimeline = useCallback(async () => {
    setLoadingTimeline(true);
    setLoadError(null);
    try {
      const data = await getTimeline();
      setTimeline(data);
      setActiveSources((prev) => {
        const allSources = new Set(data.flatMap((c) => c.sources));
        // First load: everything on. After that, keep whatever the
        // user already had toggled, but pick up brand new sources too.
        if (prev.size === 0) return allSources;
        const merged = new Set(prev);
        allSources.forEach((s) => merged.add(s));
        return merged;
      });
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoadingTimeline(false);
    }
  }, []);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  useEffect(() => {
    if (!selectedClusterId) {
      setClusterDetail(null);
      return;
    }
    setLoadingDetail(true);
    getClusterDetail(selectedClusterId)
      .then(setClusterDetail)
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoadingDetail(false));
  }, [selectedClusterId]);

  const allSources = useMemo(
    () => Array.from(new Set(timeline.flatMap((c) => c.sources))).sort(),
    [timeline]
  );

  const visibleClusters = useMemo(
    () => timeline.filter((c) => c.sources.some((s) => activeSources.has(s))),
    [timeline, activeSources]
  );

  const totalArticles = useMemo(
    () => visibleClusters.reduce((sum, c) => sum + c.articleCount, 0),
    [visibleClusters]
  );

  function toggleSource(source) {
    setActiveSources((prev) => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  }

  return (
    <div className="page">
      <header className="masthead">
        <div className="masthead__identity">
          <div className="masthead__eyebrow">
            <span className="masthead__live-dot" aria-hidden="true" />
            Topic wire &middot; live clustering
          </div>
          <h1>News Pulse</h1>
          <p className="masthead__subtitle">
            {loadingTimeline
              ? "Reading the wire..."
              : `${visibleClusters.length} storyline${visibleClusters.length === 1 ? "" : "s"} tracked from ${totalArticles} article${totalArticles === 1 ? "" : "s"}`}
          </p>
        </div>

        <div className="masthead__controls">
          {clock && (
            <div className="masthead__clock">
              {clock.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              <br />
              {clock.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>
          )}
          <RefreshButton onDone={loadTimeline} />
        </div>
      </header>

      <SourceFilter sources={allSources} activeSources={activeSources} onToggle={toggleSource} />

      {loadError && (
        <div className="banner banner--error">
          Couldn&apos;t reach the API. {loadError}
        </div>
      )}

      {loadingTimeline ? (
        <div className="loading-state">Reading the wire...</div>
      ) : (
        <div className="layout">
          <Timeline
            clusters={visibleClusters}
            selectedClusterId={selectedClusterId}
            onSelect={setSelectedClusterId}
          />
          <ClusterDetailPanel
            cluster={clusterDetail}
            loading={loadingDetail}
            activeSources={activeSources}
            onClose={() => setSelectedClusterId(null)}
          />
        </div>
      )}
    </div>
  );
}