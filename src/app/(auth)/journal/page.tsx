"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { formatYen } from "@/lib/utils/currency";
import { Plus, Search, Trash2, BookOpen } from "lucide-react";

interface JournalLine {
  id: string;
  side: "debit" | "credit";
  accountId: string;
  accountCode: string;
  accountName: string;
  amount: number;
  taxCategoryId: string | null;
  taxAmount: number;
  description: string | null;
}

interface JournalEntry {
  id: string;
  date: string;
  description: string | null;
  clientName: string | null;
  status: "draft" | "confirmed";
  lines: JournalLine[];
}

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    fetchEntries();
  }, []);

  async function fetchEntries() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const res = await fetch(`/api/journal-entries?${params}`);
    if (res.ok) {
      setEntries(await res.json());
    }
    setLoading(false);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchEntries();
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/journal-entries/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ variant: "success", title: "仕訳を削除しました" });
      fetchEntries();
    } else {
      toast({ variant: "error", title: "削除に失敗しました" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">仕訳帳</h1>
        <Link href="/journal/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            仕訳入力
          </Button>
        </Link>
      </div>

      <form onSubmit={handleSearch} className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="摘要・取引先で検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">
          検索
        </Button>
      </form>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <BookOpen className="h-10 w-10" />
              <p className="text-sm">仕訳がありません</p>
              <Link href="/journal/new">
                <Button variant="outline" size="sm">
                  <Plus className="mr-1 h-3 w-3" />
                  新規作成
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">日付</TableHead>
                    <TableHead>借方</TableHead>
                    <TableHead className="text-right">借方金額</TableHead>
                    <TableHead>貸方</TableHead>
                    <TableHead className="text-right">貸方金額</TableHead>
                    <TableHead>摘要</TableHead>
                    <TableHead className="w-20">状態</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const debitLines = entry.lines.filter((l) => l.side === "debit");
                    const creditLines = entry.lines.filter((l) => l.side === "credit");
                    const maxLines = Math.max(debitLines.length, creditLines.length);

                    return Array.from({ length: maxLines }, (_, i) => (
                      <TableRow key={`${entry.id}-${i}`}>
                        {i === 0 ? (
                          <TableCell rowSpan={maxLines} className="align-top font-mono text-sm">
                            {entry.date}
                          </TableCell>
                        ) : null}
                        <TableCell className="text-sm">
                          {debitLines[i] && (
                            <span>
                              <span className="text-muted-foreground">{debitLines[i].accountCode}</span>{" "}
                              {debitLines[i].accountName}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {debitLines[i] && formatYen(debitLines[i].amount)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {creditLines[i] && (
                            <span>
                              <span className="text-muted-foreground">{creditLines[i].accountCode}</span>{" "}
                              {creditLines[i].accountName}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {creditLines[i] && formatYen(creditLines[i].amount)}
                        </TableCell>
                        {i === 0 ? (
                          <>
                            <TableCell rowSpan={maxLines} className="align-top text-sm">
                              <div>{entry.description}</div>
                              {entry.clientName && (
                                <div className="text-xs text-muted-foreground">
                                  {entry.clientName}
                                </div>
                              )}
                            </TableCell>
                            <TableCell rowSpan={maxLines} className="align-top">
                              <Badge
                                variant={entry.status === "confirmed" ? "default" : "secondary"}
                              >
                                {entry.status === "confirmed" ? "確定" : "下書き"}
                              </Badge>
                            </TableCell>
                            <TableCell rowSpan={maxLines} className="align-top">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteTarget(entry.id)}
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </TableCell>
                          </>
                        ) : null}
                      </TableRow>
                    ));
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget);
          setDeleteTarget(null);
        }}
        title="仕訳を削除"
        message="この仕訳を削除しますか？この操作は元に戻せません。"
        confirmLabel="削除"
        destructive
      />
    </div>
  );
}
