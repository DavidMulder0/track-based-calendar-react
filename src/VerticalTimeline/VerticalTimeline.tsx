import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import {
  VerticalTimelineProps,
  TimelineEvent,
  DragEventPayload,
} from '../types';
import {
  toEpochMs,
  calculateSlotDurationMs,
  calculateSlotHeightPx,
  calculateScaleFactor,
  getPrecedingTimezone,
  formatDateLabelParts,
  formatTimeOnlyLabel,
  formatSlotLabel,
  isWeekendDay,
  getSystemTimezone,
  getMidnightEpochInTimezone,
  formatISOInTimezone,
  MS_PER_DAY,
} from '../utils/temporal';
import { computeTrackOverlapLayout } from '../utils/overlap';
import {
  getEnclosedChildEvents,
  computeChildMovePositions,
  computeChildResizePositions,
} from '../utils/hierarchy';
import {
  findOverlappingEvents,
  resolvePushEvents,
  resolveShortenEvents,
} from '../utils/overlapResolution';
import './VerticalTimeline.css';
import { OverlapConflictDialog, OverlapStrategy } from './OverlapConflictDialog';

type DragAction = 'move' | 'resize-top' | 'resize-bottom';

interface ChildInitialState {
  event: TimelineEvent;
  initialStartMs: number;
  initialEndMs: number;
}

interface DragState {
  pointerId: number;
  eventId: string;
  action: DragAction;
  initialPointerY: number;
  initialStartMs: number;
  initialEndMs: number;
  initialTrackId: string;
  currentTrackId: string;
  currentDeltaY: number;
  initialChildStates: ChildInitialState[];
}

interface PendingOverlapMove {
  movedEvent: TimelineEvent;
  nextStartMs: number;
  nextEndMs: number;
  nextTrackId: string;
  overlappingEvents: TimelineEvent[];
  childPayloads: DragEventPayload[];
}

