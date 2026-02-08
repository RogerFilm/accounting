import { pgTable, text } from "drizzle-orm/pg-core";

export const clients = pgTable("clients", {
  id: text("id").primaryKey(), // ULID
  companyId: text("company_id").notNull(),
  name: text("name").notNull(), // 取引先名
  nameKana: text("name_kana"), // フリガナ
  postalCode: text("postal_code"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  contactPerson: text("contact_person"), // 担当者名
  invoiceRegistrationNumber: text("invoice_registration_number"), // T+13桁
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
