"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
  Landmark,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface VirtualAccountItem {
  id: string;
  vaNumber: string;
  vaAccountName: string | null;
  vaType: string;
  status: string;
  expiryDate: string | null;
  invoice: {
    id: string;
    documentNumber: string;
    total: number;
    status: string;
    dueDate: string | null;
  } | null;
  client: {
    id: string;
    name: string;
  } | null;
}

interface ReconcileMatch {
  deposit: {
    vaNumber: string;
    depositDate: string;
    depositAmount: string;
    depositTime: string;
    remitterName: string;
  };
  vaNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  invoiceTotal: number;
  depositAmount: number;
  isFullPayment: boolean;
  isDuplicate: boolean;
  hash: string;
}

function formatDateInput(date: Date): string {
  return date.toISOString().split("T")[0];
}

const VA_STATUS_LABELS: Record<string, string> = {
  active: "有効",
  stopped: "停止",
  deleted: "削除済",
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  issued: "発行済",
  paid: "入金済",
  cancelled: "取消",
};

export default function VaReconcilePage() {
  const router = useRouter();
  const [vaList, setVaList] = useState<VirtualAccountItem[]>([]);
  const [vaLoading, setVaLoading] = useState(true);

  // Reconciliation
  const [dateTo, setDateTo] = useState(formatDateInput(new Date()));
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatDateInput(d);
  });
  const [matches, setMatches] = useState<ReconcileMatch[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    skipped: number;
  } | null>(null);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchVaList();
  }, []);

  async function fetchVaList() {
    setVaLoading(true);
    try {
      const res = await fetch("/api/va");
      if (res.ok) {
        const data = await res.json();
        setVaList(data.virtualAccounts);
      }
    } catch {
      toast({ variant: "error", title: "VA一覧の取得に失敗しました" });
    }
    setVaLoading(false);
  }

  async function handleFetchDeposits() {
    setLoading(true);
    setResult(null);
    setMatches(null);

    try {
      const res = await fetch("/api/va/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateFrom, dateTo }),
      });

      if (res.ok) {
        const data = await res.json();
        setMatches(data.matches);
        if (data.matches.length === 0) {
          toast({ title: "対象期間の入金はありません" });
        }
      } else {
        const err = await res.json();
        toast({
          variant: "error",
          title: "入金照会に失敗しました",
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
    if (!matches) return;
    setConfirming(true);

    const toConfirm = matches.filter(
      (m, i) => !skipped.has(i) && !m.isDuplicate,
    );

    const res = await fetch("/api/va/reconcile?action=confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matches: toConfirm }),
    });

    if (res.ok) {
      const data = await res.json();
      setResult(data);
      toast({ variant: "success", title: "入金消し込みが完了しました" });
      fetchVaList(); // Refresh VA list
    } else {
      toast({ variant: "error", title: "消し込みに失敗しました" });
    }
    setConfirming(false);
  }

  const readyCount = matches
    ? matches.filter((m, i) => !skipped.has(i) && !m.isDuplicate).length
    : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Landmark className="h-6 w-6" />
        入金消し込み
      </h1>

      {/* VA List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>バーチャル口座一覧</span>
            <Button variant="outline" size="sm" onClick={fetchVaList} disabled={vaLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${vaLoading ? "animate-spin" : ""}`} />
              更新
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {vaList.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>口座番号</TableHead>
                    <TableHead>取引先</TableHead>
                    <TableHead>請求書</TableHead>
                    <TableHead className="text-right">請求額</TableHead>
                    <TableHead>請求ステータス</TableHead>
                    <TableHead>種別</TableHead>
                    <TableHead>有効期限</TableHead>
                    <TableHead>VA状態</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vaList.map((va) => (
                    <TableRow key={va.id}>
                      <TableCell className="font-mono text-sm">
                        {va.vaNumber}
                      </TableCell>
                      <TableCell>{va.client?.name || "—"}</TableCell>
                      <TableCell>
                        {va.invoice ? (
                          <button
                            className="text-blue-600 hover:underline text-sm"
                            onClick={() => router.push(`/invoices/${va.invoice!.id}`)}
                          >
                            {va.invoice.documentNumber}
                          </button>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {va.invoice ? formatYen(va.invoice.total) : "—"}
                      </TableCell>
                      <TableCell>
                        {va.invoice && (
                          <Badge
                            variant={
                              va.invoice.status === "paid"
                                ? "default"
                                : va.invoice.status === "issued"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="text-[10px]"
                          >
                            {INVOICE_STATUS_LABELS[va.invoice.status] || va.invoice.status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {va.vaType === "term" ? "期限型" : "継続型"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {va.expiryDate || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={va.status === "active" ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {VA_STATUS_LABELS[va.status] || va.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {vaLoading ? "読み込み中..." : "バーチャル口座はまだ発行されていません"}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reconciliation section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">入金照会・消し込み</CardTitle>
        </CardHeader>
        <CardContent>
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
            <Button onClick={handleFetchDeposits} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {loading ? "照会中..." : "入金を照会"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reconciliation result */}
      {result && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-700">
              <Check className="h-5 w-5" />
              <span className="font-medium">
                {result.created}件の消し込みを完了しました
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

      {/* Reconciliation preview */}
      {matches && matches.length > 0 && !result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>消し込みプレビュー ({matches.length}件)</span>
              <Button
                onClick={handleConfirm}
                disabled={confirming || readyCount === 0}
              >
                <Check className="mr-2 h-4 w-4" />
                {confirming ? "処理中..." : `${readyCount}件を消し込み`}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="w-28">入金日</TableHead>
                    <TableHead>VA口座</TableHead>
                    <TableHead>振込人</TableHead>
                    <TableHead>請求書</TableHead>
                    <TableHead className="text-right w-28">入金額</TableHead>
                    <TableHead className="text-right w-28">請求額</TableHead>
                    <TableHead className="w-20">状態</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matches.map((match, i) => {
                    const isSkipped = skipped.has(i);
                    const opacity =
                      isSkipped || match.isDuplicate ? "opacity-40" : "";

                    return (
                      <TableRow key={i} className={opacity}>
                        <TableCell>
                          {!match.isDuplicate && (
                            <button
                              onClick={() => toggleSkip(i)}
                              className="text-muted-foreground hover:text-foreground"
                              title={isSkipped ? "消し込み対象にする" : "スキップ"}
                            >
                              <ArrowRight
                                className={`h-4 w-4 ${isSkipped ? "text-orange-500" : ""}`}
                              />
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {match.deposit.depositDate}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {match.vaNumber}
                        </TableCell>
                        <TableCell className="text-sm">
                          {match.clientName}
                        </TableCell>
                        <TableCell>
                          <button
                            className="text-blue-600 hover:underline text-sm"
                            onClick={() => router.push(`/invoices/${match.invoiceId}`)}
                          >
                            {match.invoiceNumber}
                          </button>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-green-700">
                          {formatYen(match.depositAmount)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatYen(match.invoiceTotal)}
                        </TableCell>
                        <TableCell>
                          {match.isDuplicate ? (
                            <Badge
                              variant="destructive"
                              className="text-[10px]"
                            >
                              <AlertTriangle className="h-3 w-3 mr-0.5" />
                              消込済
                            </Badge>
                          ) : isSkipped ? (
                            <Badge
                              variant="secondary"
                              className="text-[10px]"
                            >
                              スキップ
                            </Badge>
                          ) : match.isFullPayment ? (
                            <Badge className="text-[10px]">
                              <Check className="h-3 w-3 mr-0.5" />
                              一致
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              金額差異
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
      )}

      {matches && matches.length === 0 && !result && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            対象期間にマッチする入金はありません
          </CardContent>
        </Card>
      )}
    </div>
  );
}
