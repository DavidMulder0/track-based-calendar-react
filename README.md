# VerticalTimeline React Component

A modern, high-performance, and feature-rich React vertical timeline component built for multi-track scheduling, trip planning, resource allocation, and project management applications.

Features include:
- **Weekend Day Row Highlighting**: Automatically identifies Saturday and Sunday rows (aware of active event timezones) and renders a subtle, lighter background row highlight across the entire grid and date column.
- **Real-Time "Now" Indicator Line**: Displays a glowing yellow dotted horizontal line (`NOW` badge) across the tracks if and only if the current moment falls within the visible timeline range.
- **Interactive Drag-to-Create**: Press and drag on empty track space to define an event's start time, duration, and track with a real-time visual ghost preview (`+ New Event`).
- **Native HTML `<dialog>` Modals**: Built using native HTML `<dialog>` elements and Top Layer API, preventing modals from clipping or being hidden outside scrolling viewports.
- **Responsive Compact & Single-Slot Layouts**: Automatic layout adjustments when row height is $\le 30\text{px}$ (inline weekday/date labels) or when `resolution={1}` (hides time sub-column).
- **Dual-Column Time Axis Layout**: Vertically merged day blocks combined with configurable resolution time slots.
- **Precision Temporal Scaling**: Independent scaling of day height ($H_{day}$) and grid resolution ($R$).
- **Preceding Event Timezone Inheritance**: Automatic timezone propagation across timeline boundaries using `Intl.supportedValuesOf('timeZone')`.
- **Chronological Sub-Column Overlap Layout**: Dynamic sweep-line layout for simultaneous overlapping events.
- **Parent-Child Track Interactivity**: Synchronized real-time move and clamped bounds resizing of enclosed child events.
- **Interactive Overlap Conflict Resolution**: Built-in modal presenting 3 strategies (*Do Nothing*, *Push Away with multi-track cascading*, *Shorten Overlapped Event(s)*).
- **Track-Scoped Custom Property Schemas**: Full event editor dialog supporting `string`, `number`, `enum`, `currency` (with per-event currency symbols), `boolean`, and `link` field types scoped per track (`trackIds`).
- **Modular CSS & Subpath Exports**: Support for standalone `EventDialog` imports (`track-based-calendar-react/EventDialog`) and automated CSS code-splitting.
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
  - [2. Track-Scoped Custom Property Fields](#2-track-scoped-custom-property-fields)
  - [3. Overlap Conflict Resolution Strategies](#3-overlap-conflict-resolution-strategies)
  - [4. Host-Level Undo / Redo Implementation](#4-host-level-undo--redo-implementation)
  - [5. Custom Event Rendering](#5-custom-event-rendering)
  - [6. Standalone EventDialog Usage](#6-standalone-eventdialog-usage)

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
  CustomPropertyField,
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

const CUSTOM_FIELDS: CustomPropertyField[] = [
  {
    key: 'cost',
    label: 'Cost',
    type: 'currency',
    defaultValue: { amount: 0, currencySymbol: '$' },
  },
  {
    key: 'hasBeenBooked',
    label: 'Has been booked',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'startAddress',
    label: 'Start Address',
    type: 'string',
    trackIds: ['track-transport'],
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
        customPropertyFields={CUSTOM_FIELDS}
        onEventsUpdate={handleEventsUpdate}
        onEventCreate={(newEvent) => {
          setEvents((prev) => [...prev, newEvent]);
        }}
        onEventSave={(savedEvent) => {
          setEvents((prev) =>
            prev.map((e) => (e.id === savedEvent.id ? savedEvent : e))
          );
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
| `customPropertyFields` | `CustomPropertyField[]` | `[]` | Schema definitions for custom properties in the built-in event dialog. |
| `enableEventDialog` | `boolean` | `true` | Enables opening the built-in event detail modal when clicking an event. |
| `renderEvent` | `Function` | `undefined` | Custom render prop for event card content. |
| `renderTrackHeader` | `Function` | `undefined` | Custom render prop for track header labels. |
| `renderTimeSlotLabel` | `Function` | `undefined` | Custom render prop for time slot labels. |
| `onEventsUpdate` | `(payloads: DragEventPayload[]) => void` | `undefined` | Callback fired when drag/resize/push/shorten updates 1 or more events. |
| `onEventUpdate` | `(payload: DragEventPayload) => void` | `undefined` | Single-event update callback fallback. |
| `onEventCreate` | `(newEvent: TimelineEvent) => void` | `undefined` | Callback fired when a new event is created via drag-to-create on empty track space. |
| `onEventSave` | `(updatedEvent: TimelineEvent) => void` | `undefined` | Callback fired when an event is saved via the built-in dialog. |
| `onEventDelete` | `(eventId: string) => void` | `undefined` | Callback fired when an event is deleted via the built-in dialog. |
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

### `CustomPropertyField`
```ts
type CustomPropertyType =
  | 'string'
  | 'enum'
  | 'number'
  | 'currency'
  | 'boolean'
  | 'link';

interface CustomCurrencyValue {
  amount: number;
  currencySymbol: string; // Per-event currency symbol, e.g. "$", "€", "£", "¥"
}

interface CustomPropertyField {
  key: string;
  label: string;
  type: CustomPropertyType;
  options?: string[]; // Options array for 'enum' combobox
  trackIds?: string[]; // Optional array of track IDs this field applies to
  defaultValue?: string | number | boolean | CustomCurrencyValue;
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

### 2. Track-Scoped Custom Property Fields
Use `trackIds` on `CustomPropertyField` definitions to scope fields to specific tracks:

```tsx
const customFields: CustomPropertyField[] = [
  // Available on ALL tracks
  { key: 'cost', label: 'Cost', type: 'currency' },
  { key: 'link', label: 'External Website', type: 'link' },
  { key: 'hasBeenBooked', label: 'Has been booked', type: 'boolean' },

  // Available ONLY on Accommodation and Activities tracks
  {
    key: 'address',
    label: 'Address',
    type: 'string',
    trackIds: ['track-accommodation', 'track-activities'],
  },

  // Available ONLY on Transport track
  {
    key: 'startAddress',
    label: 'Start Address',
    type: 'string',
    trackIds: ['track-transport'],
  },
  {
    key: 'transportType',
    label: 'Transport Mode',
    type: 'enum',
    options: ['plane', 'bus', 'car', 'taxi', 'boat', 'mixed'],
    trackIds: ['track-transport'],
  },
];
```

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

### 6. Standalone EventDialog Usage
The `EventDialog` component can be imported and rendered standalone independently of the full timeline:

```tsx
import React, { useState } from 'react';
import { EventDialog } from 'track-based-calendar-react/EventDialog';
import { TimelineEvent, Track } from 'track-based-calendar-react';

export function StandaloneDialogExample({ activeEvent, tracks }: { activeEvent: TimelineEvent; tracks: Track[] }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <EventDialog
      isOpen={isOpen}
      event={activeEvent}
      tracks={tracks}
      minDate={new Date('2026-06-01T00:00:00.000Z')}
      maxDate={new Date('2026-06-03T00:00:00.000Z')}
      onClose={() => setIsOpen(false)}
      onSave={(updatedEvent) => {
        console.log('Saved event:', updatedEvent);
        setIsOpen(false);
      }}
      onDelete={(eventId) => {
        console.log('Deleted event:', eventId);
        setIsOpen(false);
      }}
    />
  );
}
```

---

## License

MIT © [David Mulder](https://github.com/DavidMulder)
