import React, { useState, useEffect, useCallback } from "react";
import {
  VerticalTimeline,
  TimelineEvent,
  Track,
  Resolution,
  DragEventPayload,
  CustomPropertyField,
  CustomCurrencyValue,
} from "../src";

const SAMPLE_TRACKS: Track[] = [
  {
    id: "track-accommodation",
    label: "Accommodation",
    subtitle: "Hotel & Resort Stays (Parent)",
  },
  {
    id: "track-transport",
    label: "Transport",
    subtitle: "Flights & Shuttles (Child)",
    parentId: "track-accommodation",
  },
  {
    id: "track-activities",
    label: "Activities",
    subtitle: "Tours & Excursions (Child)",
    parentId: "track-accommodation",
  },
];

const CUSTOM_FIELDS: CustomPropertyField[] = [
  // Common for all tracks
  {
    key: "cost",
    label: "Cost",
    type: "currency",
    defaultValue: { amount: 0, currencySymbol: "USD" },
  },
  {
    key: "link",
    label: "External Website Link",
    type: "link",
    defaultValue: "",
  },
  {
    key: "hasBeenBooked",
    label: "Has been booked",
    type: "boolean",
    defaultValue: false,
  },
  {
    key: "hasBeenPaidFor",
    label: "Has been paid for",
    type: "boolean",
    defaultValue: false,
  },

  // Accommodation and Activities tracks
  {
    key: "address",
    label: "Address",
    type: "string",
    trackIds: ["track-accommodation", "track-activities"],
    defaultValue: "",
  },

  // Transport track only
  {
    key: "startAddress",
    label: "Start Address",
    type: "string",
    trackIds: ["track-transport"],
    defaultValue: "",
  },
  {
    key: "endAddress",
    label: "End Address",
    type: "string",
    trackIds: ["track-transport"],
    defaultValue: "",
  },
  {
    key: "transportType",
    label: "Transport Type",
    type: "enum",
    options: ["plane", "bus", "car", "taxi", "boat", "mixed"],
    trackIds: ["track-transport"],
    defaultValue: "bus",
  },
];

const INITIAL_EVENTS: TimelineEvent[] = [
  {
    id: "evt-hotel",
    trackId: "track-accommodation",
    start: {
      dateTime: "2026-06-01T02:00:00.000Z",
      timezone: "America/New_York",
    },
    end: { dateTime: "2026-06-02T18:00:00.000Z", timezone: "America/New_York" },
    title: "Grand Plaza Hotel Stay (Parent)",
    description: "Main accommodation booking range spanning 2 days",
    isDraggable: true,
    isResizable: true,
    data: {
      cost: { amount: 2500, currencySymbol: "EUR" },
      link: "https://grandplazahotel.com",
      hasBeenBooked: true,
      hasBeenPaidFor: true,
      address: "100 Ocean Drive, Miami, FL",
    },
  },
  {
    id: "evt-shuttle",
    trackId: "track-transport",
    start: {
      dateTime: "2026-06-01T04:00:00.000Z",
      timezone: "America/New_York",
    },
    end: { dateTime: "2026-06-01T08:00:00.000Z", timezone: "America/New_York" },
    title: "Airport Express Shuttle (Child)",
    description: "Enclosed in Hotel Stay range",
    isDraggable: true,
    isResizable: true,
    data: {
      cost: { amount: 120, currencySymbol: "EUR" },
      link: "https://miamiexpressshuttle.com",
      hasBeenBooked: true,
      hasBeenPaidFor: false,
      startAddress: "Miami International Airport (MIA)",
      endAddress: "100 Ocean Drive, Miami, FL",
      transportType: "bus",
    },
  },
  {
    id: "evt-tour",
    trackId: "track-activities",
    start: {
      dateTime: "2026-06-01T10:00:00.000Z",
      timezone: "America/New_York",
    },
    end: { dateTime: "2026-06-01T16:00:00.000Z", timezone: "America/New_York" },
    title: "Guided Museum & City Tour (Child)",
    description: "Enclosed in Hotel Stay range",
    isDraggable: true,
    isResizable: true,
    data: {
      cost: { amount: 350, currencySymbol: "USD" },
      link: "https://citytoursandmuseums.com",
      hasBeenBooked: false,
      hasBeenPaidFor: false,
      address: "Art District Museum, Miami, FL",
    },
  },
  {
    id: "evt-return-flight",
    trackId: "track-transport",
    start: {
      dateTime: "2026-06-02T10:00:00.000Z",
      timezone: "America/New_York",
    },
    end: { dateTime: "2026-06-02T16:00:00.000Z", timezone: "America/New_York" },
    title: "Return Flight Connection (Child)",
    description: "Enclosed near end of Hotel Stay",
    isDraggable: true,
    isResizable: true,
    data: {
      cost: { amount: 650, currencySymbol: "CZK" },
      link: "https://britishairways.com",
      hasBeenBooked: true,
      hasBeenPaidFor: true,
      startAddress: "100 Ocean Drive, Miami, FL",
      endAddress: "London Heathrow (LHR)",
      transportType: "plane",
    },
  },
];

