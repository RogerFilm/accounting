/**
 * Convert a western date to Japanese era (令和) display.
 * Only supports dates from 2019-05-01 onward (Reiwa era).
 */
export function toWareki(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();

  if (year >= 2019) {
    const reiwaYear = year - 2018;
    const yearStr = reiwaYear === 1 ? "元" : String(reiwaYear);
    return `令和${yearStr}年${month}月${day}日`;
  }

  // Fallback for older dates (Heisei)
  if (year >= 1989) {
    const heiseiYear = year - 1988;
    const yearStr = heiseiYear === 1 ? "元" : String(heiseiYear);
    return `平成${yearStr}年${month}月${day}日`;
  }

  return `${year}年${month}月${day}日`;
}

/**
 * Format ISO date string for display (YYYY/MM/DD).
 */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Get today's date as ISO string (YYYY-MM-DD).
 */
export function today(): string {
  return new Date().toISOString().split("T")[0];
}
