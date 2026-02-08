import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { taxCategories } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";

/** GET /api/tax-categories — list all tax categories */
export async function GET() {
  await requireAuth();

  const result = await db
    .select()
    .from(taxCategories)
    .orderBy(asc(taxCategories.sortOrder));

  return NextResponse.json(result);
}
