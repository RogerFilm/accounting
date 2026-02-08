import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { receipts } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";

/** GET /api/receipts/[id]/image — serve receipt image */
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

  // filePath is now a Vercel Blob URL — redirect to it
  return NextResponse.redirect(receipt.filePath);
}
