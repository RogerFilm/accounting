/**
 * Balance Sheet (貸借対照表 / B/S) calculation.
 * Assets = Liabilities + Equity
 * Note: Net income from PL is included in equity as 当期純利益.
 */
import { type AccountBalance, aggregateByAccount } from "./aggregate";

export interface BSSection {
  label: string;
  items: { code: string; name: string; amount: number }[];
  total: number;
}

export interface BalanceSheet {
  assets: BSSection[];
  liabilities: BSSection[];
  equity: BSSection[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  netIncome: number; // 当期純利益 (from PL, added to equity)
}

export async function calculateBalanceSheet(
  companyId: string,
  dateFrom: string,
  dateTo: string,
): Promise<BalanceSheet> {
  const balances = await aggregateByAccount(companyId, dateFrom, dateTo);

  function buildSection(
    category: AccountBalance["category"],
    label: string,
  ): BSSection {
    const items = balances
      .filter((b) => b.category === category && b.balance !== 0)
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode))
      .map((b) => ({
        code: b.accountCode,
        name: b.accountName,
        amount: b.balance,
      }));
    return {
      label,
      items,
      total: items.reduce((s, i) => s + i.amount, 0),
    };
  }

  const assetSection = buildSection("asset", "資産の部");
  const liabilitySection = buildSection("liability", "負債の部");
  const equitySection = buildSection("equity", "純資産の部");

  // Calculate net income: revenue - expense
  const revenue = balances
    .filter((b) => b.category === "revenue")
    .reduce((s, b) => s + b.balance, 0);
  const expense = balances
    .filter((b) => b.category === "expense")
    .reduce((s, b) => s + b.balance, 0);
  const netIncome = revenue - expense;

  // Add net income to equity
  if (netIncome !== 0) {
    equitySection.items.push({
      code: "",
      name: "当期純利益",
      amount: netIncome,
    });
    equitySection.total += netIncome;
  }

  const totalAssets = assetSection.total;
  const totalLiabilities = liabilitySection.total;
  const totalEquity = equitySection.total;

  return {
    assets: [assetSection],
    liabilities: [liabilitySection],
    equity: [equitySection],
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
    netIncome,
  };
}
