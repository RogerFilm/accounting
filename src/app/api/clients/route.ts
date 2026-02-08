import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { clientSchema } from "@/lib/validators/invoice";

/** GET /api/clients */
export async function GET() {
  const { user } = await requireAuth();
  const result = await db
    .select()
    .from(clients)
    .where(eq(clients.companyId, user.companyId))
    .orderBy(asc(clients.name));
  return NextResponse.json(result);
}

/** POST /api/clients */
export async function POST(request: Request) {
  const { user } = await requireAuth();
  const body = await request.json();
  const parsed = clientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "バリデーションエラー", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const now = new Date().toISOString();
  const id = ulid();

  await db.insert(clients)
    .values({
      id,
      companyId: user.companyId,
      name: data.name,
      nameKana: data.nameKana || null,
      postalCode: data.postalCode || null,
      address: data.address || null,
      phone: data.phone || null,
      email: data.email || null,
      contactPerson: data.contactPerson || null,
      invoiceRegistrationNumber: data.invoiceRegistrationNumber || null,
      notes: data.notes || null,
      createdAt: now,
      updatedAt: now,
    });

  return NextResponse.json({ id }, { status: 201 });
}
