"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangeFilter } from "@/components/reports/date-range-filter";
import { formatYen } from "@/lib/utils/currency";

interface BSItem {
  code: string;
  name: string;
  amount: number;
}

interface BSSection {
  label: string;
  items: BSItem[];
  total: number;
}

interface BalanceSheet {
  assets: BSSection[];
  liabilities: BSSection[];
  equity: BSSection[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  netIncome: number;
}

function BSColumnSection({ sections, totalLabel, totalAmount }: {
  sections: BSSection[];
  totalLabel: string;
  totalAmount: number;
}) {
  return (
    <div className="space-y-2">
      {sections.map((section) => (
        <div key={section.label}>
          <div className="text-sm font-semibold text-muted-foreground mb-1">
            {section.label}
          </div>
          {section.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm py-0.5 px-2">
              <span>
                {item.code && (
                  <span className="text-muted-foreground font-mono mr-2">{item.code}</span>
                )}
                {item.name}
              </span>
              <span className="font-mono">{formatYen(item.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm font-medium py-1 px-2 border-t">
            <span>{section.label} 合計</span>
            <span className="font-mono">{formatYen(section.total)}</span>
          </div>
        </div>
      ))}
      <div className="flex justify-between font-bold text-base py-2 px-2 border-t-2">
        <span>{totalLabel}</span>
        <span className="font-mono">{formatYen(totalAmount)}</span>
      </div>
    </div>
  );
}

export default function BalanceSheetPage() {
  const [dateFrom, setDateFrom] = useState("2024-04-01");
  const [dateTo, setDateTo] = useState("2025-03-31");
  const [data, setData] = useState<BalanceSheet | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchData() {
    setLoading(true);
    const res = await fetch(
      `/api/reports/balance-sheet?dateFrom=${dateFrom}&dateTo=${dateTo}`,
    );
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  const csvUrl = `/api/reports/balance-sheet?dateFrom=${dateFrom}&dateTo=${dateTo}&format=csv`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">貸借対照表（B/S）</h1>

      <DateRangeFilter
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onApply={fetchData}
        csvUrl={data ? csvUrl : undefined}
      />

      {loading && (
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}

      {data && (
        <Card className="print:shadow-none print:border-none">
          <CardHeader className="print:pb-2">
            <CardTitle className="text-center">
              貸借対照表
              <div className="text-sm font-normal text-muted-foreground">
                {dateTo} 現在
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              {/* Left: Assets */}
              <BSColumnSection
                sections={data.assets}
                totalLabel="資産合計"
                totalAmount={data.totalAssets}
              />

              {/* Right: Liabilities + Equity */}
              <div className="space-y-4">
                <BSColumnSection
                  sections={data.liabilities}
                  totalLabel="負債合計"
                  totalAmount={data.totalLiabilities}
                />
                <BSColumnSection
                  sections={data.equity}
                  totalLabel="純資産合計"
                  totalAmount={data.totalEquity}
                />
                <div className="flex justify-between font-bold text-base py-2 px-2 border-t-2 border-double">
                  <span>負債・純資産合計</span>
                  <span className="font-mono">
                    {formatYen(data.totalLiabilitiesAndEquity)}
                  </span>
                </div>
              </div>
            </div>

            {data.totalAssets === data.totalLiabilitiesAndEquity ? (
              <div className="mt-4 p-3 text-center text-sm text-green-600 bg-green-50 rounded">
                資産合計 = 負債・純資産合計 ✓
              </div>
            ) : (
              <div className="mt-4 p-3 text-center text-sm text-red-600 bg-red-50 rounded">
                資産合計 ≠ 負債・純資産合計（差額: {formatYen(Math.abs(data.totalAssets - data.totalLiabilitiesAndEquity))}）
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
