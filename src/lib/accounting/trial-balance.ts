/**
 * Trial Balance (試算表) calculation.
 * - 合計試算表: total debits and credits per account
 * - 残高試算表: net balance per account
 */
import { type AccountBalance, aggregateByAccount } from "./aggregate";

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  category: AccountBalance["category"];
  debitTotal: number;
  creditTotal: number;
  debitBalance: number; // 借方残高
  creditBalance: number; // 貸方残高
}

export interface TrialBalance {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  totalDebitBalance: number;
  totalCreditBalance: number;
}

export async function calculateTrialBalance(
  companyId: string,
  dateFrom: string,
  dateTo: string,
): Promise<TrialBalance> {
  const balances = await aggregateByAccount(companyId, dateFrom, dateTo);

  const rows: TrialBalanceRow[] = balances
    .filter((b) => b.debitTotal > 0 || b.creditTotal > 0)
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode))
    .map((b) => {
      // balance is already computed relative to normal side:
      //   debit-normal (asset/expense): debit - credit
      //   credit-normal (liability/equity/revenue): credit - debit
      // Positive balance = on normal side; negative = on opposite side
      const isDebitNormal = b.category === "asset" || b.category === "expense";
      let debitBalance = 0;
      let creditBalance = 0;
      if (b.balance > 0) {
        if (isDebitNormal) debitBalance = b.balance;
        else creditBalance = b.balance;
      } else if (b.balance < 0) {
        if (isDebitNormal) creditBalance = Math.abs(b.balance);
        else debitBalance = Math.abs(b.balance);
      }
      return {
        accountCode: b.accountCode,
        accountName: b.accountName,
        category: b.category,
        debitTotal: b.debitTotal,
        creditTotal: b.creditTotal,
        debitBalance,
        creditBalance,
      };
    });

  return {
    rows,
    totalDebit: rows.reduce((s, r) => s + r.debitTotal, 0),
    totalCredit: rows.reduce((s, r) => s + r.creditTotal, 0),
    totalDebitBalance: rows.reduce((s, r) => s + r.debitBalance, 0),
    totalCreditBalance: rows.reduce((s, r) => s + r.creditBalance, 0),
  };
}
