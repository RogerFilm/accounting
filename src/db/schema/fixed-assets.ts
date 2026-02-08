import { pgTable, text, integer } from "drizzle-orm/pg-core";

/** 固定資産台帳 */
export const fixedAssets = pgTable("fixed_assets", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),

  name: text("name").notNull(), // 資産名
  category: text("category").notNull(), // 建物/車両運搬具/工具器具備品/ソフトウェア 等
  acquisitionDate: text("acquisition_date").notNull(), // 取得日 ISO 8601
  acquisitionCost: integer("acquisition_cost").notNull(), // 取得原価（円）
  usefulLife: integer("useful_life").notNull(), // 耐用年数
  depreciationMethod: text("depreciation_method", {
    enum: ["straight_line", "declining_balance", "immediate", "bulk_3year"],
  }).notNull(),
  // straight_line: 定額法
  // declining_balance: 定率法（200%定率法）
  // immediate: 少額減価償却資産の特例（30万円未満、即時償却）
  // bulk_3year: 一括償却資産（20万円未満、3年均等償却）

  residualValue: integer("residual_value").notNull().default(1), // 残存価額（通常1円）
  accountId: text("account_id").notNull(), // 資産科目（工具器具備品 等）
  depreciationAccountId: text("depreciation_account_id").notNull(), // 減価償却費科目

  // 累計は仕訳から計算するため保持しない
  disposalDate: text("disposal_date"), // 処分日
  memo: text("memo"),

  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
