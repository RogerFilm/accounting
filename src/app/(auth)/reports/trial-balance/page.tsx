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
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangeFilter } from "@/components/reports/date-range-filter";
import { formatYen } from "@/lib/utils/currency";
import { ACCOUNT_CATEGORY_LABELS } from "@/types";
import type { AccountCategory } from "@/types";

interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  category: AccountCategory;
  debitTotal: number;
  creditTotal: number;
  debitBalance: number;
  creditBalance: number;
}

interface TrialBalance {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  totalDebitBalance: number;
  totalCreditBalance: number;
}

export default function TrialBalancePage() {
  const [dateFrom, setDateFrom] = useState("2024-04-01");
  const [dateTo, setDateTo] = useState("2025-03-31");
  const [data, setData] = useState<TrialBalance | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchData() {
    setLoading(true);
    const res = await fetch(
      `/api/reports/trial-balance?dateFrom=${dateFrom}&dateTo=${dateTo}`,
    );
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  const csvUrl = `/api/reports/trial-balance?dateFrom=${dateFrom}&dateTo=${dateTo}&format=csv`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">残高試算表</h1>

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
              残高試算表
              <div className="text-sm font-normal text-muted-foreground">
                {dateFrom} 〜 {dateTo}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">コード</TableHead>
                  <TableHead>勘定科目</TableHead>
                  <TableHead className="w-16 text-center">区分</TableHead>
                  <TableHead className="w-28 text-right">借方合計</TableHead>
                  <TableHead className="w-28 text-right">貸方合計</TableHead>
                  <TableHead className="w-28 text-right">借方残高</TableHead>
                  <TableHead className="w-28 text-right">貸方残高</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.accountCode}>
                    <TableCell className="font-mono text-sm">{row.accountCode}</TableCell>
                    <TableCell className="text-sm">{row.accountName}</TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {ACCOUNT_CATEGORY_LABELS[row.category]}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.debitTotal > 0 ? formatYen(row.debitTotal) : ""}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.creditTotal > 0 ? formatYen(row.creditTotal) : ""}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.debitBalance > 0 ? formatYen(row.debitBalance) : ""}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.creditBalance > 0 ? formatYen(row.creditBalance) : ""}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold border-t-2">
                  <TableCell></TableCell>
                  <TableCell>合計</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right font-mono">
                    {formatYen(data.totalDebit)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatYen(data.totalCredit)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatYen(data.totalDebitBalance)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatYen(data.totalCreditBalance)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            </div>
            {data.totalDebit === data.totalCredit ? (
              <div className="p-3 text-center text-sm text-green-600 bg-green-50">
                借方合計 = 貸方合計 ✓
              </div>
            ) : (
              <div className="p-3 text-center text-sm text-red-600 bg-red-50">
                借方合計 ≠ 貸方合計（差額: {formatYen(Math.abs(data.totalDebit - data.totalCredit))}）
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
