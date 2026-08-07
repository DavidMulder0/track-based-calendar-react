Technical Specification: Advanced Vertical Timeline Component1. Overview & ArchitectureThe <VerticalTimeline/> component is a virtualized, time-zone aware React component designed to render dynamic temporal events across vertically continuous tracks.+-------------------+--------------------+--------------------+
| Time Axis (UTC-5) | Track A            | Track B            |
+-------------------+--------------------+--------------------+
| 00:00 - Jun 01    | [ Event 1 ]        |                    |
| 08:00 (Slot 1)    |                    | [ Event 3 ]        |
| 16:00 (Slot 2)    | [ Event 2 (Over-   | [ (Continuation)   |
| 00:00 - Jun 02    |   lapping) ]       |   Event 3 ]        |
+-------------------+--------------------+--------------------+
Core Architectural PrinciplesResolution-Driven Snapping: Drag-and-drop operations (moving and edge-resizing) snap to grid intervals matching the configured daily resolution $R$ by default. Fine-grained, sub-resolution timestamps are supported when edited directly via dialogs.Decoupled Scale & Resolution: Visual vertical space is governed by an independent dayHeight parameter ($H_{day}$), allowing zoom and grid subdivision ($R$) to be modified independently without distorting overall date geometry.Timezone Context & Dynamic Inheritance: Events store explicit timezone designations. Newly created or edited events automatically inherit the timezone of the chronologically closest preceding event.2. Component API & TypeScript Interfacesimport { ReactNode } from 'react';

/** Slots per 24-hour day cycle */
export type Resolution = 1 | 2 | 3 | 4 | 6 | 8 | 12 | 24 | 48 | 96;

export interface TimezoneBound {
  dateTime: Date | string; // ISO string or Date instance
  timezone: string;       // IANA timezone identifier, e.g. "America/New_York"
}

export interface TimelineEvent {
  id: string;
  trackId: string;
  
  /** Start temporal anchor with timezone metadata */
  start: TimezoneBound;
  
  /** End temporal anchor with timezone metadata */
  end: TimezoneBound;
  
  title?: string;
  description?: string;
  isDraggable?: boolean;
  isResizable?: boolean;
  data?: Record<string, unknown>;
}

export interface Track {
  id: string;
  label: ReactNode;
  subtitle?: ReactNode;
  data?: Record<string, unknown>;
}

export interface DragEventPayload {
  event: TimelineEvent;
  nextStart: TimezoneBound;
  nextEnd: TimezoneBound;
  nextTrackId: string;
}

export interface VerticalTimelineProps {
  // Core Time Scope
  startDate: Date;
  endDate: Date;
  tracks: Track[];
  events: TimelineEvent[];
  
  /**
   * Number of visual grid divisions per 24-hour day.
   * DnD interaction snaps to (24 / resolution) hours by default.
   * Default: 1 (1 slot = 24 hours)
   */
  resolution?: Resolution;

  /**
   * Visual height in pixels allocated for a full 24-hour day row.
   * Completely independent of grid resolution.
   * Default: 240px
   */
  dayHeight?: number;

  /**
   * Optional override for drag-and-drop snap interval in minutes.
   * If omitted, DnD snaps directly to resolution slot intervals.
   */
  snapToMinutesOverride?: number;

  /** Fallback timezone when no preceding event exists. Default: system local */
  defaultTimezone?: string;

  // Render Prop Overrides
  renderEvent?: (event: TimelineEvent, meta: { isDragging: boolean; widthPct: number; leftPct: number }) => ReactNode;
  renderTrackHeader?: (track: Track) => ReactNode;
  renderTimeSlotLabel?: (slotTime: Date, timezone: string) => ReactNode;

  // Event Handlers
  onEventUpdate?: (payload: DragEventPayload) => void;
  onEventClick?: (event: TimelineEvent) => void;
  onSlotDoubleClick?: (trackId: string, timestamp: Date, inheritedTimezone: string) => void;

