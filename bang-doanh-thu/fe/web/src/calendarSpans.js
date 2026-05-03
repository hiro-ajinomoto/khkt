/** Số ngày trong tháng dương lịch (month 1–12). */
export function daysInMonth(year, month1based) {
  return new Date(year, month1based, 0).getDate();
}

/**
 * Chia tháng thành các tuần liên tiếp 7 ngày: tuần 1 = ngày 1–7, tuần 2 = 8–14, …
 * @returns {{ index: number; startDay: number; endDay: number }[]}
 */
export function getCalendarWeekSpansInMonth(year, month1based) {
  const dim = daysInMonth(year, month1based);
  /** @type {{ index: number; startDay: number; endDay: number }[]} */
  const spans = [];
  let d = 1;
  while (d <= dim) {
    const end = Math.min(d + 6, dim);
    spans.push({ index: spans.length + 1, startDay: d, endDay: end });
    d = end + 1;
  }
  return spans;
}
