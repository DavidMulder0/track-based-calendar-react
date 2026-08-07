import { TimelineEvent, Track } from '../types';
import { toEpochMs } from './temporal';

/**
 * Checks if targetTrackId is a child (or descendant) of parentTrackId.
 */
export function isChildTrack(
  targetTrackId: string,
  parentTrackId: string,
  tracks: Track[]
): boolean {
  if (targetTrackId === parentTrackId) return false;

  const trackMap = new Map<string, Track>();
  for (const t of tracks) {
    trackMap.set(t.id, t);
  }

  let curr = trackMap.get(targetTrackId);
  while (curr && curr.parentId) {
    if (curr.parentId === parentTrackId) {
      return true;
    }
    curr = trackMap.get(curr.parentId);
  }
  return false;
}

/**
 * Finds all events on child tracks that fully fall within the range of parentEvent.
 */
export function getEnclosedChildEvents(
  parentEvent: TimelineEvent,
  events: TimelineEvent[],
  tracks: Track[]
): TimelineEvent[] {
  const pStartMs = toEpochMs(parentEvent.start.dateTime);
  const pEndMs = toEpochMs(parentEvent.end.dateTime);

  const enclosed: TimelineEvent[] = [];

  for (const event of events) {
    if (event.id === parentEvent.id) continue;

    // Check if event is on a child track of parentEvent's track
    if (isChildTrack(event.trackId, parentEvent.trackId, tracks)) {
      const cStartMs = toEpochMs(event.start.dateTime);
      const cEndMs = toEpochMs(event.end.dateTime);

      // Fully falls within parent event temporal range
      if (cStartMs >= pStartMs && cEndMs <= pEndMs) {
        enclosed.push(event);
      }
    }
  }

  return enclosed;
}

export interface ChildTargetPosition {
  event: TimelineEvent;
  nextStartMs: number;
  nextEndMs: number;
}

/**
 * Computes updated positions for child events during a parent event move action.
 */
export function computeChildMovePositions(
  snappedDeltaMs: number,
  initialChildStates: Array<{
    event: TimelineEvent;
    initialStartMs: number;
    initialEndMs: number;
  }>
): ChildTargetPosition[] {
  return initialChildStates.map((item) => ({
    event: item.event,
    nextStartMs: item.initialStartMs + snappedDeltaMs,
    nextEndMs: item.initialEndMs + snappedDeltaMs,
  }));
}

/**
 * Computes updated positions for child events during a parent event resize action,
 * shifting/clamping child events so they stay strictly within new parent bounds.
 */
export function computeChildResizePositions(
  newParentStartMs: number,
  newParentEndMs: number,
  initialChildStates: Array<{
    event: TimelineEvent;
    initialStartMs: number;
    initialEndMs: number;
  }>
): ChildTargetPosition[] {
  return initialChildStates.map((item) => {
    const duration = item.initialEndMs - item.initialStartMs;
    let nextStart = item.initialStartMs;
    let nextEnd = item.initialEndMs;

    // If top of parent pushed down past child start
    if (nextStart < newParentStartMs) {
      nextStart = newParentStartMs;
      nextEnd = Math.min(newParentStartMs + duration, newParentEndMs);
    }

    // If bottom of parent pulled up above child end
    if (nextEnd > newParentEndMs) {
      nextEnd = newParentEndMs;
      nextStart = Math.max(newParentEndMs - duration, newParentStartMs);
    }

    // Double check bounds constraint
    if (nextStart < newParentStartMs) nextStart = newParentStartMs;
    if (nextEnd > newParentEndMs) nextEnd = newParentEndMs;

    return {
      event: item.event,
      nextStartMs: nextStart,
      nextEndMs: nextEnd,
    };
  });
}