  className?: string;
}
3. Temporal Math & Decoupled Visual MetricsThe visual layout engine strictly separates resolution $R$ (logical subdivisions) from row scale $H_{day}$ (pixel height per day).Coordinate Mapping Formulas$R$: Resolution (slots per day).$H_{day}$: Vertical height in pixels representing 24 hours ($86,400,000 \text{ ms}$).$T_{slot}$: Duration of a single resolution slot in milliseconds:$$T_{slot} = \frac{86,400,000 \text{ ms}}{R}$$$H_{slot}$: Height in pixels of a single resolution slot grid cell:$$H_{slot} = \frac{H_{day}}{R}$$$P$: Global pixel-to-time conversion scale factor ($\text{pixels / ms}$):$$P = \frac{H_{day}}{86,400,000 \text{ ms}}$$Event Position CalculationsFor an event $E_i$ starting at epoch timestamp $t_{start}$ and ending at $t_{end}$ relative to timeline boundary $t_{origin}$:$$\text{Top}_{E_i} = (t_{start} - t_{origin}) \times P$$$$\text{Height}_{E_i} = (t_{end} - t_{start}) \times P$$Key Advantage: Modifying $R$ changes grid line density and drag-snap steps without causing layout reflows or changing the absolute $Y$-position of existing events.4. Timezone Engine & Inheritance RulesEach event start and end boundary carries an IANA timezone string (e.g., "Europe/Prague", "America/Los_Angeles").Timeline Axis
  │
  ├── 08:00 EDT  [ Event A ] ( America/New_York )
  │
  ├── 12:00 EDT  [ New Quick Event ]  <-- Inherits "America/New_York" from Event A
  │
  └── 18:00 CET  [ Event B ] ( Europe/Prague )
Preceding Event Timezone Inheritance AlgorithmWhen a new event is added (e.g., via track double-click) or when an event timezone is unassigned, determine its timezone using the following steps:Collect Temporal References: Convert all existing event start timestamps into absolute UTC epoch milliseconds ($t_{epoch}$).Filter Preceding Events: Given a target creation timestamp $t_{target}$:$$S_{prev} = \{ E_k \in \text{Events} \mid t_{start, E_k} \le t_{target} \}$$Select Nearest Neighbor:If $S_{prev} \neq \emptyset$, select $E_{closest} = \arg\max_{E_k \in S_{prev}} (t_{start, E_k})$.Primary inheritance: inheritedTz = E_closest.start.timezone.Fallback Handling:If $S_{prev} = \emptyset$, search for the nearest upcoming event ($t_{start} > t_{target}$).If no events exist in the timeline, fall back to props.defaultTimezone or Intl.DateTimeFormat().resolvedOptions().timeZone.5. Drag-and-Drop (DnD) Mechanics & Resolution SnappingWhile event dialogs allow manual text input of exact seconds and minutes, interactive pointer manipulation (drag-to-move, edge-resize) snaps strictly to slot intervals derived from $R$.Resolution Snap CalculationDetermine Active Snap Interval ($T_{snap}$):$$T_{snap} = \begin{cases} \text{snapToMinutesOverride} \times 60,000 \text{ ms} & \text{if override provided} \\ T_{slot} = \frac{86,400,000 \text{ ms}}{R} & \text{default} \end{cases}$$Pointer Movement Delta Processing:Track pointer move relative to interaction origin: $\Delta Y_{px} = Y_{current} - Y_{initial}$.Convert pixel offset to raw temporal delta:$$\Delta T_{raw} = \frac{\Delta Y_{px}}{P}$$Quantize temporal offset to nearest resolution boundary:$$\Delta T_{snapped} = \text{Round}\left( \frac{\Delta T_{raw}}{T_{snap}} \right) \times T_{snap}$$Applying Delta by Action Type:Move Action:$$t_{next\_start} = t_{initial\_start} + \Delta T_{snapped}$$$$t_{next\_end} = t_{initial\_end} + \Delta T_{snapped}$$Resize Top Action:$$t_{next\_start} = \min(t_{initial\_start} + \Delta T_{snapped}, t_{initial\_end} - T_{snap})$$Resize Bottom Action:$$t_{next\_end} = \max(t_{initial\_end} + \Delta T_{snapped}, t_{initial\_start} + T_{snap})$$6. Overlap Resolution Algorithm (Sub-Column Layout)Overlapping events within a single track share column width using a dynamic sweep-line layout algorithm:Sort: Order events chronologically by UTC start time ascending, then by duration descending.Cluster Grouping: Group overlapping events where $t_{start, E_{j}} < t_{end, E_{i}}$.Sub-Column Assignment: Assign each event in a cluster to the lowest available sub-column index where no temporal overlap occurs.Visual Positioning:$$\text{Width}_{\%} = \frac{100\%}{N_{sub\_cols}}$$$$\text{Left}_{\%} = \text{SubColumnIndex} \times \text{Width}_{\%}$$7. Edge Cases & Defensive ConstraintsDialog vs. Drag Precision Alignment:If an event possesses an exact timestamp non-aligned with $R$ (e.g., 14:23:15 when $R=3$), dragging the event maintains relative duration and snaps the anchor edge to the nearest resolution grid offset.Timezone Offset Changes (DST Transitions):Temporal offset calculations convert dates to epoch milliseconds for rendering positions, while displaying time labels formatted in the target timezone using Intl.DateTimeFormat.Minimum Rendered Height:To keep short-duration events accessible on low resolution views, enforce a minimum visual height: $\text{RenderHeight} = \max(\text{Height}_{E_i}, 20\text{px})$.