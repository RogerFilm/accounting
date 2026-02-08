import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";

/** GET /api/accounts — list all accounts for the company */
export async function GET() {
  const { user } = await requireAuth();

  const result = await db
    .select()
    .from(accounts)
    .where(eq(accounts.companyId, user.companyId))
    .orderBy(asc(accounts.code));

  return NextResponse.json(result);
}
