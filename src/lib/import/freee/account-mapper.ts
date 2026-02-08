/**
 * freee 勘定科目マッピング
 *
 * freee の科目名 → 内部の勘定科目IDへの対応付け。
 * 名前完全一致 → 部分一致 → 手動マッピング の優先順位。
 */

interface InternalAccount {
  id: string;
  code: string;
  name: string;
  category: string;
}

export interface AccountMapping {
  freeeName: string;
  internalAccount: InternalAccount | null;
  matchType: "exact" | "partial" | "manual" | "unmatched";
  confidence: number; // 0-1
}

/**
 * freee の科目名と内部科目名の既知の対応表。
 * freee 独自の名称 → 一般的な名称へのマッピング。
 */
const KNOWN_ALIASES: Record<string, string[]> = {
  // freee uses some unique names
  "未決済金(税区分なし)": ["仮受金", "仮払金"],
  "事業主貸": ["事業主貸"],
  "事業主借": ["事業主借"],
  "前受収益": ["前受収益"],
  "未払費用": ["未払費用"],
  "役員報酬": ["役員報酬"],
  "給料手当": ["給料手当", "給与手当"],
  "法定福利費": ["法定福利費"],
  "雑費": ["雑費"],
  "支払手数料": ["支払手数料"],
  "租税公課": ["租税公課"],
  "水道光熱費": ["水道光熱費"],
  "広告宣伝費": ["広告宣伝費"],
  "荷造運賃": ["荷造運賃"],
  "旅費交通費": ["旅費交通費"],
  "通信費": ["通信費"],
  "消耗品費": ["消耗品費"],
  "福利厚生費": ["福利厚生費"],
  "減価償却費": ["減価償却費"],
  "研究開発費": ["研究開発費"],
  "外注費": ["外注費", "業務委託費"],
  "売上高": ["売上高"],
  "雑収入": ["雑収入"],
  "受取利息": ["受取利息"],
};

/**
 * freee の税区分名 → 内部税区分コードのマッピング。
 */
export const TAX_CATEGORY_MAP: Record<string, string> = {
  "対象仕入10%": "purchase_10",
  "対象仕入（税率10%）": "purchase_10",
  "課対仕入10%": "purchase_10",
  "課対仕入（税率10%）": "purchase_10",
  "対象仕入8%（軽）": "purchase_8r",
  "課対仕入8%（軽）": "purchase_8r",
  "対象売上10%": "sales_10",
  "対象売上（税率10%）": "sales_10",
  "課対売上10%": "sales_10",
  "課対売上（税率10%）": "sales_10",
  "対象売上8%（軽）": "sales_8r",
  "課対売上8%（軽）": "sales_8r",
  "非課税売上": "exempt",
  "非課税仕入": "exempt",
  "不課税": "non_taxable",
  "対象外": "non_taxable",
  "免税売上": "tax_free",
};

/**
 * Auto-map freee account names to internal accounts.
 */
export function autoMapAccounts(
  freeeNames: string[],
  internalAccounts: InternalAccount[],
): AccountMapping[] {
  return freeeNames.map((freeeName) => {
    // 1. Exact name match
    const exact = internalAccounts.find(
      (a) => a.name === freeeName,
    );
    if (exact) {
      return {
        freeeName,
        internalAccount: exact,
        matchType: "exact" as const,
        confidence: 1.0,
      };
    }

    // 2. Known alias match
    const aliases = KNOWN_ALIASES[freeeName];
    if (aliases) {
      for (const alias of aliases) {
        const match = internalAccounts.find((a) => a.name === alias);
        if (match) {
          return {
            freeeName,
            internalAccount: match,
            matchType: "exact" as const,
            confidence: 0.95,
          };
        }
      }
    }

    // 3. Partial match (freee name contains or is contained by internal name)
    const partial = internalAccounts.find(
      (a) => a.name.includes(freeeName) || freeeName.includes(a.name),
    );
    if (partial) {
      return {
        freeeName,
        internalAccount: partial,
        matchType: "partial" as const,
        confidence: 0.7,
      };
    }

    // 4. Unmatched
    return {
      freeeName,
      internalAccount: null,
      matchType: "unmatched" as const,
      confidence: 0,
    };
  });
}

/**
 * Map freee tax category name to internal tax category code.
 */
export function mapTaxCategory(freeeTaxName: string): string | null {
  if (!freeeTaxName || freeeTaxName.trim() === "") return null;
  const name = freeeTaxName.trim();

  // Direct match
  if (TAX_CATEGORY_MAP[name]) return TAX_CATEGORY_MAP[name];

  // Normalize full-width/half-width parentheses and retry
  const normalized = name
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/\(/g, "（")
    .replace(/\)/g, "）");

  if (TAX_CATEGORY_MAP[normalized]) return TAX_CATEGORY_MAP[normalized];

  // Keyword-based fallback
  if (/仕入.*10/.test(name)) return "purchase_10";
  if (/仕入.*8/.test(name)) return "purchase_8r";
  if (/売上.*10/.test(name)) return "sales_10";
  if (/売上.*8/.test(name)) return "sales_8r";
  if (/非課税/.test(name)) return "exempt";
  if (/不課税|対象外/.test(name)) return "non_taxable";
  if (/免税/.test(name)) return "tax_free";

  return null;
}
