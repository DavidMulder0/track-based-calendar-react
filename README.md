# VerticalTimeline React Component

A modern, high-performance, and feature-rich React vertical timeline component built for multi-track scheduling, trip planning, resource allocation, and project management applications.

Features include:
- **Weekend Day Row Highlighting**: Automatically identifies Saturday and Sunday rows (aware of active event timezones) and renders a subtle, lighter background row highlight across the entire grid and date column.
- **Real-Time "Now" Indicator Line**: Displays a glowing yellow dotted horizontal line (`NOW` badge) across the tracks if and only if the current moment falls within the visible timeline range.
- **Interactive Drag-to-Create**: Press and drag on empty track space to define an event's start time, duration, and track with a real-time visual ghost preview (`+ New Event`).
- **Native Overlap Resolution Modal**: Uses the HTML `<dialog>` Top Layer API so conflict choices are not clipped by the scrolling timeline.
- **Responsive Compact & Single-Slot Layouts**: Automatic layout adjustments when row height is $\le 30\text{px}$ (inline weekday/date labels) or when `resolution={1}` (hides time sub-column).
- **Dual-Column Time Axis Layout**: Vertically merged day blocks combined with configurable resolution time slots.
- **Precision Temporal Scaling**: Independent scaling of day height ($H_{day}$) and grid resolution ($R$).
- **Preceding Event Timezone Inheritance**: Automatic timezone propagation across timeline boundaries using `Intl.supportedValuesOf('timeZone')`.
- **Chronological Sub-Column Overlap Layout**: Dynamic sweep-line layout for simultaneous overlapping events.
- **Parent-Child Track Interactivity**: Synchronized real-time move and clamped bounds resizing of enclosed child events.
- **Interactive Overlap Conflict Resolution**: Built-in modal presenting 3 strategies (*Do Nothing*, *Push Away with multi-track cascading*, *Shorten Overlapped Event(s)*).
- **Host-Owned Event Editing**: Emits click and creation callbacks so applications can supply editing UI and domain-specific fields without coupling them to the calendar.
- **Native Light/Dark Theming**: Uses inherited `color-scheme`, `light-dark()`, and public `--vt-*` custom properties without JavaScript theme state.
- **Fully Controlled Architecture**: Zero internal state mutation, enabling seamless Undo / Redo history management in host applications.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Architecture & Mathematical Foundations](#architecture--mathematical-foundations)
- [Component API Reference](#component-api-reference)
- [Data Models & Types](#data-models--types)
- [Advanced Guides](#advanced-guides)
  - [1. Parent-Child Track Dependencies](#1-parent-child-track-dependencies)
  - [2. Host-Owned Event Editing](#2-host-owned-event-editing)
  - [3. Overlap Conflict Resolution Strategies](#3-overlap-conflict-resolution-strategies)
  - [4. Host-Level Undo / Redo Implementation](#4-host-level-undo--redo-implementation)
  - [5. Custom Event Rendering](#5-custom-event-rendering)
  - [6. Theming](#6-theming)
  - [7. Package Scope](#7-package-scope)

---

## Installation

```bash
npm install track-based-calendar-react
```
*Note: Ensure `react` (v18+) and `react-dom` are installed in your project.*

---

## Quick Start

```tsx
import React, { useState } from 'react';
import {
  VerticalTimeline,
  TimelineEvent,
  Track,
  DragEventPayload,
} from 'track-based-calendar-react';

const SAMPLE_TRACKS: Track[] = [
  {
    id: 'track-accommodation',
    label: 'Accommodation',
    subtitle: 'Hotels & Resorts (Parent)',
  },
  {
    id: 'track-transport',
    label: 'Transport',
    subtitle: 'Flights & Shuttles (Child)',
    parentId: 'track-accommodation',
  },
];

const INITIAL_EVENTS: TimelineEvent[] = [
  {
    id: 'evt-hotel',
    trackId: 'track-accommodation',
    start: { dateTime: '2026-06-01T02:00:00.000Z', timezone: 'America/New_York' },
    end: { dateTime: '2026-06-02T18:00:00.000Z', timezone: 'America/New_York' },
    title: 'Grand Plaza Hotel Stay',
    description: 'Main accommodation booking',
    isDraggable: true,
    isResizable: true,
    data: {
      cost: { amount: 2500, currencySymbol: '$' },
      hasBeenBooked: true,
    },
  },
];

export function TimelineApp() {
  const [events, setEvents] = useState<TimelineEvent[]>(INITIAL_EVENTS);

  const startDate = new Date('2026-06-01T00:00:00.000Z');
  const endDate = new Date('2026-06-03T00:00:00.000Z');

  const handleEventsUpdate = (payloads: DragEventPayload[]) => {
    setEvents((prev) => {
      let updated = [...prev];
      for (const p of payloads) {
        updated = updated.map((ev) =>
          ev.id === p.event.id
            ? {
                ...ev,
                start: p.nextStart,
                end: p.nextEnd,
                trackId: p.nextTrackId,
              }
            : ev
        );
      }
      return updated;
    });
  };

  return (
    <div style={{ height: '600px', width: '100%' }}>
      <VerticalTimeline
        startDate={startDate}
        endDate={endDate}
        tracks={SAMPLE_TRACKS}
        events={events}
        resolution={3} // 3 slots/day (8 hrs/slot)
        dayHeight={300} // 300px per 24-hour cycle
        defaultTimezone="America/New_York"
        onEventsUpdate={handleEventsUpdate}
        onEventCreate={(newEvent) => {
          setEvents((prev) => [...prev, newEvent]);
        }}
        onEventClick={(event) => {
          // Open your application's event editor here.
          console.log('Selected event:', event);
        }}
      />
    </div>
  );
}
```

---

## Architecture & Mathematical Foundations

### 1. Temporal Scale Factor ($P$) & Resolution ($R$)
The timeline maps absolute timestamps to vertical pixel positioning using a linear scale factor $P$:

$$P = \frac{H_{\text{day}}}{86,400,000 \text{ ms}}$$

- **Day Height ($H_{\text{day}}$)**: Pixels allocated for a 24-hour period (e.g., $300\text{px}$).
- **Resolution ($R$)**: Number of visual slot divisions per 24-hour day.
- **Slot Duration ($T_{\text{slot}}$)**: $T_{\text{slot}} = \frac{86,400,000}{R}\text{ ms}$.
- **Slot Height ($H_{\text{slot}}$)**: $H_{\text{slot}} = \frac{H_{\text{day}}}{R}\text{ px}$.

Vertical pixel offsets for an event starting at $t_{\text{start}}$ relative to origin $t_{\text{origin}}$ are calculated as:

$$\text{Top}_{\text{px}} = (t_{\text{start}} - t_{\text{origin}}) \times P$$

$$\text{Height}_{\text{px}} = \max\left((t_{\text{end}} - t_{\text{start}}) \times P, 20\text{px}\right)$$

- **Compact Event Padding**: If $\text{Height}_{\text{px}} < 30\text{px}$, vertical padding is automatically zeroed (`isCompactHeight`) to keep text centered without clipping.
- **Compact Row Date Layout**: If $H_{\text{slot}} \le 30\text{px}$, the date column expands from `80px` to `120px` and displays weekday and date side-by-side without a line break.
- **Single-Slot Per Day**: If $R = 1$, the time column is hidden and the date column expands to occupy the entire time axis width.

### 2. Preceding Event Timezone Inheritance
When displaying date labels or slot times, if a timezone is not set, the timeline queries preceding events:

$$S_{\text{prev}} = \{ E_k \mid t_{\text{start}, E_k} \le t_{\text{target}} \}$$

If $S_{\text{prev}} \neq \emptyset$, the algorithm selects $E_{\text{closest}}$ with $\max(t_{\text{start}})$. If $S_{\text{prev}} = \emptyset$, it checks upcoming events or falls back to `defaultTimezone` / system local timezone.

---

## Component API Reference

### Props (`VerticalTimelineProps`)

| Prop Name | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `startDate` | `Date` | **Required** | Start temporal boundary of the visible timeline scope. |
| `endDate` | `Date` | **Required** | End temporal boundary of the visible timeline scope. |
| `tracks` | `Track[]` | **Required** | Array of track definitions (columns). |
| `events` | `TimelineEvent[]` | **Required** | Array of event items to render on the timeline. |
| `resolution` | `Resolution` | `1` | Number of slots per day (`1, 2, 3, 4, 6, 8, 12, 24, 48, 96`). |
| `dayHeight` | `number` | `240` | Visual height in pixels for a 24-hour day row. |
| `snapToMinutesOverride`| `number` | `undefined` | Optional drag snap override in minutes (e.g. `15`, `30`, `60`). |
| `timezone` | `string` | System Local | Primary IANA timezone identifier for rendering date/time columns and newly created events. |
| `defaultTimezone` | `string` | System Local | Fallback IANA timezone identifier when `timezone` prop is omitted. |
| `renderEvent` | `Function` | `undefined` | Custom render prop for event card content. |
| `renderTrackHeader` | `Function` | `undefined` | Custom render prop for track header labels. |
| `renderTimeSlotLabel` | `Function` | `undefined` | Custom render prop for time slot labels. |
| `onEventsUpdate` | `(payloads: DragEventPayload[]) => void` | `undefined` | Callback fired when drag/resize/push/shorten updates 1 or more events. |
| `onEventUpdate` | `(payload: DragEventPayload) => void` | `undefined` | Single-event update callback fallback. |
| `onEventCreate` | `(newEvent: TimelineEvent) => void` | `undefined` | Callback fired when a new event is created via drag-to-create on empty track space. |
| `onEventClick` | `(event: TimelineEvent) => void` | `undefined` | Callback fired when an event card is left-clicked. |
| `onEventContextMenu` | `(event: TimelineEvent, e: MouseEvent) => void` | `undefined` | Callback fired when an event card is right-clicked (contextmenu event). |
| `onSlotDoubleClick` | `(trackId, timestamp, tz) => void` | `undefined` | Callback fired when double-clicking a grid slot (returns inherited tz). |

---

## Data Models & Types

### `TimelineEvent`
```ts
interface TimelineEvent {
  id: string;
  trackId: string;
  start: {
    dateTime: Date | string; // ISO String or Date
    timezone: string;       // IANA Timezone, e.g., "America/New_York"
  };
  end: {
    dateTime: Date | string;
    timezone: string;
  };
  title?: string;
  description?: string;
  isDraggable?: boolean; // Default: true
  isResizable?: boolean; // Default: true
  data?: Record<string, unknown>; // Custom properties storage
}
```

### `Track`
```ts
interface Track {
  id: string;
  label: React.ReactNode;
  subtitle?: React.ReactNode;
  parentId?: string; // ID of parent track for hierarchy dependencies
  data?: Record<string, unknown>;
}
```

---

## Advanced Guides

### 1. Parent-Child Track Dependencies
Tracks can form hierarchy trees using `parentId`.

When a parent event $E_{\text{parent}}$ is moved or resized:
- **Move**: All child events $E_{\text{child}}$ on child tracks whose range falls strictly inside $E_{\text{parent}}$ are moved by the exact same temporal delta $\Delta T$.
- **Resize**: Enclosed child events are shifted and clamped to remain strictly inside $[t_{\text{start}}, t_{\text{end}}]$ of $E_{\text{parent}}$.

```tsx
const tracks: Track[] = [
  { id: 'track-accommodation', label: 'Accommodation' },
  { id: 'track-transport', label: 'Transport', parentId: 'track-accommodation' },
  { id: 'track-activities', label: 'Activities', parentId: 'track-accommodation' },
];
```

---

### 2. Host-Owned Event Editing
The package deliberately does not include an event editor. Use `onEventClick` to select an existing event and `onEventCreate` to receive a drag-created event, then render the editor that belongs to your application:

```tsx
const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);

<VerticalTimeline
  events={events}
  tracks={tracks}
  onEventClick={setEditingEvent}
  onEventCreate={(event) => {
    setEvents((current) => [...current, event]);
    setEditingEvent(event);
  }}
  {...timeScopeProps}
/>
```

Saving, deleting, validation, custom-property schemas, and cancel behavior are responsibilities of the host application. This keeps the calendar reusable across domains.

---

### 3. Overlap Conflict Resolution Strategies
When moving or resizing an event creates an overlap with existing events on a track, the built-in **Overlap Conflict Resolution Modal** prompts the user to select one of 3 strategies:

1. 🔵 **Do Nothing (creates an overlap)**: Leaves events at target positions; overlapping events share column width side-by-side using the sub-column sweep-line layout.
2. 🟢 **Push the Other Event(s) Away**: Shifts overlapping events (and downstream cascading events across connected parent-child tracks) in the movement direction (upward or downward) until no overlaps remain.
3. 🟡 **Shorten the Overlapped Event(s)**: Truncates the start or end boundary of overlapping events flush with the moved/resized event.

---

### 4. Host-Level Undo / Redo Implementation
The `VerticalTimeline` component is completely stateless with respect to event data. You can implement full **Undo** (`Ctrl+Z`) and **Redo** (`Ctrl+Y`) in your host application:

```tsx
function HostPlanner() {
  const [history, setHistory] = useState<TimelineEvent[][]>([INITIAL_EVENTS]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const currentEvents = history[historyIndex];

  const handleEventsUpdate = (payloads: DragEventPayload[]) => {
    let nextEvents = [...currentEvents];
    for (const p of payloads) {
      nextEvents = nextEvents.map((ev) =>
        ev.id === p.event.id
          ? { ...ev, start: p.nextStart, end: p.nextEnd, trackId: p.nextTrackId }
          : ev
      );
    }
    // Push new snapshot to history
    setHistory((prev) => [...prev.slice(0, historyIndex + 1), nextEvents]);
    setHistoryIndex((prev) => prev + 1);
  };

  const undo = () => historyIndex > 0 && setHistoryIndex((i) => i - 1);
  const redo = () => historyIndex < history.length - 1 && setHistoryIndex((i) => i + 1);

  return (
    <>
      <button onClick={undo} disabled={historyIndex === 0}>Undo</button>
      <button onClick={redo} disabled={historyIndex === history.length - 1}>Redo</button>
      <VerticalTimeline
        events={currentEvents}
        onEventsUpdate={handleEventsUpdate}
        {...otherProps}
      />
    </>
  );
}
```

---

### 5. Custom Event Rendering
Pass `renderEvent` to completely customize the visual appearance of events:

```tsx
<VerticalTimeline
  events={events}
  renderEvent={(event, meta) => (
    <div style={{ padding: 6 }}>
      <div style={{ fontWeight: 'bold' }}>{event.title}</div>
      {event.data?.address && <div>📍 {String(event.data.address)}</div>}
      {event.data?.link && (
        <a href={String(event.data.link)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
          🔗 Website
        </a>
      )}
    </div>
  )}
  {...otherProps}
/>
```

---

### 6. Theming
The component follows the host document's native `color-scheme`. Its default theme uses `light-dark()`, so no theme prop or JavaScript synchronization is required:

```css
:root {
  color-scheme: light dark;
}

:root[data-theme='light'] { color-scheme: light; }
:root[data-theme='dark'] { color-scheme: dark; }
```

Override semantic custom properties on `.vertical-timeline` or on a wrapper selected through the `className` prop. Overrides are inherited by the overlap-resolution dialog as well:

```css
.my-calendar {
  --vt-font-family: var(--app-font-family);
  --vt-color-background: var(--app-bg);
  --vt-color-surface: var(--app-surface);
  --vt-color-border: var(--app-border);
  --vt-color-text: var(--app-text);
  --vt-color-text-muted: var(--app-text-muted);
  --vt-color-accent: var(--app-accent);
  --vt-color-accent-hover: var(--app-accent-hover);
  --vt-shadow-container: var(--app-shadow);
  --vt-radius-container: var(--app-radius);
}
```

All public theme tokens:

| Category | Custom properties |
| :--- | :--- |
| Typography | `--vt-font-family` |
| Backgrounds | `--vt-color-background`, `--vt-color-surface`, `--vt-color-surface-subtle`, `--vt-color-surface-translucent` |
| Text and borders | `--vt-color-border`, `--vt-color-text`, `--vt-color-text-muted`, `--vt-color-text-soft` |
| Accent and events | `--vt-color-accent`, `--vt-color-accent-hover`, `--vt-color-accent-strong`, `--vt-color-accent-surface`, `--vt-color-accent-surface-strong`, `--vt-color-accent-border`, `--vt-color-accent-text` |
| Grid states | `--vt-color-gridline`, `--vt-color-gridline-dashed`, `--vt-color-hover`, `--vt-color-weekend`, `--vt-color-weekend-surface`, `--vt-color-weekend-label` |
| Indicators and dialogs | `--vt-color-now`, `--vt-color-on-now`, `--vt-color-warning`, `--vt-color-backdrop` |
| Shadows | `--vt-shadow-container`, `--vt-shadow-event`, `--vt-shadow-event-hover`, `--vt-shadow-dialog`, `--vt-shadow-label`, `--vt-shadow-drag`, `--vt-shadow-now`, `--vt-shadow-now-badge` |
| Shape | `--vt-radius-container`, `--vt-radius-event` |

Consumers may use `light-dark()` inside any override. The component intentionally does not set `color-scheme`; the host remains the source of truth for system preference and explicit light/dark selection.

---

### 7. Package Scope
`track-based-calendar-react` exports the `VerticalTimeline`, its calendar data types, and timezone helpers. It no longer exports `EventDialog`, dialog-specific custom-property types, or an `EventDialog` subpath. Applications upgrading from the previous API should move their editor into the host project and connect it through `onEventClick` and `onEventCreate`.

---

## License

MIT © [David Mulder](https://github.com/DavidMulder)
