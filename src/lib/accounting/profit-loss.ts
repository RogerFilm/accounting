/**
 * Profit & Loss Statement (損益計算書 / P/L) calculation.
 */
import { type AccountBalance, aggregateByAccount } from "./aggregate";

export interface PLSection {
  label: string;
  items: { code: string; name: string; amount: number }[];
  total: number;
}

export interface ProfitLoss {
  revenue: PLSection;
  costOfSales: PLSection;
  grossProfit: number; // 売上総利益
  sellingAndAdmin: PLSection; // 販管費
  operatingIncome: number; // 営業利益
  nonOperatingIncome: PLSection; // 営業外収益
  nonOperatingExpense: PLSection; // 営業外費用
  ordinaryIncome: number; // 経常利益
  extraordinaryGain: PLSection; // 特別利益
  extraordinaryLoss: PLSection; // 特別損失
  incomeBeforeTax: number; // 税引前当期純利益
  incomeTax: number; // 法人税等
  netIncome: number; // 当期純利益
}

// Account code ranges for PL classification
const COST_OF_SALES_CODES = ["5100", "5110"]; // 売上原価, 仕入高
const TAX_CODES = ["5700"]; // 法人税等
const NON_OP_INCOME_CODES = ["4200", "4300", "4400"]; // 受取利息, 受取配当金, 雑収入
const NON_OP_EXPENSE_CODES = ["5500"]; // 支払利息
const EXTRA_GAIN_CODES = ["4500"]; // 固定資産売却益
const EXTRA_LOSS_CODES = ["5600"]; // 固定資産売却損

function buildSection(
  balances: AccountBalance[],
  codes: string[],
  label: string,
): PLSection {
  const items = balances
    .filter((b) => codes.includes(b.accountCode) && b.balance !== 0)
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode))
    .map((b) => ({ code: b.accountCode, name: b.accountName, amount: b.balance }));
  return { label, items, total: items.reduce((s, i) => s + i.amount, 0) };
}

export async function calculateProfitLoss(
  companyId: string,
  dateFrom: string,
  dateTo: string,
): Promise<ProfitLoss> {
  const balances = await aggregateByAccount(companyId, dateFrom, dateTo);

  // Revenue (売上高): code 4100
  const revenueItems = balances
    .filter((b) => b.category === "revenue" && b.accountCode === "4100" && b.balance !== 0)
    .map((b) => ({ code: b.accountCode, name: b.accountName, amount: b.balance }));
  const revenue: PLSection = {
    label: "売上高",
    items: revenueItems,
    total: revenueItems.reduce((s, i) => s + i.amount, 0),
  };

  // Cost of sales
  const costOfSales = buildSection(balances, COST_OF_SALES_CODES, "売上原価");

  const grossProfit = revenue.total - costOfSales.total;

  // Selling & admin expenses (販管費): all expense accounts except cost of sales, tax, non-op, extraordinary
  const excludedExpenseCodes = new Set([
    ...COST_OF_SALES_CODES,
    ...TAX_CODES,
    ...NON_OP_EXPENSE_CODES,
    ...EXTRA_LOSS_CODES,
  ]);
  const sgaItems = balances
    .filter(
      (b) =>
        b.category === "expense" &&
        !excludedExpenseCodes.has(b.accountCode) &&
        b.balance !== 0,
    )
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode))
    .map((b) => ({ code: b.accountCode, name: b.accountName, amount: b.balance }));
  const sellingAndAdmin: PLSection = {
    label: "販売費及び一般管理費",
    items: sgaItems,
    total: sgaItems.reduce((s, i) => s + i.amount, 0),
  };

  const operatingIncome = grossProfit - sellingAndAdmin.total;

  // Non-operating
  const nonOperatingIncome = buildSection(balances, NON_OP_INCOME_CODES, "営業外収益");
  const nonOperatingExpense = buildSection(balances, NON_OP_EXPENSE_CODES, "営業外費用");

  const ordinaryIncome =
    operatingIncome + nonOperatingIncome.total - nonOperatingExpense.total;

  // Extraordinary
  const extraordinaryGain = buildSection(balances, EXTRA_GAIN_CODES, "特別利益");
  const extraordinaryLoss = buildSection(balances, EXTRA_LOSS_CODES, "特別損失");

  const incomeBeforeTax =
    ordinaryIncome + extraordinaryGain.total - extraordinaryLoss.total;

  // Income tax
  const taxItems = balances
    .filter((b) => TAX_CODES.includes(b.accountCode) && b.balance !== 0)
    .map((b) => ({ code: b.accountCode, name: b.accountName, amount: b.balance }));
  const incomeTax = taxItems.reduce((s, i) => s + i.amount, 0);

  const netIncome = incomeBeforeTax - incomeTax;

  return {
    revenue,
    costOfSales,
    grossProfit,
    sellingAndAdmin,
    operatingIncome,
    nonOperatingIncome,
    nonOperatingExpense,
    ordinaryIncome,
    extraordinaryGain,
    extraordinaryLoss,
    incomeBeforeTax,
    incomeTax,
    netIncome,
  };
}
