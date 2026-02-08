/**
 * 決算整理仕訳テンプレート
 *
 * 決算時に必要な調整仕訳のテンプレートを提供。
 */

export interface SettlementTemplate {
  id: string;
  name: string;
  description: string;
  category: "depreciation" | "accrual" | "prepaid" | "tax" | "other";
  debitAccountCode: string;
  creditAccountCode: string;
  needsAmount: boolean; // ユーザーが金額を入力する必要があるか
  autoCalculate: boolean; // 自動計算可能か
}

export const SETTLEMENT_TEMPLATES: SettlementTemplate[] = [
  // 減価償却
  {
    id: "depreciation",
    name: "減価償却費の計上",
    description: "固定資産の当期分の減価償却費を計上します",
    category: "depreciation",
    debitAccountCode: "5450", // 減価償却費
    creditAccountCode: "1900", // 減価償却累計額
    needsAmount: false,
    autoCalculate: true,
  },

  // 未払費用
  {
    id: "accrued_salary",
    name: "未払役員報酬の計上",
    description: "月末締め翌月払いの役員報酬の未払分を計上",
    category: "accrual",
    debitAccountCode: "5200", // 役員報酬
    creditAccountCode: "2310", // 未払費用
    needsAmount: true,
    autoCalculate: false,
  },
  {
    id: "accrued_social_insurance",
    name: "未払社会保険料の計上",
    description: "会社負担分の社会保険料の未払分を計上",
    category: "accrual",
    debitAccountCode: "5230", // 法定福利費
    creditAccountCode: "2310", // 未払費用
    needsAmount: true,
    autoCalculate: false,
  },
  {
    id: "accrued_rent",
    name: "未払家賃の計上",
    description: "期末時点で未払いの家賃を計上",
    category: "accrual",
    debitAccountCode: "5340", // 地代家賃
    creditAccountCode: "2310", // 未払費用
    needsAmount: true,
    autoCalculate: false,
  },

  // 前払費用
  {
    id: "prepaid_insurance",
    name: "前払保険料の振替",
    description: "年払い保険料のうち翌期分を前払費用に振替",
    category: "prepaid",
    debitAccountCode: "1410", // 前払費用
    creditAccountCode: "5360", // 保険料
    needsAmount: true,
    autoCalculate: false,
  },
  {
    id: "prepaid_rent",
    name: "前払家賃の振替",
    description: "前払いした翌期分の家賃を前払費用に振替",
    category: "prepaid",
    debitAccountCode: "1410", // 前払費用
    creditAccountCode: "5340", // 地代家賃
    needsAmount: true,
    autoCalculate: false,
  },

  // 消費税
  {
    id: "consumption_tax",
    name: "消費税の確定計上",
    description: "仮受消費税と仮払消費税を相殺し、未払消費税を計上",
    category: "tax",
    debitAccountCode: "2360", // 仮受消費税
    creditAccountCode: "2330", // 未払消費税等
    needsAmount: false,
    autoCalculate: true,
  },

  // その他
  {
    id: "corporate_tax",
    name: "法人税等の計上",
    description: "確定した法人税・住民税・事業税を未払計上",
    category: "tax",
    debitAccountCode: "5700", // 法人税等
    creditAccountCode: "2320", // 未払法人税等
    needsAmount: true,
    autoCalculate: false,
  },
];

/**
 * カテゴリ別にテンプレートをグループ化。
 */
export function getTemplatesByCategory(): Record<string, SettlementTemplate[]> {
  const groups: Record<string, SettlementTemplate[]> = {};
  for (const t of SETTLEMENT_TEMPLATES) {
    if (!groups[t.category]) groups[t.category] = [];
    groups[t.category].push(t);
  }
  return groups;
}

export const CATEGORY_LABELS: Record<string, string> = {
  depreciation: "減価償却",
  accrual: "未払費用",
  prepaid: "前払費用",
  tax: "消費税",
  other: "その他",
};