export function VerticalTimeline({
  startDate,
  endDate,
  tracks,
  events,
  resolution = 1,
  dayHeight = 240,
  snapToMinutesOverride,
  touchInteractionMode = 'tap-select',
  timezone,
  defaultTimezone,
  renderEvent,
  renderTrackHeader,
  renderTimeSlotLabel,
  onEventUpdate,
  onEventsUpdate,
  onEventClick,
  onEventContextMenu,
  onEventCreate,
  onSlotDoubleClick,
  className = '',
}: VerticalTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const wasDraggingRef = useRef<boolean>(false);
  const lastPointerTypeRef = useRef<string>('mouse');

  const activeTimezone = useMemo(
    () => timezone || defaultTimezone || getSystemTimezone(),
    [timezone, defaultTimezone]
  );

  const [dragState, setDragState] = useState<DragState | null>(null);

  interface CreateDragState {
    pointerId: number;
    trackId: string;
    anchorStartMs: number;
    initialPointerX: number;
    initialPointerY: number;
    currentPointerY: number;
    initialOffsetY: number;
    activated: boolean;
  }

  const [createDragState, setCreateDragState] = useState<CreateDragState | null>(null);

  // Overlap Conflict State
  const [pendingOverlap, setPendingOverlap] = useState<PendingOverlapMove | null>(null);

  // Epoch metrics
  const originMs = useMemo(
    () => getMidnightEpochInTimezone(startDate, activeTimezone),
    [startDate, activeTimezone]
  );
  const endScopeMs = useMemo(
    () => getMidnightEpochInTimezone(endDate, activeTimezone),
    [endDate, activeTimezone]
  );
  const totalDurationMs = useMemo(
    () => Math.max(endScopeMs - originMs, MS_PER_DAY),
    [endScopeMs, originMs]
  );
  const totalDays = useMemo(
    () => Math.ceil(totalDurationMs / MS_PER_DAY),
    [totalDurationMs]
  );

  // Live "Now" Time Indicator
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const isNowInRange = useMemo(() => {
    return nowMs >= originMs && nowMs <= endScopeMs;
  }, [nowMs, originMs, endScopeMs]);

  const P = useMemo(() => calculateScaleFactor(dayHeight), [dayHeight]);

  const nowTopPx = useMemo(() => {
    if (!isNowInRange) return 0;
    return (nowMs - originMs) * P;
  }, [isNowInRange, nowMs, originMs, P]);
  const totalHeightPx = useMemo(
    () => totalDays * dayHeight,
    [totalDays, dayHeight]
  );

  const slotDurationMs = useMemo(
    () => calculateSlotDurationMs(resolution),
    [resolution]
  );
  const slotHeightPx = useMemo(
    () => calculateSlotHeightPx(dayHeight, resolution),
    [dayHeight, resolution]
  );
  const isCompactRow = slotHeightPx <= 30;
  const isSingleSlotPerDay = resolution === 1;

  const activeSnapMs = useMemo(() => {
    if (snapToMinutesOverride && snapToMinutesOverride > 0) {
      return snapToMinutesOverride * 60_000;
    }
    return slotDurationMs;
  }, [snapToMinutesOverride, slotDurationMs]);

  // Generate day blocks for vertically merged date column
  const dayBlocks = useMemo(() => {
    const blocks: Array<{ dayIndex: number; time: Date; topPx: number; heightPx: number }> = [];
    for (let d = 0; d < totalDays; d++) {
      const ms = originMs + d * MS_PER_DAY;
      blocks.push({
        dayIndex: d,
        time: new Date(ms),
        topPx: d * dayHeight,
        heightPx: dayHeight,
      });
    }
    return blocks;
  }, [originMs, totalDays, dayHeight]);

  // Generate slots for time axis column
  const timeSlots = useMemo(() => {
    const slots: Array<{ time: Date; topPx: number; ms: number }> = [];
    const totalSlots = totalDays * resolution;
    for (let i = 0; i < totalSlots; i++) {
      const ms = originMs + i * slotDurationMs;
      slots.push({
        time: new Date(ms),
        topPx: i * slotHeightPx,
        ms,
      });
    }
    return slots;
  }, [originMs, totalDays, resolution, slotDurationMs, slotHeightPx]);

  // Pre-calculate track overlap layouts
  const trackOverlapLayouts = useMemo(() => {
    const layouts = new Map<
      string,
      ReturnType<typeof computeTrackOverlapLayout>
    >();
    for (const track of tracks) {
      const trackEvents = events.filter((e) => e.trackId === track.id);
      layouts.set(
        track.id,
        computeTrackOverlapLayout(trackEvents, activeTimezone, originMs, P, 24)
      );
    }
    return layouts;
  }, [tracks, events, activeTimezone, originMs, P]);

  // Handle Drag Pointer Events
  const handlePointerDown = (
    e: React.PointerEvent,
    event: TimelineEvent,
    action: DragAction
  ) => {
    e.stopPropagation();
    if (!e.isPrimary || e.button !== 0) return;
    lastPointerTypeRef.current = e.pointerType;
    wasDraggingRef.current = false;
    if (e.pointerType === 'touch' && touchInteractionMode !== 'drag-edit') {
      return;
    }
    if (action === 'move' && event.isDraggable === false) return;
    if (
      (action === 'resize-top' || action === 'resize-bottom') &&
      event.isResizable === false
    )
      return;

    const startMs = toEpochMs(event.start, activeTimezone);
    const endMs = toEpochMs(event.end, activeTimezone);

    // Capture child event initial positions if this event is a parent track event
    const childEvents = getEnclosedChildEvents(event, events, tracks);
    const initialChildStates: ChildInitialState[] = childEvents.map((child) => ({
      event: child,
      initialStartMs: toEpochMs(child.start, activeTimezone),
      initialEndMs: toEpochMs(child.end, activeTimezone),
    }));

    setDragState({
      pointerId: e.pointerId,
      eventId: event.id,
      action,
      initialPointerY: e.clientY,
      initialStartMs: startMs,
      initialEndMs: endMs,
      initialTrackId: event.trackId,
      currentTrackId: event.trackId,
      currentDeltaY: 0,
      initialChildStates,
    });

    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleTrackPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    trackId: string
  ) => {
    if (!e.isPrimary || e.button !== 0) return;
    lastPointerTypeRef.current = e.pointerType;
    wasDraggingRef.current = false;
    if (e.pointerType === 'touch' && touchInteractionMode !== 'drag-edit') {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const rawMs = originMs + offsetY / P;

    const anchorSlotIndex = Math.floor((rawMs - originMs) / activeSnapMs);
    const anchorStartMs = originMs + anchorSlotIndex * activeSnapMs;

    setCreateDragState({
      pointerId: e.pointerId,
      trackId,
      anchorStartMs,
      initialPointerX: e.clientX,
      initialPointerY: e.clientY,
      currentPointerY: e.clientY,
      initialOffsetY: offsetY,
      activated: false,
    });

    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      // ignore if pointer capture fails
    }
  };

  // Refs for tracking active drag states and callbacks inside window listeners without stale closures
  const dragStateRef = useRef<DragState | null>(null);
  dragStateRef.current = dragState;

  const createDragStateRef = useRef<CreateDragState | null>(null);
  createDragStateRef.current = createDragState;

  const eventsRef = useRef(events);
  eventsRef.current = events;

  const onEventCreateRef = useRef(onEventCreate);
  onEventCreateRef.current = onEventCreate;

  const activeTimezoneRef = useRef(activeTimezone);
  activeTimezoneRef.current = activeTimezone;

  const emitPayloads = useCallback(
    (payloads: DragEventPayload[]) => {
      if (payloads.length === 0) return;
      if (onEventsUpdate) {
        onEventsUpdate(payloads);
      } else if (onEventUpdate) {
        for (const payload of payloads) {
          onEventUpdate(payload);
        }
      }
    },
    [onEventsUpdate, onEventUpdate]
  );

  const emitPayloadsRef = useRef(emitPayloads);
  emitPayloadsRef.current = emitPayloads;

  // Window-level Pointer Event Listeners for robust drag move & completion on mouseup/pointerup anywhere
  useEffect(() => {
    if (!dragState && !createDragState) return;

    const handleWindowPointerMove = (e: PointerEvent) => {
      if (createDragStateRef.current) {
        const pendingCreate = createDragStateRef.current;
        if (e.pointerId !== pendingCreate.pointerId) return;
        const deltaX = e.clientX - pendingCreate.initialPointerX;
        const deltaY = e.clientY - pendingCreate.initialPointerY;
        const activated =
          pendingCreate.activated || Math.hypot(deltaX, deltaY) > 4;
        const nextCreateState = {
          ...pendingCreate,
          currentPointerY: e.clientY,
          activated,
        };
        createDragStateRef.current = nextCreateState;
        setCreateDragState(nextCreateState);
        if (activated) wasDraggingRef.current = true;
        return;
      }

      const ds = dragStateRef.current;
      if (!ds) return;
      if (e.pointerId !== ds.pointerId) return;

      const deltaY = e.clientY - ds.initialPointerY;

      // Determine current track hover if moving
      let targetTrackId = ds.currentTrackId;
      if (ds.action === 'move') {
        const clientX = e.clientX;
        for (const [tId, el] of trackRefs.current.entries()) {
          const rect = el.getBoundingClientRect();
          if (clientX >= rect.left && clientX <= rect.right) {
            targetTrackId = tId;
            break;
          }
        }
      }

      if (Math.abs(deltaY) > 3 || targetTrackId !== ds.initialTrackId) {
        wasDraggingRef.current = true;
      }

      const nextDragState = {
        ...ds,
        currentDeltaY: deltaY,
        currentTrackId: targetTrackId,
      };
      dragStateRef.current = nextDragState;
      setDragState(nextDragState);
    };

    const handleWindowPointerUp = (e: PointerEvent) => {
      // 1. Handle Drag-to-Create completion
      if (createDragStateRef.current) {
        const cds = createDragStateRef.current;
        if (e.pointerId !== cds.pointerId) return;
        if (!cds.activated) {
          setCreateDragState(null);
          return;
        }
        const deltaY = cds.currentPointerY - cds.initialPointerY;
        const currentOffsetY = cds.initialOffsetY + deltaY;
        const currentRawMs = originMs + currentOffsetY / P;

        const currentSlotIndex = Math.floor(
          (currentRawMs - originMs) / activeSnapMs
        );
        const currentMs = originMs + currentSlotIndex * activeSnapMs;

        let startMs: number;
        let endMs: number;

        if (currentMs >= cds.anchorStartMs) {
          startMs = cds.anchorStartMs;
          endMs = currentMs + activeSnapMs;
        } else {
          startMs = currentMs;
          endMs = cds.anchorStartMs + activeSnapMs;
        }

        const startDateObj = new Date(startMs);
        const endDateObj = new Date(endMs);

        const newEvent: TimelineEvent = {
          id:
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `event-${Date.now()}`,
          trackId: cds.trackId,
          title: 'New Event',
          description: '',
          start: {
            dateTime: formatISOInTimezone(startMs, activeTimezoneRef.current),
            timezone: activeTimezoneRef.current,
          },
          end: {
            dateTime: formatISOInTimezone(endMs, activeTimezoneRef.current),
            timezone: activeTimezoneRef.current,
          },
        };

        onEventCreateRef.current?.(newEvent);

        setCreateDragState(null);
        return;
      }

      // 2. Handle Event Move / Resize completion
      const ds = dragStateRef.current;
      if (!ds) return;
      if (e.pointerId !== ds.pointerId) return;

      const rawDeltaMs = ds.currentDeltaY / P;
      const snappedDeltaMs =
        Math.round(rawDeltaMs / activeSnapMs) * activeSnapMs;

      let nextStartMs = ds.initialStartMs;
      let nextEndMs = ds.initialEndMs;

      if (ds.action === 'move') {
        nextStartMs = ds.initialStartMs + snappedDeltaMs;
        nextEndMs = ds.initialEndMs + snappedDeltaMs;
      } else if (ds.action === 'resize-top') {
        nextStartMs = Math.min(
          ds.initialStartMs + snappedDeltaMs,
          ds.initialEndMs - activeSnapMs
        );
      } else if (ds.action === 'resize-bottom') {
        nextEndMs = Math.max(
          ds.initialEndMs + snappedDeltaMs,
          ds.initialStartMs + activeSnapMs
        );
      }

      const targetEvent = eventsRef.current.find((ev) => ev.id === ds.eventId);

      if (targetEvent) {
        // Collect child payloads if parent moved/resized
        const childPayloads: DragEventPayload[] = [];
        if (ds.initialChildStates.length > 0) {
          const childPositions =
            ds.action === 'move'
              ? computeChildMovePositions(
                  snappedDeltaMs,
                  ds.initialChildStates
                )
              : computeChildResizePositions(
                  nextStartMs,
                  nextEndMs,
                  ds.initialChildStates
                );

          for (const pos of childPositions) {
            const childTzStart = pos.event.start.timezone || activeTimezoneRef.current;
            const childTzEnd = pos.event.end.timezone || activeTimezoneRef.current;
            childPayloads.push({
              event: pos.event,
              nextStart: {
                dateTime: formatISOInTimezone(pos.nextStartMs, childTzStart),
                timezone: childTzStart,
              },
              nextEnd: {
                dateTime: formatISOInTimezone(pos.nextEndMs, childTzEnd),
                timezone: childTzEnd,
              },
              nextTrackId: pos.event.trackId,
            });
          }
        }

        const isMovedOrResized =
          snappedDeltaMs !== 0 ||
          ds.currentTrackId !== ds.initialTrackId;

        // If action is MOVE or RESIZE and created an overlap on target track -> prompt user
        if (isMovedOrResized) {
          const overlaps = findOverlappingEvents(
            targetEvent.id,
            nextStartMs,
            nextEndMs,
            ds.currentTrackId,
            eventsRef.current,
            activeTimezoneRef.current
          );

          if (overlaps.length > 0) {
            setPendingOverlap({
              movedEvent: targetEvent,
              nextStartMs,
              nextEndMs,
              nextTrackId: ds.currentTrackId,
              overlappingEvents: overlaps,
              childPayloads,
            });
            setDragState(null);
            return;
          }
        }

        // If no overlap conflict, emit payloads directly
        if (isMovedOrResized) {
          const tzStart = targetEvent.start.timezone || activeTimezoneRef.current;
          const tzEnd = targetEvent.end.timezone || activeTimezoneRef.current;
          const parentPayload: DragEventPayload = {
            event: targetEvent,
            nextStart: {
              dateTime: formatISOInTimezone(nextStartMs, tzStart),
              timezone: tzStart,
            },
            nextEnd: {
              dateTime: formatISOInTimezone(nextEndMs, tzEnd),
              timezone: tzEnd,
            },
            nextTrackId: ds.currentTrackId,
          };

          emitPayloadsRef.current([parentPayload, ...childPayloads]);
        }
      }

      setDragState(null);
    };

    const handleWindowPointerCancel = (e: PointerEvent) => {
      // A browser commonly cancels touch pointers when it takes over scrolling.
      // Cancellation must never commit a create, move, or resize operation.
      const activePointerId =
        dragStateRef.current?.pointerId ?? createDragStateRef.current?.pointerId;
      if (activePointerId !== e.pointerId) return;
      if (dragStateRef.current || createDragStateRef.current) {
        wasDraggingRef.current = true;
      }
      setDragState(null);
      setCreateDragState(null);
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerCancel);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerCancel);
    };
  }, [
    dragState,
    createDragState,
    P,
    activeSnapMs,
    defaultTimezone,
    originMs,
  ]);

  // Handle choice in Overlap Conflict Dialog
  const handleSelectOverlapStrategy = (strategy: OverlapStrategy) => {
    if (!pendingOverlap) return;

    const { movedEvent, nextStartMs, nextEndMs, nextTrackId, childPayloads } =
      pendingOverlap;

    const tzStart = movedEvent.start.timezone || activeTimezoneRef.current;
    const tzEnd = movedEvent.end.timezone || activeTimezoneRef.current;
    const movedPayload: DragEventPayload = {
      event: movedEvent,
      nextStart: {
        dateTime: formatISOInTimezone(nextStartMs, tzStart),
        timezone: tzStart,
      },
      nextEnd: {
        dateTime: formatISOInTimezone(nextEndMs, tzEnd),
        timezone: tzEnd,
      },
      nextTrackId,
    };

    const finalPayloads: DragEventPayload[] = [movedPayload, ...childPayloads];

    if (strategy === 'push') {
      const pushedChanges = resolvePushEvents(
        movedEvent.id,
        nextStartMs,
        nextEndMs,
        nextTrackId,
        events,
        tracks,
        activeTimezone
      );
      for (const change of pushedChanges) {
        const pTzStart = change.event.start.timezone || activeTimezoneRef.current;
        const pTzEnd = change.event.end.timezone || activeTimezoneRef.current;
        finalPayloads.push({
          event: change.event,
          nextStart: {
            dateTime: formatISOInTimezone(change.nextStartMs, pTzStart),
            timezone: pTzStart,
          },
          nextEnd: {
            dateTime: formatISOInTimezone(change.nextEndMs, pTzEnd),
            timezone: pTzEnd,
          },
          nextTrackId: change.event.trackId,
        });
      }
    } else if (strategy === 'shorten') {
      const shortenedChanges = resolveShortenEvents(
        movedEvent.id,
        nextStartMs,
        nextEndMs,
        nextTrackId,
        events,
        activeTimezone
      );
      for (const change of shortenedChanges) {
        const sTzStart = change.event.start.timezone || activeTimezoneRef.current;
        const sTzEnd = change.event.end.timezone || activeTimezoneRef.current;
        finalPayloads.push({
          event: change.event,
          nextStart: {
            dateTime: formatISOInTimezone(change.nextStartMs, sTzStart),
            timezone: sTzStart,
          },
          nextEnd: {
            dateTime: formatISOInTimezone(change.nextEndMs, sTzEnd),
            timezone: sTzEnd,
          },
          nextTrackId: change.event.trackId,
        });
      }
    }

    emitPayloads(finalPayloads);
    setPendingOverlap(null);
  };

  // Calculate dynamic drag previews for parent & child events
  const dragPreviews = useMemo(() => {
    if (!dragState) return null;

    const rawDeltaMs = dragState.currentDeltaY / P;
    const snappedDeltaMs =
      Math.round(rawDeltaMs / activeSnapMs) * activeSnapMs;

    let parentStartMs = dragState.initialStartMs;
    let parentEndMs = dragState.initialEndMs;

    if (dragState.action === 'move') {
      parentStartMs = dragState.initialStartMs + snappedDeltaMs;
      parentEndMs = dragState.initialEndMs + snappedDeltaMs;
    } else if (dragState.action === 'resize-top') {
      parentStartMs = Math.min(
        dragState.initialStartMs + snappedDeltaMs,
        dragState.initialEndMs - activeSnapMs
      );
    } else if (dragState.action === 'resize-bottom') {
      parentEndMs = Math.max(
        dragState.initialEndMs + snappedDeltaMs,
        dragState.initialStartMs + activeSnapMs
      );
    }

    const previewMap = new Map<
      string,
      { startMs: number; endMs: number; trackId?: string }
    >();
    previewMap.set(dragState.eventId, {
      startMs: parentStartMs,
      endMs: parentEndMs,
      trackId: dragState.currentTrackId,
    });

    if (dragState.initialChildStates.length > 0) {
      const childPositions =
        dragState.action === 'move'
          ? computeChildMovePositions(
              snappedDeltaMs,
              dragState.initialChildStates
            )
          : computeChildResizePositions(
              parentStartMs,
              parentEndMs,
              dragState.initialChildStates
            );

      for (const pos of childPositions) {
        previewMap.set(pos.event.id, {
          startMs: pos.nextStartMs,
          endMs: pos.nextEndMs,
        });
      }
    }

    return previewMap;
  }, [dragState, P, activeSnapMs]);

  // Compute Creation Drag Ghost Event Preview
  const createPreview = useMemo(() => {
    if (!createDragState?.activated) return null;

    const deltaY =
      createDragState.currentPointerY - createDragState.initialPointerY;
    const currentOffsetY = createDragState.initialOffsetY + deltaY;
    const currentRawMs = originMs + currentOffsetY / P;

    const currentSlotIndex = Math.floor(
      (currentRawMs - originMs) / activeSnapMs
    );
    const currentMs = originMs + currentSlotIndex * activeSnapMs;

    let startMs: number;
    let endMs: number;

    if (currentMs >= createDragState.anchorStartMs) {
      startMs = createDragState.anchorStartMs;
      endMs = currentMs + activeSnapMs;
    } else {
      startMs = currentMs;
      endMs = createDragState.anchorStartMs + activeSnapMs;
    }

    const topPx = (startMs - originMs) * P;
    const heightPx = Math.max((endMs - startMs) * P, 20);

    const startDateObj = new Date(startMs);
    const startLabel = formatTimeOnlyLabel(startDateObj, activeTimezone);
    const endLabel = formatTimeOnlyLabel(new Date(endMs), activeTimezone);

    return {
      trackId: createDragState.trackId,
      topPx,
      heightPx,
      startLabel,
      endLabel,
    };
  }, [createDragState, originMs, P, activeSnapMs, activeTimezone]);

  // Handle Track Double-click to create or slot double click
  const handleTrackDoubleClick = (
    e: React.MouseEvent<HTMLDivElement>,
    trackId: string
  ) => {
    if (
      lastPointerTypeRef.current === 'touch' &&
      touchInteractionMode !== 'drag-edit'
    ) {
      return;
    }
    if (!onSlotDoubleClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const clickedTimeMs = originMs + offsetY / P;

    // Snap to nearest slot
    const slotIndex = Math.floor((clickedTimeMs - originMs) / slotDurationMs);
    const snappedTimeMs = originMs + slotIndex * slotDurationMs;
    const timestamp = new Date(snappedTimeMs);

    onSlotDoubleClick(trackId, timestamp, activeTimezone);
  };

  const handleEventClickInternal = (event: TimelineEvent) => {
    // If the click was preceded by dragging or resizing, do not emit a click.
    if (wasDraggingRef.current) {
      wasDraggingRef.current = false;
      return;
    }

    if (
      lastPointerTypeRef.current === 'touch' &&
      touchInteractionMode === 'scroll-only'
    ) {
      return;
    }

    onEventClick?.(event);
  };

  return (
    <div
      ref={containerRef}
      className={`vertical-timeline ${
        touchInteractionMode === 'drag-edit' ? 'is-touch-edit-enabled' : ''
      } ${className}`}
    >
      {/* Header and timeline share one scroll viewport so their columns stay aligned. */}
      <div className="vt-body-scroll">
        <div className="vt-scroll-content">
          <div className="vt-header">
            <div
              className={`vt-header-time-axis ${
                isCompactRow ? 'is-compact-row' : ''
              } ${isSingleSlotPerDay ? 'is-single-slot' : ''}`}
            >
              <div className="vt-header-day-subcol">Date</div>
              {!isSingleSlotPerDay && (
                <div className="vt-header-time-subcol">Time</div>
              )}
            </div>
            <div className="vt-header-tracks">
              {tracks.map((track) => (
                <div
                  key={track.id}
                  className="vt-track-header"
                  style={{
                    paddingLeft: track.parentId ? 24 : 16,
                  }}
                >
                  {renderTrackHeader ? (
                    renderTrackHeader(track)
                  ) : (
                    <>
                      <div className="vt-track-title">
                        {track.parentId && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color: 'var(--vt-color-accent)',
                              marginRight: 6,
                            }}
                          >
                            ↳
                          </span>
                        )}
                        {track.label}
                      </div>
                      {track.subtitle && (
                        <div className="vt-track-subtitle">
                          {track.subtitle}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Main Body */}
          <div className="vt-timeline-body">
            {/* Sticky Split Time Axis Column */}
        <div
          className={`vt-time-axis-column ${isCompactRow ? 'is-compact-row' : ''} ${
            isSingleSlotPerDay ? 'is-single-slot' : ''
          }`}
          style={{ height: totalHeightPx }}
        >
          {/* Vertically Merged Date Sub-Column */}
          <div className="vt-day-column">
            {dayBlocks.map((day) => {
              const { weekday, dateStr } = formatDateLabelParts(
                day.time,
                activeTimezone
              );
              const isWeekend = isWeekendDay(day.time, activeTimezone);
              return (
                <div
                  key={day.dayIndex}
                  className={`vt-day-block ${isWeekend ? 'is-weekend' : ''}`}
                  style={{
                    top: day.topPx,
                    height: day.heightPx,
                  }}
                >
                  <div
                    className={`vt-day-label ${
                      isCompactRow ? 'is-compact-row' : ''
                    } ${isWeekend ? 'is-weekend' : ''}`}
                  >
                    <div className="vt-day-weekday">{weekday}</div>
                    <div className="vt-day-date">{dateStr}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Resolution Time Slots Sub-Column */}
          {!isSingleSlotPerDay && (
            <div className="vt-time-column">
              {timeSlots.map((slot, index) => {
                return (
                  <div
                    key={index}
                    className="vt-time-slot-label"
                    style={{
                      top: slot.topPx,
                      height: slotHeightPx,
                    }}
                  >
                    {renderTimeSlotLabel
                      ? renderTimeSlotLabel(slot.time, activeTimezone)
                      : formatTimeOnlyLabel(slot.time, activeTimezone)}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tracks Container */}
        <div className="vt-tracks-container" style={{ height: totalHeightPx }}>
          {/* Weekend Day Row Highlights */}
          {dayBlocks.map((day) => {
            if (!isWeekendDay(day.time, activeTimezone)) return null;
            return (
              <div
                key={day.dayIndex}
                className="vt-weekend-row-highlight"
                style={{
                  top: day.topPx,
                  height: day.heightPx,
                }}
              />
            );
          })}

          {/* Yellow Dotted Now Line Indicator */}
          {isNowInRange && (
            <div
              className="vt-now-indicator-line"
              style={{ top: nowTopPx }}
            >
              <div className="vt-now-indicator-badge">NOW</div>
            </div>
          )}

          {tracks.map((track) => {
            const layoutMap = trackOverlapLayouts.get(track.id);
            const trackEvents = events.filter((e) => {
              const preview = dragPreviews?.get(e.id);
              if (preview && preview.trackId) {
                return preview.trackId === track.id;
              }
              return e.trackId === track.id;
            });

            return (
              <div
                key={track.id}
                ref={(el) => {
                  if (el) trackRefs.current.set(track.id, el);
                  else trackRefs.current.delete(track.id);
                }}
                className="vt-track-column"
                onPointerDown={(e) => handleTrackPointerDown(e, track.id)}
                onDoubleClick={(e) => handleTrackDoubleClick(e, track.id)}
              >
                {/* Background Resolution Grid Slots */}
                {timeSlots.map((slot, idx) => (
                  <div
                    key={idx}
                    className="vt-grid-slot"
                    style={{
                      top: slot.topPx,
                      height: slotHeightPx,
                    }}
                  />
                ))}

                {/* Drag-to-Create Ghost Event Preview */}
                {createPreview && createPreview.trackId === track.id && (
                  <div
                    className={`vt-event is-creating ${
                      createPreview.heightPx < 30 ? 'is-compact' : ''
                    }`}
                    style={{
                      top: createPreview.topPx,
                      height: createPreview.heightPx,
                      left: 0,
                      width: '100%',
                    }}
                  >
                    <div className="vt-event-header">
                      <span className="vt-event-title">+ New Event</span>
                      <span className="vt-event-time">
                        {createPreview.startLabel} - {createPreview.endLabel}
                      </span>
                    </div>
                  </div>
                )}

                {/* Events */}
                {trackEvents.map((event) => {
                  const isDraggingThis = dragState?.eventId === event.id;
                  const preview = dragPreviews?.get(event.id);

                  let startMs = toEpochMs(event.start, activeTimezone);
                  let endMs = toEpochMs(event.end, activeTimezone);

                  if (preview) {
                    startMs = preview.startMs;
                    endMs = preview.endMs;
                  }

                  const topPx = (startMs - originMs) * P;
                  const rawHeightPx = (endMs - startMs) * P;
                  const heightPx = Math.max(rawHeightPx, 20); // Section 7 defensive constraint
                  const isCompactHeight = heightPx <= 30;

                  const meta = layoutMap?.get(event.id) || {
                    widthPct: 100,
                    leftPct: 0,
                    subColumnIndex: 0,
                    totalSubColumns: 1,
                  };

                  const canDrag = event.isDraggable !== false;
                  const canResize = event.isResizable !== false;

                  return (
                    <div
                      key={event.id}
                      className={`vt-event ${canDrag ? 'is-draggable' : ''} ${
                        isDraggingThis ? 'is-dragging' : ''
                      } ${isCompactHeight ? 'is-compact' : ''}`}
                      style={{
                        top: topPx,
                        height: heightPx,
                        width: `${meta.widthPct}%`,
                        left: `${meta.leftPct}%`,
                        ...(isCompactHeight
                          ? { paddingTop: 0, paddingBottom: 0 }
                          : {}),
                      }}
                      onPointerDown={(e) =>
                        handlePointerDown(e, event, 'move')
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEventClickInternal(event);
                      }}
                      onDoubleClick={(e) => e.stopPropagation()}
                      onContextMenu={(e) => {
                        const nativePointerType =
                          'pointerType' in e.nativeEvent
                            ? (e.nativeEvent as PointerEvent).pointerType
                            : lastPointerTypeRef.current;
                        if (
                          nativePointerType === 'touch' &&
                          touchInteractionMode !== 'drag-edit'
                        ) {
                          return;
                        }
                        if (onEventContextMenu) {
                          onEventContextMenu(event, e);
                        }
                      }}
                    >
                      {/* Top Resize Handle */}
                      {canResize && (
                        <div
                          className="vt-resize-handle vt-resize-handle-top"
                          onPointerDown={(e) =>
                            handlePointerDown(e, event, 'resize-top')
                          }
                        />
                      )}

                      {/* Event Content */}
                      {renderEvent ? (
                        renderEvent(event, {
                          isDragging: !!isDraggingThis,
                          widthPct: meta.widthPct,
                          leftPct: meta.leftPct,
                        })
                      ) : (
                        <>
                          <div className="vt-event-header">
                            <div className="vt-event-title">
                              {event.title || 'Untitled Event'}
                            </div>
                            <span className="vt-event-tz-badge">
                              {event.start.timezone}
                            </span>
                          </div>
                          {event.description && (
                            <div className="vt-event-desc">
                              {event.description}
                            </div>
                          )}
                          <div className="vt-event-time">
                            {formatSlotLabel(
                              new Date(startMs),
                              event.start.timezone
                            )}
                          </div>
                        </>
                      )}

                      {/* Bottom Resize Handle */}
                      {canResize && (
                        <div
                          className="vt-resize-handle vt-resize-handle-bottom"
                          onPointerDown={(e) =>
                            handlePointerDown(e, event, 'resize-bottom')
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
          </div>
        </div>
      </div>

      {/* Overlap Conflict Modal Dialog */}
      <OverlapConflictDialog
        isOpen={!!pendingOverlap}
        movedEvent={pendingOverlap?.movedEvent ?? null}
        overlappingEvents={pendingOverlap?.overlappingEvents ?? []}
        onSelectStrategy={handleSelectOverlapStrategy}
        onCancel={() => setPendingOverlap(null)}
      />
    </div>
  );
}
