import { pgTable, text } from "drizzle-orm/pg-core";

/**
 * バーチャル口座 (GMO Aozora VA)
 * 請求書と紐付けて入金消し込みを自動化する。
 */
export const virtualAccounts = pgTable("virtual_accounts", {
  id: text("id").primaryKey(), // ULID
  companyId: text("company_id").notNull(),
  vaNumber: text("va_number").notNull(), // バーチャル口座番号
  vaAccountName: text("va_account_name"), // 口座名義
  vaType: text("va_type", { enum: ["term", "continuous"] }).notNull(), // 期限型/継続型
  invoiceId: text("invoice_id"), // 紐付く請求書 (nullable)
  clientId: text("client_id"), // 紐付く取引先
  status: text("status", { enum: ["active", "stopped", "deleted"] }).notNull().default("active"),
  expiryDate: text("expiry_date"), // 期限型の場合 (YYYY-MM-DD)
  vaId: text("va_id"), // GMO API上のVA ID
  vaContractAuthKey: text("va_contract_auth_key"), // GMO API認証キー
  gmoRawResponse: text("gmo_raw_response"), // GMOレスポンスJSON
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
