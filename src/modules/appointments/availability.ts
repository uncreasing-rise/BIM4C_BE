/**
 * Timezone-aware consultation slot generation.
 *
 * Availability rules are wall-clock times ("09:00"–"17:00") in the business
 * timezone. Generating them with Date#setHours would use the *server* timezone
 * (UTC on Vercel) and shift every slot by the UTC offset, so all calendar math
 * here is done explicitly in `timeZone`.
 */

export interface SlotRule {
  weekday: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  bufferMinutes: number;
}

export interface SlotException {
  /** Calendar date (the DB column is DATE, so Prisma returns UTC midnight). */
  date: Date;
  isAvailable: boolean;
  startTime: string | null;
  endTime: string | null;
}

export interface BookedRange {
  startAt: Date;
  endAt: Date;
}

export interface Slot {
  startAt: string;
  endAt: string;
  timezone: string;
}

export interface SlotInput {
  rules: SlotRule[];
  exceptions: SlotException[];
  booked: BookedRange[];
  from: Date;
  to: Date;
  now: Date;
  timeZone: string;
}

const DAY_MS = 86_400_000;
const EXCEPTION_DURATION_MINUTES = 30;
const EXCEPTION_BUFFER_MINUTES = 10;

export const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

export function timeToMinutes(value: string): number {
  if (!TIME_OF_DAY.test(value)) return Number.NaN;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function zoneOffset(instant: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(instant))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>;
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - (instant - (instant % 1000));
}

/** UTC instant of a wall-clock time on a calendar day in `timeZone`. */
export function zonedTime(
  day: number,
  minutes: number,
  timeZone: string,
): Date {
  const wallClock = day + minutes * 60_000;
  const firstGuess = wallClock - zoneOffset(wallClock, timeZone);
  // A second pass corrects guesses that land on the other side of a DST change.
  return new Date(wallClock - zoneOffset(firstGuess, timeZone));
}

/** Calendar day (as a UTC-midnight timestamp) of an instant in `timeZone`. */
export function zonedDay(instant: Date, timeZone: string): number {
  const local = instant.getTime() + zoneOffset(instant.getTime(), timeZone);
  return local - (((local % DAY_MS) + DAY_MS) % DAY_MS);
}

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function generateSlots(input: SlotInput): Slot[] {
  const { rules, booked, from, to, now, timeZone } = input;
  const exceptions = new Map(
    input.exceptions.map((item) => [
      item.date.toISOString().slice(0, 10),
      item,
    ]),
  );
  const slots: Slot[] = [];
  const lastDay = zonedDay(to, timeZone);
  for (let day = zonedDay(from, timeZone); day <= lastDay; day += DAY_MS) {
    const weekday = new Date(day).getUTCDay();
    const exception = exceptions.get(new Date(day).toISOString().slice(0, 10));
    const dayRules: SlotRule[] = exception
      ? exception.isAvailable && exception.startTime && exception.endTime
        ? [
            {
              weekday,
              startTime: exception.startTime,
              endTime: exception.endTime,
              durationMinutes: EXCEPTION_DURATION_MINUTES,
              bufferMinutes: EXCEPTION_BUFFER_MINUTES,
            },
          ]
        : []
      : rules.filter((rule) => rule.weekday === weekday);

    for (const rule of dayRules) {
      const first = timeToMinutes(rule.startTime);
      const last = timeToMinutes(rule.endTime);
      const step = rule.durationMinutes + rule.bufferMinutes;
      if (!Number.isFinite(first) || !Number.isFinite(last) || step <= 0)
        continue;
      for (
        let minute = first;
        minute + rule.durationMinutes <= last;
        minute += step
      ) {
        const start = zonedTime(day, minute, timeZone);
        const finish = new Date(start.getTime() + rule.durationMinutes * 60_000);
        if (start <= now || start < from || finish > to) continue;
        if (booked.some((item) => item.startAt < finish && item.endAt > start))
          continue;
        slots.push({
          startAt: start.toISOString(),
          endAt: finish.toISOString(),
          timezone: timeZone,
        });
      }
    }
  }
  return slots;
}
