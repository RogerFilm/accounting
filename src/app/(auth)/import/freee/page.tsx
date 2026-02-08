"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import {
  Upload,
  Check,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface Account {
  id: string;
  code: string;
  name: string;
  category: string;
}

interface TaxCategory {
  id: string;
  code: string;
  name: string;
  rate: number;
}

interface AccountMapping {
  freeeName: string;
  internalAccount: Account | null;
  matchType: "exact" | "partial" | "manual" | "unmatched";
  confidence: number;
}

interface FreeeEntry {
  date: string;
  entryNumber: string;
  description: string;
  clientName: string;
  lines: {
    side: "debit" | "credit";
    accountName: string;
    subAccountName: string;
    taxCategory: string;
    amount: number;
    taxAmount: number;
  }[];
}

type Step = "upload" | "mapping" | "review" | "result";

export default function FreeeImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);

  // Parse result
  const [format, setFormat] = useState<string>("");
  const [entries, setEntries] = useState<FreeeEntry[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [summary, setSummary] = useState<{
    totalEntries: number;
    totalDebit: number;
    totalCredit: number;
    dateRange: { from: string; to: string } | null;
  } | null>(null);

  // Account mappings (freeeName → accountId)
  const [autoMappings, setAutoMappings] = useState<AccountMapping[]>([]);
  const [userMappings, setUserMappings] = useState<Record<string, string>>({});
  const [taxCategoryMappings, setTaxCategoryMappings] = useState<Record<string, string | null>>({});

  // Result
  const [result, setResult] = useState<{ created: number; total: number; errors: string[] } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/accounts").then((r) => r.json()),
      fetch("/api/tax-categories").then((r) => r.json()),
    ]).then(([accts, taxCats]) => {
      setAccounts(accts);
      setTaxCategories(taxCats);
    });
  }, []);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrors([]);

    // Read file with Shift-JIS fallback
    let csvText: string;
    try {
      const buffer = await file.arrayBuffer();
      const sjisDecoder = new TextDecoder("shift_jis");
      csvText = sjisDecoder.decode(buffer);
      if ((csvText.match(/\uFFFD/g) || []).length > 5) {
        csvText = new TextDecoder("utf-8").decode(buffer);
      }
    } catch {
      csvText = await file.text();
    }

    const res = await fetch("/api/import/freee?action=preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: csvText }),
    });

    if (res.ok) {
      const data = await res.json();
      setFormat(data.format);
      setEntries(data.entries || []);
      setErrors(data.errors || []);
      setSummary(data.summary || null);
      setAutoMappings(data.accountMappings || []);
      setTaxCategoryMappings(data.taxCategoryMappings || {});

      // Pre-fill user mappings from auto-mappings
      const pre: Record<string, string> = {};
      for (const m of data.accountMappings || []) {
        if (m.internalAccount) {
          pre[m.freeeName] = m.internalAccount.id;
        }
      }
      setUserMappings(pre);

      if (data.entries?.length > 0) {
        setStep("mapping");
      }
    } else {
      toast({ variant: "error", title: "取り込みに失敗しました" });
    }

    setLoading(false);
  }

  function getAccountId(freeeName: string): string {
    return userMappings[freeeName] || "";
  }

  function getTaxCategoryId(freeeTaxName: string): string | null {
    const code = taxCategoryMappings[freeeTaxName];
    if (!code) return null;
    const cat = taxCategories.find((t) => t.code === code);
    return cat?.id || null;
  }

  const unmappedCount = autoMappings.filter(
    (m) => !userMappings[m.freeeName],
  ).length;

  const mappedCount = autoMappings.length - unmappedCount;

  async function handleConfirm() {
    setLoading(true);

    const mappedEntries = entries.map((entry) => ({
      date: entry.date,
      description: entry.description,
      clientName: entry.clientName,
      lines: entry.lines.map((line) => ({
        side: line.side,
        accountId: getAccountId(line.accountName),
        amount: line.amount,
        taxCategoryId: getTaxCategoryId(line.taxCategory),
        taxAmount: line.taxAmount,
      })),
    }));

    // Filter out entries with unmapped accounts
    const validEntries = mappedEntries.filter((e) =>
      e.lines.every((l) => l.accountId),
    );

    const res = await fetch("/api/import/freee?action=confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: validEntries }),
    });

    if (res.ok) {
      const data = await res.json();
      setResult(data);
      setStep("result");
      toast({ variant: "success", title: "freeeデータを取り込みました" });
    } else {
      toast({ variant: "error", title: "取り込みに失敗しました" });
    }

    setLoading(false);
  }

  // Count importable entries (all accounts mapped)
  const importableCount = entries.filter((e) =>
    e.lines.every((l) => getAccountId(l.accountName)),
  ).length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">freee データ移行</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(["upload", "mapping", "review", "result"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
            <Badge variant={step === s ? "default" : "outline"} className="text-xs">
              {s === "upload" && "1. アップロード"}
              {s === "mapping" && "2. 科目マッピング"}
              {s === "review" && "3. 確認"}
              {s === "result" && "4. 結果"}
            </Badge>
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div
                className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-muted-foreground/25 p-12 cursor-pointer hover:border-muted-foreground/50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="font-medium">
                    {loading ? "解析中..." : "freee CSVファイルを選択"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    仕訳帳または取引のCSVエクスポートに対応
                  </p>
                </div>
                {loading && <Loader2 className="h-5 w-5 animate-spin" />}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />

              {errors.length > 0 && (
                <div className="space-y-1">
                  {errors.map((e, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-destructive">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      {e}
                    </div>
                  ))}
                </div>
              )}

              <div className="text-sm text-muted-foreground space-y-2">
                <p className="font-medium">対応フォーマット:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>freee 仕訳帳エクスポート（取引日, 仕訳番号, 借方勘定科目, ...）</li>
                  <li>freee 取引エクスポート（収支区分, 管理番号, 発生日, ...）</li>
                </ul>
                <p>Shift-JIS / UTF-8 どちらのエンコーディングにも対応しています。</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Account Mapping */}
      {step === "mapping" && (
        <>
          {/* Summary */}
          {summary && (
            <Card>
              <CardContent className="pt-6">
                <div className="grid gap-4 sm:grid-cols-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">フォーマット</span>
                    <p className="font-medium">
                      {format === "journal" ? "仕訳帳" : "取引"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">仕訳件数</span>
                    <p className="font-medium">{summary.totalEntries}件</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">期間</span>
                    <p className="font-medium">
                      {summary.dateRange
                        ? `${summary.dateRange.from} 〜 ${summary.dateRange.to}`
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">借方/貸方合計</span>
                    <p className="font-medium">
                      {formatYen(summary.totalDebit)}
                      {summary.totalDebit !== summary.totalCredit && (
                        <span className="text-destructive ml-1">
                          (不一致: {formatYen(summary.totalCredit)})
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>
                  勘定科目マッピング
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({mappedCount}/{autoMappings.length} 対応済み)
                  </span>
                </span>
                {unmappedCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {unmappedCount}件 未対応
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>freee 科目名</TableHead>
                    <TableHead className="w-16">一致</TableHead>
                    <TableHead className="w-72">対応する科目</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {autoMappings.map((mapping) => (
                    <TableRow key={mapping.freeeName}>
                      <TableCell className="font-medium text-sm">
                        {mapping.freeeName}
                      </TableCell>
                      <TableCell>
                        {mapping.matchType === "exact" && (
                          <Badge className="text-[10px]">
                            <Check className="h-3 w-3 mr-0.5" />
                            完全
                          </Badge>
                        )}
                        {mapping.matchType === "partial" && (
                          <Badge variant="secondary" className="text-[10px]">
                            部分
                          </Badge>
                        )}
                        {mapping.matchType === "unmatched" && (
                          <Badge variant="destructive" className="text-[10px]">
                            なし
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={userMappings[mapping.freeeName] || ""}
                          onChange={(e) =>
                            setUserMappings((prev) => ({
                              ...prev,
                              [mapping.freeeName]: e.target.value,
                            }))
                          }
                          className="text-xs"
                        >
                          <option value="">科目を選択</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} {a.name}
                            </option>
                          ))}
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>

          {errors.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  パースエラー ({errors.length}件)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm max-h-32 overflow-auto">
                  {errors.map((e, i) => (
                    <div key={i} className="text-destructive">{e}</div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("upload")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              戻る
            </Button>
            <Button onClick={() => setStep("review")}>
              確認へ進む
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </>
      )}

      {/* Step 3: Review */}
      {step === "review" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>インポートプレビュー ({entries.length}件)</span>
                <div className="flex items-center gap-2 text-sm font-normal">
                  <Badge variant="secondary">
                    インポート可能: {importableCount}件
                  </Badge>
                  {importableCount < entries.length && (
                    <Badge variant="destructive">
                      スキップ: {entries.length - importableCount}件
                    </Badge>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[60vh] overflow-auto overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead className="w-28">日付</TableHead>
                      <TableHead>摘要</TableHead>
                      <TableHead>借方</TableHead>
                      <TableHead>貸方</TableHead>
                      <TableHead className="text-right w-28">金額</TableHead>
                      <TableHead className="w-16">状態</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.slice(0, 100).map((entry, i) => {
                      const allMapped = entry.lines.every(
                        (l) => getAccountId(l.accountName),
                      );
                      const debitNames = entry.lines
                        .filter((l) => l.side === "debit")
                        .map((l) => {
                          const id = getAccountId(l.accountName);
                          const acc = accounts.find((a) => a.id === id);
                          return acc ? `${acc.code} ${acc.name}` : l.accountName;
                        })
                        .join(", ");
                      const creditNames = entry.lines
                        .filter((l) => l.side === "credit")
                        .map((l) => {
                          const id = getAccountId(l.accountName);
                          const acc = accounts.find((a) => a.id === id);
                          return acc ? `${acc.code} ${acc.name}` : l.accountName;
                        })
                        .join(", ");
                      const amount = entry.lines
                        .filter((l) => l.side === "debit")
                        .reduce((s, l) => s + l.amount, 0);

                      return (
                        <TableRow
                          key={i}
                          className={allMapped ? "" : "opacity-40"}
                        >
                          <TableCell className="text-xs text-muted-foreground">
                            {i + 1}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {entry.date}
                          </TableCell>
                          <TableCell className="text-sm">
                            {entry.description || entry.clientName || "-"}
                          </TableCell>
                          <TableCell className="text-xs">{debitNames}</TableCell>
                          <TableCell className="text-xs">{creditNames}</TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatYen(amount)}
                          </TableCell>
                          <TableCell>
                            {allMapped ? (
                              <Badge className="text-[10px]">
                                <Check className="h-3 w-3" />
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[10px]">
                                未対応
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {entries.length > 100 && (
                  <div className="p-3 text-center text-sm text-muted-foreground">
                    ...他 {entries.length - 100}件
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Validation report */}
          {summary && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">バリデーション</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    {summary.totalDebit === summary.totalCredit ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    )}
                    借方合計: {formatYen(summary.totalDebit)} / 貸方合計:{" "}
                    {formatYen(summary.totalCredit)}
                  </div>
                  <div className="flex items-center gap-2">
                    {unmappedCount === 0 ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    )}
                    科目マッピング: {mappedCount}/{autoMappings.length} 対応済み
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    件数: {summary.totalEntries}件
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("mapping")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              マッピングに戻る
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={loading || importableCount === 0}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  インポート中...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {importableCount}件をインポート
                </>
              )}
            </Button>
          </div>
        </>
      )}

      {/* Step 4: Result */}
      {step === "result" && result && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-700">
                <Check className="h-6 w-6" />
                <span className="text-lg font-medium">
                  {result.created}件の仕訳をインポートしました
                </span>
              </div>

              {result.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive">
                    エラー ({result.errors.length}件):
                  </p>
                  {result.errors.map((e, i) => (
                    <div key={i} className="text-sm text-destructive">{e}</div>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => router.push("/journal")}>
                  仕訳帳を確認
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("upload");
                    setEntries([]);
                    setErrors([]);
                    setSummary(null);
                    setAutoMappings([]);
                    setUserMappings({});
                    setResult(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                >
                  別のCSVをインポート
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
