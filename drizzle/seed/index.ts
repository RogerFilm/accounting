/**
 * Seed script: Run with `npx tsx drizzle/seed/index.ts`
 * Creates initial company, admin user, accounts, and tax categories.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import "dotenv/config";
import { ulid } from "ulid";
import * as schema from "../../src/db/schema";
import { seedAccounts } from "./accounts";
import { seedTaxCategories } from "./tax-categories";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function main() {
  // Dynamic import to use hashPassword
  const { hashPassword } = await import("../../src/lib/auth/password");

  const now = new Date().toISOString();
  const companyId = ulid();

  // Create company
  await db.insert(schema.companies)
    .values({
      id: companyId,
      name: "RogerFilm合同会社",
      address: "東京都調布市西つつじケ丘３丁目２６番７号アーバンフラッツＭＡ２０３",
      invoiceRegistrationNumber: "T3012403005316",
      fiscalYearEndMonth: 12,
      taxMethod: "standard",
      createdAt: now,
      updatedAt: now,
    });

  // Create fiscal year (2024/4 - 2025/3)
  const fyId = ulid();
  await db.insert(schema.fiscalYears)
    .values({
      id: fyId,
      companyId,
      startDate: "2024-04-01",
      endDate: "2025-03-31",
      isClosed: false,
      createdAt: now,
    });

  // Create admin user
  const userId = ulid();
  const hashed = await hashPassword("admin123");
  await db.insert(schema.users)
    .values({
      id: userId,
      email: "admin@example.com",
      hashedPassword: hashed,
      name: "管理者",
      role: "owner",
      companyId,
      createdAt: now,
    });

  // Create tax accountant user
  const taxAccountantId = ulid();
  const taxAccountantHashed = await hashPassword("tax123");
  await db.insert(schema.users)
    .values({
      id: taxAccountantId,
      email: "tax@example.com",
      hashedPassword: taxAccountantHashed,
      name: "税理士",
      role: "accountant",
      companyId,
      createdAt: now,
    });

  // Create accountant user
  const accountantId = ulid();
  const accountantHashed = await hashPassword("keiri123");
  await db.insert(schema.users)
    .values({
      id: accountantId,
      email: "accountant@example.com",
      hashedPassword: accountantHashed,
      name: "経理担当",
      role: "accountant",
      companyId,
      createdAt: now,
    });

  // Seed accounts
  for (let i = 0; i < seedAccounts.length; i++) {
    const acc = seedAccounts[i];
    await db.insert(schema.accounts)
      .values({
        id: ulid(),
        companyId,
        code: acc.code,
        name: acc.name,
        category: acc.category,
        isSystem: true,
        isActive: true,
        sortOrder: i,
        createdAt: now,
      });
  }

  // Seed tax categories
  for (const tc of seedTaxCategories) {
    await db.insert(schema.taxCategories)
      .values({
        id: ulid(),
        code: tc.code,
        name: tc.name,
        rate: tc.rate,
        type: tc.type,
        isReduced: tc.isReduced,
        isActive: true,
        sortOrder: tc.sortOrder,
      });
  }

  console.log("Seed completed successfully!");
  console.log(`  Company: ${companyId}`);
  console.log(`  Fiscal Year: ${fyId}`);
  console.log(`  Admin User: admin@example.com / admin123`);
  console.log(`  Tax Accountant User: tax@example.com / tax123`);
  console.log(`  Accountant User: accountant@example.com / keiri123`);
  console.log(`  Accounts: ${seedAccounts.length} accounts created`);
  console.log(`  Tax Categories: ${seedTaxCategories.length} categories created`);
}

main().catch(console.error);