const TRANSPORT_ICONS: Record<string, string> = {
  plane: "✈️",
  bus: "🚌",
  car: "🚗",
  taxi: "🚕",
  boat: "🚤",
  mixed: "🔀",
};

export function App() {
  const [resolution, setResolution] = useState<Resolution>(3);
  const [dayHeight, setDayHeight] = useState<number>(300);
  const [snapOverride, setSnapOverride] = useState<number | undefined>(
    undefined,
  );

  // Playground History State for Undo / Redo
  const [history, setHistory] = useState<TimelineEvent[][]>([INITIAL_EVENTS]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const [logMessages, setLogMessages] = useState<string[]>([
    "Playground initialized with track-scoped properties (addresses, transport types, booking status).",
  ]);

  const currentEvents = history[historyIndex] || INITIAL_EVENTS;

  const startDate = new Date("2026-06-01T00:00:00.000Z");
  const endDate = new Date("2026-06-03T00:00:00.000Z");

  const addLog = (msg: string) => {
    setLogMessages((prev) => [
      `[${new Date().toLocaleTimeString()}] ${msg}`,
      ...prev.slice(0, 7),
    ]);
  };

  const pushEventsState = (newEvents: TimelineEvent[], logMsg: string) => {
    setHistory((prev) => {
      const nextHistory = [...prev.slice(0, historyIndex + 1), newEvents];
      return nextHistory;
    });
    setHistoryIndex((prev) => prev + 1);
    addLog(logMsg);
  };

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex((prev) => prev - 1);
      addLog(`Undo (Step ${historyIndex} → ${historyIndex - 1})`);
    }
  }, [historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((prev) => prev + 1);
      addLog(`Redo (Step ${historyIndex} → ${historyIndex + 1})`);
    }
  }, [historyIndex, history.length]);

  // Keyboard shortcut listener (Ctrl+Z / Ctrl+Y / Cmd+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  const handleEventsUpdate = (payloads: DragEventPayload[]) => {
    let nextEvents = [...currentEvents];
    for (const p of payloads) {
      nextEvents = nextEvents.map((ev) =>
        ev.id === p.event.id
          ? {
              ...ev,
              start: p.nextStart,
              end: p.nextEnd,
              trackId: p.nextTrackId,
            }
          : ev,
      );
    }
    const log =
      payloads.length > 1
        ? `Bulk update: ${payloads.length} events modified simultaneously`
        : `Updated "${payloads[0].event.title}"`;
    pushEventsState(nextEvents, log);
  };

  const handleEventSave = (savedEvent: TimelineEvent) => {
    const nextEvents = currentEvents.map((ev) =>
      ev.id === savedEvent.id ? savedEvent : ev,
    );
    const costObj = savedEvent.data?.cost as CustomCurrencyValue | undefined;
    const costStr = costObj
      ? `${costObj.currencySymbol}${costObj.amount}`
      : "N/A";
    pushEventsState(
      nextEvents,
      `Saved "${savedEvent.title}": Cost=${costStr}, Booked=${savedEvent.data?.hasBeenBooked}, Paid=${savedEvent.data?.hasBeenPaidFor}`,
    );
  };

  const handleEventDelete = (eventId: string) => {
    const nextEvents = currentEvents.filter((ev) => ev.id !== eventId);
    pushEventsState(nextEvents, `Deleted event ID "${eventId}"`);
  };

  const handleSlotDoubleClick = (
    trackId: string,
    timestamp: Date,
    inheritedTimezone: string,
  ) => {
    const endTimestamp = new Date(timestamp.getTime() + 4 * 3600 * 1000);
    const newEvt: TimelineEvent = {
      id: `evt-${Date.now()}`,
      trackId,
      start: {
        dateTime: timestamp.toISOString(),
        timezone: inheritedTimezone,
      },
      end: {
        dateTime: endTimestamp.toISOString(),
        timezone: inheritedTimezone,
      },
      title: `New Booking (${inheritedTimezone})`,
      description: `Created via double click. Inherited tz: ${inheritedTimezone}`,
      isDraggable: true,
      isResizable: true,
      data: {
        cost: { amount: 150, currencySymbol: "USD" },
        link: "https://example.com",
        hasBeenBooked: false,
        hasBeenPaidFor: false,
        address: trackId !== "track-transport" ? "Sample Address" : undefined,
        startAddress: trackId === "track-transport" ? "Origin" : undefined,
        endAddress: trackId === "track-transport" ? "Destination" : undefined,
        transportType: trackId === "track-transport" ? "bus" : undefined,
      },
    };

    pushEventsState(
      [...currentEvents, newEvt],
      `Added event on ${trackId} (${inheritedTimezone})`,
    );
  };

  return (
    <div
      style={{
        padding: 24,
        fontFamily: "system-ui, sans-serif",
        background: "#090d16",
        minHeight: "100vh",
        color: "#f1f5f9",
      }}
    >
      <header
        style={{
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "1.6rem",
              background: "linear-gradient(90deg, #818cf8, #c084fc)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Vertical Timeline Component Playground
          </h1>
          <p
            style={{
              margin: "4px 0 0",
              color: "#94a3b8",
              fontSize: "0.875rem",
            }}
          >
            Track-Scoped Custom Properties: Cost, Links, Booking/Payment Status,
            Addresses, and Transport Types.
          </p>
        </div>

        {/* Undo / Redo Controls */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: canUndo ? "#334155" : "#1e293b",
              color: canUndo ? "#f8fafc" : "#64748b",
              border: "1px solid #475569",
              padding: "8px 16px",
              borderRadius: 6,
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: canUndo ? "pointer" : "not-allowed",
              opacity: canUndo ? 1 : 0.6,
              transition: "all 0.15s ease",
            }}
          >
            ↩ Undo
          </button>

          <button
            type="button"
            onClick={handleRedo}
            disabled={!canRedo}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: canRedo ? "#334155" : "#1e293b",
              color: canRedo ? "#f8fafc" : "#64748b",
              border: "1px solid #475569",
              padding: "8px 16px",
              borderRadius: 6,
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: canRedo ? "pointer" : "not-allowed",
              opacity: canRedo ? 1 : 0.6,
              transition: "all 0.15s ease",
            }}
          >
            ↪ Redo
          </button>

          <span
            style={{ fontSize: "0.75rem", color: "#94a3b8", marginLeft: 4 }}
          >
            Step {historyIndex + 1} of {history.length}
          </span>
        </div>
      </header>

      {/* Control Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 20,
          flexWrap: "wrap",
          alignItems: "center",
          background: "#1e293b",
          padding: "14px 20px",
          borderRadius: 10,
          border: "1px solid #334155",
          marginBottom: 20,
        }}
      >
        <div>
          <label
            style={{
              fontSize: "0.8rem",
              color: "#94a3b8",
              display: "block",
              marginBottom: 4,
            }}
          >
            Grid Resolution (R slots / day)
          </label>
          <select
            value={resolution}
            onChange={(e) =>
              setResolution(Number(e.target.value) as Resolution)
            }
            style={{
              background: "#0f172a",
              color: "#f8fafc",
              border: "1px solid #475569",
              padding: "6px 12px",
              borderRadius: 6,
              outline: "none",
              cursor: "pointer",
            }}
          >
            {[1, 2, 3, 4, 6, 8, 12, 24, 48, 96].map((res) => (
              <option key={res} value={res}>
                {res} slots/day ({24 / res} hrs/slot)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            style={{
              fontSize: "0.8rem",
              color: "#94a3b8",
              display: "block",
              marginBottom: 4,
            }}
          >
            Day Height (H_day: {dayHeight}px)
          </label>
          <input
            type="range"
            min={120}
            max={600}
            step={20}
            value={dayHeight}
            onChange={(e) => setDayHeight(Number(e.target.value))}
            style={{ accentColor: "#6366f1", cursor: "pointer" }}
          />
        </div>

        <div>
          <label
            style={{
              fontSize: "0.8rem",
              color: "#94a3b8",
              display: "block",
              marginBottom: 4,
            }}
          >
            Snap Override (minutes)
          </label>
          <select
            value={snapOverride ?? ""}
            onChange={(e) =>
              setSnapOverride(
                e.target.value === "" ? undefined : Number(e.target.value),
              )
            }
            style={{
              background: "#0f172a",
              color: "#f8fafc",
              border: "1px solid #475569",
              padding: "6px 12px",
              borderRadius: 6,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="">Default (resolution grid slot)</option>
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">60 minutes</option>
          </select>
        </div>

        <div style={{ marginLeft: "auto" }}>
          <span
            style={{ fontSize: "0.8rem", color: "#818cf8", fontWeight: 500 }}
          >
            Click any event to view/edit its track-specific address, transport
            type, website link, or booking status!
          </span>
        </div>
      </div>

      {/* Main Timeline View */}
      <div style={{ height: 600, marginBottom: 20 }}>
        <VerticalTimeline
          startDate={startDate}
          endDate={endDate}
          tracks={SAMPLE_TRACKS}
          events={currentEvents}
          resolution={resolution}
          dayHeight={dayHeight}
          snapToMinutesOverride={snapOverride}
          defaultTimezone="UTC"
          customPropertyFields={CUSTOM_FIELDS}
          enableEventDialog={true}
          onEventsUpdate={handleEventsUpdate}
          onEventSave={handleEventSave}
          onEventDelete={handleEventDelete}
          onSlotDoubleClick={handleSlotDoubleClick}
          onEventClick={(evt) => addLog(`Clicked "${evt.title}"`)}
          renderEvent={(event) => {
            const costObj = event.data?.cost as CustomCurrencyValue | undefined;
            const formatter = new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: costObj?.currencySymbol,
              currencyDisplay: "symbol",
            });
            const costStr = costObj
              ? formatter.format(costObj.amount)
              : "";
            const isBooked = Boolean(event.data?.hasBeenBooked);
            const isPaid = Boolean(event.data?.hasBeenPaidFor);
            const linkUrl = event.data?.link as string | undefined;
            const transportType = event.data?.transportType as
              | string
              | undefined;

            return (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "0.825rem",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {transportType && TRANSPORT_ICONS[transportType] && (
                      <span>{TRANSPORT_ICONS[transportType]}</span>
                    )}
                    <span
                      style={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {event.title}
                    </span>
                  </div>

                  {event.data?.address && (
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "#cbd5e1",
                        marginTop: 2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      📍 {String(event.data.address)}
                    </div>
                  )}

                  {event.data?.startAddress && (
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "#cbd5e1",
                        marginTop: 2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      🛫 {String(event.data.startAddress)} ➔{" "}
                      {String(event.data.endAddress || "")}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 4,
                    flexWrap: "wrap",
                    alignItems: "center",
                    marginTop: 4,
                  }}
                >
                  {costStr && (
                    <span
                      style={{
                        background: "rgba(34, 197, 94, 0.3)",
                        color: "#86efac",
                        fontSize: "0.65rem",
                        padding: "1px 5px",
                        borderRadius: 4,
                        fontWeight: 600,
                      }}
                    >
                      {costStr}
                    </span>
                  )}
                  {isBooked && (
                    <span
                      style={{
                        background: "rgba(59, 130, 246, 0.3)",
                        color: "#93c5fd",
                        fontSize: "0.65rem",
                        padding: "1px 5px",
                        borderRadius: 4,
                      }}
                    >
                      ✓ Booked
                    </span>
                  )}
                  {isPaid && (
                    <span
                      style={{
                        background: "rgba(168, 85, 247, 0.3)",
                        color: "#e9d5ff",
                        fontSize: "0.65rem",
                        padding: "1px 5px",
                        borderRadius: 4,
                      }}
                    >
                      ✓ Paid
                    </span>
                  )}
                  {linkUrl && (
                    <a
                      href={linkUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        background: "rgba(255, 255, 255, 0.15)",
                        color: "#f8fafc",
                        fontSize: "0.65rem",
                        padding: "1px 5px",
                        borderRadius: 4,
                        textDecoration: "none",
                      }}
                    >
                      🔗 Link
                    </a>
                  )}
                </div>
              </div>
            );
          }}
        />
      </div>

      {/* Activity Logs */}
      <div
        style={{
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 8,
          padding: "12px 16px",
        }}
      >
        <div
          style={{
            fontSize: "0.85rem",
            fontWeight: 600,
            color: "#818cf8",
            marginBottom: 8,
          }}
        >
          Activity Log & Custom Track Property Output
        </div>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: "0.775rem",
            color: "#cbd5e1",
          }}
        >
          {logMessages.map((log, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
