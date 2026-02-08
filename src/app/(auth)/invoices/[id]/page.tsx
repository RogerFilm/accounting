"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { formatYen } from "@/lib/utils/currency";
import { computeTaxBreakdown, type InvoicePDFData } from "@/lib/pdf/invoice-template";
import { FileDown, Send, Copy } from "lucide-react";

// Dynamic import for PDF (client-side only)
const PDFSection = dynamic(
  () => import("@/components/invoice/pdf-download-section"),
  { ssr: false, loading: () => <Button variant="outline" disabled><FileDown className="mr-2 h-4 w-4" />PDF</Button> },
);

interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  isReducedTax: boolean;
  amount: number;
  taxAmount: number;
}

interface InvoiceDetail {
  id: string;
  documentType: string;
  documentNumber: string;
  issueDate: string;
  dueDate: string | null;
  subject: string | null;
  notes: string | null;
  status: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  journalEntryId: string | null;
  sourceDocumentId: string | null;
  lines: InvoiceLine[];
  client: {
    name: string;
    address: string | null;
  } | null;
  company: {
    name: string;
    address: string | null;
    invoiceRegistrationNumber: string | null;
  } | null;
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

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);

  useEffect(() => {
    fetch(`/api/invoices/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, [id]);

  async function handleIssue() {
    setIssuing(true);
    const res = await fetch(`/api/invoices/${id}/issue`, { method: "POST" });
    if (res.ok) {
      toast({ variant: "success", title: "書類を発行しました" });
      const updated = await fetch(`/api/invoices/${id}`).then((r) => r.json());
      setData(updated);
    } else {
      toast({ variant: "error", title: "発行に失敗しました" });
    }
    setIssuing(false);
  }

  function handleConvert() {
    router.push(`/invoices/new?type=invoice&source=${id}`);
  }

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-center text-sm text-destructive p-6">書類が見つかりません</div>;
  }

  const typeLabel = TYPE_LABELS[data.documentType] || data.documentType;
  const hasReducedTax = data.lines.some((l) => l.isReducedTax);

  // Build PDF data
  const pdfData: InvoicePDFData = {
    companyName: data.company?.name || "",
    companyAddress: data.company?.address || "",
    registrationNumber: data.company?.invoiceRegistrationNumber || "",
    clientName: data.client?.name || "",
    clientAddress: data.client?.address || "",
    documentType: data.documentType as InvoicePDFData["documentType"],
    documentNumber: data.documentNumber,
    issueDate: data.issueDate,
    dueDate: data.dueDate || undefined,
    subject: data.subject || undefined,
    notes: data.notes || undefined,
    lines: data.lines.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxRate: l.taxRate,
      isReducedTax: l.isReducedTax,
      amount: l.amount,
      taxAmount: l.taxAmount,
    })),
    subtotal: data.subtotal,
    taxAmount: data.taxAmount,
    total: data.total,
    taxBreakdown: computeTaxBreakdown(
      data.lines.map((l) => ({
        ...l,
        description: l.description,
      })),
    ),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {typeLabel} {data.documentNumber}
          </h1>
          <Badge
            variant={
              data.status === "issued"
                ? "default"
                : data.status === "draft"
                  ? "secondary"
                  : "outline"
            }
            className="mt-1"
          >
            {STATUS_LABELS[data.status] || data.status}
          </Badge>
        </div>
        <div className="flex gap-2">
          {data.status === "draft" && (
            <Button onClick={handleIssue} disabled={issuing}>
              <Send className="mr-2 h-4 w-4" />
              {issuing ? "発行中..." : "発行する"}
            </Button>
          )}
          {data.documentType === "estimate" && (
            <Button variant="outline" onClick={handleConvert}>
              <Copy className="mr-2 h-4 w-4" />
              請求書に変換
            </Button>
          )}
          <PDFSection data={pdfData} fileName={`${data.documentNumber}.pdf`} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">宛先</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-medium">{data.client?.name} 御中</div>
            {data.client?.address && (
              <div className="text-sm text-muted-foreground">
                {data.client.address}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">発行元</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-medium">{data.company?.name}</div>
            {data.company?.address && (
              <div className="text-sm text-muted-foreground">
                {data.company.address}
              </div>
            )}
            {data.company?.invoiceRegistrationNumber && (
              <div className="text-xs text-muted-foreground font-mono mt-1">
                登録番号: {data.company.invoiceRegistrationNumber}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 text-sm mb-4">
            <div>
              <span className="text-muted-foreground">発行日: </span>
              {data.issueDate}
            </div>
            {data.dueDate && (
              <div>
                <span className="text-muted-foreground">支払期限: </span>
                {data.dueDate}
              </div>
            )}
            {data.subject && (
              <div>
                <span className="text-muted-foreground">件名: </span>
                {data.subject}
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>品名</TableHead>
                <TableHead className="text-right w-20">数量</TableHead>
                <TableHead className="text-right w-28">単価</TableHead>
                <TableHead className="text-center w-20">税率</TableHead>
                <TableHead className="text-right w-28">金額</TableHead>
                <TableHead className="text-right w-24">消費税</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    {line.description}
                    {line.isReducedTax && (
                      <span className="text-orange-600 ml-1">※</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{line.quantity}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatYen(line.unitPrice)}
                  </TableCell>
                  <TableCell className="text-center">
                    {line.taxRate}%
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatYen(line.amount)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatYen(line.taxAmount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>

          {hasReducedTax && (
            <div className="mt-2 text-xs text-muted-foreground">
              ※ 軽減税率対象品目
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span>小計（税抜）</span>
                <span className="font-mono">{formatYen(data.subtotal)}</span>
              </div>
              {pdfData.taxBreakdown.map((tb, i) => (
                <div key={i} className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    消費税（{tb.rate}%{tb.isReduced ? " 軽減" : ""}）
                  </span>
                  <span className="font-mono">{formatYen(tb.taxAmount)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm">
                <span>消費税合計</span>
                <span className="font-mono">{formatYen(data.taxAmount)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>合計（税込）</span>
                <span className="font-mono">{formatYen(data.total)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {data.notes && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground mb-1">備考</div>
            <div className="text-sm whitespace-pre-wrap">{data.notes}</div>
          </CardContent>
        </Card>
      )}

      {data.journalEntryId && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm">
              <span className="text-muted-foreground">自動生成仕訳: </span>
              <span className="font-mono text-xs">{data.journalEntryId}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
