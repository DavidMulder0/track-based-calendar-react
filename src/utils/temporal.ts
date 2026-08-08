import { TimelineEvent, TimezoneBound, Resolution } from "../types";

export const MS_PER_DAY = 86_400_000;

export function getTimezoneOffsetMs(date: Date, timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const partMap: Record<string, string> = {};
    for (const p of parts) {
      if (p.type !== 'literal') {
        partMap[p.type] = p.value;
      }
    }
    const y = Number(partMap.year);
    const m = Number(partMap.month) - 1;
    const d = Number(partMap.day);
    let hh = Number(partMap.hour);
    if (hh === 24) hh = 0;
    const mm = Number(partMap.minute);
    const ss = Number(partMap.second);

    const asUtc = Date.UTC(y, m, d, hh, mm, ss);
    return asUtc - date.getTime();
  } catch {
    return 0;
  }
}

export function parseLocalISOInTimezone(isoStr: string, timezone: string): number {
  try {
    const match = isoStr.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!match) return new Date(isoStr).getTime();

    const [, y, m, d, hh = '00', mm = '00', ss = '00'] = match;
    const year = Number(y);
    const month = Number(m) - 1;
    const day = Number(d);
    const hours = Number(hh);
    const mins = Number(mm);
    const secs = Number(ss);

    const utcGuess = Date.UTC(year, month, day, hours, mins, secs);
    const offsetMs = getTimezoneOffsetMs(new Date(utcGuess), timezone);
    return utcGuess - offsetMs;
  } catch {
    return new Date(isoStr).getTime();
  }
}

export function formatISOInTimezone(
  epochMs: number,
  timezone: string
): string {
  try {
    const d = new Date(epochMs);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
      hour12: false,
    });
    const parts = formatter.formatToParts(d);
    const partMap: Record<string, string> = {};
    for (const p of parts) {
      if (p.type !== 'literal') partMap[p.type] = p.value;
    }
    let hh = Number(partMap.hour);
    if (hh === 24) hh = 0;
    const hhStr = String(hh).padStart(2, '0');
    const msStr = partMap.fractionalSecond ? `.${partMap.fractionalSecond}` : '';
    return `${partMap.year}-${partMap.month}-${partMap.day}T${hhStr}:${partMap.minute}:${partMap.second}${msStr}`;
  } catch {
    return new Date(epochMs).toISOString();
  }
}

export function getMidnightEpochInTimezone(
  dateTime: Date | string | undefined | null,
  timezone: string
): number {
  if (!dateTime) return Date.now();
  try {
    const d = dateTime instanceof Date ? dateTime : new Date(dateTime);
    if (isNaN(d.getTime())) return Date.now();

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(d);
    const partMap: Record<string, string> = {};
    for (const p of parts) {
      if (p.type !== 'literal') partMap[p.type] = p.value;
    }
    const isoDateStr = `${partMap.year}-${partMap.month}-${partMap.day}T00:00:00`;
    return parseLocalISOInTimezone(isoDateStr, timezone);
  } catch {
    return new Date(dateTime as string).getTime();
  }
}

export function toEpochMs(
  dateTime: Date | string | TimezoneBound | undefined | null,
  timezoneFallback?: string
): number {
  if (!dateTime) return NaN;
  if (dateTime instanceof Date) {
    return dateTime.getTime();
  }
  if (typeof dateTime === 'object' && 'dateTime' in dateTime) {
    const tz = dateTime.timezone || timezoneFallback;
    return toEpochMs(dateTime.dateTime, tz);
  }
  if (typeof dateTime === 'string') {
    if (timezoneFallback) {
      const cleanIso = dateTime.replace(/Z$|[+-]\d{2}:\d{2}$/, '');
      const epoch = parseLocalISOInTimezone(cleanIso, timezoneFallback);
      if (!isNaN(epoch)) return epoch;
    }
    return new Date(dateTime).getTime();
  }
  return new Date(dateTime as string).getTime();
}

export function getSystemTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function getSupportedTimezones(): string[] {
  try {
    if (
      typeof Intl !== "undefined" &&
      typeof Intl.supportedValuesOf === "function"
    ) {
      return Intl.supportedValuesOf("timeZone");
    }
  } catch {
    // Fallback if supportedValuesOf is unavailable
  }
  return [
    "UTC",
    "America/New_York",
    "America/Los_Angeles",
    "America/Chicago",
    "Europe/London",
    "Europe/Prague",
    "Europe/Paris",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Australia/Sydney",
  ];
}

