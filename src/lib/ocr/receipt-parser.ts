/**
 * Receipt OCR text parser.
 * Extracts structured data from OCR output using regex patterns.
 */

export interface ReceiptItem {
  name: string;
  amount: number;
  quantity?: number;
}

export interface ReceiptData {
  storeName: string | null;
  date: string | null; // ISO 8601
  totalAmount: number | null;
  taxAmount: number | null;
  items: ReceiptItem[];
}

/**
 * Parse OCR text from a Japanese receipt into structured data.
 */
export function parseReceiptText(text: string): ReceiptData {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return {
    storeName: extractStoreName(lines),
    date: extractDate(lines),
    totalAmount: extractTotal(lines),
    taxAmount: extractTax(lines),
    items: extractItems(lines),
  };
}

/**
 * Store name is typically in the first few non-empty lines,
 * before any date or price information.
 */
function extractStoreName(lines: string[]): string | null {
  for (const line of lines.slice(0, 5)) {
    // Skip lines that look like dates, amounts, or addresses
    if (/^\d{2,4}[年/\-]/.test(line)) continue;
    if (/^[R令H平]/.test(line)) continue;
    if (/^[\d¥￥]/.test(line)) continue;
    if (/^〒|^TEL|^tel|^電話/.test(line)) continue;
    if (/^(東京|大阪|神奈川|愛知|北海道|福岡)/.test(line) && line.length > 10) continue;

    // Likely a store name if it has some kanji/katakana
    if (/[\u3000-\u9fff\uff00-\uffef]/.test(line) && line.length >= 2) {
      // Clean up common artifacts
      return line.replace(/[#＃※\*]+$/, "").trim();
    }
  }
  return null;
}

/**
 * Extract date from various Japanese formats.
 */
function extractDate(lines: string[]): string | null {
  const text = lines.join(" ");

  // 2024年4月1日 or 2024年04月01日
  const jpMatch = text.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (jpMatch) {
    return `${jpMatch[1]}-${jpMatch[2].padStart(2, "0")}-${jpMatch[3].padStart(2, "0")}`;
  }

  // R6年4月1日 or R6.4.1 or 令和6年
  const warekiMatch = text.match(
    /[Rr令和]\s*(\d{1,2})\s*[年.]\s*(\d{1,2})\s*[月.]\s*(\d{1,2})/,
  );
  if (warekiMatch) {
    const year = 2018 + parseInt(warekiMatch[1]);
    return `${year}-${warekiMatch[2].padStart(2, "0")}-${warekiMatch[3].padStart(2, "0")}`;
  }

  // 2024/04/01 or 2024-04-01
  const isoMatch = text.match(/(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
  }

  // 24/04/01 (2-digit year)
  const shortYearMatch = text.match(/(\d{2})[/](\d{2})[/](\d{2})/);
  if (shortYearMatch) {
    const year = 2000 + parseInt(shortYearMatch[1]);
    return `${year}-${shortYearMatch[2]}-${shortYearMatch[3]}`;
  }

  return null;
}

/**
 * Extract total amount.
 */
function extractTotal(lines: string[]): number | null {
  // Search from bottom (total is usually near the end)
  const reversed = [...lines].reverse();

  for (const line of reversed) {
    // 合計 ¥1,234 or 合計 1,234円 or 合計 1234
    const totalMatch = line.match(
      /(?:合計|お会計|TOTAL|ＴＯＴＡＬお買上|お買い上げ)\s*[¥￥]?\s*([\d,]+)/i,
    );
    if (totalMatch) {
      return parseAmount(totalMatch[1]);
    }

    // ¥1,234 at end of line with 合計 keyword
    if (/合計|TOTAL/i.test(line)) {
      const amountMatch = line.match(/[¥￥]?\s*([\d,]+)\s*円?\s*$/);
      if (amountMatch) {
        return parseAmount(amountMatch[1]);
      }
    }
  }

  // Fallback: look for largest amount as total
  let maxAmount = 0;
  for (const line of lines) {
    const amounts = line.match(/[¥￥]?\s*([\d,]{3,})/g);
    if (amounts) {
      for (const a of amounts) {
        const val = parseAmount(a.replace(/[¥￥\s]/g, ""));
        if (val > maxAmount) maxAmount = val;
      }
    }
  }

  return maxAmount > 0 ? maxAmount : null;
}

/**
 * Extract tax amount.
 */
function extractTax(lines: string[]): number | null {
  for (const line of lines) {
    // 消費税(8%) 24 or 消費税 ¥123 — skip percentage part, grab amount at end
    if (/(?:消費税|内税|外税|税額|うち税)/.test(line)) {
      // Remove percentage like (8%) or (10%) first
      const cleaned = line.replace(/\(\d+%?\)/g, "").replace(/（\d+%?）/g, "");
      const amountMatch = cleaned.match(/[¥￥]?\s*([\d,]+)\s*[円)）]?\s*$/);
      if (amountMatch) {
        return parseAmount(amountMatch[1]);
      }
    }
  }
  return null;
}

/**
 * Extract line items (product name + price).
 */
function extractItems(lines: string[]): ReceiptItem[] {
  const items: ReceiptItem[] = [];

  // Skip header lines (store name, address, etc.) and footer (total, tax, etc.)
  let startIdx = 0;
  let endIdx = lines.length;

  // Find where items start (after date/header info)
  for (let i = 0; i < lines.length; i++) {
    if (/(\d{4})[年/\-]/.test(lines[i]) || /[Rr令和]/.test(lines[i])) {
      startIdx = i + 1;
      break;
    }
  }

  // Find where items end (before total/subtotal)
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/小計|合計|TOTAL|お会計|お釣|お預|現金|クレジット|カード/i.test(lines[i])) {
      endIdx = i;
    }
  }

  // Extract items between start and end
  for (let i = startIdx; i < endIdx; i++) {
    const line = lines[i];

    // Skip non-item lines
    if (/^[\-=＝─━]+$/.test(line)) continue;
    if (/^(TEL|tel|電話|〒|住所)/.test(line)) continue;
    if (line.length < 3) continue;

    // Pattern: 商品名 ¥1,234 or 商品名 1,234
    const match = line.match(/^(.+?)\s+[¥￥]?\s*([\d,]+)\s*円?\s*$/);
    if (match) {
      const name = match[1].trim();
      const amount = parseAmount(match[2]);
      if (amount > 0 && name.length >= 1) {
        // Check for quantity: x2, ×2, @100x2
        const qtyMatch = name.match(/[x×@]\s*(\d+)\s*$/);
        items.push({
          name: qtyMatch ? name.replace(/\s*[x×@]\s*\d+\s*$/, "").trim() : name,
          amount,
          quantity: qtyMatch ? parseInt(qtyMatch[1]) : undefined,
        });
      }
    }
  }

  return items;
}

