import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "@/db";
import {
  journalEntries,
  journalLines,
  accounts,
  bankImportHistory,
} from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { parseBankCSV } from "@/lib/import/bank-csv/parser";
import { suggestAccount, checkDuplicate } from "@/lib/import/bank-csv/rule-engine";

/**
 * POST /api/import/bank — Parse CSV and return preview with suggestions.
 * Body: { csv: string }
 */
export async function POST(request: Request) {
  const { user } = await requireAuth();
  const url = new URL(request.url);
  const action = url.searchParams.get("action"); // "preview" or "confirm"
  const body = await request.json();

  if (action === "confirm") {
    return await handleConfirm(user, body);
  }

  // Default: preview
  return await handlePreview(user, body);
}

async function handlePreview(
  user: { id: string; companyId: string },
  body: { csv: string },
) {
  if (!body.csv) {
    return NextResponse.json({ error: "CSVデータがありません" }, { status: 400 });
  }

  const result = await parseBankCSV(body.csv);

  // Get bank account (普通預金 1120)
  const allAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.companyId, user.companyId));
  const bankAccount = allAccounts.find((a) => a.code === "1120");

  // Enrich transactions with suggestions and duplicate check
  const preview = await Promise.all(result.transactions.map(async (tx) => {
    const suggestion = await suggestAccount(user.companyId, tx);
    const isDuplicate = await checkDuplicate(user.companyId, tx.hash);

    return {
      ...tx,
      suggestion,
      isDuplicate,
      bankAccountId: bankAccount?.id || null,
      bankAccountCode: bankAccount?.code || "1120",
      bankAccountName: bankAccount?.name || "普通預金",
    };
  }));

  return NextResponse.json({
    format: result.format,
    confidence: result.confidence,
    transactions: preview,
    errors: result.errors,
    totalDeposit: result.transactions.reduce((s, t) => s + t.deposit, 0),
    totalWithdrawal: result.transactions.reduce((s, t) => s + t.withdrawal, 0),
  });
}

interface ConfirmTransaction {
  date: string;
  description: string;
  withdrawal: number;
  deposit: number;
  hash: string;
  accountId: string; // 相手科目（ユーザーが選択/確認済み）
  taxCategoryId?: string;
  bankAccountId: string; // 普通預金
}

async function handleConfirm(
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
    await db.insert(journalEntries)
      .values({
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