export function currencyAsSymbol(c: string) {
  try {
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: c,
      currencyDisplay: 'symbol'
    });
  
    return (
      formatter.formatToParts(0).find((part) => part.type === "currency")
        ?.value || c
    );
  } catch {
    return c;
  }
}

export function getSupportedCurrencies(): string[] {
  const commonSymbols = [] as string[];
  let intlCurrencies: string[] = [];
  try {
    if (
      typeof Intl !== "undefined" &&
      typeof Intl.supportedValuesOf === "function"
    ) {
      intlCurrencies = Intl.supportedValuesOf("currency");
    }
  } catch {
    intlCurrencies = [
      "USD",
      "EUR",
      "GBP",
      "JPY",
      "CAD",
      "AUD",
      "CHF",
      "CNY",
      "INR",
    ];
  }
  // Unique list with common symbols first
  const set = new Set([...commonSymbols, ...intlCurrencies]);
  return Array.from(set);
}

/**
 * Preceding Event Timezone Inheritance Algorithm
 * 1. Convert all existing event start timestamps into absolute UTC epoch ms.
 * 2. Filter preceding events: S_prev = { E_k | t_start <= t_target }
 * 3. Select E_closest = argmax_{S_prev} (t_start). Return E_closest.start.timezone.
 * 4. Fallback: If S_prev empty, find nearest upcoming event (t_start > t_target).
 * 5. Fallback: If no events, fall back to defaultTimezone or system timezone.
 */
export function getPrecedingTimezone(
  events: TimelineEvent[],
  targetTime: Date | string | number,
  defaultTimezone?: string,
): string {
  const targetMs =
    typeof targetTime === "number" ? targetTime : toEpochMs(targetTime);

  const eventStartMap = events
    .map((e) => ({
      event: e,
      startMs: toEpochMs(e.start.dateTime),
    }))
    .filter((item) => !isNaN(item.startMs));

  // Step 2 & 3: Preceding events
  const preceding = eventStartMap.filter((item) => item.startMs <= targetMs);

  if (preceding.length > 0) {
    preceding.sort((a, b) => b.startMs - a.startMs);
    const closest = preceding[0];
    if (closest.event.start.timezone) {
      return closest.event.start.timezone;
    }
  }

  // Step 4: Nearest upcoming event
  const upcoming = eventStartMap.filter((item) => item.startMs > targetMs);

  if (upcoming.length > 0) {
    upcoming.sort((a, b) => a.startMs - b.startMs);
    const nearestUpcoming = upcoming[0];
    if (nearestUpcoming.event.start.timezone) {
      return nearestUpcoming.event.start.timezone;
    }
  }

  // Step 5: Default timezone fallback
  return defaultTimezone || getSystemTimezone();
}

export function calculateSlotDurationMs(resolution: Resolution): number {
  return MS_PER_DAY / resolution;
}

export function calculateSlotHeightPx(
  dayHeight: number,
  resolution: Resolution,
): number {
  return dayHeight / resolution;
}

export function calculateScaleFactor(dayHeight: number): number {
  return dayHeight / MS_PER_DAY;
}

export function formatDateLabelParts(
  date: Date,
  timezone: string,
): { weekday: string; dateStr: string } {
  try {
    const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
    });
    const dateFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      month: "short",
      day: "numeric",
    });
    return {
      weekday: weekdayFormatter.format(date),
      dateStr: dateFormatter.format(date),
    };
  } catch {
    return {
      weekday: date.toISOString().slice(0, 3),
      dateStr: date.toISOString().slice(5, 10),
    };
  }
}

export function formatDateLabel(date: Date, timezone: string): string {
  const parts = formatDateLabelParts(date, timezone);
  return `${parts.weekday} ${parts.dateStr}`;
}

export function formatTimeOnlyLabel(date: Date, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return formatter.format(date);
  } catch {
    return date.toISOString().slice(11, 16);
  }
}

export function formatSlotLabel(slotTime: Date, timezone: string): string {
  return `${formatDateLabel(slotTime, timezone)} ${formatTimeOnlyLabel(slotTime, timezone)}`;
}

export function isWeekendDay(date: Date, timezone: string): boolean {
  try {
    const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
    });
    const dayStr = weekdayFormatter.format(date);
    return dayStr === "Sat" || dayStr === "Sun";
  } catch {
    const day = date.getDay();
    return day === 0 || day === 6;
  }
}
