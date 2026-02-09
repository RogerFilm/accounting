import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "@/db";
import {
  invoices,
  accounts,
  journalEntries,
  journalLines,
  virtualAccounts,
} from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { issueVirtualAccounts, GmoApiError } from "@/lib/gmo-aozora/client";

/** POST /api/invoices/[id]/issue — issue invoice and create journal entry */
export async function POST(
  request: Request,
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

  if (invoice.status !== "draft") {
    return NextResponse.json({ error: "下書き以外は発行できません" }, { status: 400 });
  }

  const now = new Date().toISOString();

  // Create journal entry: 売掛金 / 売上高 (+ 仮受消費税)
  const accountsData = await db
    .select()
    .from(accounts)
    .where(eq(accounts.companyId, user.companyId));
  const arAccount = accountsData.find((a) => a.code === "1200"); // 売掛金
  const salesAccount = accountsData.find((a) => a.code === "4100"); // 売上高

  let journalEntryId: string | null = null;

  if (arAccount && salesAccount) {
    const entryId = ulid();
    journalEntryId = entryId;

    await db.insert(journalEntries)
      .values({
        id: entryId,
        companyId: user.companyId,
        fiscalYearId: "",
        date: invoice.issueDate,
        description: `請求書 ${invoice.documentNumber}`,
        clientName: null,
        status: "confirmed",
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      });

    // Debit: 売掛金 (tax-inclusive total)
    await db.insert(journalLines)
      .values({
        id: ulid(),
        journalEntryId: entryId,
        side: "debit",
        accountId: arAccount.id,
        amount: invoice.total,
        taxCategoryId: null,
        taxAmount: 0,
        description: null,
        sortOrder: 0,
      });

    // Credit: 売上高 (subtotal)
    await db.insert(journalLines)
      .values({
        id: ulid(),
        journalEntryId: entryId,
        side: "credit",
        accountId: salesAccount.id,
        amount: invoice.subtotal,
        taxCategoryId: null,
        taxAmount: 0,
        description: null,
        sortOrder: 1,
      });

    // Credit: 仮受消費税 (tax amount) if any
    if (invoice.taxAmount > 0) {
      const taxReceivable = accountsData.find((a) => a.code === "2360");
      if (taxReceivable) {
        await db.insert(journalLines)
          .values({
            id: ulid(),
            journalEntryId: entryId,
            side: "credit",
            accountId: taxReceivable.id,
            amount: invoice.taxAmount,
            taxCategoryId: null,
            taxAmount: 0,
            description: null,
            sortOrder: 2,
          });
      }
    }
  }

  // Update invoice status
  await db.update(invoices)
    .set({
      status: "issued",
      journalEntryId,
      updatedAt: now,
    })
    .where(eq(invoices.id, id));

  // Optionally issue VA for automatic payment reconciliation
  let virtualAccountId: string | null = null;
  const body = await request.json().catch(() => ({}));

  if (body.issueVa) {
    try {
      const vaContractAuthKey = process.env.GMO_VA_CONTRACT_AUTH_KEY;
      if (vaContractAuthKey) {
        const vaType = body.vaType === "continuous" ? "2" : "1";
        const result = await issueVirtualAccounts([
          {
            vaContractAuthKey,
            vaTypeCode: vaType,
            depositAmountExistCode: "1",
            depositAmount: String(invoice.total),
            vaTradeInformation: invoice.documentNumber,
            expiredDate: invoice.dueDate
              ? invoice.dueDate.replace(/-/g, "")
              : undefined,
          },
        ]);

        const issuedVa = result.vaList[0];
        if (issuedVa) {
          const vaRecordId = ulid();
          virtualAccountId = vaRecordId;

          await db.insert(virtualAccounts).values({
            id: vaRecordId,
            companyId: user.companyId,
            vaNumber: issuedVa.vaNumber,
            vaAccountName: issuedVa.vaAccountName,
            vaType: body.vaType === "continuous" ? "continuous" : "term",
            invoiceId: id,
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
            .set({ virtualAccountId: vaRecordId, updatedAt: now })
            .where(eq(invoices.id, id));
        }
      }
    } catch (e) {
      // VA issuance failure should not block invoice issuance
      console.error("VA issuance failed:", e instanceof GmoApiError ? e.message : e);
    }
  }

  return NextResponse.json({ success: true, journalEntryId, virtualAccountId });
}
