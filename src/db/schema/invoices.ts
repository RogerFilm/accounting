import { pgTable, text, integer, boolean } from "drizzle-orm/pg-core";

/**
 * Documents: 請求書, 見積書, 納品書, 領収書
 */
export const invoices = pgTable("invoices", {
  id: text("id").primaryKey(), // ULID
  companyId: text("company_id").notNull(),
  documentType: text("document_type", {
    enum: ["invoice", "estimate", "delivery_note", "receipt"],
  }).notNull(),
  // invoice: 請求書, estimate: 見積書, delivery_note: 納品書, receipt: 領収書
  documentNumber: text("document_number").notNull(), // 採番 e.g. "INV-2025-0001"
  clientId: text("client_id").notNull(),
  issueDate: text("issue_date").notNull(), // 発行日
  dueDate: text("due_date"), // 支払期限 (請求書のみ)
  subject: text("subject"), // 件名
  notes: text("notes"), // 備考
  status: text("status", {
    enum: ["draft", "issued", "paid", "cancelled"],
  }).notNull().default("draft"),
  // Totals (computed from lines, stored for quick access)
  subtotal: integer("subtotal").notNull().default(0), // 税抜合計
  taxAmount: integer("tax_amount").notNull().default(0), // 消費税合計
  total: integer("total").notNull().default(0), // 税込合計
  // Linked journal entry (auto-generated when issued)
  journalEntryId: text("journal_entry_id"),
  virtualAccountId: text("virtual_account_id"), // 紐付くバーチャル口座
  // Source document (for estimate → invoice conversion)
  sourceDocumentId: text("source_document_id"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const invoiceLines = pgTable("invoice_lines", {
  id: text("id").primaryKey(), // ULID
  invoiceId: text("invoice_id").notNull(),
  description: text("description").notNull(), // 品名・サービス名
  quantity: integer("quantity").notNull().default(1),
  unitPrice: integer("unit_price").notNull(), // 単価（円）
  taxRate: integer("tax_rate").notNull().default(10), // 税率 (10 or 8)
  isReducedTax: boolean("is_reduced_tax").notNull().default(false), // 軽減税率
  amount: integer("amount").notNull(), // 小計 = quantity * unitPrice
  taxAmount: integer("tax_amount").notNull(), // 消費税額
  sortOrder: integer("sort_order").notNull().default(0),
});

/**
 * 採番ルール設定
 */
export const numberingRules = pgTable("numbering_rules", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  documentType: text("document_type", {
    enum: ["invoice", "estimate", "delivery_note", "receipt"],
  }).notNull(),
  prefix: text("prefix").notNull(), // e.g. "INV-", "EST-"
  nextNumber: integer("next_number").notNull().default(1),
  digitCount: integer("digit_count").notNull().default(4), // zero-pad
});
