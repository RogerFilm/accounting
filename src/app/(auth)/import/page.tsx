import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Upload, FileSpreadsheet, Camera } from "lucide-react";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">データ取込</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/import/bank">
          <Card className="transition-colors hover:bg-muted/30 cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">銀行CSV取込</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                銀行の取引明細CSVを取り込んで仕訳を自動生成
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/import/receipts">
          <Card className="transition-colors hover:bg-muted/30 cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <Camera className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">レシートOCR</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                レシートを撮影・アップロードして仕訳を自動作成
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/import/freee">
          <Card className="transition-colors hover:bg-muted/30 cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">freee データ移行</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                freee の仕訳帳・取引CSVをインポート
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
