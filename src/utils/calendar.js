const DAY = 86400000;
export function bounds(calendar, week) {
  const first =
    new Date(calendar.startDate + "T00:00:00+08:00").getTime() +
    (week - 1) * 7 * DAY;
  return {
    min: new Date(first),
    max: new Date(Math.min(first + 7 * DAY - 1, Date.now())),
    initial: new Date(Math.min(first + 9 * 3600000, Date.now())),
  };
}
export function formatActivity(date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}
export function validSchedule(value, calendar, week) {
  if (!value) return false;
  const b = bounds(calendar, week),
    time = new Date(
      value.replace(/\//g, "-").replace(" ", "T") + "+08:00",
    ).getTime();
  return (
    Number.isFinite(time) && time >= b.min.getTime() && time <= b.max.getTime()
  );
}
