import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import {
  fetchVaDepositTransactions,
  GmoApiError,
} from "@/lib/gmo-aozora/client";
import {
  reconcilePreview,
  reconcileConfirm,
  type ReconcileMatch,
} from "@/lib/gmo-aozora/reconciliation";

/**
 * POST /api/va/reconcile — 入金照会+消し込みプレビュー
 * POST /api/va/reconcile?action=confirm — 消し込み確定
 *
 * Preview body: { dateFrom: string, dateTo: string, vaNumber?: string }
 * Confirm body: { matches: ReconcileMatch[] }
 */
export async function POST(request: Request) {
  const { user } = await requireAuth();
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const body = await request.json();

  if (action === "confirm") {
    return handleConfirm(user, body);
  }

  return handlePreview(user, body);
}

async function handlePreview(
  user: { id: string; companyId: string },
  body: { dateFrom: string; dateTo: string; vaNumber?: string },
) {
  if (!body.dateFrom || !body.dateTo) {
    return NextResponse.json(
      { error: "日付範囲を指定してください" },
      { status: 400 },
    );
  }

  try {
    // Fetch deposit transactions from GMO API
    const deposits = await fetchVaDepositTransactions({
      dateFrom: body.dateFrom,
      dateTo: body.dateTo,
      vaNumber: body.vaNumber,
    });

    // Match deposits with invoices
    const matches = await reconcilePreview(user.companyId, deposits);

    const totalDeposit = matches.reduce((s, m) => s + m.depositAmount, 0);
    const matchedCount = matches.filter((m) => !m.isDuplicate).length;
    const duplicateCount = matches.filter((m) => m.isDuplicate).length;

    return NextResponse.json({
      matches,
      summary: {
        totalDeposits: deposits.length,
        matchedCount,
        duplicateCount,
        unmatchedCount: deposits.length - matches.length,
        totalDepositAmount: totalDeposit,
      },
    });
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

async function handleConfirm(
  user: { id: string; companyId: string },
  body: { matches: ReconcileMatch[] },
) {
  if (!body.matches || body.matches.length === 0) {
    return NextResponse.json(
      { error: "消し込み対象がありません" },
      { status: 400 },
    );
  }

  try {
    const result = await reconcileConfirm(user, body.matches);

    return NextResponse.json({
      success: true,
      created: result.created.length,
      skipped: result.skipped.length,
      journalEntryIds: result.created,
    });
  } catch (e) {
    if (e instanceof Error) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
    throw e;
  }
}
