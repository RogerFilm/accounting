import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { fetchBalance, fetchTransactions, GmoApiError } from "@/lib/gmo-aozora/client";
import { transformTransactions } from "@/lib/gmo-aozora/transformer";
import { suggestAccount, checkDuplicate } from "@/lib/import/bank-csv/rule-engine";
import { handleConfirm } from "@/lib/import/confirm";

/**
 * GET /api/import/bank-api?action=balance — Fetch account balance.
 */
export async function GET(request: Request) {
  try {
    await requireAuth();
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    if (action === "balance") {
      const data = await fetchBalance();
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    if (e instanceof GmoApiError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status },
      );
    }
    throw e;
  }
}

/**
 * POST /api/import/bank-api — Fetch transactions and return preview.
 * POST /api/import/bank-api?action=confirm — Create journal entries.
 * Body for preview: { dateFrom: string, dateTo: string }
 * Body for confirm: { transactions: ConfirmTransaction[] }
 */
export async function POST(request: Request) {
  const { user } = await requireAuth();
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const body = await request.json();

  if (action === "confirm") {
    return await handleConfirm(user, body);
  }

  // Default: fetch transactions and return preview
  try {
    return await handlePreview(user, body);
  } catch (e) {
    if (e instanceof GmoApiError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status },
      );
    }
    throw e;
  }
}

async function handlePreview(
  user: { id: string; companyId: string },
  body: { dateFrom: string; dateTo: string },
) {
  if (!body.dateFrom || !body.dateTo) {
    return NextResponse.json(
      { error: "日付範囲を指定してください" },
      { status: 400 },
    );
  }

  // Fetch from GMO API
  const gmoTxs = await fetchTransactions(body.dateFrom, body.dateTo);
  const transactions = await transformTransactions(gmoTxs);

  // Get bank account (普通預金 1120)
  const allAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.companyId, user.companyId));
  const bankAccount = allAccounts.find((a) => a.code === "1120");

  // Enrich with suggestions and duplicate check
  const preview = await Promise.all(
    transactions.map(async (tx) => {
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
    }),
  );

  return NextResponse.json({
    transactions: preview,
    totalDeposit: transactions.reduce((s, t) => s + t.deposit, 0),
    totalWithdrawal: transactions.reduce((s, t) => s + t.withdrawal, 0),
  });
}
