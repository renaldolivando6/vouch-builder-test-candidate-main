// Shift assignment.
//
// A night shift runs ~23:00–07:00, so one shift spans two calendar dates.
// We identify a shift by its "night-of" date (the evening it started).
//   - 23:00–23:59  -> shift is that same date        (D)
//   - 00:00–06:59  -> shift started the evening before (D-1)
//   - 07:00–22:59  -> daytime; folded into the night that begins that evening (D)
//
// We read the wall-clock hour straight from the ISO string rather than via
// `new Date()`, so the hotel's local time (offset already in the string) is
// used and we avoid UTC rollover bugs.

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):/;

function addDays(dateStr, delta) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, 12)); // noon UTC avoids DST/rollover edge cases
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

// Returns the "night-of" date, e.g. "2026-05-29", or null if unparseable.
export function shiftIdFromTimestamp(ts) {
  const m = typeof ts === 'string' && ts.match(ISO_RE);
  if (!m) return null;
  const [, y, mo, d, h] = m;
  const date = `${y}-${mo}-${d}`;
  return Number(h) < 7 ? addDays(date, -1) : date;
}

// Human label for a shift, e.g. "night of 2026-05-29 → 2026-05-30".
export function shiftLabel(shiftId) {
  if (!shiftId) return 'unknown shift';
  return `night of ${shiftId} → ${addDays(shiftId, 1)}`;
}

// The morning a shift hands over to (the day after the night-of date).
export function morningAfter(shiftId) {
  return shiftId ? addDays(shiftId, 1) : null;
}
