"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangeFilter } from "@/components/reports/date-range-filter";
import { formatYen } from "@/lib/utils/currency";

interface PLItem {
  code: string;
  name: string;
  amount: number;
}

interface PLSection {
  label: string;
  items: PLItem[];
  total: number;
}

interface ProfitLoss {
  revenue: PLSection;
  costOfSales: PLSection;
  grossProfit: number;
  sellingAndAdmin: PLSection;
  operatingIncome: number;
  nonOperatingIncome: PLSection;
  nonOperatingExpense: PLSection;
  ordinaryIncome: number;
  extraordinaryGain: PLSection;
  extraordinaryLoss: PLSection;
  incomeBeforeTax: number;
  incomeTax: number;
  netIncome: number;
}

function PLSectionView({ section }: { section: PLSection }) {
  if (section.items.length === 0) return null;
  return (
    <div>
      <div className="text-sm font-semibold text-muted-foreground mb-1">
        {section.label}
      </div>
      {section.items.map((item, i) => (
        <div key={i} className="flex justify-between text-sm py-0.5 px-4">
          <span>
            {item.code && (
              <span className="text-muted-foreground font-mono mr-2">{item.code}</span>
            )}
            {item.name}
          </span>
          <span className="font-mono">{formatYen(item.amount)}</span>
        </div>
      ))}
      <div className="flex justify-between text-sm font-medium py-1 px-4 border-t">
        <span>{section.label} 合計</span>
        <span className="font-mono">{formatYen(section.total)}</span>
      </div>
    </div>
  );
}

function SubtotalRow({ label, amount, bold }: { label: string; amount: number; bold?: boolean }) {
  return (
    <div
      className={`flex justify-between py-2 px-2 border-t ${
        bold ? "font-bold text-base border-t-2" : "font-medium text-sm"
      }`}
    >
      <span>{label}</span>
      <span className="font-mono">{formatYen(amount)}</span>
    </div>
  );
}

export default function ProfitLossPage() {
  const [dateFrom, setDateFrom] = useState("2024-04-01");
  const [dateTo, setDateTo] = useState("2025-03-31");
  const [data, setData] = useState<ProfitLoss | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchData() {
    setLoading(true);
    const res = await fetch(
      `/api/reports/profit-loss?dateFrom=${dateFrom}&dateTo=${dateTo}`,
    );
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  const csvUrl = `/api/reports/profit-loss?dateFrom=${dateFrom}&dateTo=${dateTo}&format=csv`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">損益計算書（P/L）</h1>

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
        <Card className="max-w-2xl print:shadow-none print:border-none">
          <CardHeader className="print:pb-2">
            <CardTitle className="text-center">
              損益計算書
              <div className="text-sm font-normal text-muted-foreground">
                {dateFrom} 〜 {dateTo}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <PLSectionView section={data.revenue} />
            <PLSectionView section={data.costOfSales} />
            <SubtotalRow label="売上総利益" amount={data.grossProfit} />

            <PLSectionView section={data.sellingAndAdmin} />
            <SubtotalRow label="営業利益" amount={data.operatingIncome} />

            <PLSectionView section={data.nonOperatingIncome} />
            <PLSectionView section={data.nonOperatingExpense} />
            <SubtotalRow label="経常利益" amount={data.ordinaryIncome} />

            <PLSectionView section={data.extraordinaryGain} />
            <PLSectionView section={data.extraordinaryLoss} />
            <SubtotalRow label="税引前当期純利益" amount={data.incomeBeforeTax} />

            <div className="flex justify-between text-sm py-1 px-4">
              <span>法人税等</span>
              <span className="font-mono">{formatYen(data.incomeTax)}</span>
            </div>

            <SubtotalRow label="当期純利益" amount={data.netIncome} bold />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
