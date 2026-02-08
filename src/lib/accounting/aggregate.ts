/**
 * Core aggregation logic: sum journal lines by account within a date range.
 * This is the foundation for trial balance, BS, and PL.
 */
import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { journalEntries, journalLines, accounts } from "@/db/schema";

export interface AccountBalance {
  accountId: string;
  accountCode: string;
  accountName: string;
  category: "asset" | "liability" | "equity" | "revenue" | "expense";
  debitTotal: number;
  creditTotal: number;
  balance: number; // net balance (debit-normal: debit-credit, credit-normal: credit-debit)
}

/**
 * Aggregate all confirmed journal lines by account for a given company and date range.
 */
export async function aggregateByAccount(
  companyId: string,
  dateFrom: string,
  dateTo: string,
): Promise<AccountBalance[]> {
  // Get all confirmed journal entries in range
  const entries = await db
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.companyId, companyId),
        eq(journalEntries.status, "confirmed"),
        gte(journalEntries.date, dateFrom),
        lte(journalEntries.date, dateTo),
      ),
    );

  const entryIds = new Set(entries.map((e) => e.id));
  if (entryIds.size === 0) {
    // Return all accounts with zero balances
    const zeroAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.companyId, companyId));
    return zeroAccounts.map((a) => ({
      accountId: a.id,
      accountCode: a.code,
      accountName: a.name,
      category: a.category as AccountBalance["category"],
      debitTotal: 0,
      creditTotal: 0,
      balance: 0,
    }));
  }

  // Get all lines and filter by entry IDs
  const rawLines = await db
    .select({
      accountId: journalLines.accountId,
      side: journalLines.side,
      amount: journalLines.amount,
      journalEntryId: journalLines.journalEntryId,
    })
    .from(journalLines);
  const allLines = rawLines.filter((l) => entryIds.has(l.journalEntryId));

  // Aggregate by account
  const totals = new Map<string, { debit: number; credit: number }>();
  for (const line of allLines) {
    const existing = totals.get(line.accountId) || { debit: 0, credit: 0 };
    if (line.side === "debit") {
      existing.debit += line.amount;
    } else {
      existing.credit += line.amount;
    }
    totals.set(line.accountId, existing);
  }

  // Get all accounts for the company
  const allAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.companyId, companyId));

  return allAccounts.map((a) => {
    const t = totals.get(a.id) || { debit: 0, credit: 0 };
    const isDebitNormal = a.category === "asset" || a.category === "expense";
    const balance = isDebitNormal
      ? t.debit - t.credit
      : t.credit - t.debit;

    return {
      accountId: a.id,
      accountCode: a.code,
      accountName: a.name,
      category: a.category as AccountBalance["category"],
      debitTotal: t.debit,
      creditTotal: t.credit,
      balance,
    };
  });
}

/**
 * Aggregate by account for each month in a date range (for monthly trend).
 */
export async function aggregateByMonth(
  companyId: string,
  dateFrom: string,
  dateTo: string,
): Promise<{ month: string; balances: AccountBalance[] }[]> {
  const start = new Date(dateFrom);
  const end = new Date(dateTo);
  const results: { month: string; balances: AccountBalance[] }[] = [];

  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const monthStart = cursor.toISOString().split("T")[0];
    const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const monthEnd = nextMonth.toISOString().split("T")[0];
    const label = `${cursor.getFullYear()}/${String(cursor.getMonth() + 1).padStart(2, "0")}`;

    results.push({
      month: label,
      balances: await aggregateByAccount(companyId, monthStart, monthEnd),
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return results;
}
