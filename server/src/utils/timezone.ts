/** Minutes the zone is ahead of UTC at `instant` (e.g. Asia/Kolkata → 330). */
export const zoneOffsetMinutes = (instant: Date, timeZone: string): number => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(instant)
      .map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - instant.getTime()) / 60_000);
};

/** The UTC instant of wall-clock `date` (YYYY-MM-DD) + `time` (HH:mm) in `timeZone`. */
export const zonedToUtc = (date: string, time: string, timeZone: string): Date => {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes handle DST edges: the offset at the guess may differ from the offset at the result.
  const first = guess - zoneOffsetMinutes(new Date(guess), timeZone) * 60_000;
  return new Date(guess - zoneOffsetMinutes(new Date(first), timeZone) * 60_000);
};

/** Calendar date (YYYY-MM-DD) and weekday (0 = Sunday) of `instant` in `timeZone`. */
export const zonedDay = (instant: Date, timeZone: string): { date: string; weekday: number } => {
  const local = new Date(instant.getTime() + zoneOffsetMinutes(instant, timeZone) * 60_000);
  return { date: local.toISOString().slice(0, 10), weekday: local.getUTCDay() };
};

export const isValidTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
};
