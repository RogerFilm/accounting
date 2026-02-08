/**
 * Bank CSV format auto-detection.
 * Detects bank by analyzing header rows and column patterns.
 */

export type BankFormat =
  | "mufg"        // 三菱UFJ銀行
  | "smbc"        // 三井住友銀行
  | "mizuho"      // みずほ銀行
  | "rakuten"     // 楽天銀行
  | "sbi_shinsei" // SBI新生銀行
  | "generic";    // 汎用（日付、摘要、入金、出金）

export const BANK_LABELS: Record<BankFormat, string> = {
  mufg: "三菱UFJ銀行",
  smbc: "三井住友銀行",
  mizuho: "みずほ銀行",
  rakuten: "楽天銀行",
  sbi_shinsei: "SBI新生銀行",
  generic: "汎用フォーマット",
};

interface DetectionResult {
  format: BankFormat;
  confidence: number; // 0-1
  headerRowIndex: number; // ヘッダー行のインデックス
}

/**
 * Detect bank format from the first few lines of CSV.
 */
export function detectBankFormat(lines: string[]): DetectionResult {
  const joined = lines.slice(0, 5).join("\n").toLowerCase();

  // MUFG: ヘッダーに「日付」「摘要」「お支払金額」「お預り金額」
  if (
    joined.includes("お支払金額") ||
    joined.includes("お預り金額") ||
    joined.includes("三菱")
  ) {
    const headerIdx = lines.findIndex(
      (l) => l.includes("日付") || l.includes("お支払金額"),
    );
    return { format: "mufg", confidence: 0.9, headerRowIndex: Math.max(0, headerIdx) };
  }

  // SMBC: 「お引出し」「お預入れ」
  if (joined.includes("お引出し") || joined.includes("お預入れ")) {
    const headerIdx = lines.findIndex(
      (l) => l.includes("お引出し") || l.includes("お預入れ"),
    );
    return { format: "smbc", confidence: 0.9, headerRowIndex: Math.max(0, headerIdx) };
  }

  // Mizuho: 「みずほ」or 「お取引日」「お引出し額」「お預入れ額」
  if (
    joined.includes("みずほ") ||
    (joined.includes("お取引日") && joined.includes("お引出し額"))
  ) {
    const headerIdx = lines.findIndex(
      (l) => l.includes("お取引日") || l.includes("お引出し額"),
    );
    return { format: "mizuho", confidence: 0.85, headerRowIndex: Math.max(0, headerIdx) };
  }

  // Rakuten: 「取引日」「入出金（税込）」or 「楽天銀行」
  if (joined.includes("楽天") || joined.includes("入出金(税込)")) {
    const headerIdx = lines.findIndex(
      (l) => l.includes("取引日") || l.includes("入出金"),
    );
    return { format: "rakuten", confidence: 0.85, headerRowIndex: Math.max(0, headerIdx) };
  }

  // SBI Shinsei: 「SBI」or specific patterns
  if (joined.includes("sbi") || joined.includes("新生")) {
    const headerIdx = lines.findIndex((l) => l.includes("日付") || l.includes("取引"));
    return {
      format: "sbi_shinsei",
      confidence: 0.8,
      headerRowIndex: Math.max(0, headerIdx),
    };
  }

  // Generic fallback: look for header with date/amount-like columns
  const headerIdx = lines.findIndex(
    (l) => l.includes("日付") || l.includes("取引日") || l.includes("date"),
  );
  return {
    format: "generic",
    confidence: 0.5,
    headerRowIndex: Math.max(0, headerIdx),
  };
}
