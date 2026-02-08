/**
 * Format an integer yen amount for display.
 * e.g. 1234567 -> "¥1,234,567"
 */
export function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

/**
 * Parse a user-entered yen string to integer.
 * Strips ¥, commas, spaces.
 */
export function parseYen(input: string): number {
  const cleaned = input.replace(/[¥,\s]/g, "");
  const n = Number(cleaned);
  if (!Number.isInteger(n)) {
    throw new Error(`Invalid yen amount: ${input}`);
  }
  return n;
}
