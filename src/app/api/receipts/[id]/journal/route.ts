import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "@/db";
import { receipts, journalEntries, journalLines, accounts, taxCategories } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";

/** POST /api/receipts/[id]/journal — create journal entry from receipt */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await requireAuth();
  const { id } = await params;
  const body = await request.json();

  const [receipt] = await db
    .select()
    .from(receipts)
    .where(
      and(eq(receipts.id, id), eq(receipts.companyId, user.companyId)),
    );

  if (!receipt) {
    return NextResponse.json({ error: "レシートが見つかりません" }, { status: 404 });
  }

  if (receipt.journalEntryId) {
    return NextResponse.json({ error: "このレシートは既に仕訳が登録されています" }, { status: 409 });
  }

  // Required fields
  const { accountId, date, amount, taxCategoryId, description } = body;
  if (!accountId || !date || !amount) {
    return NextResponse.json(
      { error: "勘定科目、日付、金額は必須です" },
      { status: 400 },
    );
  }

  // Look up the expense account
  const [expenseAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId));

  if (!expenseAccount) {
    return NextResponse.json({ error: "勘定科目が見つかりません" }, { status: 404 });
  }

  // Find cash account (1100) for the credit side
  const cashAccount = (await db
    .select()
    .from(accounts)
    .where(eq(accounts.companyId, user.companyId))
  ).find((a) => a.code === "1100");

  if (!cashAccount) {
    return NextResponse.json({ error: "現金科目が見つかりません" }, { status: 500 });
  }

  // Calculate tax if applicable
  let taxAmount = 0;
  if (taxCategoryId) {
    const [taxCat] = await db
      .select()
      .from(taxCategories)
      .where(eq(taxCategories.id, taxCategoryId));
    if (taxCat && taxCat.rate > 0) {
      // Tax-inclusive: amount includes tax
      taxAmount = Math.floor(parseInt(String(amount)) * taxCat.rate / (100 + taxCat.rate));
    }
  }

  const now = new Date().toISOString();
  const entryId = ulid();
  const entryAmount = parseInt(String(amount));

  // Create journal entry: 費用(debit) / 現金(credit)
  await db.insert(journalEntries)
    .values({
      id: entryId,
      companyId: user.companyId,
      fiscalYearId: "",
      date,
      description: description || receipt.storeName || "レシート取込",
      clientName: receipt.storeName || null,
      status: "draft",
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    });

  // Debit: expense account
  await db.insert(journalLines)
    .values({
      id: ulid(),
      journalEntryId: entryId,
      side: "debit",
      accountId,
      amount: entryAmount,
      taxCategoryId: taxCategoryId || null,
      taxAmount,
      sortOrder: 0,
    });

  // Credit: cash
  await db.insert(journalLines)
    .values({
      id: ulid(),
      journalEntryId: entryId,
      side: "credit",
      accountId: cashAccount.id,
      amount: entryAmount,
      taxCategoryId: null,
      taxAmount: 0,
      sortOrder: 1,
    });

  // Link receipt to journal entry
  await db.update(receipts)
    .set({
      journalEntryId: entryId,
      status: "journalized",
      updatedAt: now,
    })
    .where(eq(receipts.id, id));

  return NextResponse.json({
    journalEntryId: entryId,
  });
}
