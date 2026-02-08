/**
 * freee 仕訳帳CSVパーサー
 *
 * 対応フォーマット:
 * 1. 仕訳帳エクスポート（取引日, 仕訳番号, 借方勘定科目, ...）
 * 2. 取引エクスポート（収支区分, 管理番号, 発生日, ...）
 */

export type FreeeFormat = "journal" | "transaction" | "unknown";

export interface FreeeJournalLine {
  side: "debit" | "credit";
  accountName: string;
  subAccountName: string;
  taxCategory: string;
  amount: number;
  taxAmount: number;
}

export interface FreeeJournalEntry {
  date: string; // ISO 8601
  entryNumber: string;
  description: string;
  memo: string;
  clientName: string;
  lines: FreeeJournalLine[];
}

export interface FreeeParseResult {
  format: FreeeFormat;
  entries: FreeeJournalEntry[];
  accountNames: string[]; // Unique account names found
  errors: string[];
  summary: {
    totalEntries: number;
    totalDebit: number;
    totalCredit: number;
    dateRange: { from: string; to: string } | null;
  };
}

/**
 * Simple CSV line splitter handling quoted fields.
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
 * Detect freee CSV format from header row.
 */
function detectFormat(header: string[]): FreeeFormat {
  const joined = header.join(",");

  if (joined.includes("仕訳番号") && joined.includes("借方勘定科目")) {
    return "journal";
  }
  if (joined.includes("収支区分") && joined.includes("勘定科目")) {
    return "transaction";
  }
  // Try to detect by column patterns
  if (joined.includes("借方") && joined.includes("貸方")) {
    return "journal";
  }
  return "unknown";
}

/**
 * Parse date in freee format (YYYY/MM/DD or YYYY-MM-DD).
 */
function parseDate(dateStr: string): string {
  const s = dateStr.trim().replace(/"/g, "");
  const m = s.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})$/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  return s;
}

/**
 * Parse amount string.
 */
