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
import { BANK_LABELS, type BankFormat } from "@/lib/import/bank-csv/detector";
import { Upload, Check, AlertTriangle, SkipForward } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface AccountSuggestion {
  accountId: string;
  accountCode: string;
  accountName: string;
  taxCategoryId: string | null;
  confidence: number;
  source: "rule" | "history";
}

interface PreviewTransaction {
  date: string;
  description: string;
  withdrawal: number;
  deposit: number;
  balance: number;
  hash: string;
  suggestion: AccountSuggestion | null;
  isDuplicate: boolean;
  bankAccountId: string;
  bankAccountCode: string;
  bankAccountName: string;
}

interface Account {
  id: string;
  code: string;
  name: string;
  category: string;
}

export default function BankImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [preview, setPreview] = useState<PreviewTransaction[] | null>(null);
  const [format, setFormat] = useState<BankFormat | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then(setAccounts);
  }, []);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResult(null);

    // Read file — try Shift-JIS first, then UTF-8
    let csvText: string;
    try {
      const buffer = await file.arrayBuffer();
      // Try Shift-JIS (common for Japanese bank CSVs)
      const decoder = new TextDecoder("shift_jis");
      csvText = decoder.decode(buffer);
      // Simple heuristic: if too many replacement chars, try UTF-8
      if ((csvText.match(/\uFFFD/g) || []).length > 5) {
        csvText = new TextDecoder("utf-8").decode(buffer);
      }
    } catch {
      csvText = await file.text();
    }

    const res = await fetch("/api/import/bank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: csvText }),
    });

    if (res.ok) {
      const data = await res.json();
      setPreview(data.transactions);
      setFormat(data.format);
      setConfidence(data.confidence);
      setErrors(data.errors);

      // Pre-fill account selections from suggestions
      const preSelected: Record<number, string> = {};
      data.transactions.forEach((tx: PreviewTransaction, i: number) => {
        if (tx.suggestion) {
          preSelected[i] = tx.suggestion.accountId;
        }
      });
      setSelectedAccounts(preSelected);
    } else {
      toast({ variant: "error", title: "取り込みに失敗しました" });
    }
    setLoading(false);
  }

  function toggleSkip(index: number) {
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleConfirm() {
    if (!preview) return;
    setConfirming(true);

    const transactions = preview
      .map((tx, i) => {
        if (skipped.has(i) || tx.isDuplicate) return null;
        const accountId = selectedAccounts[i];
        if (!accountId) return null;
        return {
          date: tx.date,
          description: tx.description,
          withdrawal: tx.withdrawal,
          deposit: tx.deposit,
          hash: tx.hash,
          accountId,
          bankAccountId: tx.bankAccountId,
        };
      })
      .filter(Boolean);

    const res = await fetch("/api/import/bank?action=confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions }),
    });

    if (res.ok) {
      const data = await res.json();
      setResult(data);
      toast({ variant: "success", title: "CSVデータを取り込みました" });
    } else {
      toast({ variant: "error", title: "取り込みに失敗しました" });
    }
    setConfirming(false);
  }

  const readyCount = preview
    ? preview.filter(
        (tx, i) =>
          !skipped.has(i) && !tx.isDuplicate && selectedAccounts[i],
      ).length
    : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">銀行CSV取込</h1>

      {/* File upload */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={loading}
              variant="outline"
            >
              <Upload className="mr-2 h-4 w-4" />
              {loading ? "解析中..." : "CSVファイルを選択"}
            </Button>
            {format && (
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">
                  {BANK_LABELS[format]}
                </Badge>
                <span className="text-muted-foreground">
                  (信頼度 {Math.round(confidence * 100)}%)
                </span>
              </div>
            )}
          </div>
          {errors.length > 0 && (
            <div className="mt-3 text-sm text-destructive">
              {errors.map((e, i) => (
                <div key={i}>{e}</div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-700">
              <Check className="h-5 w-5" />
              <span className="font-medium">
                {result.created}件の仕訳を登録しました
              </span>
              {result.skipped > 0 && (
                <span className="text-muted-foreground">
                  （{result.skipped}件は重複のためスキップ）
                </span>
              )}
            </div>
            <Button
              className="mt-3"
              variant="outline"
              onClick={() => router.push("/journal")}
            >
              仕訳帳を確認
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Preview table */}
      {preview && preview.length > 0 && !result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>取引プレビュー ({preview.length}件)</span>
                <Button
                  onClick={handleConfirm}
                  disabled={confirming || readyCount === 0}
                >
                  <Check className="mr-2 h-4 w-4" />
                  {confirming ? "登録中..." : `${readyCount}件を登録`}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="w-28">日付</TableHead>
                    <TableHead>摘要</TableHead>
                    <TableHead className="text-right w-28">入金</TableHead>
                    <TableHead className="text-right w-28">出金</TableHead>
                    <TableHead className="w-56">勘定科目</TableHead>
                    <TableHead className="w-20">状態</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((tx, i) => {
                    const isSkipped = skipped.has(i);
                    const opacity = isSkipped || tx.isDuplicate ? "opacity-40" : "";

                    return (
                      <TableRow key={i} className={opacity}>
                        <TableCell>
                          {!tx.isDuplicate && (
                            <button
                              onClick={() => toggleSkip(i)}
                              className="text-muted-foreground hover:text-foreground"
                              title={isSkipped ? "取込対象にする" : "スキップ"}
                            >
                              <SkipForward
                                className={`h-4 w-4 ${isSkipped ? "text-orange-500" : ""}`}
                              />
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {tx.date}
                        </TableCell>
                        <TableCell className="text-sm">
                          {tx.description}
                          {tx.suggestion && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              推定: {tx.suggestion.accountCode} {tx.suggestion.accountName}
                              <Badge variant="outline" className="ml-1 text-[10px] px-1">
                                {tx.suggestion.source === "rule" ? "ルール" : "学習"}
                                {" "}
                                {Math.round(tx.suggestion.confidence * 100)}%
                              </Badge>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-green-700">
                          {tx.deposit > 0 ? formatYen(tx.deposit) : ""}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-red-600">
                          {tx.withdrawal > 0 ? formatYen(tx.withdrawal) : ""}
                        </TableCell>
                        <TableCell>
                          {tx.isDuplicate ? (
                            <span className="text-xs text-muted-foreground">重複</span>
                          ) : (
                            <Select
                              value={selectedAccounts[i] || ""}
                              onChange={(e) =>
                                setSelectedAccounts((prev) => ({
                                  ...prev,
                                  [i]: e.target.value,
                                }))
                              }
                              className="text-xs"
                            >
                              <option value="">科目を選択</option>
                              {accounts
                                .filter((a) => a.code !== "1120") // Exclude bank account itself
                                .map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.code} {a.name}
                                  </option>
                                ))}
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          {tx.isDuplicate ? (
                            <Badge variant="destructive" className="text-[10px]">
                              <AlertTriangle className="h-3 w-3 mr-0.5" />
                              重複
                            </Badge>
                          ) : isSkipped ? (
                            <Badge variant="secondary" className="text-[10px]">
                              スキップ
                            </Badge>
                          ) : selectedAccounts[i] ? (
                            <Badge className="text-[10px]">
                              <Check className="h-3 w-3 mr-0.5" />
                              OK
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              未設定
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <div className="flex gap-4 text-sm">
            <span>
              入金合計:{" "}
              <span className="font-mono font-medium text-green-700">
                {formatYen(preview.reduce((s, t) => s + t.deposit, 0))}
              </span>
            </span>
            <span>
              出金合計:{" "}
              <span className="font-mono font-medium text-red-600">
                {formatYen(preview.reduce((s, t) => s + t.withdrawal, 0))}
              </span>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
