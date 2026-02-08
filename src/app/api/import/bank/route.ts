import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { parseBankCSV } from "@/lib/import/bank-csv/parser";
import { suggestAccount, checkDuplicate } from "@/lib/import/bank-csv/rule-engine";
import { handleConfirm } from "@/lib/import/confirm";

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
