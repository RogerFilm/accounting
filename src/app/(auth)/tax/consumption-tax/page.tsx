"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatYen } from "@/lib/utils/currency";
import { Calculator, RefreshCw } from "lucide-react";

interface TaxBreakdown {
  rate: number;
  isReduced: boolean;
  taxableAmount: number;
  taxAmount: number;
}

interface TaxResult {
  method: "standard" | "simplified";
  dateFrom: string;
  dateTo: string;
  salesBreakdown: TaxBreakdown[];
  totalTaxableSales: number;
  totalSalesTax: number;
  purchaseBreakdown: TaxBreakdown[];
  totalTaxablePurchases: number;
  totalPurchaseTax: number;
  businessType?: number;
  deemedPurchaseRate?: number;
  deemedPurchaseTax?: number;
  taxPayable: number;
  nationalTax: number;
  localTax: number;
  deemedPurchaseRates: Record<string, { name: string; rate: number }>;
}

export default function ConsumptionTaxPage() {
  const currentYear = new Date().getFullYear();
  const [dateFrom, setDateFrom] = useState(`${currentYear}-04-01`);
  const [dateTo, setDateTo] = useState(`${currentYear + 1}-03-31`);
  const [method, setMethod] = useState<"standard" | "simplified">("simplified");
  const [businessType, setBusinessType] = useState(5);
  const [result, setResult] = useState<TaxResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function calculate() {
    setLoading(true);
    const params = new URLSearchParams({
      dateFrom,
      dateTo,
      method,
      businessType: String(businessType),
    });
    const res = await fetch(`/api/tax/consumption-tax?${params}`);
    if (res.ok) {
      setResult(await res.json());
    }
    setLoading(false);
  }

  useEffect(() => {
    calculate();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">消費税計算</h1>

      {/* Settings */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <Label>期間（開始）</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label>期間（終了）</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div>
              <Label>課税方式</Label>
              <Select
                value={method}
                onChange={(e) => setMethod(e.target.value as "standard" | "simplified")}
              >
                <option value="standard">本則課税（一般課税）</option>
                <option value="simplified">簡易課税</option>
              </Select>
            </div>
            {method === "simplified" && (
              <div>
                <Label>事業区分</Label>
                <Select
                  value={String(businessType)}
                  onChange={(e) => setBusinessType(parseInt(e.target.value))}
                >
                  <option value="1">第1種（卸売業）90%</option>
                  <option value="2">第2種（小売業）80%</option>
                  <option value="3">第3種（製造業等）70%</option>
                  <option value="4">第4種（その他）60%</option>
                  <option value="5">第5種（サービス業等）50%</option>
                  <option value="6">第6種（不動産業）40%</option>
                </Select>
              </div>
            )}
            <div className="flex items-end">
              <Button onClick={calculate} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                計算
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {result && (
        <>
          {/* Sales */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">課税売上</CardTitle>
            </CardHeader>
            <CardContent>
              {result.salesBreakdown.length > 0 ? (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>税率</TableHead>
                      <TableHead className="text-right">課税売上額</TableHead>
                      <TableHead className="text-right">消費税額</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.salesBreakdown.map((bd, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          {bd.rate}%
                          {bd.isReduced && (
                            <Badge variant="secondary" className="ml-1 text-[10px]">軽減</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatYen(bd.taxableAmount)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatYen(bd.taxAmount)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-medium">
                      <TableCell>合計</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatYen(result.totalTaxableSales)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatYen(result.totalSalesTax)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">課税売上の仕訳がありません</p>
              )}
            </CardContent>
          </Card>

          {/* Purchases (standard method only) */}
          {result.method === "standard" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">課税仕入</CardTitle>
              </CardHeader>
              <CardContent>
                {result.purchaseBreakdown.length > 0 ? (
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>税率</TableHead>
                        <TableHead className="text-right">課税仕入額</TableHead>
                        <TableHead className="text-right">消費税額</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.purchaseBreakdown.map((bd, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            {bd.rate}%
                            {bd.isReduced && (
                              <Badge variant="secondary" className="ml-1 text-[10px]">軽減</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatYen(bd.taxableAmount)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatYen(bd.taxAmount)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-medium">
                        <TableCell>合計</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatYen(result.totalTaxablePurchases)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatYen(result.totalPurchaseTax)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">課税仕入の仕訳がありません</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Result summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                消費税額計算結果
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>課税売上に係る消費税額</span>
                      <span className="font-mono">{formatYen(result.totalSalesTax)}</span>
                    </div>

                    {result.method === "standard" ? (
                      <div className="flex justify-between text-sm">
                        <span>課税仕入に係る消費税額</span>
                        <span className="font-mono">- {formatYen(result.totalPurchaseTax)}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-sm">
                        <span>
                          みなし仕入控除税額
                          <Badge variant="outline" className="ml-1 text-[10px]">
                            {result.deemedPurchaseRate && `${result.deemedPurchaseRate * 100}%`}
                          </Badge>
                        </span>
                        <span className="font-mono">
                          - {formatYen(result.deemedPurchaseTax || 0)}
                        </span>
                      </div>
                    )}

                    <div className="border-t pt-2 flex justify-between font-medium">
                      <span>納付税額</span>
                      <span className="font-mono text-lg">
                        {formatYen(result.taxPayable)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 bg-muted p-3 rounded-md">
                    <p className="text-sm font-medium">内訳</p>
                    <div className="flex justify-between text-sm">
                      <span>国税（消費税）</span>
                      <span className="font-mono">{formatYen(result.nationalTax)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>地方消費税</span>
                      <span className="font-mono">{formatYen(result.localTax)}</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-3">
                  ※ この計算は参考値です。確定申告時は税理士にご確認ください。
                  {result.method === "simplified" &&
                    " 簡易課税は基準期間の課税売上高が5,000万円以下の場合に選択できます。"}
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
