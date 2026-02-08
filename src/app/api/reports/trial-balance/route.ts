import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { calculateTrialBalance } from "@/lib/accounting/trial-balance";
import { toCSV, csvResponse } from "@/lib/utils/csv";
import { ACCOUNT_CATEGORY_LABELS } from "@/types";

export async function GET(request: Request) {
  const { user } = await requireAuth();
  const url = new URL(request.url);
  const dateFrom = url.searchParams.get("dateFrom") || "2000-01-01";
  const dateTo = url.searchParams.get("dateTo") || "2099-12-31";
  const format = url.searchParams.get("format"); // "csv" or default json

  const result = await calculateTrialBalance(user.companyId, dateFrom, dateTo);

  if (format === "csv") {
    const header = ["勘定科目コード", "勘定科目", "区分", "借方合計", "貸方合計", "借方残高", "貸方残高"];
    const dataRows = result.rows.map((r) => [
      r.accountCode,
      r.accountName,
      ACCOUNT_CATEGORY_LABELS[r.category],
      String(r.debitTotal),
      String(r.creditTotal),
      String(r.debitBalance),
      String(r.creditBalance),
    ]);
    const totalRow = [
      "",
      "合計",
      "",
      String(result.totalDebit),
      String(result.totalCredit),
      String(result.totalDebitBalance),
      String(result.totalCreditBalance),
    ];
    return csvResponse(toCSV([header, ...dataRows, totalRow]), "trial-balance.csv");
  }

  return NextResponse.json(result);
}
