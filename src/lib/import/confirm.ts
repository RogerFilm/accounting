/**
 * Shared confirm handler for bank imports (CSV and API).
 * Creates journal entries from confirmed transactions.
 */

import { NextResponse } from "next/server";
import { ulid } from "ulid";
import { db } from "@/db";
import { journalEntries, journalLines, bankImportHistory } from "@/db/schema";
import { checkDuplicate } from "@/lib/import/bank-csv/rule-engine";

export interface ConfirmTransaction {
  date: string;
  description: string;
  withdrawal: number;
  deposit: number;
  hash: string;
  accountId: string; // 相手科目（ユーザーが選択/確認済み）
  taxCategoryId?: string;
  bankAccountId: string; // 普通預金
}

export async function handleConfirm(
  user: { id: string; companyId: string },
  body: { transactions: ConfirmTransaction[] },
) {
  if (!body.transactions || body.transactions.length === 0) {
    return NextResponse.json({ error: "取引がありません" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const created: string[] = [];
  const skipped: string[] = [];

  for (const tx of body.transactions) {
    // Skip duplicates
    const isDup = await checkDuplicate(user.companyId, tx.hash);
    if (isDup) {
      skipped.push(tx.hash);
      continue;
    }

    const entryId = ulid();
    const isDeposit = tx.deposit > 0;
    const amount = isDeposit ? tx.deposit : tx.withdrawal;

    // Create journal entry
    await db.insert(journalEntries).values({
      id: entryId,
      companyId: user.companyId,
      fiscalYearId: "",
      date: tx.date,
      description: tx.description,
      clientName: null,
      status: "confirmed",
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    });

    if (isDeposit) {
      // 入金: 普通預金(debit) / 相手科目(credit)
      await db.insert(journalLines).values({
        id: ulid(),
        journalEntryId: entryId,
        side: "debit",
        accountId: tx.bankAccountId,
        amount,
        taxCategoryId: null,
        taxAmount: 0,
        sortOrder: 0,
      });
      await db.insert(journalLines).values({
        id: ulid(),
        journalEntryId: entryId,
        side: "credit",
        accountId: tx.accountId,
        amount,
        taxCategoryId: tx.taxCategoryId || null,
        taxAmount: 0,
        sortOrder: 1,
      });
    } else {
      // 出金: 相手科目(debit) / 普通預金(credit)
      await db.insert(journalLines).values({
        id: ulid(),
        journalEntryId: entryId,
        side: "debit",
        accountId: tx.accountId,
        amount,
        taxCategoryId: tx.taxCategoryId || null,
        taxAmount: 0,
        sortOrder: 0,
      });
      await db.insert(journalLines).values({
        id: ulid(),
        journalEntryId: entryId,
        side: "credit",
        accountId: tx.bankAccountId,
        amount,
        taxCategoryId: null,
        taxAmount: 0,
        sortOrder: 1,
      });
    }

    // Record import history for duplicate detection
    await db.insert(bankImportHistory).values({
      id: ulid(),
      companyId: user.companyId,
      hash: tx.hash,
      journalEntryId: entryId,
      importedAt: now,
    });

    created.push(entryId);
  }

  return NextResponse.json({
    created: created.length,
    skipped: skipped.length,
    journalEntryIds: created,
  });
}
