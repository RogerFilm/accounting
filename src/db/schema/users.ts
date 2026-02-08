import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(), // ULID
  email: text("email").notNull().unique(),
  hashedPassword: text("hashed_password").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["owner", "accountant"] }).notNull().default("accountant"),
  companyId: text("company_id").notNull(),
  createdAt: text("created_at").notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
});
