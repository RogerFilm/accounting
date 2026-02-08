import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FileSpreadsheet, Scale, TrendingUp, BarChart3 } from "lucide-react";

const reports = [
  {
    href: "/reports/trial-balance",
    title: "残高試算表",
    description: "勘定科目別の借方・貸方合計と残高を表示",
    icon: FileSpreadsheet,
  },
  {
    href: "/reports/balance-sheet",
    title: "貸借対照表（B/S）",
    description: "資産・負債・純資産の状況を表示",
    icon: Scale,
  },
  {
    href: "/reports/profit-loss",
    title: "損益計算書（P/L）",
    description: "売上・費用・利益の状況を表示",
    icon: TrendingUp,
  },
  {
    href: "/reports/monthly-trend",
    title: "月次推移表",
    description: "月別の売上・費用・利益の推移を表示",
    icon: BarChart3,
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">レポート</h1>

      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((report) => (
          <Link key={report.href} href={report.href}>
            <Card className="transition-colors hover:bg-muted/30 cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <report.icon className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">{report.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{report.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
