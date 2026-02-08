import { pgTable, text, integer, real } from "drizzle-orm/pg-core";

export const receipts = pgTable("receipts", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),

  // File
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),

  // OCR
  ocrText: text("ocr_text"),
  ocrConfidence: real("ocr_confidence"),
  ocrProvider: text("ocr_provider"), // tesseract | claude

  // Extracted data
  storeName: text("store_name"),
  date: text("date"), // ISO 8601
  totalAmount: integer("total_amount"),
  taxAmount: integer("tax_amount"),
  items: text("items"), // JSON string of ReceiptItem[]

  // Account suggestion
  suggestedAccountId: text("suggested_account_id"),
  suggestedTaxCategoryId: text("suggested_tax_category_id"),

  // Status
  status: text("status").notNull().default("pending"), // pending | reviewed | journalized
  journalEntryId: text("journal_entry_id"),

  // Timestamps
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
