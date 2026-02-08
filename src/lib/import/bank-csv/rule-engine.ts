/**
 * Auto-categorization rule engine.
 * Matches bank transaction descriptions against rules to suggest accounts.
 */
import { eq, desc, and } from "drizzle-orm";
import { db } from "@/db";
import { bankImportRules, bankImportHistory, journalEntries, journalLines, accounts } from "@/db/schema";
import type { BankTransaction } from "./parser";

export interface AccountSuggestion {
  accountId: string;
  accountCode: string;
  accountName: string;
  taxCategoryId: string | null;
  confidence: number; // 0-1
  source: "rule" | "history"; // ルールマッチ or 過去の仕訳から学習
}

/**
 * Suggest an account for a transaction based on rules and history.
 */
export async function suggestAccount(
  companyId: string,
  transaction: BankTransaction,
): Promise<AccountSuggestion | null> {
  const desc_lower = transaction.description.toLowerCase();

  // 1. Check explicit rules (highest priority)
  const rawRules = await db
    .select({
      accountId: bankImportRules.accountId,
      taxCategoryId: bankImportRules.taxCategoryId,
      pattern: bankImportRules.pattern,
      priority: bankImportRules.priority,
    })
    .from(bankImportRules)
    .where(eq(bankImportRules.companyId, companyId))
    .orderBy(desc(bankImportRules.priority));
  const rules = rawRules.filter((r) => desc_lower.includes(r.pattern.toLowerCase()));

  if (rules.length > 0) {
    const rule = rules[0];
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, rule.accountId))
      .limit(1);

    if (account) {
      return {
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        taxCategoryId: rule.taxCategoryId,
        confidence: 0.9,
        source: "rule",
      };
    }
  }

  // 2. Learn from past journal entries with similar descriptions
  const pastEntries = await db
    .select({
      description: journalEntries.description,
      entryId: journalEntries.id,
    })
    .from(journalEntries)
    .where(eq(journalEntries.companyId, companyId));

  // Find entries with similar descriptions
  const keywords = transaction.description
    .replace(/[0-9\s\-\/]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  for (const keyword of keywords) {
    const matching = pastEntries.filter(
      (e) => e.description && e.description.toLowerCase().includes(keyword.toLowerCase()),
    );

    if (matching.length > 0) {
      // Get the expense/income account from the most recent matching entry
      const recentEntry = matching[matching.length - 1];
      const lines = await db
        .select({
          accountId: journalLines.accountId,
          side: journalLines.side,
        })
        .from(journalLines)
        .where(eq(journalLines.journalEntryId, recentEntry.entryId));

      // For deposits (income), suggest the credit account that's not 普通預金
      // For withdrawals (expense), suggest the debit account that's not 普通預金
      const isDeposit = transaction.deposit > 0;
      const targetSide = isDeposit ? "credit" : "debit";
      const targetLine = lines.find((l) => l.side === targetSide);

      if (targetLine) {
        const [account] = await db
          .select()
          .from(accounts)
          .where(eq(accounts.id, targetLine.accountId))
          .limit(1);

        // Don't suggest bank account itself
        if (account && account.code !== "1120") {
          return {
            accountId: account.id,
            accountCode: account.code,
            accountName: account.name,
            taxCategoryId: null,
            confidence: 0.6,
            source: "history",
          };
        }
      }
    }
  }

  return null;
}

/**
 * Check for duplicate transactions.
 */
export async function checkDuplicate(
  companyId: string,
  hash: string,
): Promise<boolean> {
  const [existing] = await db
    .select()
    .from(bankImportHistory)
    .where(
      and(
        eq(bankImportHistory.companyId, companyId),
        eq(bankImportHistory.hash, hash),
      ),
    )
    .limit(1);

  return !!existing;
}
