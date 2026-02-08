import { pgTable, text, integer } from "drizzle-orm/pg-core";

/** 仕訳ヘッダ */
export const journalEntries = pgTable("journal_entries", {
  id: text("id").primaryKey(), // ULID
  companyId: text("company_id").notNull(),
  fiscalYearId: text("fiscal_year_id").notNull(),
  date: text("date").notNull(), // ISO 8601 "2024-04-15"
  description: text("description"), // 摘要
  clientName: text("client_name"), // 取引先
  status: text("status", { enum: ["draft", "confirmed"] })
    .notNull()
    .default("draft"),
  createdBy: text("created_by").notNull(), // user ID
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** 仕訳明細（借方/貸方の各行） */
export const journalLines = pgTable("journal_lines", {
  id: text("id").primaryKey(), // ULID
  journalEntryId: text("journal_entry_id").notNull(),
  side: text("side", { enum: ["debit", "credit"] }).notNull(), // 借方/貸方
  accountId: text("account_id").notNull(), // 勘定科目
  amount: integer("amount").notNull(), // 金額（円、整数）
  taxCategoryId: text("tax_category_id"), // 税区分
  taxAmount: integer("tax_amount").default(0), // 消費税額
  description: text("description"), // 行ごとの摘要
  sortOrder: integer("sort_order").notNull().default(0),
});
