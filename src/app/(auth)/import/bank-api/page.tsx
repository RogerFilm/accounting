"use client";

import { useState, useEffect } from "react";
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
  RefreshCw,
  Check,
  AlertTriangle,
  SkipForward,
  Wallet,
  Loader2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

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

interface BalanceInfo {
  balance: string;
  baseDate: string;
  baseTime: string;
}

function formatDateInput(date: Date): string {
  return date.toISOString().split("T")[0];
}

export default function BankApiImportPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balanceInfo, setBalanceInfo] = useState<BalanceInfo | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewTransaction[] | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<
    Record<number, string>
  >({});
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<{
    created: number;
    skipped: number;
  } | null>(null);

  // Date range: default past 30 days
  const [dateTo, setDateTo] = useState(formatDateInput(new Date()));
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatDateInput(d);
  });

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then(setAccounts);
  }, []);

  async function fetchBalanceInfo() {
    setBalanceLoading(true);
    try {
      const res = await fetch("/api/import/bank-api?action=balance");
      if (res.ok) {
        const data = await res.json();
        if (data.balances && data.balances.length > 0) {
          setBalanceInfo(data.balances[0]);
        }
      } else {
        const err = await res.json();
        toast({
          variant: "error",
          title: "残高取得に失敗しました",
          description: err.error,
        });
      }
    } catch {
      toast({ variant: "error", title: "通信エラーが発生しました" });
    }
    setBalanceLoading(false);
  }

  async function handleFetchTransactions() {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/import/bank-api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateFrom, dateTo }),
      });

      if (res.ok) {
        const data = await res.json();
        setPreview(data.transactions);

        // Pre-fill account selections from suggestions
        const preSelected: Record<number, string> = {};
        data.transactions.forEach((tx: PreviewTransaction, i: number) => {
          if (tx.suggestion) {
            preSelected[i] = tx.suggestion.accountId;
          }
        });
        setSelectedAccounts(preSelected);
      } else {
        const err = await res.json();
        toast({
          variant: "error",
          title: "取引明細の取得に失敗しました",
          description: err.error,
        });
      }
    } catch {
      toast({ variant: "error", title: "通信エラーが発生しました" });
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

    const res = await fetch("/api/import/bank-api?action=confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions }),
    });

    if (res.ok) {
      const data = await res.json();
      setResult(data);
      toast({ variant: "success", title: "取引データを取り込みました" });
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
      <h1 className="text-2xl font-bold">銀行API連携</h1>

      {/* Balance card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            口座残高
          </CardTitle>
        </CardHeader>
        <CardContent>
          {balanceInfo ? (
            <div className="space-y-1">
              <div className="text-2xl font-bold font-mono">
                {formatYen(parseInt(balanceInfo.balance) || 0)}
              </div>
              <div className="text-xs text-muted-foreground">
                基準日時: {balanceInfo.baseDate} {balanceInfo.baseTime}
              </div>
            </div>
          ) : (
            <Button
              onClick={fetchBalanceInfo}
              disabled={balanceLoading}
              variant="outline"
              size="sm"
            >
              {balanceLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              残高を取得
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Date range + fetch */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">開始日</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="border rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">終了日</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="border rounded px-3 py-1.5 text-sm"
              />
            </div>
            <Button onClick={handleFetchTransactions} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {loading ? "取得中..." : "取引明細を取得"}
            </Button>
          </div>
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
                      const opacity =
                        isSkipped || tx.isDuplicate ? "opacity-40" : "";

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
                                推定: {tx.suggestion.accountCode}{" "}
                                {tx.suggestion.accountName}
                                <Badge
                                  variant="outline"
                                  className="ml-1 text-[10px] px-1"
                                >
                                  {tx.suggestion.source === "rule"
                                    ? "ルール"
                                    : "学習"}{" "}
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
                              <span className="text-xs text-muted-foreground">
                                重複
                              </span>
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
                                  .filter((a) => a.code !== "1120")
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
                              <Badge
                                variant="destructive"
                                className="text-[10px]"
                              >
                                <AlertTriangle className="h-3 w-3 mr-0.5" />
                                重複
                              </Badge>
                            ) : isSkipped ? (
                              <Badge
                                variant="secondary"
                                className="text-[10px]"
                              >
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

      {/* Empty state */}
      {preview && preview.length === 0 && !result && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            指定期間の取引はありません
          </CardContent>
        </Card>
      )}
    </div>
  );
}
