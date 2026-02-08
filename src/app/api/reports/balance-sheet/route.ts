import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { calculateBalanceSheet } from "@/lib/accounting/balance-sheet";
import { toCSV, csvResponse } from "@/lib/utils/csv";

export async function GET(request: Request) {
  const { user } = await requireAuth();
  const url = new URL(request.url);
  const dateFrom = url.searchParams.get("dateFrom") || "2000-01-01";
  const dateTo = url.searchParams.get("dateTo") || "2099-12-31";
  const format = url.searchParams.get("format");

  const result = await calculateBalanceSheet(user.companyId, dateFrom, dateTo);

  if (format === "csv") {
    const rows: string[][] = [["区分", "勘定科目コード", "勘定科目", "金額"]];

    for (const section of result.assets) {
      for (const item of section.items) {
        rows.push([section.label, item.code, item.name, String(item.amount)]);
      }
      rows.push(["", "", `${section.label} 合計`, String(section.total)]);
    }
    rows.push(["", "", "資産合計", String(result.totalAssets)]);
    rows.push([]);

    for (const section of result.liabilities) {
      for (const item of section.items) {
        rows.push([section.label, item.code, item.name, String(item.amount)]);
      }
      rows.push(["", "", `${section.label} 合計`, String(section.total)]);
    }
    rows.push(["", "", "負債合計", String(result.totalLiabilities)]);
    rows.push([]);

    for (const section of result.equity) {
      for (const item of section.items) {
        rows.push([section.label, item.code, item.name, String(item.amount)]);
      }
      rows.push(["", "", `${section.label} 合計`, String(section.total)]);
    }
    rows.push(["", "", "純資産合計", String(result.totalEquity)]);
    rows.push(["", "", "負債・純資産合計", String(result.totalLiabilitiesAndEquity)]);

    return csvResponse(toCSV(rows), "balance-sheet.csv");
  }

  return NextResponse.json(result);
}
