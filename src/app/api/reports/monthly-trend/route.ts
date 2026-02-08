import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { aggregateByMonth } from "@/lib/accounting/aggregate";
import { toCSV, csvResponse } from "@/lib/utils/csv";

export async function GET(request: Request) {
  const { user } = await requireAuth();
  const url = new URL(request.url);
  const dateFrom = url.searchParams.get("dateFrom") || "2024-04-01";
  const dateTo = url.searchParams.get("dateTo") || "2025-03-31";
  const format = url.searchParams.get("format");

  const monthlyData = await aggregateByMonth(user.companyId, dateFrom, dateTo);

  if (format === "csv") {
    // Build a pivot table: rows = accounts, columns = months
    const months = monthlyData.map((m) => m.month);
    const header = ["コード", "科目名", "区分", ...months];

    // Collect all account codes that have any activity
    const activeAccounts = new Map<string, { code: string; name: string; category: string }>();
    for (const m of monthlyData) {
      for (const b of m.balances) {
        if (b.balance !== 0) {
          activeAccounts.set(b.accountCode, {
            code: b.accountCode,
            name: b.accountName,
            category: b.category,
          });
        }
      }
    }

    const sortedAccounts = [...activeAccounts.values()].sort((a, b) =>
      a.code.localeCompare(b.code),
    );

    const dataRows = sortedAccounts.map((acc) => {
      const monthValues = monthlyData.map((m) => {
        const bal = m.balances.find((b) => b.accountCode === acc.code);
        return String(bal?.balance || 0);
      });
      return [acc.code, acc.name, acc.category, ...monthValues];
    });

    return csvResponse(toCSV([header, ...dataRows]), "monthly-trend.csv");
  }

  // For JSON, simplify the response
  const summary = monthlyData.map((m) => {
    const revenue = m.balances
      .filter((b) => b.category === "revenue")
      .reduce((s, b) => s + b.balance, 0);
    const expense = m.balances
      .filter((b) => b.category === "expense")
      .reduce((s, b) => s + b.balance, 0);
    return {
      month: m.month,
      revenue,
      expense,
      profit: revenue - expense,
      accounts: m.balances
        .filter((b) => b.balance !== 0)
        .map((b) => ({
          code: b.accountCode,
          name: b.accountName,
          category: b.category,
          balance: b.balance,
        })),
    };
  });

  return NextResponse.json(summary);
}
