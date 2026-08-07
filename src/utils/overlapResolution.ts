import { TimelineEvent, Track } from '../types';
import { toEpochMs } from './temporal';
import { getEnclosedChildEvents } from './hierarchy';

export function findOverlappingEvents(
  movedEventId: string,
  nextStartMs: number,
  nextEndMs: number,
  targetTrackId: string,
  events: TimelineEvent[]
): TimelineEvent[] {
  return events.filter((e) => {
    if (e.id === movedEventId) return false;
    if (e.trackId !== targetTrackId) return false;

    const startMs = toEpochMs(e.start.dateTime);
    const endMs = toEpochMs(e.end.dateTime);

    return startMs < nextEndMs && endMs > nextStartMs;
  });
}

export interface ResolvedEventChange {
  event: TimelineEvent;
  nextStartMs: number;
  nextEndMs: number;
}

interface BoundsItem {
  event: TimelineEvent;
  initialStartMs: number;
  initialEndMs: number;
  startMs: number;
  endMs: number;
  trackId: string;
  isFixed: boolean;
}

/**
 * Resolves overlaps by pushing overlapping events away in the direction of movement/resize (upwards or downwards),
 * with cascading multi-track parent-child propagation.
 */
export function resolvePushEvents(
  movedEventId: string,
  nextStartMs: number,
  nextEndMs: number,
  targetTrackId: string,
  events: TimelineEvent[],
  tracks: Track[]
): ResolvedEventChange[] {
  const targetEvent = events.find((e) => e.id === movedEventId);
  if (!targetEvent) return [];

  const initialStartMs = toEpochMs(targetEvent.start.dateTime);
  const initialEndMs = toEpochMs(targetEvent.end.dateTime);

  // Direction: upward if top boundary moved earlier or end boundary moved earlier
  const isUpward =
    nextStartMs < initialStartMs ||
    (nextStartMs === initialStartMs && nextEndMs < initialEndMs);

  const moveDeltaMs = nextStartMs - initialStartMs;

  // Track state map of all event bounds
  const boundsMap = new Map<string, BoundsItem>();

  for (const e of events) {
    const s = toEpochMs(e.start.dateTime);
    const end = toEpochMs(e.end.dateTime);
    boundsMap.set(e.id, {
      event: e,
      initialStartMs: s,
      initialEndMs: end,
      startMs: s,
      endMs: end,
      trackId: e.trackId,
      isFixed: false,
    });
  }

  // Update moved/resized event
  const movedItem = boundsMap.get(movedEventId)!;
  movedItem.startMs = nextStartMs;
  movedItem.endMs = nextEndMs;
  movedItem.trackId = targetTrackId;
  movedItem.isFixed = true;

  // Move enclosed child events of targetEvent if it moved
  if (moveDeltaMs !== 0) {
    const directChildren = getEnclosedChildEvents(targetEvent, events, tracks);
    for (const child of directChildren) {
      const childItem = boundsMap.get(child.id);
      if (childItem) {
        childItem.startMs = childItem.initialStartMs + moveDeltaMs;
        childItem.endMs = childItem.initialEndMs + moveDeltaMs;
        childItem.isFixed = true;
      }
    }
  }

  // Pre-calculate parent-child relationships for cascading
  const childMap = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    const enclosed = getEnclosedChildEvents(e, events, tracks);
    if (enclosed.length > 0) {
      childMap.set(e.id, enclosed);
    }
  }

  // Iterative multi-track cascade push solver
  let changed = true;
  let loopCount = 0;

  while (changed && loopCount < 50) {
    changed = false;
    loopCount++;

    for (const track of tracks) {
      const trackItems = Array.from(boundsMap.values()).filter(
        (b) => b.trackId === track.id
      );

      // Sort items based on push direction
      if (isUpward) {
        // Pushing upwards (earlier): process latest endMs first
        trackItems.sort((a, b) => b.endMs - a.endMs);
      } else {
        // Pushing downwards (later): process earliest startMs first
        trackItems.sort((a, b) => a.startMs - b.startMs);
      }

      for (let i = 0; i < trackItems.length; i++) {
        for (let j = i + 1; j < trackItems.length; j++) {
          const itemA = trackItems[i]; // earlier/fixed item in sort order
          const itemB = trackItems[j]; // item to be pushed if overlapping

          // Check overlap between A and B
          if (itemA.startMs < itemB.endMs && itemA.endMs > itemB.startMs) {
            const durationB = itemB.initialEndMs - itemB.initialStartMs;

            if (isUpward) {
              // Push B UPWARDS so B.endMs = A.startMs
              const newEndB = itemA.startMs;
              const newStartB = newEndB - durationB;

              if (itemB.startMs !== newStartB || itemB.endMs !== newEndB) {
                itemB.startMs = newStartB;
                itemB.endMs = newEndB;
                itemB.isFixed = true;
                changed = true;

                // Cascade push to B's child events on child tracks
                const bChildren = childMap.get(itemB.event.id) || [];
                const bDeltaMs = newStartB - itemB.initialStartMs;
                for (const c of bChildren) {
                  const cItem = boundsMap.get(c.id);
                  if (cItem) {
                    cItem.startMs = cItem.initialStartMs + bDeltaMs;
                    cItem.endMs = cItem.initialEndMs + bDeltaMs;
                    cItem.isFixed = true;
                  }
                }
              }
            } else {
              // Push B DOWNWARDS so B.startMs = A.endMs
              const newStartB = itemA.endMs;
              const newEndB = newStartB + durationB;

              if (itemB.startMs !== newStartB || itemB.endMs !== newEndB) {
                itemB.startMs = newStartB;
                itemB.endMs = newEndB;
                itemB.isFixed = true;
                changed = true;

                // Cascade push to B's child events on child tracks
                const bChildren = childMap.get(itemB.event.id) || [];
                const bDeltaMs = newStartB - itemB.initialStartMs;
                for (const c of bChildren) {
                  const cItem = boundsMap.get(c.id);
                  if (cItem) {
                    cItem.startMs = cItem.initialStartMs + bDeltaMs;
                    cItem.endMs = cItem.initialEndMs + bDeltaMs;
                    cItem.isFixed = true;
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // Collect all modified events except movedEventId itself
  const result: ResolvedEventChange[] = [];
  for (const [id, item] of boundsMap.entries()) {
    if (id === movedEventId) continue;
    if (
      item.startMs !== item.initialStartMs ||
      item.endMs !== item.initialEndMs ||
      item.trackId !== item.event.trackId
    ) {
      result.push({
        event: item.event,
        nextStartMs: item.startMs,
        nextEndMs: item.endMs,
      });
    }
  }

  return result;
}

/**
 * Resolves overlaps by shortening/truncating the overlapping events.
 */
export function resolveShortenEvents(
  movedEventId: string,
  nextStartMs: number,
  nextEndMs: number,
  targetTrackId: string,
  events: TimelineEvent[]
): ResolvedEventChange[] {
  const result: ResolvedEventChange[] = [];
  const overlaps = findOverlappingEvents(
    movedEventId,
    nextStartMs,
    nextEndMs,
    targetTrackId,
    events
  );

  for (const event of overlaps) {
    const origStart = toEpochMs(event.start.dateTime);
    const origEnd = toEpochMs(event.end.dateTime);
    let newStart = origStart;
    let newEnd = origEnd;

    if (origStart < nextStartMs && origEnd > nextStartMs && origEnd <= nextEndMs) {
      // Overlaps the start of moved event -> shorten end to nextStartMs
      newEnd = nextStartMs;
    } else if (origStart >= nextStartMs && origStart < nextEndMs && origEnd > nextEndMs) {
      // Overlaps the end of moved event -> shorten start to nextEndMs
      newStart = nextEndMs;
    } else if (origStart >= nextStartMs && origEnd <= nextEndMs) {
      // Completely covered by moved event -> move to start right after moved event with min 15min duration
      newStart = nextEndMs;
      newEnd = nextEndMs + 15 * 60_000;
    } else if (origStart < nextStartMs && origEnd > nextEndMs) {
      // Moved event is completely inside origEvent -> shorten origEvent end to nextStartMs
      newEnd = nextStartMs;
    }

    if (newStart !== origStart || newEnd !== origEnd) {
      result.push({
        event,
        nextStartMs: newStart,
        nextEndMs: newEnd,
      });
    }
  }

  return result;
}
