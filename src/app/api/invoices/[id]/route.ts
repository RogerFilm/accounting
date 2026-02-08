import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { invoices, invoiceLines, clients, companies } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";

/** GET /api/invoices/[id] — get invoice with lines and related data */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await requireAuth();
  const { id } = await params;

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.companyId, user.companyId)));

  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const lines = await db
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, id));

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, invoice.clientId));

  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, user.companyId));

  return NextResponse.json({
    ...invoice,
    lines,
    client,
    company,
  });
}
