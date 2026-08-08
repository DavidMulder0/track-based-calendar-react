import { ReactNode, MouseEvent } from 'react';

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
  
  /** Track type: 'accommodation', 'transport', or 'custom' */
  type?: 'accommodation' | 'transport' | 'custom' | string;

  /** ID of parent track if this track is a child track */
  parentId?: string;
  
  data?: Record<string, unknown>;
}

export interface DragEventPayload {
  event: TimelineEvent;
  nextStart: TimezoneBound;
  nextEnd: TimezoneBound;
  nextTrackId: string;
}

export type CustomPropertyType =
  | 'string'
  | 'enum'
  | 'number'
  | 'currency'
  | 'boolean'
  | 'link';

export interface CustomCurrencyValue {
  amount: number;
  currencySymbol: string;
}

export interface CustomPropertyField {
  key: string;
  label: string;
  type: CustomPropertyType;
  options?: string[]; // Options for 'enum' combobox
  
  /** Optional array of track IDs this field applies to. If omitted, applies to all tracks. */
  trackIds?: string[];
  
  defaultValue?: string | number | boolean | CustomCurrencyValue;
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

  /** Primary timezone for rendering the date/time axis and newly created events. */
  timezone?: string;

  /** Fallback timezone when timezone prop is omitted. Default: system local */
  defaultTimezone?: string;

  /** Schema definitions for custom event properties */
  customPropertyFields?: CustomPropertyField[];

  /** Enable opening built-in event editor dialog on click. Default: true */
  enableEventDialog?: boolean;

  // Render Prop Overrides
  renderEvent?: (
    event: TimelineEvent,
    meta: { isDragging: boolean; widthPct: number; leftPct: number }
  ) => ReactNode;
  renderTrackHeader?: (track: Track) => ReactNode;
  renderTimeSlotLabel?: (slotTime: Date, timezone: string) => ReactNode;

  // Event Handlers
  onEventUpdate?: (payload: DragEventPayload) => void;
  onEventsUpdate?: (payloads: DragEventPayload[]) => void;
  onEventSave?: (updatedEvent: TimelineEvent) => void;
  onEventDelete?: (eventId: string) => void;
  onEventClick?: (event: TimelineEvent) => void;
  /** Called when an event is right-clicked (contextmenu event). */
  onEventContextMenu?: (
    event: TimelineEvent,
    e: MouseEvent<HTMLDivElement>
  ) => void;
  /** Called when a new event is created via drag-to-create on empty track space. */
  onEventCreate?: (newEvent: TimelineEvent) => void;
  onSlotDoubleClick?: (
    trackId: string,
    timestamp: Date,
    inheritedTimezone: string
  ) => void;

  className?: string;
}
