"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Camera,
  Upload,
  Loader2,
  Check,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { parseReceiptText, suggestAccountFromStore } from "@/lib/ocr/receipt-parser";
import type { ReceiptItem } from "@/lib/ocr/receipt-parser";

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

type PageState = "idle" | "processing" | "reviewing" | "saving" | "saved";

export default function ReceiptOCRPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<PageState>("idle");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  // OCR state
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrText, setOcrText] = useState("");
  const [ocrConfidence, setOcrConfidence] = useState(0);
  const [ocrProvider, setOcrProvider] = useState<"tesseract" | "claude">("tesseract");

  // Parsed data (editable)
  const [storeName, setStoreName] = useState("");
  const [date, setDate] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [items, setItems] = useState<ReceiptItem[]>([]);

  // Journal entry
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedTaxCategoryId, setSelectedTaxCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [journalEntryId, setJournalEntryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/accounts").then((r) => r.json()),
      fetch("/api/tax-categories").then((r) => r.json()),
    ]).then(([accts, taxCats]) => {
      setAccounts(accts);
      setTaxCategories(taxCats);
    });
  }, []);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setImageFile(file);
      setError(null);
      setJournalEntryId(null);
      setReceiptId(null);

      // Preview
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);

      // Run OCR
      setState("processing");
      setOcrProgress(0);

      try {
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("jpn+eng", undefined, {
          logger: (m) => {
            if (m.status === "recognizing text") {
              setOcrProgress(Math.round(m.progress * 100));
            }
          },
        });

        const {
          data: { text, confidence },
        } = await worker.recognize(file);
        await worker.terminate();

        setOcrText(text);
        setOcrConfidence(confidence / 100); // tesseract returns 0-100
        setOcrProvider("tesseract");

        // Parse extracted text
        const parsed = parseReceiptText(text);
        setStoreName(parsed.storeName || "");
        setDate(parsed.date || new Date().toISOString().split("T")[0]);
        setTotalAmount(parsed.totalAmount ? String(parsed.totalAmount) : "");
        setTaxAmount(parsed.taxAmount ? String(parsed.taxAmount) : "");
        setItems(parsed.items);
        setDescription(parsed.storeName || "");

        // Suggest account from store name
        if (parsed.storeName) {
          const suggestion = suggestAccountFromStore(parsed.storeName);
          if (suggestion) {
            const match = accounts.find((a) => a.code === suggestion.accountCode);
            if (match) {
              setSelectedAccountId(match.id);
            }
          }
        }

        // Default tax category: 課税仕入10%
        const defaultTaxCat = taxCategories.find((t) => t.code === "purchase_10");
        if (defaultTaxCat) {
          setSelectedTaxCategoryId(defaultTaxCat.id);
        }

        setState("reviewing");
      } catch (err) {
        setError(`OCR処理に失敗しました: ${err}`);
        toast({ variant: "error", title: "OCR処理に失敗しました" });
        setState("idle");
      }
    },
    [accounts, taxCategories],
  );

  async function handleClaudeFallback() {
    if (!imagePreview || !receiptId) {
      // Need to save image first
      await saveReceipt();
    }

    const rid = receiptId;
    if (!rid) return;

    setOcrProgress(0);
    setState("processing");

    try {
      const res = await fetch(`/api/receipts/${rid}/ocr`, {
        method: "POST",
      });

      if (res.status === 501) {
        setError("Claude API キーが設定されていません（.env.local に ANTHROPIC_API_KEY を設定）");
        setState("reviewing");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Claude OCR に失敗しました");
        setState("reviewing");
        return;
      }

      const data = await res.json();
      setOcrText(data.ocrText || "");
      setOcrConfidence(data.ocrConfidence || 0.9);
      setOcrProvider("claude");
      setStoreName(data.storeName || "");
      setDate(data.date || date);
      setTotalAmount(data.totalAmount ? String(data.totalAmount) : totalAmount);
      setTaxAmount(data.taxAmount ? String(data.taxAmount) : taxAmount);
      if (data.items) setItems(data.items);
      if (data.storeName) setDescription(data.storeName);

      setState("reviewing");
    } catch (err) {
      setError(`Claude OCR に失敗しました: ${err}`);
      setState("reviewing");
    }
  }

  async function saveReceipt(): Promise<string | null> {
    if (!imagePreview) return null;

    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imagePreview,
          fileName: imageFile?.name || "receipt.jpg",
          ocrText,
          ocrConfidence,
          ocrProvider,
          storeName,
          date,
          totalAmount: totalAmount ? parseInt(totalAmount) : null,
          taxAmount: taxAmount ? parseInt(taxAmount) : null,
          items: items.length > 0 ? JSON.stringify(items) : null,
          suggestedAccountId: selectedAccountId || null,
          suggestedTaxCategoryId: selectedTaxCategoryId || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setReceiptId(data.id);
        return data.id;
      }
    } catch {
      // Continue silently
    }
    return null;
  }

  async function handleCreateJournal() {
    if (!totalAmount || !selectedAccountId || !date) {
      setError("日付、金額、勘定科目は必須です");
      return;
    }

    setState("saving");
    setError(null);

    try {
      // Save receipt first if not saved yet
      let rid = receiptId;
      if (!rid) {
        rid = await saveReceipt();
        if (!rid) {
          setError("レシートの保存に失敗しました");
          setState("reviewing");
          return;
        }
      }

      const res = await fetch(`/api/receipts/${rid}/journal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccountId,
          date,
          amount: parseInt(totalAmount),
          taxCategoryId: selectedTaxCategoryId || null,
          description: description || storeName || "レシート取込",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setJournalEntryId(data.journalEntryId);
        setState("saved");
        toast({ variant: "success", title: "仕訳を作成しました" });
      } else {
        const data = await res.json();
        setError(data.error || "仕訳の作成に失敗しました");
        toast({ variant: "error", title: "仕訳の作成に失敗しました" });
        setState("reviewing");
      }
    } catch (err) {
      setError(`エラー: ${err}`);
      toast({ variant: "error", title: "仕訳の作成に失敗しました" });
      setState("reviewing");
    }
  }

  function handleReset() {
    setState("idle");
    setImagePreview(null);
    setImageFile(null);
    setOcrText("");
    setOcrConfidence(0);
    setOcrProgress(0);
    setStoreName("");
    setDate("");
    setTotalAmount("");
    setTaxAmount("");
    setItems([]);
    setSelectedAccountId("");
    setSelectedTaxCategoryId("");
    setDescription("");
    setReceiptId(null);
    setJournalEntryId(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">レシートOCR</h1>

      {/* Upload area */}
      {state === "idle" && (
        <Card>
          <CardContent className="pt-6">
            <div
              className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-muted-foreground/25 p-12 cursor-pointer hover:border-muted-foreground/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <div className="flex gap-3">
                <Camera className="h-8 w-8 text-muted-foreground" />
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-medium">レシート画像を選択</p>
                <p className="text-sm text-muted-foreground mt-1">
                  カメラで撮影またはファイルを選択
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processing */}
      {state === "processing" && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="Receipt"
                  className="max-h-48 rounded-lg border object-contain"
                />
              )}
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="font-medium">OCR処理中... {ocrProgress}%</span>
              </div>
              <div className="w-full max-w-xs bg-secondary rounded-full h-2">
                <div
                  className="bg-primary rounded-full h-2 transition-all"
                  style={{ width: `${ocrProgress}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review & Edit */}
      {(state === "reviewing" || state === "saving") && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left: Image + OCR text */}
            <div className="space-y-4">
              {imagePreview && (
                <Card>
                  <CardContent className="pt-6">
                    <img
                      src={imagePreview}
                      alt="Receipt"
                      className="w-full rounded-lg border object-contain max-h-96"
                    />
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>OCR結果</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {ocrProvider === "claude" ? "Claude" : "Tesseract"}
                      </Badge>
                      <Badge
                        variant={ocrConfidence >= 0.7 ? "secondary" : "destructive"}
                        className="text-[10px]"
                      >
                        信頼度 {Math.round(ocrConfidence * 100)}%
                      </Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded-md max-h-48 overflow-auto font-mono">
                    {ocrText || "(テキストなし)"}
                  </pre>
                  {ocrConfidence < 0.7 && ocrProvider === "tesseract" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={handleClaudeFallback}
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      Claude APIで再読取
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right: Editable parsed data */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">読み取り結果</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    <div>
                      <Label htmlFor="storeName">店舗名</Label>
                      <Input
                        id="storeName"
                        value={storeName}
                        onChange={(e) => {
                          setStoreName(e.target.value);
                          setDescription(e.target.value);
                        }}
                        placeholder="店舗名"
                      />
                    </div>

                    <div>
                      <Label htmlFor="date">日付</Label>
                      <Input
                        id="date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="totalAmount">合計金額</Label>
                        <Input
                          id="totalAmount"
                          type="number"
                          value={totalAmount}
                          onChange={(e) => setTotalAmount(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="taxAmount">消費税額</Label>
                        <Input
                          id="taxAmount"
                          type="number"
                          value={taxAmount}
                          onChange={(e) => setTaxAmount(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Items */}
              {items.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">明細</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>品名</TableHead>
                          <TableHead className="text-right w-24">金額</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-sm">
                              {item.name}
                              {item.quantity && item.quantity > 1 && (
                                <span className="text-muted-foreground ml-1">×{item.quantity}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatYen(item.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Journal entry settings */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">仕訳設定</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label htmlFor="account">勘定科目（借方）</Label>
                    <Select
                      id="account"
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                    >
                      <option value="">科目を選択</option>
                      {accounts
                        .filter((a) => a.category === "expense" || a.category === "asset")
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} {a.name}
                          </option>
                        ))}
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="taxCategory">税区分</Label>
                    <Select
                      id="taxCategory"
                      value={selectedTaxCategoryId}
                      onChange={(e) => setSelectedTaxCategoryId(e.target.value)}
                    >
                      <option value="">税区分を選択</option>
                      {taxCategories
                        .filter((t) => t.code.startsWith("purchase") || t.code === "non_taxable")
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="description">摘要</Label>
                    <Input
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="摘要"
                    />
                  </div>

                  <p className="text-xs text-muted-foreground">
                    貸方は「現金」(1100) で自動設定されます
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button onClick={handleReset} variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />
              やり直し
            </Button>
            <Button
              onClick={handleCreateJournal}
              disabled={state === "saving" || !totalAmount || !selectedAccountId || !date}
            >
              {state === "saving" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  登録中...
                </>
              ) : (
                <>
                  <BookOpen className="h-4 w-4 mr-2" />
                  仕訳を作成
                </>
              )}
            </Button>
          </div>
        </>
      )}

      {/* Success */}
      {state === "saved" && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 text-green-700">
                <Check className="h-6 w-6" />
                <span className="text-lg font-medium">仕訳を登録しました</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {storeName && <span>{storeName} — </span>}
                {totalAmount && <span>{formatYen(parseInt(totalAmount))}</span>}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleReset}>
                  <Camera className="h-4 w-4 mr-2" />
                  次のレシートをスキャン
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.location.href = "/journal"}
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  仕訳帳を確認
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
