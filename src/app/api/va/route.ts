import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "@/db";
import { virtualAccounts, invoices, clients } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import {
  issueVirtualAccounts,
  listVirtualAccounts,
  GmoApiError,
} from "@/lib/gmo-aozora/client";

/**
 * GET /api/va — VA一覧取得
 */
export async function GET() {
  const { user } = await requireAuth();

  const vaList = await db
    .select()
    .from(virtualAccounts)
    .where(eq(virtualAccounts.companyId, user.companyId));

  // Enrich with invoice and client info
  const enriched = await Promise.all(
    vaList.map(async (va) => {
      let invoice = null;
      let client = null;

      if (va.invoiceId) {
        const [inv] = await db
          .select()
          .from(invoices)
          .where(eq(invoices.id, va.invoiceId));
        invoice = inv || null;
      }

      if (va.clientId) {
        const [cl] = await db
          .select()
          .from(clients)
          .where(eq(clients.id, va.clientId));
        client = cl || null;
      }

      return {
        ...va,
        invoice: invoice
          ? {
              id: invoice.id,
              documentNumber: invoice.documentNumber,
              total: invoice.total,
              status: invoice.status,
              dueDate: invoice.dueDate,
            }
          : null,
        client: client ? { id: client.id, name: client.name } : null,
      };
    }),
  );

  return NextResponse.json({ virtualAccounts: enriched });
}

/**
 * POST /api/va — VA発行
 * Body: { invoiceId: string, vaType?: "term" | "continuous", expiryDate?: string }
 */
export async function POST(request: Request) {
  const { user } = await requireAuth();
  const body = await request.json();

  const { invoiceId, vaType = "term", expiryDate } = body;

  if (!invoiceId) {
    return NextResponse.json(
      { error: "請求書IDを指定してください" },
      { status: 400 },
    );
  }

  // Get invoice
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(
      and(eq(invoices.id, invoiceId), eq(invoices.companyId, user.companyId)),
    );

  if (!invoice) {
    return NextResponse.json({ error: "請求書が見つかりません" }, { status: 404 });
  }

  if (invoice.status !== "issued") {
    return NextResponse.json(
      { error: "発行済みの請求書のみVAを発行できます" },
      { status: 400 },
    );
  }

  // Check if VA already exists for this invoice
  const [existingVa] = await db
    .select()
    .from(virtualAccounts)
    .where(
      and(
        eq(virtualAccounts.invoiceId, invoiceId),
        eq(virtualAccounts.status, "active"),
      ),
    );

  if (existingVa) {
    return NextResponse.json(
      { error: "この請求書には既にバーチャル口座が発行されています", va: existingVa },
      { status: 409 },
    );
  }

  try {
    const vaContractAuthKey = process.env.GMO_VA_CONTRACT_AUTH_KEY!;
    const vaTypeCode = vaType === "continuous" ? "2" : "1";

    // Issue VA via GMO API
    const result = await issueVirtualAccounts([
      {
        vaContractAuthKey,
        vaTypeCode,
        depositAmountExistCode: "1",
        depositAmount: String(invoice.total),
        vaTradeInformation: invoice.documentNumber,
        expiredDate: expiryDate
          ? expiryDate.replace(/-/g, "")
          : invoice.dueDate
            ? invoice.dueDate.replace(/-/g, "")
            : undefined,
      },
    ]);

    const issuedVa = result.vaList[0];
    if (!issuedVa) {
      return NextResponse.json(
        { error: "VA発行に失敗しました" },
        { status: 500 },
      );
    }

    const now = new Date().toISOString();
    const vaId = ulid();

    // Save VA to DB
    await db.insert(virtualAccounts).values({
      id: vaId,
      companyId: user.companyId,
      vaNumber: issuedVa.vaNumber,
      vaAccountName: issuedVa.vaAccountName,
      vaType: vaType === "continuous" ? "continuous" : "term",
      invoiceId: invoice.id,
      clientId: invoice.clientId,
      status: "active",
      expiryDate: issuedVa.expiredDate
        ? `${issuedVa.expiredDate.slice(0, 4)}-${issuedVa.expiredDate.slice(4, 6)}-${issuedVa.expiredDate.slice(6, 8)}`
        : null,
      vaId: issuedVa.vaId,
      vaContractAuthKey,
      gmoRawResponse: JSON.stringify(issuedVa),
      createdAt: now,
      updatedAt: now,
    });

    // Link VA to invoice
    await db
      .update(invoices)
      .set({ virtualAccountId: vaId, updatedAt: now })
      .where(eq(invoices.id, invoiceId));

    return NextResponse.json({
      success: true,
      virtualAccount: {
        id: vaId,
        vaNumber: issuedVa.vaNumber,
        vaAccountName: issuedVa.vaAccountName,
      },
    });
  } catch (e) {
    if (e instanceof GmoApiError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.status },
      );
    }
    throw e;
  }
}
