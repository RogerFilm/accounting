"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatYen } from "@/lib/utils/currency";
import { today } from "@/lib/utils/date";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Save } from "lucide-react";

interface Client {
  id: string;
  name: string;
}

interface LineData {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  isReducedTax: boolean;
}

function createEmptyLine(): LineData {
  return {
    key: crypto.randomUUID(),
    description: "",
    quantity: "1",
    unitPrice: "",
    taxRate: "10",
    isReducedTax: false,
  };
}

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [documentType, setDocumentType] = useState(
    searchParams.get("type") || "invoice",
  );
  const [clientId, setClientId] = useState("");
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState("");
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineData[]>([createEmptyLine()]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then(setClients);
  }, []);

  // Load source document if converting from estimate
  const sourceId = searchParams.get("source");
  useEffect(() => {
    if (!sourceId) return;
    fetch(`/api/invoices/${sourceId}`)
      .then((r) => r.json())
      .then((data) => {
        setClientId(data.clientId);
        setSubject(data.subject || "");
        setNotes(data.notes || "");
        setLines(
          data.lines.map((l: { description: string; quantity: number; unitPrice: number; taxRate: number; isReducedTax: boolean }) => ({
            key: crypto.randomUUID(),
            description: l.description,
            quantity: String(l.quantity),
            unitPrice: String(l.unitPrice),
            taxRate: String(l.taxRate),
            isReducedTax: l.isReducedTax,
          })),
        );
      });
  }, [sourceId]);

  function computeTotals() {
    let subtotal = 0;
    let tax = 0;
    for (const line of lines) {
      const qty = parseInt(line.quantity) || 0;
      const price = parseInt(line.unitPrice) || 0;
      const amount = qty * price;
      const rate = parseInt(line.taxRate) || 0;
      subtotal += amount;
      tax += Math.floor((amount * rate) / 100);
    }
    return { subtotal, tax, total: subtotal + tax };
  }

  const { subtotal, tax, total } = computeTotals();

  function updateLine(index: number, field: keyof LineData, value: string | boolean) {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    // Auto-set isReducedTax when taxRate is 8
    if (field === "taxRate") {
      updated[index].isReducedTax = value === "8";
    }
    setLines(updated);
  }

  async function handleSubmit(status: "draft" | "issued") {
    setError("");
    setSaving(true);

    const payload = {
      documentType,
      clientId,
      issueDate,
      dueDate: dueDate || undefined,
      subject: subject || undefined,
      notes: notes || undefined,
      status,
      sourceDocumentId: sourceId || undefined,
      lines: lines.map((l) => ({
        description: l.description,
        quantity: parseInt(l.quantity) || 1,
        unitPrice: parseInt(l.unitPrice) || 0,
        taxRate: parseInt(l.taxRate) || 10,
        isReducedTax: l.isReducedTax,
      })),
    };

    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      toast({ variant: "success", title: status === "issued" ? "書類を発行しました" : "下書きを保存しました" });
      router.push(`/invoices/${data.id}`);
    } else {
      const data = await res.json();
      const msg = data.error || "保存に失敗しました";
      setError(msg);
      toast({ variant: "error", title: msg });
    }
    setSaving(false);
  }

  const typeLabels: Record<string, string> = {
    invoice: "請求書",
    estimate: "見積書",
    delivery_note: "納品書",
    receipt: "領収書",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{typeLabels[documentType] || "書類"}作成</h1>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>書類種別</Label>
              <Select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
              >
                <option value="invoice">請求書</option>
                <option value="estimate">見積書</option>
                <option value="delivery_note">納品書</option>
                <option value="receipt">領収書</option>
              </Select>
            </div>
            <div>
              <Label>取引先 *</Label>
              <Select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">選択してください</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>発行日</Label>
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            {documentType === "invoice" && (
              <div>
                <Label>支払期限</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            )}
            <div className="col-span-2">
              <Label>件名</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="件名"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>明細</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLines([...lines, createEmptyLine()])}
          >
            <Plus className="mr-1 h-3 w-3" />
            行追加
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {lines.map((line, i) => (
              <div key={line.key} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  {i === 0 && (
                    <Label className="text-xs text-muted-foreground">品名</Label>
                  )}
                  <Input
                    placeholder="品名・サービス名"
                    value={line.description}
                    onChange={(e) => updateLine(i, "description", e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  {i === 0 && (
                    <Label className="text-xs text-muted-foreground">数量</Label>
                  )}
                  <Input
                    type="number"
                    value={line.quantity}
                    onChange={(e) => updateLine(i, "quantity", e.target.value)}
                    className="text-right"
                  />
                </div>
                <div className="col-span-2">
                  {i === 0 && (
                    <Label className="text-xs text-muted-foreground">単価</Label>
                  )}
                  <Input
                    type="number"
                    placeholder="0"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(i, "unitPrice", e.target.value)}
                    className="text-right font-mono"
                  />
                </div>
                <div className="col-span-2">
                  {i === 0 && (
                    <Label className="text-xs text-muted-foreground">税率</Label>
                  )}
                  <Select
                    value={line.taxRate}
                    onChange={(e) => updateLine(i, "taxRate", e.target.value)}
                  >
                    <option value="10">10%</option>
                    <option value="8">8%（軽減）</option>
                    <option value="0">非課税</option>
                  </Select>
                </div>
                <div className="col-span-1 text-right font-mono text-sm pt-1">
                  {formatYen(
                    (parseInt(line.quantity) || 0) * (parseInt(line.unitPrice) || 0),
                  )}
                </div>
                <div className="col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (lines.length > 1) {
                        setLines(lines.filter((_, j) => j !== i));
                      }
                    }}
                    disabled={lines.length <= 1}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span>小計（税抜）</span>
                <span className="font-mono">{formatYen(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>消費税</span>
                <span className="font-mono">{formatYen(tax)}</span>
              </div>
              <div className="flex justify-between text-base font-bold border-t pt-2">
                <span>合計（税込）</span>
                <span className="font-mono">{formatYen(total)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Label>備考</Label>
          <textarea
            className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="お振込先など"
          />
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button
          onClick={() => handleSubmit("draft")}
          variant="outline"
          disabled={saving}
        >
          <Save className="mr-2 h-4 w-4" />
          下書き保存
        </Button>
        <Button onClick={() => handleSubmit("issued")} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          発行
        </Button>
      </div>
    </div>
  );
}
