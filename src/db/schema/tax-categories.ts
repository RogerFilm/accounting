import { pgTable, text, integer, boolean } from "drizzle-orm/pg-core";

export const taxCategories = pgTable("tax_categories", {
  id: text("id").primaryKey(), // ULID
  code: text("code").notNull().unique(), // e.g. "sales_10", "purchase_10"
  name: text("name").notNull(), // e.g. "課税売上10%"
  rate: integer("rate").notNull(), // 税率 (10 = 10%, 8 = 8%, 0 = 非課税)
  type: text("type", {
    enum: ["taxable_sales", "taxable_purchase", "exempt", "non_taxable", "tax_free"],
  }).notNull(),
  // taxable_sales: 課税売上
  // taxable_purchase: 課税仕入
  // exempt: 非課税
  // non_taxable: 不課税
  // tax_free: 免税
  isReduced: boolean("is_reduced").notNull().default(false), // 軽減税率
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});
