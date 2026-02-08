import { NextResponse } from "next/server";
import { eq, desc, and } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "@/db";
import {
  invoices,
  invoiceLines,
  clients,
  numberingRules,
  journalEntries,
  journalLines,
} from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { invoiceSchema } from "@/lib/validators/invoice";

/** Generate next document number and increment counter */
type DocumentType = "invoice" | "estimate" | "delivery_note" | "receipt";

async function generateDocumentNumber(
  companyId: string,
  documentType: DocumentType,
): Promise<string> {
  const [rule] = await db
    .select()
    .from(numberingRules)
    .where(
      and(
        eq(numberingRules.companyId, companyId),
        eq(numberingRules.documentType, documentType),
      ),
    );

  if (!rule) {
    return `${documentType.toUpperCase()}-${Date.now()}`;
  }

  const num = String(rule.nextNumber).padStart(rule.digitCount, "0");
  const year = new Date().getFullYear();
  const docNumber = `${rule.prefix}${year}-${num}`;

  // Increment
  await db.update(numberingRules)
    .set({ nextNumber: rule.nextNumber + 1 })
    .where(eq(numberingRules.id, rule.id));

  return docNumber;
}

/** GET /api/invoices */
export async function GET(request: Request) {
  const { user } = await requireAuth();
  const url = new URL(request.url);
  const docType = url.searchParams.get("type");

  const results = await db
    .select({
      invoice: invoices,
      clientName: clients.name,
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(eq(invoices.companyId, user.companyId))
    .orderBy(desc(invoices.issueDate));

  const filtered = docType
    ? results.filter((r) => r.invoice.documentType === docType)
    : results;

  return NextResponse.json(
    filtered.map((r) => ({ ...r.invoice, clientName: r.clientName })),
  );
}

/** POST /api/invoices */
export async function POST(request: Request) {
  const { user } = await requireAuth();
  const body = await request.json();
  const parsed = invoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "バリデーションエラー", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const now = new Date().toISOString();
  const id = ulid();
  const docNumber = await generateDocumentNumber(user.companyId, data.documentType);

  // Calculate totals from lines
  const computedLines = data.lines.map((line, i) => {
    const amount = line.quantity * line.unitPrice;
    const taxAmount = Math.floor((amount * line.taxRate) / 100);
    return { ...line, amount, taxAmount, sortOrder: i };
  });

  const subtotal = computedLines.reduce((s, l) => s + l.amount, 0);
  const taxAmount = computedLines.reduce((s, l) => s + l.taxAmount, 0);
  const total = subtotal + taxAmount;

  await db.insert(invoices)
    .values({
      id,
      companyId: user.companyId,
      documentType: data.documentType,
      documentNumber: docNumber,
      clientId: data.clientId,
      issueDate: data.issueDate,
      dueDate: data.dueDate || null,
      subject: data.subject || null,
      notes: data.notes || null,
      status: data.status,
      subtotal,
      taxAmount,
      total,
      journalEntryId: null,
      sourceDocumentId: body.sourceDocumentId || null,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    });

  for (const line of computedLines) {
    await db.insert(invoiceLines)
      .values({
        id: ulid(),
        invoiceId: id,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        taxRate: line.taxRate,
        isReducedTax: line.isReducedTax,
        amount: line.amount,
        taxAmount: line.taxAmount,
        sortOrder: line.sortOrder,
      });
  }

  return NextResponse.json({ id, documentNumber: docNumber }, { status: 201 });
}
