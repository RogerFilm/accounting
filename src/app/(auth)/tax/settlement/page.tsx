"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatYen } from "@/lib/utils/currency";
import { Check, BookOpen, ClipboardCheck, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { CATEGORY_LABELS } from "@/lib/accounting/settlement";

interface SettlementTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  debitAccountCode: string;
  creditAccountCode: string;
  needsAmount: boolean;
  autoCalculate: boolean;
}

export default function SettlementPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<SettlementTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [date, setDate] = useState(() => {
    const now = new Date();
    const year = now.getMonth() >= 3 ? now.getFullYear() + 1 : now.getFullYear();
    return `${year}-03-31`;
  });
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/tax/settlement")
      .then((r) => r.json())
      .then(setTemplates);
  }, []);

  // Group by category
  const grouped = templates.reduce<Record<string, SettlementTemplate[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});

  async function handleCreate() {
    if (!selectedId || !amount) return;

    setSaving(true);
    const template = templates.find((t) => t.id === selectedId);

    const res = await fetch("/api/tax/settlement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: selectedId,
        date,
        amount: parseInt(amount),
        memo: memo || template?.name,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setCreated((prev) => [...prev, data.journalEntryId]);
      setSelectedId(null);
      setAmount("");
      setMemo("");
      toast({ variant: "success", title: "決算仕訳を作成しました" });
    } else {
      toast({ variant: "error", title: "作成に失敗しました" });
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">決算整理仕訳</h1>
        <div className="flex items-center gap-2">
          <Label className="text-sm">決算日</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      {created.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-700">
                <Check className="h-5 w-5" />
                <span className="font-medium">{created.length}件の決算整理仕訳を作成しました</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => router.push("/journal")}>
                <BookOpen className="h-4 w-4 mr-2" />
                仕訳帳を確認
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Templates by category */}
      {Object.entries(grouped).map(([category, tmpl]) => (
        <Card key={category}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {(CATEGORY_LABELS as Record<string, string>)[category] || category}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tmpl.map((t) => {
                const isSelected = selectedId === t.id;
                const isCreated = false; // Could track per-template

                return (
                  <div
                    key={t.id}
                    className={`rounded-lg border p-4 transition-colors cursor-pointer ${
                      isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                    }`}
                    onClick={() => {
                      setSelectedId(isSelected ? null : t.id);
                      setMemo(t.name);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{t.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t.description}
                        </p>
                        <div className="flex gap-2 mt-1.5">
                          <Badge variant="outline" className="text-[10px]">
                            借方: {t.debitAccountCode}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            貸方: {t.creditAccountCode}
                          </Badge>
                          {t.autoCalculate && (
                            <Badge variant="secondary" className="text-[10px]">
                              自動計算可
                            </Badge>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <ClipboardCheck className="h-5 w-5 text-primary" />
                      )}
                    </div>

                    {isSelected && (
                      <div className="mt-4 flex items-end gap-3 border-t pt-3">
                        <div className="flex-1">
                          <Label className="text-xs">金額</Label>
                          <Input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs">摘要</Label>
                          <Input
                            value={memo}
                            onChange={(e) => setMemo(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCreate();
                          }}
                          disabled={saving || !amount}
                          size="sm"
                        >
                          {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "仕訳を作成"
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
