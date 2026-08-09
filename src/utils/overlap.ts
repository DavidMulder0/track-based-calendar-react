import { TimelineEvent } from '../types';
import { toEpochMs } from './temporal';

export interface EventLayoutMeta {
  widthPct: number;
  leftPct: number;
  subColumnIndex: number;
  totalSubColumns: number;
}

export function computeTrackOverlapLayout(
  trackEvents: TimelineEvent[],
  activeTimezone?: string,
  originMs?: number,
  scaleFactor?: number,
  minHeightPx: number = 24
): Map<string, EventLayoutMeta> {
  const result = new Map<string, EventLayoutMeta>();

  if (trackEvents.length === 0) {
    return result;
  }

  // Map events to items with calculated epoch ms and duration (or visual pixel bounds if scaleFactor provided)
  const items = trackEvents.map((event) => {
    const startMs = toEpochMs(event.start, activeTimezone);
    const endMs = toEpochMs(event.end, activeTimezone);
    const duration = Math.max(endMs - startMs, 1);

    let startBound = startMs;
    let endBound = Math.max(endMs, startMs + 1);

    if (originMs !== undefined && scaleFactor !== undefined && scaleFactor > 0) {
      const topPx = (startMs - originMs) * scaleFactor;
      const rawHeightPx = (endMs - startMs) * scaleFactor;
      const heightPx = Math.max(rawHeightPx, minHeightPx);
      startBound = topPx;
      endBound = topPx + heightPx;
    }

    return {
      event,
      startMs: startBound,
      endMs: endBound,
      duration,
    };
  });

  // Sort chronologically by startMs ascending, then duration descending
  items.sort((a, b) => {
    if (a.startMs !== b.startMs) {
      return a.startMs - b.startMs;
    }
    return b.duration - a.duration;
  });

  // Partition items into overlapping clusters
  const clusters: Array<typeof items> = [];
  let currentCluster: typeof items = [];
  let clusterMaxEnd = -1;

  for (const item of items) {
    if (currentCluster.length === 0) {
      currentCluster.push(item);
      clusterMaxEnd = item.endMs;
    } else {
      if (item.startMs < clusterMaxEnd) {
        // Overlaps with the active cluster scope
        currentCluster.push(item);
        if (item.endMs > clusterMaxEnd) {
          clusterMaxEnd = item.endMs;
        }
      } else {
        // Start new cluster
        clusters.push(currentCluster);
        currentCluster = [item];
        clusterMaxEnd = item.endMs;
      }
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  // Assign sub-columns within each cluster
  for (const cluster of clusters) {
    const subColumnsEndMs: number[] = [];
    const eventAssignments: Array<{
      event: TimelineEvent;
      subColIndex: number;
    }> = [];

    for (const item of cluster) {
      let assignedCol = -1;

      for (let c = 0; c < subColumnsEndMs.length; c++) {
        if (subColumnsEndMs[c] <= item.startMs) {
          assignedCol = c;
          subColumnsEndMs[c] = item.endMs;
          break;
        }
      }

      if (assignedCol === -1) {
        assignedCol = subColumnsEndMs.length;
        subColumnsEndMs.push(item.endMs);
      }

      eventAssignments.push({
        event: item.event,
        subColIndex: assignedCol,
      });
    }

    const totalSubCols = subColumnsEndMs.length;

    for (const assign of eventAssignments) {
      const widthPct = 100 / totalSubCols;
      const leftPct = assign.subColIndex * widthPct;

      result.set(assign.event.id, {
        widthPct,
        leftPct,
        subColumnIndex: assign.subColIndex,
        totalSubColumns: totalSubCols,
      });
    }
  }

  return result;
}
