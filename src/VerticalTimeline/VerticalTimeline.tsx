import React, { useRef, useState, useCallback, useMemo } from 'react';
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
import { verticalTimelineStyles } from './styles';
import { EventDialog } from './EventDialog';
import { OverlapConflictDialog, OverlapStrategy } from './OverlapConflictDialog';

type DragAction = 'move' | 'resize-top' | 'resize-bottom';

interface ChildInitialState {
  event: TimelineEvent;
  initialStartMs: number;
  initialEndMs: number;
}

interface DragState {
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
  defaultTimezone,
  customPropertyFields = [],
  enableEventDialog = true,
  renderEvent,
  renderTrackHeader,
  renderTimeSlotLabel,
  onEventUpdate,
  onEventsUpdate,
  onEventSave,
  onEventDelete,
  onEventClick,
  onSlotDoubleClick,
  className = '',
}: VerticalTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const wasDraggingRef = useRef<boolean>(false);

  const [dragState, setDragState] = useState<DragState | null>(null);

  // Dialog State
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Overlap Conflict State
  const [pendingOverlap, setPendingOverlap] = useState<PendingOverlapMove | null>(null);

  // Epoch metrics
  const originMs = useMemo(() => toEpochMs(startDate), [startDate]);
  const endScopeMs = useMemo(() => toEpochMs(endDate), [endDate]);
  const totalDurationMs = useMemo(
    () => Math.max(endScopeMs - originMs, MS_PER_DAY),
    [endScopeMs, originMs]
  );
  const totalDays = useMemo(
    () => Math.ceil(totalDurationMs / MS_PER_DAY),
    [totalDurationMs]
  );

  const P = useMemo(() => calculateScaleFactor(dayHeight), [dayHeight]);
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
      layouts.set(track.id, computeTrackOverlapLayout(trackEvents));
    }
    return layouts;
  }, [tracks, events]);

  // Handle Drag Pointer Events
  const handlePointerDown = (
    e: React.PointerEvent,
    event: TimelineEvent,
    action: DragAction
  ) => {
    e.stopPropagation();
    if (action === 'move' && event.isDraggable === false) return;
    if (
      (action === 'resize-top' || action === 'resize-bottom') &&
      event.isResizable === false
    )
      return;

    wasDraggingRef.current = false;

    const startMs = toEpochMs(event.start.dateTime);
    const endMs = toEpochMs(event.end.dateTime);

    // Collect enclosed child events if this event is on a parent track
    const enclosed = getEnclosedChildEvents(event, events, tracks);
    const initialChildStates: ChildInitialState[] = enclosed.map((child) => ({
      event: child,
      initialStartMs: toEpochMs(child.start.dateTime),
      initialEndMs: toEpochMs(child.end.dateTime),
    }));

    setDragState({
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

    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState) return;

      const deltaY = e.clientY - dragState.initialPointerY;

      // Determine current track hover if moving
      let targetTrackId = dragState.currentTrackId;
      if (dragState.action === 'move') {
        const clientX = e.clientX;
        for (const [tId, el] of trackRefs.current.entries()) {
          const rect = el.getBoundingClientRect();
          if (clientX >= rect.left && clientX <= rect.right) {
            targetTrackId = tId;
            break;
          }
        }
      }

      if (Math.abs(deltaY) > 3 || targetTrackId !== dragState.initialTrackId) {
        wasDraggingRef.current = true;
      }

      setDragState((prev) =>
        prev
          ? {
              ...prev,
              currentDeltaY: deltaY,
              currentTrackId: targetTrackId,
            }
          : null
      );
    },
    [dragState]
  );

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

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState) return;

      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);

      const rawDeltaMs = dragState.currentDeltaY / P;
      const snappedDeltaMs =
        Math.round(rawDeltaMs / activeSnapMs) * activeSnapMs;

      let nextStartMs = dragState.initialStartMs;
      let nextEndMs = dragState.initialEndMs;

      if (dragState.action === 'move') {
        nextStartMs = dragState.initialStartMs + snappedDeltaMs;
        nextEndMs = dragState.initialEndMs + snappedDeltaMs;
      } else if (dragState.action === 'resize-top') {
        nextStartMs = Math.min(
          dragState.initialStartMs + snappedDeltaMs,
          dragState.initialEndMs - activeSnapMs
        );
      } else if (dragState.action === 'resize-bottom') {
        nextEndMs = Math.max(
          dragState.initialEndMs + snappedDeltaMs,
          dragState.initialStartMs + activeSnapMs
        );
      }

      const targetEvent = events.find((ev) => ev.id === dragState.eventId);

      if (targetEvent) {
        // Collect child payloads if parent moved/resized
        const childPayloads: DragEventPayload[] = [];
        if (dragState.initialChildStates.length > 0) {
          const childPositions =
            dragState.action === 'move'
              ? computeChildMovePositions(
                  snappedDeltaMs,
                  dragState.initialChildStates
                )
              : computeChildResizePositions(
                  nextStartMs,
                  nextEndMs,
                  dragState.initialChildStates
                );

          for (const pos of childPositions) {
            childPayloads.push({
              event: pos.event,
              nextStart: {
                dateTime: new Date(pos.nextStartMs).toISOString(),
                timezone: pos.event.start.timezone,
              },
              nextEnd: {
                dateTime: new Date(pos.nextEndMs).toISOString(),
                timezone: pos.event.end.timezone,
              },
              nextTrackId: pos.event.trackId,
            });
          }
        }

        const isMovedOrResized =
          snappedDeltaMs !== 0 ||
          dragState.currentTrackId !== dragState.initialTrackId;

        // If action is MOVE or RESIZE and created an overlap on target track -> prompt user
        if (isMovedOrResized) {
          const overlaps = findOverlappingEvents(
            targetEvent.id,
            nextStartMs,
            nextEndMs,
            dragState.currentTrackId,
            events
          );

          if (overlaps.length > 0) {
            setPendingOverlap({
              movedEvent: targetEvent,
              nextStartMs,
              nextEndMs,
              nextTrackId: dragState.currentTrackId,
              overlappingEvents: overlaps,
              childPayloads,
            });
            setDragState(null);
            return;
          }
        }

        // If no overlap conflict, emit payloads directly
        if (isMovedOrResized) {
          const parentPayload: DragEventPayload = {
            event: targetEvent,
            nextStart: {
              dateTime: new Date(nextStartMs).toISOString(),
              timezone: targetEvent.start.timezone,
            },
            nextEnd: {
              dateTime: new Date(nextEndMs).toISOString(),
              timezone: targetEvent.end.timezone,
            },
            nextTrackId: dragState.currentTrackId,
          };

          emitPayloads([parentPayload, ...childPayloads]);
        }
      }

      setDragState(null);
    },
    [dragState, P, activeSnapMs, events, emitPayloads]
  );

  // Handle choice in Overlap Conflict Dialog
  const handleSelectOverlapStrategy = (strategy: OverlapStrategy) => {
    if (!pendingOverlap) return;

    const { movedEvent, nextStartMs, nextEndMs, nextTrackId, childPayloads } =
      pendingOverlap;

    const movedPayload: DragEventPayload = {
      event: movedEvent,
      nextStart: {
        dateTime: new Date(nextStartMs).toISOString(),
        timezone: movedEvent.start.timezone,
      },
      nextEnd: {
        dateTime: new Date(nextEndMs).toISOString(),
        timezone: movedEvent.end.timezone,
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
        tracks
      );
      for (const change of pushedChanges) {
        finalPayloads.push({
          event: change.event,
          nextStart: {
            dateTime: new Date(change.nextStartMs).toISOString(),
            timezone: change.event.start.timezone,
          },
          nextEnd: {
            dateTime: new Date(change.nextEndMs).toISOString(),
            timezone: change.event.end.timezone,
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
        events
      );
      for (const change of shortenedChanges) {
        finalPayloads.push({
          event: change.event,
          nextStart: {
            dateTime: new Date(change.nextStartMs).toISOString(),
            timezone: change.event.start.timezone,
          },
          nextEnd: {
            dateTime: new Date(change.nextEndMs).toISOString(),
            timezone: change.event.end.timezone,
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

  // Handle Track Double-click to create or slot double click
  const handleTrackDoubleClick = (
    e: React.MouseEvent<HTMLDivElement>,
    trackId: string
  ) => {
    if (!onSlotDoubleClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const clickedTimeMs = originMs + offsetY / P;

    // Snap to nearest slot
    const slotIndex = Math.floor((clickedTimeMs - originMs) / slotDurationMs);
    const snappedTimeMs = originMs + slotIndex * slotDurationMs;
    const timestamp = new Date(snappedTimeMs);

    const inheritedTz = getPrecedingTimezone(
      events,
      timestamp,
      defaultTimezone
    );
    onSlotDoubleClick(trackId, timestamp, inheritedTz);
  };

  const handleEventClickInternal = (event: TimelineEvent) => {
    // If the click was preceded by dragging or resizing, do NOT open the edit dialog
    if (wasDraggingRef.current) {
      wasDraggingRef.current = false;
      return;
    }

    onEventClick?.(event);
    if (enableEventDialog) {
      setEditingEvent(event);
      setIsDialogOpen(true);
    }
  };

  const handleSaveEventInternal = (updatedEvent: TimelineEvent) => {
    onEventSave?.(updatedEvent);
  };

  return (
    <div
      ref={containerRef}
      className={`vertical-timeline ${className}`}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <style>{verticalTimelineStyles}</style>

      {/* Header */}
      <div className="vt-header">
        <div className="vt-header-time-axis">
          <div className="vt-header-day-subcol">Date</div>
          <div className="vt-header-time-subcol">Time</div>
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
                          color: '#818cf8',
                          marginRight: 6,
                        }}
                      >
                        ↳
                      </span>
                    )}
                    {track.label}
                  </div>
                  {track.subtitle && (
                    <div className="vt-track-subtitle">{track.subtitle}</div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Body */}
      <div className="vt-body-scroll">
        {/* Sticky Split Time Axis Column */}
        <div className="vt-time-axis-column" style={{ height: totalHeightPx }}>
          {/* Vertically Merged Date Sub-Column */}
          <div className="vt-day-column">
            {dayBlocks.map((day) => {
              const inheritedTz = getPrecedingTimezone(
                events,
                day.time,
                defaultTimezone
              );
              const { weekday, dateStr } = formatDateLabelParts(
                day.time,
                inheritedTz
              );
              return (
                <div
                  key={day.dayIndex}
                  className="vt-day-block"
                  style={{
                    top: day.topPx,
                    height: day.heightPx,
                  }}
                >
                  <div className="vt-day-label">
                    <div className="vt-day-weekday">{weekday}</div>
                    <div className="vt-day-date">{dateStr}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Resolution Time Slots Sub-Column */}
          <div className="vt-time-column">
            {timeSlots.map((slot, index) => {
              const inheritedTz = getPrecedingTimezone(
                events,
                slot.time,
                defaultTimezone
              );
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
                    ? renderTimeSlotLabel(slot.time, inheritedTz)
                    : formatTimeOnlyLabel(slot.time, inheritedTz)}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tracks Container */}
        <div className="vt-tracks-container" style={{ height: totalHeightPx }}>
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

                {/* Events */}
                {trackEvents.map((event) => {
                  const isDraggingThis = dragState?.eventId === event.id;
                  const preview = dragPreviews?.get(event.id);

                  let startMs = toEpochMs(event.start.dateTime);
                  let endMs = toEpochMs(event.end.dateTime);

                  if (preview) {
                    startMs = preview.startMs;
                    endMs = preview.endMs;
                  }

                  const topPx = (startMs - originMs) * P;
                  const rawHeightPx = (endMs - startMs) * P;
                  const heightPx = Math.max(rawHeightPx, 20); // Section 7 defensive constraint
                  const isCompactHeight = heightPx < 22;

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

      {/* Built-in Event Editing Modal Dialog */}
      <EventDialog
        event={editingEvent}
        tracks={tracks}
        customFields={customPropertyFields}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSaveEventInternal}
        onDelete={onEventDelete}
      />

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
