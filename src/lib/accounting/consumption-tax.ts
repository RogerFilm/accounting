/**
 * 消費税計算
 *
 * 対応:
 * - 本則課税（一般課税）: 課税売上消費税 - 課税仕入消費税
 * - 簡易課税: みなし仕入率による計算
 */

import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { journalEntries, journalLines, taxCategories, accounts } from "@/db/schema";

/** みなし仕入率（簡易課税用） */
export const DEEMED_PURCHASE_RATES: Record<number, { name: string; rate: number }> = {
  1: { name: "第1種（卸売業）", rate: 0.9 },
  2: { name: "第2種（小売業）", rate: 0.8 },
  3: { name: "第3種（製造業等）", rate: 0.7 },
  4: { name: "第4種（その他）", rate: 0.6 },
  5: { name: "第5種（サービス業等）", rate: 0.5 },
  6: { name: "第6種（不動産業）", rate: 0.4 },
};

export interface TaxBreakdown {
  rate: number; // 10 or 8
  isReduced: boolean;
  taxableAmount: number; // 課税対象額
  taxAmount: number; // 消費税額
}

export interface ConsumptionTaxResult {
  method: "standard" | "simplified";

  // 課税売上
  salesBreakdown: TaxBreakdown[];
  totalTaxableSales: number;
  totalSalesTax: number;

  // 課税仕入（本則のみ）
  purchaseBreakdown: TaxBreakdown[];
  totalTaxablePurchases: number;
  totalPurchaseTax: number;

  // 簡易課税用
  businessType?: number;
  deemedPurchaseRate?: number;
  deemedPurchaseTax?: number;

  // 納付税額
  taxPayable: number;

  // 内訳: 国税 + 地方税
  nationalTax: number;
  localTax: number;
}

/**
 * 消費税を計算。
 */
export async function calculateConsumptionTax(
  companyId: string,
  dateFrom: string,
  dateTo: string,
  method: "standard" | "simplified",
  businessType: number = 5, // デフォルト: 第5種（サービス業）
): Promise<ConsumptionTaxResult> {
  // 期間内の確定済み仕訳を取得
  const entries = await db
    .select({
      entryId: journalEntries.id,
      date: journalEntries.date,
    })
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.companyId, companyId),
        eq(journalEntries.status, "confirmed"),
        gte(journalEntries.date, dateFrom),
        lte(journalEntries.date, dateTo),
      ),
    );

  const entryIds = new Set(entries.map((e) => e.entryId));

  // 全仕訳明細 + 税区分を取得
  const rawLines = await db
    .select({
      journalEntryId: journalLines.journalEntryId,
      side: journalLines.side,
      amount: journalLines.amount,
      taxCategoryId: journalLines.taxCategoryId,
      taxAmount: journalLines.taxAmount,
    })
    .from(journalLines);
  const allLines = rawLines.filter((l) => entryIds.has(l.journalEntryId));

  // 税区分マスタを取得
  const taxCats = await db.select().from(taxCategories);
  const taxCatMap = new Map(taxCats.map((t) => [t.id, t]));

  // 売上・仕入の税額を集計
  const salesByRate = new Map<number, { taxable: number; tax: number; isReduced: boolean }>();
  const purchaseByRate = new Map<number, { taxable: number; tax: number; isReduced: boolean }>();

  for (const line of allLines) {
    if (!line.taxCategoryId) continue;
    const taxCat = taxCatMap.get(line.taxCategoryId);
    if (!taxCat || taxCat.rate === 0) continue;

    const rate = taxCat.rate;
    const isSales = taxCat.type === "taxable_sales";
    const isPurchase = taxCat.type === "taxable_purchase";

    if (!isSales && !isPurchase) continue;

    const target = isSales ? salesByRate : purchaseByRate;
    const existing = target.get(rate) || { taxable: 0, tax: 0, isReduced: taxCat.isReduced };

    existing.taxable += line.amount;
    existing.tax += line.taxAmount || 0;
    target.set(rate, existing);
  }

  // Breakdown arrays
  const salesBreakdown: TaxBreakdown[] = [];
  let totalTaxableSales = 0;
  let totalSalesTax = 0;

  for (const [rate, data] of salesByRate) {
    salesBreakdown.push({
      rate,
      isReduced: data.isReduced,
      taxableAmount: data.taxable,
      taxAmount: data.tax,
    });
    totalTaxableSales += data.taxable;
    totalSalesTax += data.tax;
  }

  const purchaseBreakdown: TaxBreakdown[] = [];
  let totalTaxablePurchases = 0;
  let totalPurchaseTax = 0;

  for (const [rate, data] of purchaseByRate) {
    purchaseBreakdown.push({
      rate,
      isReduced: data.isReduced,
      taxableAmount: data.taxable,
      taxAmount: data.tax,
    });
    totalTaxablePurchases += data.taxable;
    totalPurchaseTax += data.tax;
  }

  // If tax amounts weren't recorded in journal lines, calculate from amounts
  if (totalSalesTax === 0 && totalTaxableSales > 0) {
    for (const bd of salesBreakdown) {
      bd.taxAmount = Math.floor(bd.taxableAmount * bd.rate / (100 + bd.rate));
    }
    totalSalesTax = salesBreakdown.reduce((s, b) => s + b.taxAmount, 0);
  }

  if (totalPurchaseTax === 0 && totalTaxablePurchases > 0) {
    for (const bd of purchaseBreakdown) {
      bd.taxAmount = Math.floor(bd.taxableAmount * bd.rate / (100 + bd.rate));
    }
    totalPurchaseTax = purchaseBreakdown.reduce((s, b) => s + b.taxAmount, 0);
  }

  let taxPayable: number;
  let deemedPurchaseRate: number | undefined;
  let deemedPurchaseTax: number | undefined;

  if (method === "simplified") {
    // 簡易課税
    deemedPurchaseRate = DEEMED_PURCHASE_RATES[businessType]?.rate || 0.5;
    deemedPurchaseTax = Math.floor(totalSalesTax * deemedPurchaseRate);
    taxPayable = totalSalesTax - deemedPurchaseTax;
  } else {
    // 本則課税
    taxPayable = totalSalesTax - totalPurchaseTax;
  }

  // 国税・地方税の按分（消費税10%の場合: 国税7.8% + 地方消費税2.2%）
  // 簡易計算: 国税78%, 地方22%
  const nationalTax = Math.floor(taxPayable * 78 / 100);
  const localTax = taxPayable - nationalTax;

  return {
    method,
    salesBreakdown,
    totalTaxableSales,
    totalSalesTax,
    purchaseBreakdown,
    totalTaxablePurchases,
    totalPurchaseTax,
    businessType: method === "simplified" ? businessType : undefined,
    deemedPurchaseRate,
    deemedPurchaseTax,
    taxPayable,
    nationalTax,
    localTax,
  };
}
