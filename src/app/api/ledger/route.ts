import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { journalEntries, journalLines, accounts } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";

/** GET /api/ledger?accountId=xxx — get ledger entries for a specific account */
export async function GET(request: Request) {
  const { user } = await requireAuth();
  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId");

  if (!accountId) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  // Get the account's category to determine normal balance side
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId));

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Find all journal lines for this account, joined with their entries
  const lines = (await db
    .select({
      lineId: journalLines.id,
      side: journalLines.side,
      amount: journalLines.amount,
      lineDescription: journalLines.description,
      entryId: journalEntries.id,
      date: journalEntries.date,
      entryDescription: journalEntries.description,
      companyId: journalEntries.companyId,
      journalEntryId: journalLines.journalEntryId,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .where(eq(journalLines.accountId, accountId))
    .orderBy(asc(journalEntries.date))
  ).filter((row) => row.companyId === user.companyId);

  // For each line, find the counter account(s)
  const result = [];
  let runningBalance = 0;

  for (const line of lines) {
    // Get other lines in same entry (counter accounts)
    const otherLines = (await db
      .select({
        accountName: accounts.name,
        accountCode: accounts.code,
      })
      .from(journalLines)
      .leftJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(eq(journalLines.journalEntryId, line.journalEntryId))
    ).filter(
        (ol) =>
          !(
            ol.accountCode === account.code &&
            ol.accountName === account.name
          ),
      );

    const counterAccount = otherLines
      .map((ol) => `${ol.accountCode} ${ol.accountName}`)
      .join(", ") || "諸口";

    const debitAmount = line.side === "debit" ? line.amount : 0;
    const creditAmount = line.side === "credit" ? line.amount : 0;

    // Normal balance: assets/expenses are debit-normal, others are credit-normal
    const isDebitNormal = account.category === "asset" || account.category === "expense";
    if (isDebitNormal) {
      runningBalance += debitAmount - creditAmount;
    } else {
      runningBalance += creditAmount - debitAmount;
    }

    result.push({
      date: line.date,
      description: line.lineDescription || line.entryDescription,
      debitAmount,
      creditAmount,
      balance: runningBalance,
      counterAccount,
    });
  }

  return NextResponse.json(result);
}
