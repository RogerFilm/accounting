"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import { formatYen } from "@/lib/utils/currency";
import { Plus, Receipt } from "lucide-react";

interface Invoice {
  id: string;
  documentType: string;
  documentNumber: string;
  clientName: string;
  issueDate: string;
  status: string;
  subtotal: number;
  taxAmount: number;
  total: number;
}

const TYPE_LABELS: Record<string, string> = {
  invoice: "請求書",
  estimate: "見積書",
  delivery_note: "納品書",
  receipt: "領収書",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  issued: "発行済",
  paid: "入金済",
  cancelled: "取消",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  issued: "default",
  paid: "outline",
  cancelled: "destructive",
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");

  useEffect(() => {
    fetchInvoices();
  }, [typeFilter]);

  async function fetchInvoices() {
    setLoading(true);
    const params = typeFilter ? `?type=${typeFilter}` : "";
    const res = await fetch(`/api/invoices${params}`);
    if (res.ok) setInvoices(await res.json());
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">請求書・見積書</h1>
        <Link href="/invoices/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            新規作成
          </Button>
        </Link>
      </div>

      <div className="max-w-xs">
        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">すべて</option>
          <option value="invoice">請求書</option>
          <option value="estimate">見積書</option>
          <option value="delivery_note">納品書</option>
          <option value="receipt">領収書</option>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <Receipt className="h-10 w-10" />
              <p className="text-sm">書類がありません</p>
              <Link href="/invoices/new">
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
                  <TableHead>種類</TableHead>
                  <TableHead>番号</TableHead>
                  <TableHead>取引先</TableHead>
                  <TableHead>発行日</TableHead>
                  <TableHead className="text-right">合計</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {TYPE_LABELS[inv.documentType] || inv.documentType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {inv.documentNumber}
                    </TableCell>
                    <TableCell>{inv.clientName}</TableCell>
                    <TableCell className="font-mono text-sm">{inv.issueDate}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium">
                      {formatYen(inv.total)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[inv.status] || "secondary"}>
                        {STATUS_LABELS[inv.status] || inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="text-sm text-primary underline-offset-4 hover:underline"
                      >
                        詳細
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
