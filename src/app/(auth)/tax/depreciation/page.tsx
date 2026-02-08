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
import { Plus, BookOpen, Building2, Check, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Account {
  id: string;
  code: string;
  name: string;
  category: string;
}

interface FixedAsset {
  id: string;
  name: string;
  category: string;
  acquisitionDate: string;
  acquisitionCost: number;
  usefulLife: number;
  depreciationMethod: string;
  residualValue: number;
  accountId: string;
  depreciationAccountId: string;
}

interface DepreciationResult {
  asset: FixedAsset;
  currentYearAmount: number;
  accumulatedDepreciation: number;
  bookValue: number;
  schedule: Array<{
    year: number;
    fiscalYear: string;
    startBookValue: number;
    depreciationAmount: number;
    endBookValue: number;
  }>;
}

const METHOD_LABELS: Record<string, string> = {
  straight_line: "定額法",
  declining_balance: "定率法",
  immediate: "即時償却",
  bulk_3year: "一括償却(3年)",
};

const ASSET_CATEGORIES = [
  "建物", "建物附属設備", "車両運搬具", "工具器具備品",
  "ソフトウェア", "機械装置", "その他",
];

export default function DepreciationPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [data, setData] = useState<{
    fiscalYear: string;
    assets: DepreciationResult[];
    totalCurrentYear: number;
  } | null>(null);
  const [fiscalYear, setFiscalYear] = useState(String(new Date().getFullYear()));
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedCount, setGeneratedCount] = useState<number | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState("工具器具備品");
  const [acquisitionDate, setAcquisitionDate] = useState("");
  const [acquisitionCost, setAcquisitionCost] = useState("");
  const [usefulLife, setUsefulLife] = useState("4");
  const [method, setMethod] = useState("straight_line");
  const [accountId, setAccountId] = useState("");
  const [depAccountId, setDepAccountId] = useState("");

  useEffect(() => {
    fetch("/api/accounts").then((r) => r.json()).then(setAccounts);
  }, []);

  useEffect(() => {
    loadData();
  }, [fiscalYear]);

  function loadData() {
    fetch(`/api/tax/depreciation?fiscalYear=${fiscalYear}`)
      .then((r) => r.json())
      .then(setData);
  }

  async function handleAdd() {
    const res = await fetch("/api/tax/fixed-assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        category,
        acquisitionDate,
        acquisitionCost: parseInt(acquisitionCost),
        usefulLife: parseInt(usefulLife),
        depreciationMethod: method,
        accountId,
        depreciationAccountId: depAccountId,
      }),
    });

    if (res.ok) {
      setShowForm(false);
      setName("");
      setAcquisitionDate("");
      setAcquisitionCost("");
      loadData();
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    const res = await fetch("/api/tax/depreciation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fiscalYear }),
    });
    if (res.ok) {
      const d = await res.json();
      setGeneratedCount(d.created);
      toast({ variant: "success", title: "減価償却仕訳を生成しました" });
    } else {
      toast({ variant: "error", title: "生成に失敗しました" });
    }
    setGenerating(false);
  }

  const assetAccounts = accounts.filter((a) =>
    a.category === "asset" && parseInt(a.code) >= 1400,
  );
  const expenseAccounts = accounts.filter((a) => a.category === "expense");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">固定資産・減価償却</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm">事業年度</Label>
            <Input
              type="number"
              value={fiscalYear}
              onChange={(e) => setFiscalYear(e.target.value)}
              className="w-24"
            />
          </div>
          <Button variant="outline" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            資産を追加
          </Button>
        </div>
      </div>

      {/* Add asset form */}
      {showForm && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">固定資産を登録</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label>資産名</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="MacBook Pro" />
              </div>
              <div>
                <Label>分類</Label>
                <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {ASSET_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>取得日</Label>
                <Input type="date" value={acquisitionDate} onChange={(e) => setAcquisitionDate(e.target.value)} />
              </div>
              <div>
                <Label>取得原価</Label>
                <Input type="number" value={acquisitionCost} onChange={(e) => setAcquisitionCost(e.target.value)} placeholder="300000" />
              </div>
              <div>
                <Label>耐用年数</Label>
                <Input type="number" value={usefulLife} onChange={(e) => setUsefulLife(e.target.value)} />
              </div>
              <div>
                <Label>償却方法</Label>
                <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="straight_line">定額法</option>
                  <option value="declining_balance">定率法</option>
                  <option value="immediate">即時償却（30万円未満）</option>
                  <option value="bulk_3year">一括償却（20万円未満）</option>
                </Select>
              </div>
              <div>
                <Label>資産科目</Label>
                <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="">選択</option>
                  {assetAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} {a.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>減価償却費科目</Label>
                <Select value={depAccountId} onChange={(e) => setDepAccountId(e.target.value)}>
                  <option value="">選択</option>
                  {expenseAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} {a.name}</option>
                  ))}
                </Select>
              </div>
            </div>
            <Button className="mt-4" onClick={handleAdd} disabled={!name || !acquisitionDate || !acquisitionCost}>
              登録
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Asset list with depreciation */}
      {data && data.assets.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>
                  固定資産一覧 ({data.assets.length}件)
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    当期償却合計: {formatYen(data.totalCurrentYear)}
                  </span>
                </span>
                <Button onClick={handleGenerate} disabled={generating || data.totalCurrentYear === 0}>
                  {generating ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />生成中...</>
                  ) : (
                    <><BookOpen className="h-4 w-4 mr-2" />償却仕訳を生成</>
                  )}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>資産名</TableHead>
                    <TableHead>分類</TableHead>
                    <TableHead>取得日</TableHead>
                    <TableHead className="text-right">取得原価</TableHead>
                    <TableHead>償却方法</TableHead>
                    <TableHead className="text-right">当期償却額</TableHead>
                    <TableHead className="text-right">累計償却額</TableHead>
                    <TableHead className="text-right">帳簿価額</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.assets.map((item) => (
                    <TableRow key={item.asset.id}>
                      <TableCell className="font-medium">{item.asset.name}</TableCell>
                      <TableCell className="text-sm">{item.asset.category}</TableCell>
                      <TableCell className="font-mono text-sm">{item.asset.acquisitionDate}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatYen(item.asset.acquisitionCost)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {METHOD_LABELS[item.asset.depreciationMethod] || item.asset.depreciationMethod}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-red-600">
                        {item.currentYearAmount > 0 ? formatYen(item.currentYearAmount) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatYen(item.accumulatedDepreciation)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-medium">
                        {formatYen(item.bookValue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>

          {generatedCount !== null && (
            <div className="flex items-center gap-2 text-green-700 text-sm">
              <Check className="h-4 w-4" />
              {generatedCount}件の減価償却仕訳を生成しました
            </div>
          )}
        </>
      )}

      {data && data.assets.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">固定資産が登録されていません</p>
            <Button variant="outline" className="mt-3" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              最初の資産を登録
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
