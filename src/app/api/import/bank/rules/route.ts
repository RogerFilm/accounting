import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "@/db";
import { bankImportRules, accounts } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";

/** GET /api/import/bank/rules — list rules */
export async function GET() {
  const { user } = await requireAuth();

  const rules = await db
    .select({
      rule: bankImportRules,
      accountCode: accounts.code,
      accountName: accounts.name,
    })
    .from(bankImportRules)
    .leftJoin(accounts, eq(bankImportRules.accountId, accounts.id))
    .where(eq(bankImportRules.companyId, user.companyId))
    .orderBy(desc(bankImportRules.priority));

  return NextResponse.json(
    rules.map((r) => ({
      ...r.rule,
      accountCode: r.accountCode,
      accountName: r.accountName,
    })),
  );
}

/** POST /api/import/bank/rules — create rule */
export async function POST(request: Request) {
  const { user } = await requireAuth();
  const body = await request.json();

  if (!body.pattern || !body.accountId) {
    return NextResponse.json(
      { error: "パターンと勘定科目は必須です" },
      { status: 400 },
    );
  }

  const id = ulid();
  await db.insert(bankImportRules)
    .values({
      id,
      companyId: user.companyId,
      pattern: body.pattern,
      accountId: body.accountId,
      taxCategoryId: body.taxCategoryId || null,
      priority: body.priority || 0,
      isActive: true,
      createdAt: new Date().toISOString(),
    });

  return NextResponse.json({ id }, { status: 201 });
}
