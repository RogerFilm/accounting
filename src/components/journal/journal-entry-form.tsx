"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AccountCombobox } from "@/components/ui/account-combobox";
import { toast } from "@/hooks/use-toast";
import { formatYen } from "@/lib/utils/currency";
import { today } from "@/lib/utils/date";
import { Plus, Trash2, Save } from "lucide-react";

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

interface LineData {
  key: string;
  side: "debit" | "credit";
  accountId: string;
  amount: string;
  taxCategoryId: string;
  taxAmount: string;
  description: string;
}

function createEmptyLine(side: "debit" | "credit"): LineData {
  return {
    key: crypto.randomUUID(),
    side,
    accountId: "",
    amount: "",
    taxCategoryId: "",
    taxAmount: "0",
    description: "",
  };
}

function formatComma(value: string): string {
  const num = parseInt(value);
  if (isNaN(num)) return value;
  return num.toLocaleString();
}

export function JournalEntryForm() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState("");
  const [clientName, setClientName] = useState("");
  const [debitLines, setDebitLines] = useState<LineData[]>([createEmptyLine("debit")]);
  const [creditLines, setCreditLines] = useState<LineData[]>([createEmptyLine("credit")]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [focusedAmount, setFocusedAmount] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/accounts").then((r) => r.json()),
      fetch("/api/tax-categories").then((r) => r.json()),
    ]).then(([accs, tcs]) => {
      setAccounts(accs);
      setTaxCategories(tcs);
    });
  }, []);

  // Cmd+Enter / Ctrl+Enter to save as confirmed
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (!saving && isBalanced) {
          handleSubmit("confirmed");
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });

  const debitTotal = debitLines.reduce((s, l) => s + (parseInt(l.amount) || 0), 0);
  const creditTotal = creditLines.reduce((s, l) => s + (parseInt(l.amount) || 0), 0);
  const isBalanced = debitTotal === creditTotal && debitTotal > 0;
  const difference = Math.abs(debitTotal - creditTotal);

  function updateLine(
    lines: LineData[],
    setLines: (l: LineData[]) => void,
    index: number,
    field: keyof LineData,
    value: string,
  ) {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };

    if (field === "amount" || field === "taxCategoryId") {
      const tc = taxCategories.find((t) => t.id === updated[index].taxCategoryId);
      if (tc && tc.rate > 0) {
        const amount = parseInt(updated[index].amount) || 0;
        const taxAmount = Math.floor((amount * tc.rate) / (100 + tc.rate));
        updated[index].taxAmount = String(taxAmount);
      } else {
        updated[index].taxAmount = "0";
      }
    }

    setLines(updated);
  }

  function removeLine(
    lines: LineData[],
    setLines: (l: LineData[]) => void,
    index: number,
  ) {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== index));
  }

  async function handleSubmit(status: "draft" | "confirmed") {
    setError("");
    setSaving(true);

    const allLines = [...debitLines, ...creditLines].map((l) => ({
      side: l.side,
      accountId: l.accountId,
      amount: parseInt(l.amount) || 0,
      taxCategoryId: l.taxCategoryId || undefined,
      taxAmount: parseInt(l.taxAmount) || 0,
      description: l.description || undefined,
    }));

    const payload = {
      date,
      description: description || undefined,
      clientName: clientName || undefined,
      status,
      lines: allLines,
    };

    const res = await fetch("/api/journal-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      toast({
        variant: "success",
        title: status === "confirmed" ? "仕訳を確定保存しました" : "下書きを保存しました",
      });
      router.push("/journal");
      router.refresh();
    } else {
      const data = await res.json();
      const msg = data.error || "保存に失敗しました";
      if (data.details) {
        const fieldErrors = data.details.fieldErrors;
        const formErrors = data.details.formErrors;
        const msgs: string[] = [...(formErrors || [])];
        for (const [, errs] of Object.entries(fieldErrors || {})) {
          msgs.push(...(errs as string[]));
        }
        if (msgs.length > 0) {
          setError(msgs.join(", "));
          toast({ variant: "error", title: "入力エラー", description: msgs.join(", ") });
        } else {
          setError(msg);
          toast({ variant: "error", title: msg });
        }
      } else {
        setError(msg);
        toast({ variant: "error", title: msg });
      }
    }
    setSaving(false);
  }

  function renderLines(
    lines: LineData[],
    setLines: (l: LineData[]) => void,
    sideLabel: string,
    side: "debit" | "credit",
  ) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{sideLabel}</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLines([...lines, createEmptyLine(side)])}
          >
            <Plus className="mr-1 h-3 w-3" />
            行追加
          </Button>
        </div>
        {lines.map((line, i) => (
          <div key={line.key} className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-4">
              {i === 0 && <Label className="text-xs text-muted-foreground">勘定科目</Label>}
              <AccountCombobox
                accounts={accounts}
                value={line.accountId}
                onChange={(accountId) => updateLine(lines, setLines, i, "accountId", accountId)}
              />
            </div>
            <div className="col-span-2">
              {i === 0 && <Label className="text-xs text-muted-foreground">金額</Label>}
              <Input
                type={focusedAmount === line.key ? "number" : "text"}
                placeholder="0"
                value={focusedAmount === line.key ? line.amount : formatComma(line.amount)}
                onChange={(e) => updateLine(lines, setLines, i, "amount", e.target.value)}
                onFocus={() => setFocusedAmount(line.key)}
                onBlur={() => setFocusedAmount(null)}
                className="text-right font-mono"
              />
            </div>
            <div className="col-span-2">
              {i === 0 && <Label className="text-xs text-muted-foreground">税区分</Label>}
              <Select
                value={line.taxCategoryId}
                onChange={(e) =>
                  updateLine(lines, setLines, i, "taxCategoryId", e.target.value)
                }
              >
                <option value="">なし</option>
                {taxCategories.map((tc) => (
                  <option key={tc.id} value={tc.id}>
                    {tc.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="col-span-1">
              {i === 0 && <Label className="text-xs text-muted-foreground">消費税</Label>}
              <Input
                type="number"
                value={line.taxAmount}
                onChange={(e) => updateLine(lines, setLines, i, "taxAmount", e.target.value)}
                className="text-right font-mono text-muted-foreground"
                readOnly
              />
            </div>
            <div className="col-span-2">
              {i === 0 && <Label className="text-xs text-muted-foreground">摘要</Label>}
              <Input
                placeholder="摘要"
                value={line.description}
                onChange={(e) => updateLine(lines, setLines, i, "description", e.target.value)}
              />
            </div>
            <div className="col-span-1">
              {i === 0 && <Label className="text-xs text-muted-foreground">&nbsp;</Label>}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeLine(lines, setLines, i)}
                disabled={lines.length <= 1}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
        ))}
        <div className="text-right font-mono text-sm font-medium">
          合計: {formatYen(side === "debit" ? debitTotal : creditTotal)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>仕訳ヘッダ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="date">取引日</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="description">摘要</Label>
              <Input
                id="description"
                placeholder="取引の概要"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="clientName">取引先</Label>
              <Input
                id="clientName"
                placeholder="取引先名"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>借方（デビット）</CardTitle>
        </CardHeader>
        <CardContent>
          {renderLines(debitLines, setDebitLines, "借方", "debit")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>貸方（クレジット）</CardTitle>
        </CardHeader>
        <CardContent>
          {renderLines(creditLines, setCreditLines, "貸方", "credit")}
        </CardContent>
      </Card>

      {/* Balance indicator */}
      <div
        className={`rounded-md p-3 text-center text-sm font-medium ${
          isBalanced
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}
      >
        借方合計: {formatYen(debitTotal)} / 貸方合計: {formatYen(creditTotal)}
        {isBalanced ? " — 一致" : ` — 不一致（差額: ${formatYen(difference)}）`}
      </div>

      <div className="flex gap-3">
        <Button
          onClick={() => handleSubmit("draft")}
          variant="outline"
          disabled={saving}
        >
          <Save className="mr-2 h-4 w-4" />
          下書き保存
        </Button>
        <Button
          onClick={() => handleSubmit("confirmed")}
          disabled={saving || !isBalanced}
        >
          <Save className="mr-2 h-4 w-4" />
          確定保存
        </Button>
        <span className="flex items-center text-xs text-muted-foreground">
          Cmd+Enter で確定保存
        </span>
      </div>
    </div>
  );
}
