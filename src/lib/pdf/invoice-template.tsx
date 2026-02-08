/**
 * Invoice PDF template using @react-pdf/renderer.
 * Compliant with Japan's Invoice System (インボイス制度) 6 requirements:
 * 1. 発行事業者名 + 登録番号
 * 2. 取引年月日
 * 3. 取引内容
 * 4. 税率ごとの合計額 + 適用税率
 * 5. 税率ごとの消費税額
 * 6. 宛先
 */

// This module exports data structures for PDF generation.
// Actual PDF rendering is done client-side in the component.

export interface InvoicePDFData {
  // Company (issuer)
  companyName: string;
  companyAddress: string;
  registrationNumber: string; // T+13桁

  // Client (recipient)
  clientName: string;
  clientAddress: string;

  // Document
  documentType: "invoice" | "estimate" | "delivery_note" | "receipt";
  documentNumber: string;
  issueDate: string;
  dueDate?: string;
  subject?: string;
  notes?: string;

  // Lines
  lines: {
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    isReducedTax: boolean;
    amount: number;
    taxAmount: number;
  }[];

  // Totals
  subtotal: number;
  taxAmount: number;
  total: number;

  // Tax breakdown by rate
  taxBreakdown: {
    rate: number;
    isReduced: boolean;
    subtotal: number;
    taxAmount: number;
  }[];
}

export const DOCUMENT_TYPE_LABELS = {
  invoice: "請求書",
  estimate: "見積書",
  delivery_note: "納品書",
  receipt: "領収書",
} as const;

/**
 * Compute tax breakdown from invoice lines.
 */
export function computeTaxBreakdown(
  lines: InvoicePDFData["lines"],
): InvoicePDFData["taxBreakdown"] {
  const map = new Map<string, { rate: number; isReduced: boolean; subtotal: number; taxAmount: number }>();
  for (const line of lines) {
    const key = `${line.taxRate}-${line.isReducedTax}`;
    const existing = map.get(key) || {
      rate: line.taxRate,
      isReduced: line.isReducedTax,
      subtotal: 0,
      taxAmount: 0,
    };
    existing.subtotal += line.amount;
    existing.taxAmount += line.taxAmount;
    map.set(key, existing);
  }
  return [...map.values()].sort((a, b) => b.rate - a.rate);
}
