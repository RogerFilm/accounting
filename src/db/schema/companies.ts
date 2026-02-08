import { pgTable, text, integer } from "drizzle-orm/pg-core";

export const companies = pgTable("companies", {
  id: text("id").primaryKey(), // ULID
  name: text("name").notNull(), // 法人名
  address: text("address"), // 住所
  invoiceRegistrationNumber: text("invoice_registration_number"), // T+13桁
  fiscalYearEndMonth: integer("fiscal_year_end_month").notNull().default(3), // 決算月
  taxMethod: text("tax_method", { enum: ["standard", "simplified"] })
    .notNull()
    .default("standard"), // 本則/簡易
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