function parseAmount(s: string): number {
  if (!s || s.trim() === "" || s.trim() === "-") return 0;
  return parseInt(s.replace(/[",¥\\s]/g, "").trim()) || 0;
}

/**
 * Build column index map for journal format.
 */
function buildJournalColumnMap(header: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  const h = header.map((s) => s.trim());

  for (let i = 0; i < h.length; i++) {
    const col = h[i];
    if (col.includes("取引日") || col === "日付") map.date = i;
    if (col.includes("仕訳番号") || col.includes("管理番号")) map.entryNumber = i;
    if (col === "借方勘定科目") map.debitAccount = i;
    if (col === "借方補助科目") map.debitSubAccount = i;
    if (col === "借方税区分") map.debitTaxCategory = i;
    if (col === "借方金額") map.debitAmount = i;
    if (col === "借方税額") map.debitTaxAmount = i;
    if (col === "貸方勘定科目") map.creditAccount = i;
    if (col === "貸方補助科目") map.creditSubAccount = i;
    if (col === "貸方税区分") map.creditTaxCategory = i;
    if (col === "貸方金額") map.creditAmount = i;
    if (col === "貸方税額") map.creditTaxAmount = i;
    if (col === "摘要") map.description = i;
    if (col === "仕訳メモ" || col === "メモ") map.memo = i;
    if (col === "取引先") map.clientName = i;
  }

  return map;
}

/**
 * Build column index map for transaction format.
 */
function buildTransactionColumnMap(header: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  const h = header.map((s) => s.trim());

  for (let i = 0; i < h.length; i++) {
    const col = h[i];
    if (col === "収支区分") map.type = i;
    if (col.includes("管理番号")) map.entryNumber = i;
    if (col === "発生日") map.date = i;
    if (col === "取引先") map.clientName = i;
    if (col === "勘定科目") map.accountName = i;
    if (col === "補助科目") map.subAccountName = i;
    if (col === "税区分") map.taxCategory = i;
    if (col === "金額") map.amount = i;
    if (col === "税額") map.taxAmount = i;
    if (col === "備考") map.description = i;
    if (col === "仕訳メモ") map.memo = i;
    if (col === "決済口座") map.paymentAccount = i;
    if (col === "決済金額") map.paymentAmount = i;
  }

  return map;
}

/**
 * Parse freee 仕訳帳 CSV format.
 */
function parseJournalFormat(
  rows: string[][],
  colMap: Record<string, number>,
): { entries: FreeeJournalEntry[]; errors: string[] } {
  const entries: FreeeJournalEntry[] = [];
  const errors: string[] = [];
  const groups = new Map<string, { rows: string[][]; date: string; desc: string; memo: string; client: string }>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const entryNumber = row[colMap.entryNumber] || `line_${i}`;
    const dateStr = row[colMap.date] || "";
    const date = dateStr ? parseDate(dateStr) : "";

    if (!groups.has(entryNumber)) {
      groups.set(entryNumber, {
        rows: [],
        date: date || "",
        desc: row[colMap.description] || "",
        memo: row[colMap.memo] || "",
        client: row[colMap.clientName] || "",
      });
    }

    const group = groups.get(entryNumber)!;
    group.rows.push(row);
    // Update date/desc from first row that has them
    if (date && !group.date) group.date = date;
    if (row[colMap.description] && !group.desc) group.desc = row[colMap.description];
    if (row[colMap.clientName] && !group.client) group.client = row[colMap.clientName];
  }

  for (const [entryNumber, group] of groups) {
    if (!group.date) {
      errors.push(`仕訳番号 ${entryNumber}: 日付がありません`);
      continue;
    }

    const lines: FreeeJournalLine[] = [];

    for (const row of group.rows) {
      const debitAccount = row[colMap.debitAccount] || "";
      const debitAmount = parseAmount(row[colMap.debitAmount] || "");
      const creditAccount = row[colMap.creditAccount] || "";
      const creditAmount = parseAmount(row[colMap.creditAmount] || "");

      if (debitAccount && debitAmount > 0) {
        lines.push({
          side: "debit",
          accountName: debitAccount,
          subAccountName: row[colMap.debitSubAccount] || "",
          taxCategory: row[colMap.debitTaxCategory] || "",
          amount: debitAmount,
          taxAmount: parseAmount(row[colMap.debitTaxAmount] || ""),
        });
      }

      if (creditAccount && creditAmount > 0) {
        lines.push({
          side: "credit",
          accountName: creditAccount,
          subAccountName: row[colMap.creditSubAccount] || "",
          taxCategory: row[colMap.creditTaxCategory] || "",
          amount: creditAmount,
          taxAmount: parseAmount(row[colMap.creditTaxAmount] || ""),
        });
      }
    }

    if (lines.length === 0) {
      errors.push(`仕訳番号 ${entryNumber}: 金額がありません`);
      continue;
    }

    // Validate debit = credit
    const debitTotal = lines.filter((l) => l.side === "debit").reduce((s, l) => s + l.amount, 0);
    const creditTotal = lines.filter((l) => l.side === "credit").reduce((s, l) => s + l.amount, 0);

    if (debitTotal !== creditTotal) {
      errors.push(
        `仕訳番号 ${entryNumber}: 借方合計(${debitTotal}) ≠ 貸方合計(${creditTotal})`,
      );
    }

    entries.push({
      date: group.date,
      entryNumber,
      description: group.desc,
      memo: group.memo,
      clientName: group.client,
      lines,
    });
  }

  // Sort by date
  entries.sort((a, b) => a.date.localeCompare(b.date));

  return { entries, errors };
}

/**
 * Parse freee 取引 CSV format.
 */
function parseTransactionFormat(
  rows: string[][],
  colMap: Record<string, number>,
): { entries: FreeeJournalEntry[]; errors: string[] } {
  const entries: FreeeJournalEntry[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const type = row[colMap.type] || ""; // 収入 or 支出
    const entryNumber = row[colMap.entryNumber] || `tx_${i}`;
    const dateStr = row[colMap.date] || "";
    const date = dateStr ? parseDate(dateStr) : "";

    if (!date) {
      errors.push(`行 ${i + 1}: 日付がありません`);
      continue;
    }

    const accountName = row[colMap.accountName] || "";
    const amount = parseAmount(row[colMap.amount] || "");
    const taxCategory = row[colMap.taxCategory] || "";
    const taxAmount = parseAmount(row[colMap.taxAmount] || "");
    const paymentAccount = row[colMap.paymentAccount] || "";
    const paymentAmount = parseAmount(row[colMap.paymentAmount] || "");

    if (!accountName || amount === 0) continue;

    const description = row[colMap.description] || "";
    const memo = row[colMap.memo] || "";
    const clientName = row[colMap.clientName] || "";

    const lines: FreeeJournalLine[] = [];
    const isExpense = type === "支出";

    if (isExpense) {
      // 支出: 費用(debit) / 決済口座(credit)
      lines.push({
        side: "debit",
        accountName,
        subAccountName: row[colMap.subAccountName] || "",
        taxCategory,
        amount,
        taxAmount,
      });
      lines.push({
        side: "credit",
        accountName: paymentAccount || "普通預金",
        subAccountName: "",
        taxCategory: "",
        amount: paymentAmount || amount,
        taxAmount: 0,
      });
    } else {
      // 収入: 決済口座(debit) / 収益(credit)
      lines.push({
        side: "debit",
        accountName: paymentAccount || "普通預金",
        subAccountName: "",
        taxCategory: "",
        amount: paymentAmount || amount,
        taxAmount: 0,
      });
      lines.push({
        side: "credit",
        accountName,
        subAccountName: row[colMap.subAccountName] || "",
        taxCategory,
        amount,
        taxAmount,
      });
    }

    entries.push({
      date,
      entryNumber,
      description,
      memo,
      clientName,
      lines,
    });
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));
  return { entries, errors };
}

/**
 * Parse freee CSV content.
 */
export function parseFreeeCSV(csvContent: string): FreeeParseResult {
  const rawLines = csvContent.split(/\r?\n/).filter((l) => l.trim() !== "");

  if (rawLines.length < 2) {
    return {
      format: "unknown",
      entries: [],
      accountNames: [],
      errors: ["CSVが空です"],
      summary: { totalEntries: 0, totalDebit: 0, totalCredit: 0, dateRange: null },
    };
  }

  const header = splitCSVLine(rawLines[0]);
  const format = detectFormat(header);

  if (format === "unknown") {
    return {
      format: "unknown",
      entries: [],
      accountNames: [],
      errors: ["freee のCSVフォーマットを認識できません。仕訳帳または取引のCSVエクスポートを使用してください。"],
      summary: { totalEntries: 0, totalDebit: 0, totalCredit: 0, dateRange: null },
    };
  }

  // Parse data rows
  const dataRows = rawLines.slice(1).map(splitCSVLine);

  let entries: FreeeJournalEntry[];
  let errors: string[];

  if (format === "journal") {
    const colMap = buildJournalColumnMap(header);
    const result = parseJournalFormat(dataRows, colMap);
    entries = result.entries;
    errors = result.errors;
  } else {
    const colMap = buildTransactionColumnMap(header);
    const result = parseTransactionFormat(dataRows, colMap);
    entries = result.entries;
    errors = result.errors;
  }

  // Collect unique account names
  const accountNameSet = new Set<string>();
  for (const entry of entries) {
    for (const line of entry.lines) {
      if (line.accountName) accountNameSet.add(line.accountName);
    }
  }

  // Summary
  const totalDebit = entries.reduce(
    (sum, e) => sum + e.lines.filter((l) => l.side === "debit").reduce((s, l) => s + l.amount, 0),
    0,
  );
  const totalCredit = entries.reduce(
    (sum, e) => sum + e.lines.filter((l) => l.side === "credit").reduce((s, l) => s + l.amount, 0),
    0,
  );

  const dates = entries.map((e) => e.date).filter(Boolean).sort();
  const dateRange = dates.length > 0
    ? { from: dates[0], to: dates[dates.length - 1] }
    : null;

  return {
    format,
    entries,
    accountNames: Array.from(accountNameSet).sort(),
    errors,
    summary: {
      totalEntries: entries.length,
      totalDebit,
      totalCredit,
      dateRange,
    },
  };
}
