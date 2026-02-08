import { pgTable, text, integer, boolean } from "drizzle-orm/pg-core";

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(), // ULID
  companyId: text("company_id").notNull(),
  code: text("code").notNull(), // e.g. "1100", "5340"
  name: text("name").notNull(), // e.g. "現金", "地代家賃"
  category: text("category", {
    enum: ["asset", "liability", "equity", "revenue", "expense"],
  }).notNull(),
  parentId: text("parent_id"), // 補助科目の場合、親科目ID
  isSystem: boolean("is_system").notNull().default(false), // シード科目は削除不可
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
});
