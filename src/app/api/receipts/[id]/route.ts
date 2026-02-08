import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { receipts, accounts } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";

/** GET /api/receipts/[id] — get receipt detail */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await requireAuth();
  const { id } = await params;

  const [receipt] = await db
    .select()
    .from(receipts)
    .where(
      and(eq(receipts.id, id), eq(receipts.companyId, user.companyId)),
    );

  if (!receipt) {
    return NextResponse.json({ error: "レシートが見つかりません" }, { status: 404 });
  }

  // Attach account info if suggested
  let suggestedAccount = null;
  if (receipt.suggestedAccountId) {
    [suggestedAccount] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, receipt.suggestedAccountId));
  }

  return NextResponse.json({ ...receipt, suggestedAccount });
}

/** PATCH /api/receipts/[id] — update OCR results */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await requireAuth();
  const { id } = await params;
  const body = await request.json();

  const [receipt] = await db
    .select()
    .from(receipts)
    .where(
      and(eq(receipts.id, id), eq(receipts.companyId, user.companyId)),
    );

  if (!receipt) {
    return NextResponse.json({ error: "レシートが見つかりません" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  const allowedFields = [
    "ocrText", "ocrConfidence", "ocrProvider",
    "storeName", "date", "totalAmount", "taxAmount", "items",
    "suggestedAccountId", "suggestedTaxCategoryId", "status",
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  await db.update(receipts)
    .set(updates)
    .where(eq(receipts.id, id));

  return NextResponse.json({ ok: true });
}
