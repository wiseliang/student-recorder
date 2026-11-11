const expiredCodes = new Set([
  "SNAPSHOT_EXPIRED",
  "SNAPSHOT_NOT_FOUND",
  "ACADEMIC_SNAPSHOT_EXPIRED",
  "ACADEMIC_SNAPSHOT_NOT_FOUND",
  "PLAN_EXPIRED",
  "ACADEMIC_RULES_UPDATED",
  "SCHOOL_ACCOUNT_CHANGED",
  "SCHOOL_OPTIONS_CHANGED",
]);
export function needsRosterReload(error) {
  return expiredCodes.has(error?.code);
}
export function snapshotIsExpired(snapshot, now = Date.now()) {
  return (
    !!snapshot?.expired ||
    (!!snapshot?.expiresAt &&
      Number.isFinite(Date.parse(snapshot.expiresAt)) &&
      Date.parse(snapshot.expiresAt) <= now)
  );
}
export function refreshWeeks(weeks, calendar, entry) {
  const valid = (weeks || []).filter(
    (w) => Number.isInteger(w) && w >= 1 && w <= calendar?.week,
  );
  return valid.length
    ? [...new Set(valid)].sort((a, b) => a - b)
    : entry === "automatic"
      ? Array.from({ length: calendar?.week || 0 }, (_, i) => i + 1)
      : calendar?.week
        ? [calendar.week]
        : [];
}
