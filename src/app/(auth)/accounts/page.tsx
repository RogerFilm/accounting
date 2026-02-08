"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ACCOUNT_CATEGORY_LABELS } from "@/types";

interface Account {
  id: string;
  code: string;
  name: string;
  category: "asset" | "liability" | "equity" | "revenue" | "expense";
  parentId: string | null;
  isSystem: boolean;
  isActive: boolean;
}

const categoryColors: Record<string, string> = {
  asset: "bg-blue-100 text-blue-800",
  liability: "bg-red-100 text-red-800",
  equity: "bg-purple-100 text-purple-800",
  revenue: "bg-green-100 text-green-800",
  expense: "bg-orange-100 text-orange-800",
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => {
        setAccounts(data);
        setLoading(false);
      });
  }, []);

  // Group by category
  const grouped = accounts.reduce(
    (acc, a) => {
      if (!acc[a.category]) acc[a.category] = [];
      acc[a.category].push(a);
      return acc;
    },
    {} as Record<string, Account[]>,
  );

  const categoryOrder: Array<keyof typeof ACCOUNT_CATEGORY_LABELS> = [
    "asset",
    "liability",
    "equity",
    "revenue",
    "expense",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">勘定科目</h1>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : (
        categoryOrder.map((cat) => {
          const accs = grouped[cat] || [];
          if (accs.length === 0) return null;
          return (
            <Card key={cat}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${categoryColors[cat]}`}
                  >
                    {ACCOUNT_CATEGORY_LABELS[cat]}
                  </span>
                  <span className="text-sm text-muted-foreground">{accs.length}科目</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">コード</TableHead>
                      <TableHead>科目名</TableHead>
                      <TableHead className="w-20">状態</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accs.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-sm">{a.code}</TableCell>
                        <TableCell className="text-sm">
                          {a.parentId && <span className="mr-2 text-muted-foreground">└</span>}
                          {a.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant={a.isActive ? "secondary" : "outline"}>
                            {a.isActive ? "有効" : "無効"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
