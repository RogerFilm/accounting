import { pgTable, text, boolean } from "drizzle-orm/pg-core";

export const fiscalYears = pgTable("fiscal_years", {
  id: text("id").primaryKey(), // ULID
  companyId: text("company_id").notNull(),
  startDate: text("start_date").notNull(), // ISO 8601 "2024-04-01"
  endDate: text("end_date").notNull(), // ISO 8601 "2025-03-31"
  isClosed: boolean("is_closed").notNull().default(false),
  createdAt: text("created_at").notNull(),
});
