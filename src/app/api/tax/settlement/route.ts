import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "@/db";
import { accounts, journalEntries, journalLines } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { SETTLEMENT_TEMPLATES } from "@/lib/accounting/settlement";

/** GET /api/tax/settlement — list settlement templates */
export async function GET() {
  await requireAuth();
  return NextResponse.json(SETTLEMENT_TEMPLATES);
}

/**
 * POST /api/tax/settlement — create settlement journal entry from template.
 * Body: { templateId, date, amount, memo? }
 */
export async function POST(request: Request) {
  const { user } = await requireAuth();
  const body = await request.json();

  const { templateId, date, amount, memo } = body;

  if (!templateId || !date || !amount) {
    return NextResponse.json(
      { error: "テンプレート、日付、金額は必須です" },
      { status: 400 },
    );
  }

  const template = SETTLEMENT_TEMPLATES.find((t) => t.id === templateId);
  if (!template) {
    return NextResponse.json({ error: "テンプレートが見つかりません" }, { status: 404 });
  }

  // Find accounts by code
  const allAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.companyId, user.companyId));

  const debitAccount = allAccounts.find((a) => a.code === template.debitAccountCode);
  const creditAccount = allAccounts.find((a) => a.code === template.creditAccountCode);

  if (!debitAccount || !creditAccount) {
    return NextResponse.json(
      {
        error: `科目が見つかりません: ${!debitAccount ? template.debitAccountCode : ""} ${!creditAccount ? template.creditAccountCode : ""}`.trim(),
      },
      { status: 404 },
    );
  }

  const now = new Date().toISOString();
  const entryId = ulid();
  const entryAmount = parseInt(String(amount));

  await db.insert(journalEntries)
    .values({
      id: entryId,
      companyId: user.companyId,
      fiscalYearId: "",
      date,
      description: memo || template.name,
      clientName: null,
      status: "draft",
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    });

  await db.insert(journalLines)
    .values({
      id: ulid(),
      journalEntryId: entryId,
      side: "debit",
      accountId: debitAccount.id,
      amount: entryAmount,
      taxCategoryId: null,
      taxAmount: 0,
      sortOrder: 0,
    });

  await db.insert(journalLines)
    .values({
      id: ulid(),
      journalEntryId: entryId,
      side: "credit",
      accountId: creditAccount.id,
      amount: entryAmount,
      taxCategoryId: null,
      taxAmount: 0,
      sortOrder: 1,
    });

  return NextResponse.json({ journalEntryId: entryId });
}