/**
 * Clean and parse an amount string.
 */
function parseAmount(s: string): number {
  return parseInt(s.replace(/[,，\s¥￥円]/g, "")) || 0;
}

/**
 * Suggest an account based on store name patterns.
 */
export function suggestAccountFromStore(storeName: string): {
  accountCode: string;
  confidence: number;
} | null {
  const s = storeName.toLowerCase();

  const patterns: [RegExp, string, number][] = [
    // 交通費 (5300)
    [/タクシー|taxi|uber|jr |suica|pasmo|交通/, "5300", 0.8],
    // 通信費 (5200) - reuse
    [/ドコモ|softbank|au |kddi|ntt|通信/, "5350", 0.7],
    // 消耗品費 (5100)
    [/ヨドバシ|ビック|ヤマダ|amazon|アマゾン|ダイソー|100均/, "5100", 0.7],
    // 会議費 (5500)
    [/スターバックス|starbucks|ドトール|タリーズ|カフェ|cafe/, "5500", 0.6],
    // 接待交際費 (5450)
    [/居酒屋|レストラン|ホテル|旅館/, "5450", 0.5],
    // 新聞図書費 (5700)
    [/書店|ブック|紀伊國屋|丸善|ジュンク堂|book/, "5700", 0.6],
    // 旅費交通費 (5300)
    [/ガソリン|gs |shell|eneos|出光|コスモ/, "5300", 0.7],
    // 福利厚生費 (5400)
    [/セブン|ローソン|ファミ|コンビニ|マート/, "5400", 0.4],
    // 地代家賃 (5340) — unlikely on receipt but just in case
    [/駐車場|パーキング|コインパ/, "5300", 0.6],
  ];

  for (const [pattern, code, confidence] of patterns) {
    if (pattern.test(s)) {
      return { accountCode: code, confidence };
    }
  }

  return null;
}
