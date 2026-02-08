/**
 * Bank CSV parser.
 * Parses CSV content into standardized transaction rows.
 */

import { type BankFormat, detectBankFormat } from "./detector";

export interface BankTransaction {
  date: string; // ISO 8601 YYYY-MM-DD
  description: string; // 摘要
  withdrawal: number; // 出金（支払い）
  deposit: number; // 入金
  balance: number; // 残高（あれば）
  rawLine: string; // 元の行
  hash: string; // 重複検出用ハッシュ
}

export interface ParseResult {
  format: BankFormat;
  confidence: number;
  transactions: BankTransaction[];
  errors: string[];
}

/**
 * Simple CSV line splitter that handles quoted fields.
 */
function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parse a date string in various Japanese bank formats to ISO 8601.
 */
function parseDate(dateStr: string): string {
  const s = dateStr.trim().replace(/"/g, "");

  // YYYY/MM/DD or YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
  }

  // R6.4.15 (令和) or H31.4.1 (平成)
  const warekiMatch = s.match(/^[RrＲ](\d{1,2})[./](\d{1,2})[./](\d{1,2})$/);
  if (warekiMatch) {
    const year = 2018 + parseInt(warekiMatch[1]);
    return `${year}-${warekiMatch[2].padStart(2, "0")}-${warekiMatch[3].padStart(2, "0")}`;
  }

  // MM/DD (current year assumed)
  const shortMatch = s.match(/^(\d{1,2})[/](\d{1,2})$/);
  if (shortMatch) {
    const year = new Date().getFullYear();
    return `${year}-${shortMatch[1].padStart(2, "0")}-${shortMatch[2].padStart(2, "0")}`;
  }

  return s; // Return as-is if unparseable
}

/**
 * Parse an amount string, removing commas and quotes.
 */
function parseAmount(amountStr: string): number {
  if (!amountStr || amountStr.trim() === "" || amountStr.trim() === "-") return 0;
  const cleaned = amountStr.replace(/[",¥\\s]/g, "").trim();
  return parseInt(cleaned) || 0;
}

/**
 * Generate a hash for duplicate detection.
 */
async function generateHash(date: string, amount: number, description: string): Promise<string> {
  const data = `${date}|${amount}|${description}`;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Column mapping per bank format
interface ColumnMap {
  date: number;
  description: number;
  withdrawal: number;
  deposit: number;
  balance: number; // -1 if not available
}

function getColumnMap(format: BankFormat, header: string[]): ColumnMap {
  const h = header.map((s) => s.trim().toLowerCase());

  switch (format) {
    case "mufg":
      return {
        date: h.findIndex((c) => c.includes("日付")),
        description: h.findIndex((c) => c.includes("摘要")),
        withdrawal: h.findIndex((c) => c.includes("お支払") || c.includes("出金")),
        deposit: h.findIndex((c) => c.includes("お預り") || c.includes("入金")),
        balance: h.findIndex((c) => c.includes("残高")),
      };

    case "smbc":
      return {
        date: h.findIndex((c) => c.includes("年月日") || c.includes("日付")),
        description: h.findIndex((c) => c.includes("摘要") || c.includes("内容")),
        withdrawal: h.findIndex((c) => c.includes("お引出し") || c.includes("出金")),
        deposit: h.findIndex((c) => c.includes("お預入れ") || c.includes("入金")),
        balance: h.findIndex((c) => c.includes("残高")),
      };

    case "mizuho":
      return {
        date: h.findIndex((c) => c.includes("お取引日") || c.includes("日付")),
        description: h.findIndex((c) => c.includes("摘要") || c.includes("内容")),
        withdrawal: h.findIndex((c) => c.includes("お引出し額") || c.includes("出金")),
        deposit: h.findIndex((c) => c.includes("お預入れ額") || c.includes("入金")),
        balance: h.findIndex((c) => c.includes("残高")),
      };

    case "rakuten":
      return {
        date: h.findIndex((c) => c.includes("取引日") || c.includes("日付")),
        description: h.findIndex((c) => c.includes("摘要") || c.includes("内容")),
        withdrawal: h.findIndex((c) => c.includes("支出") || c.includes("出金")),
        deposit: h.findIndex((c) => c.includes("収入") || c.includes("入金")),
        balance: h.findIndex((c) => c.includes("残高")),
      };

    case "sbi_shinsei":
      return {
        date: h.findIndex((c) => c.includes("日付") || c.includes("取引日")),
        description: h.findIndex((c) => c.includes("摘要") || c.includes("内容")),
        withdrawal: h.findIndex((c) => c.includes("出金") || c.includes("支払")),
        deposit: h.findIndex((c) => c.includes("入金") || c.includes("預入")),
        balance: h.findIndex((c) => c.includes("残高")),
      };

    default: { // generic
      const find = (patterns: string[], fallback: number) => {
        const idx = h.findIndex((c) => patterns.some((p) => c.includes(p)));
        return idx >= 0 ? idx : fallback;
      };
      return {
        date: find(["日付", "date"], 0),
        description: find(["摘要", "内容"], 1),
        withdrawal: find(["出金", "支払"], 3),
        deposit: find(["入金", "預入"], 2),
        balance: h.findIndex((c) => c.includes("残高")),
      };
    }
  }
}

/**
 * Parse bank CSV content into standardized transactions.
 */
export async function parseBankCSV(csvContent: string): Promise<ParseResult> {
  const rawLines = csvContent.split(/\r?\n/).filter((l) => l.trim() !== "");
  const errors: string[] = [];

  if (rawLines.length < 2) {
    return { format: "generic", confidence: 0, transactions: [], errors: ["CSVが空です"] };
  }

  const detection = detectBankFormat(rawLines);
  const headerLine = rawLines[detection.headerRowIndex];
  const header = splitCSVLine(headerLine);
  const columnMap = getColumnMap(detection.format, header);

  if (columnMap.date < 0 || columnMap.description < 0) {
    errors.push("日付または摘要列が見つかりません");
    return { format: detection.format, confidence: detection.confidence, transactions: [], errors };
  }

  const transactions: BankTransaction[] = [];

  for (let i = detection.headerRowIndex + 1; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) continue;

    const cols = splitCSVLine(line);

    // Skip if not enough columns
    if (cols.length <= Math.max(columnMap.date, columnMap.description)) {
      continue;
    }

    const dateStr = cols[columnMap.date] || "";
    const date = parseDate(dateStr);
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Skip non-date rows (could be footer/summary)
      continue;
    }

    const description = cols[columnMap.description] || "";
    const withdrawal = columnMap.withdrawal >= 0 ? parseAmount(cols[columnMap.withdrawal]) : 0;
    const deposit = columnMap.deposit >= 0 ? parseAmount(cols[columnMap.deposit]) : 0;
    const balance = columnMap.balance >= 0 ? parseAmount(cols[columnMap.balance]) : 0;

    // Skip rows with no amounts
    if (withdrawal === 0 && deposit === 0) continue;

    const amount = deposit > 0 ? deposit : -withdrawal;
    const hash = await generateHash(date, amount, description);

    transactions.push({
      date,
      description,
      withdrawal,
      deposit,
      balance,
      rawLine: line,
      hash,
    });
  }

  return {
    format: detection.format,
    confidence: detection.confidence,
    transactions,
    errors,
  };
}
