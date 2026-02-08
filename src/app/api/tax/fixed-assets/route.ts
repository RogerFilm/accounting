import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "@/db";
import { fixedAssets, accounts } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";

/** GET /api/tax/fixed-assets — list fixed assets */
export async function GET() {
  const { user } = await requireAuth();

  const assets = await db
    .select()
    .from(fixedAssets)
    .where(eq(fixedAssets.companyId, user.companyId))
    .orderBy(desc(fixedAssets.acquisitionDate));

  return NextResponse.json(assets);
}

/** POST /api/tax/fixed-assets — create fixed asset */
export async function POST(request: Request) {
  const { user } = await requireAuth();
  const body = await request.json();

  if (!body.name || !body.acquisitionDate || !body.acquisitionCost || !body.usefulLife) {
    return NextResponse.json(
      { error: "資産名、取得日、取得原価、耐用年数は必須です" },
      { status: 400 },
    );
  }

  const id = ulid();
  const now = new Date().toISOString();

  await db.insert(fixedAssets)
    .values({
      id,
      companyId: user.companyId,
      name: body.name,
      category: body.category || "器具備品",
      acquisitionDate: body.acquisitionDate,
      acquisitionCost: parseInt(body.acquisitionCost),
      usefulLife: parseInt(body.usefulLife),
      depreciationMethod: body.depreciationMethod || "straight_line",
      residualValue: body.residualValue ? parseInt(body.residualValue) : 1,
      accountId: body.accountId,
      depreciationAccountId: body.depreciationAccountId,
      disposalDate: body.disposalDate || null,
      memo: body.memo || null,
      createdAt: now,
      updatedAt: now,
    });

  return NextResponse.json({ id }, { status: 201 });
}
