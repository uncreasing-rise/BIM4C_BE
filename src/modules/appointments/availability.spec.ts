import { generateSlots, isValidTimeZone, zonedTime } from './availability';

const TZ = 'Asia/Ho_Chi_Minh'; // UTC+7, no DST
// 2026-10-05 is a Monday.
const monday = (hours: number, minutes = 0) =>
  new Date(Date.UTC(2026, 9, 5, hours - 7, minutes));
const rule = {
  weekday: 1,
  startTime: '09:00',
  endTime: '10:00',
  durationMinutes: 30,
  bufferMinutes: 0,
};
const base = {
  rules: [rule],
  exceptions: [],
  booked: [],
  from: new Date('2026-10-04T17:00:00.000Z'), // Monday 00:00 in Vietnam
  to: new Date('2026-10-05T17:00:00.000Z'), // Tuesday 00:00 in Vietnam
  now: new Date('2026-10-01T00:00:00.000Z'),
  timeZone: TZ,
};

describe('generateSlots', () => {
  it('generates wall-clock slots in the business timezone, not the server timezone', () => {
    expect(generateSlots(base).map((slot) => slot.startAt)).toEqual([
      monday(9).toISOString(), // 02:00Z
      monday(9, 30).toISOString(),
    ]);
  });

  it('applies the buffer between slots', () => {
    const slots = generateSlots({
      ...base,
      rules: [{ ...rule, endTime: '11:00', bufferMinutes: 10 }],
    });
    expect(slots.map((slot) => slot.startAt)).toEqual([
      monday(9).toISOString(),
      monday(9, 40).toISOString(),
      monday(10, 20).toISOString(),
    ]);
  });

  it('skips booked and past slots', () => {
    const booked = [{ startAt: monday(9), endAt: monday(9, 30) }];
    expect(generateSlots({ ...base, booked })).toHaveLength(1);
    expect(generateSlots({ ...base, now: monday(9, 10) })).toHaveLength(1);
  });

  it('honours a closed-day exception', () => {
    const exceptions = [
      {
        date: new Date('2026-10-05T00:00:00.000Z'),
        isAvailable: false,
        startTime: null,
        endTime: null,
      },
    ];
    expect(generateSlots({ ...base, exceptions })).toEqual([]);
  });

  it('uses exception hours on an otherwise closed day', () => {
    const exceptions = [
      {
        date: new Date('2026-10-05T00:00:00.000Z'),
        isAvailable: true,
        startTime: '14:00',
        endTime: '14:30',
      },
    ];
    expect(
      generateSlots({ ...base, rules: [], exceptions }).map((s) => s.startAt),
    ).toEqual([monday(14).toISOString()]);
  });

  it('ignores malformed rule times instead of looping', () => {
    expect(
      generateSlots({ ...base, rules: [{ ...rule, startTime: 'ab' }] }),
    ).toEqual([]);
  });
});

describe('timezone helpers', () => {
  it('converts wall-clock time across a DST change', () => {
    // 2026-03-09 (after US DST start): 09:00 in New York is 13:00Z.
    expect(
      zonedTime(Date.UTC(2026, 2, 9), 9 * 60, 'America/New_York').toISOString(),
    ).toBe('2026-03-09T13:00:00.000Z');
  });

  it('validates IANA names', () => {
    expect(isValidTimeZone('Asia/Ho_Chi_Minh')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});
