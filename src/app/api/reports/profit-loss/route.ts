import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { calculateProfitLoss } from "@/lib/accounting/profit-loss";
import { toCSV, csvResponse } from "@/lib/utils/csv";

export async function GET(request: Request) {
  const { user } = await requireAuth();
  const url = new URL(request.url);
  const dateFrom = url.searchParams.get("dateFrom") || "2000-01-01";
  const dateTo = url.searchParams.get("dateTo") || "2099-12-31";
  const format = url.searchParams.get("format");

  const result = await calculateProfitLoss(user.companyId, dateFrom, dateTo);

  if (format === "csv") {
    const rows: string[][] = [["項目", "勘定科目コード", "勘定科目", "金額"]];

    // Revenue
    for (const item of result.revenue.items) {
      rows.push([result.revenue.label, item.code, item.name, String(item.amount)]);
    }
    rows.push(["", "", "売上高 合計", String(result.revenue.total)]);

    // Cost of sales
    for (const item of result.costOfSales.items) {
      rows.push([result.costOfSales.label, item.code, item.name, String(item.amount)]);
    }
    rows.push(["", "", "売上原価 合計", String(result.costOfSales.total)]);
    rows.push(["", "", "売上総利益", String(result.grossProfit)]);

    // SGA
    for (const item of result.sellingAndAdmin.items) {
      rows.push([result.sellingAndAdmin.label, item.code, item.name, String(item.amount)]);
    }
    rows.push(["", "", "販管費 合計", String(result.sellingAndAdmin.total)]);
    rows.push(["", "", "営業利益", String(result.operatingIncome)]);

    // Non-operating
    for (const item of result.nonOperatingIncome.items) {
      rows.push(["営業外収益", item.code, item.name, String(item.amount)]);
    }
    for (const item of result.nonOperatingExpense.items) {
      rows.push(["営業外費用", item.code, item.name, String(item.amount)]);
    }
    rows.push(["", "", "経常利益", String(result.ordinaryIncome)]);

    // Extraordinary
    for (const item of result.extraordinaryGain.items) {
      rows.push(["特別利益", item.code, item.name, String(item.amount)]);
    }
    for (const item of result.extraordinaryLoss.items) {
      rows.push(["特別損失", item.code, item.name, String(item.amount)]);
    }
    rows.push(["", "", "税引前当期純利益", String(result.incomeBeforeTax)]);
    rows.push(["", "", "法人税等", String(result.incomeTax)]);
    rows.push(["", "", "当期純利益", String(result.netIncome)]);

    return csvResponse(toCSV(rows), "profit-loss.csv");
  }

  return NextResponse.json(result);
}
