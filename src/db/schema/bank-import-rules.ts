import { pgTable, text, integer, boolean } from "drizzle-orm/pg-core";

/**
 * 銀行CSV自動仕訳ルール
 * 摘要のパターンマッチで勘定科目を自動推定する。
 */
export const bankImportRules = pgTable("bank_import_rules", {
  id: text("id").primaryKey(), // ULID
  companyId: text("company_id").notNull(),
  pattern: text("pattern").notNull(), // 摘要の部分一致パターン（e.g. "Amazon", "東京電力"）
  accountId: text("account_id").notNull(), // 推定する勘定科目
  taxCategoryId: text("tax_category_id"), // 推定する税区分
  priority: integer("priority").notNull().default(0), // 高い方が優先
  isActive: boolean("is_active").notNull().default(true),
  createdAt: text("created_at").notNull(),
});

/**
 * 銀行CSVインポート履歴（重複検出用）
 */
export const bankImportHistory = pgTable("bank_import_history", {
  id: text("id").primaryKey(), // ULID
  companyId: text("company_id").notNull(),
  hash: text("hash").notNull(), // SHA-256 of date+amount+description
  journalEntryId: text("journal_entry_id").notNull(),
  importedAt: text("imported_at").notNull(),
});
