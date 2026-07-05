import { useMemo } from "react";

const MS_IN_DAY = 1000 * 60 * 60 * 24;

// Greedily packs clusters into lanes so two topics active at the same
// time land on separate rows instead of overlapping on top of each
// other. Clusters are assumed to already be sorted by start time.
function assignLanes(clusters) {
  const laneEnds = []; // last end time (ms) currently occupied in each lane
  const placed = [];

  for (const cluster of clusters) {
    const start = new Date(cluster.startsAt).getTime();
    const end = new Date(cluster.endsAt).getTime();

    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }

    placed.push({ ...cluster, lane, start, end });
  }

  return { placed, laneCount: laneEnds.length || 1 };
}

function formatTick(ms) {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function Timeline({ clusters, selectedClusterId, onSelect }) {
  const { placed, laneCount, domainStart, domainEnd } = useMemo(() => {
    if (clusters.length === 0) {
      return { placed: [], laneCount: 1, domainStart: 0, domainEnd: 1 };
    }

    const sorted = [...clusters].sort(
      (a, b) => new Date(a.startsAt) - new Date(b.startsAt)
    );

    const { placed, laneCount } = assignLanes(sorted);

    const allStarts = placed.map((c) => c.start);
    const allEnds = placed.map((c) => c.end);
    let domainStart = Math.min(...allStarts);
    let domainEnd = Math.max(...allEnds);

    // A cluster whose start === end would otherwise be a zero-width
    // bar, so pad the whole domain a bit on each side for breathing
    // room and to keep single-article clusters visible as dots.
    const pad = Math.max((domainEnd - domainStart) * 0.05, MS_IN_DAY * 0.25);
    domainStart -= pad;
    domainEnd += pad;

    return { placed, laneCount, domainStart, domainEnd };
  }, [clusters]);

  if (clusters.length === 0) {
    return (
      <div className="timeline timeline--empty">
        Nothing on the wire for these sources. Try turning another source back on.
      </div>
    );
  }

  const span = domainEnd - domainStart;
  const toPercent = (ms) => ((ms - domainStart) / span) * 100;

  const tickCount = 5;
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const ms = domainStart + (span * i) / (tickCount - 1);
    return { ms, left: toPercent(ms) };
  });

  const laneHeight = 56;

  return (
    <div className="timeline">
      <div className="timeline__axis">
        {ticks.map((tick) => (
          <span key={tick.ms} className="timeline__tick" style={{ left: `${tick.left}%` }}>
            {formatTick(tick.ms)}
          </span>
        ))}
      </div>

      <div
        className="timeline__track"
        style={{ height: laneCount * laneHeight + 8 }}
      >
        {ticks.map((tick) => (
          <div key={tick.ms} className="timeline__gridline" style={{ left: `${tick.left}%` }} />
        ))}

        {placed.map((cluster) => {
          const left = toPercent(cluster.start);
          const right = toPercent(cluster.end);
          const width = Math.max(right - left, 0.6);
          const isSelected = cluster.id === selectedClusterId;
          const isPoint = cluster.start === cluster.end;

          return (
            <button
              key={cluster.id}
              type="button"
              className={`timeline__bar ${isSelected ? "timeline__bar--selected" : ""} ${
                isPoint ? "timeline__bar--point" : ""
              }`}
              style={{
                left: `${left}%`,
                width: `${width}%`,
                top: cluster.lane * laneHeight + 4,
                opacity: 0.55 + cluster.intensity * 0.45,
              }}
              onClick={() => onSelect(cluster.id)}
              title={`${cluster.label} (${cluster.articleCount} article${cluster.articleCount === 1 ? "" : "s"})`}
            >
              <span className="timeline__bar-label">{cluster.label}</span>
              <span className="timeline__bar-count">{cluster.articleCount}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
