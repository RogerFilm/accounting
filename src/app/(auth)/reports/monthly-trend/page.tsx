"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { DateRangeFilter } from "@/components/reports/date-range-filter";
import { formatYen } from "@/lib/utils/currency";

interface MonthData {
  month: string;
  revenue: number;
  expense: number;
  profit: number;
}

export default function MonthlyTrendPage() {
  const [dateFrom, setDateFrom] = useState("2024-04-01");
  const [dateTo, setDateTo] = useState("2025-03-31");
  const [data, setData] = useState<MonthData[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchData() {
    setLoading(true);
    const res = await fetch(
      `/api/reports/monthly-trend?dateFrom=${dateFrom}&dateTo=${dateTo}`,
    );
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  const csvUrl = `/api/reports/monthly-trend?dateFrom=${dateFrom}&dateTo=${dateTo}&format=csv`;

  const totalRevenue = data?.reduce((s, m) => s + m.revenue, 0) ?? 0;
  const totalExpense = data?.reduce((s, m) => s + m.expense, 0) ?? 0;
  const totalProfit = data?.reduce((s, m) => s + m.profit, 0) ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">月次推移表</h1>

      <DateRangeFilter
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onApply={fetchData}
        csvUrl={data ? csvUrl : undefined}
      />

      {loading && (
        <div className="text-center text-sm text-muted-foreground">読み込み中...</div>
      )}

      {data && (
        <Card className="print:shadow-none print:border-none">
          <CardHeader className="print:pb-2">
            <CardTitle className="text-center">
              月次推移表
              <div className="text-sm font-normal text-muted-foreground">
                {dateFrom} 〜 {dateTo}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>月</TableHead>
                  <TableHead className="text-right">売上</TableHead>
                  <TableHead className="text-right">費用</TableHead>
                  <TableHead className="text-right">利益</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((m) => (
                  <TableRow key={m.month}>
                    <TableCell className="font-medium">{m.month}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {m.revenue > 0 ? formatYen(m.revenue) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {m.expense > 0 ? formatYen(m.expense) : "-"}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono text-sm font-medium ${
                        m.profit < 0 ? "text-red-600" : ""
                      }`}
                    >
                      {m.profit !== 0 ? formatYen(m.profit) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold border-t-2">
                  <TableCell>合計</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatYen(totalRevenue)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatYen(totalExpense)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono ${
                      totalProfit < 0 ? "text-red-600" : ""
                    }`}
                  >
                    {formatYen(totalProfit)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
