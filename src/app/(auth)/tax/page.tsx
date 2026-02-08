import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Calculator, Building2, ClipboardCheck } from "lucide-react";

export default function TaxPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">決算・税務</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/tax/depreciation">
          <Card className="transition-colors hover:bg-muted/30 cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">固定資産・減価償却</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                固定資産台帳の管理と減価償却費の自動計算・仕訳生成
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/tax/consumption-tax">
          <Card className="transition-colors hover:bg-muted/30 cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <Calculator className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">消費税計算</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                本則課税・簡易課税の消費税額を自動計算
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/tax/settlement">
          <Card className="transition-colors hover:bg-muted/30 cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">決算整理仕訳</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                減価償却・未払費用・前払費用・消費税の決算整理仕訳を作成
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
