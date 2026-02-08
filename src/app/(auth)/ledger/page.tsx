"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatYen } from "@/lib/utils/currency";

interface Account {
  id: string;
  code: string;
  name: string;
  category: string;
}

interface LedgerEntry {
  date: string;
  description: string | null;
  debitAmount: number;
  creditAmount: number;
  balance: number;
  counterAccount: string;
}

export default function LedgerPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then(setAccounts);
  }, []);

  useEffect(() => {
    if (!selectedAccountId) {
      setEntries([]);
      return;
    }
    setLoading(true);
    fetch(`/api/ledger?accountId=${selectedAccountId}`)
      .then((r) => r.json())
      .then((data) => {
        setEntries(data);
        setLoading(false);
      });
  }, [selectedAccountId]);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">総勘定元帳</h1>

      <div className="max-w-sm">
        <Select
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
        >
          <option value="">勘定科目を選択</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} {a.name}
            </option>
          ))}
        </Select>
      </div>

      {selectedAccount && (
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedAccount.code} {selectedAccount.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                取引がありません
              </div>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">日付</TableHead>
                    <TableHead>相手科目</TableHead>
                    <TableHead>摘要</TableHead>
                    <TableHead className="text-right">借方</TableHead>
                    <TableHead className="text-right">貸方</TableHead>
                    <TableHead className="text-right">残高</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-sm">{entry.date}</TableCell>
                      <TableCell className="text-sm">{entry.counterAccount}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {entry.description}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {entry.debitAmount > 0 ? formatYen(entry.debitAmount) : ""}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {entry.creditAmount > 0 ? formatYen(entry.creditAmount) : ""}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-medium">
                        {formatYen(entry.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
