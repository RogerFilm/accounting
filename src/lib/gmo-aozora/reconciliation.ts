/**
 * VA入金消し込みロジック
 * バーチャル口座への入金を請求書と突合し、消し込み処理を行う。
 */

import { eq, and } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "@/db";
import {
  invoices,
  virtualAccounts,
  accounts,
  journalEntries,
  journalLines,
  bankImportHistory,
} from "@/db/schema";
import type { VaDepositTransaction } from "./client";

export interface ReconcileMatch {
  deposit: VaDepositTransaction;
  vaNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  invoiceTotal: number;
  depositAmount: number;
  isFullPayment: boolean; // 入金額 == 請求額
  isDuplicate: boolean; // 既に消し込み済み
  hash: string;
}

async function generateHash(
  vaNumber: string,
  date: string,
  amount: string,
  time: string,
): Promise<string> {
  const data = `va|${vaNumber}|${date}|${amount}|${time}`;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * VA入金明細と請求書を突合し、消し込みプレビューを返す。
 */
export async function reconcilePreview(
  companyId: string,
  deposits: VaDepositTransaction[],
): Promise<ReconcileMatch[]> {
  // Get all active VAs for this company
  const vaList = await db
    .select()
    .from(virtualAccounts)
    .where(
      and(
        eq(virtualAccounts.companyId, companyId),
        eq(virtualAccounts.status, "active"),
      ),
    );

  const vaMap = new Map(vaList.map((va) => [va.vaNumber, va]));

  const matches: ReconcileMatch[] = [];

  for (const deposit of deposits) {
    const va = vaMap.get(deposit.vaNumber);
    if (!va || !va.invoiceId) continue;

    // Get invoice
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(
        and(eq(invoices.id, va.invoiceId), eq(invoices.companyId, companyId)),
      );

    if (!invoice || invoice.status === "paid" || invoice.status === "cancelled")
      continue;

    const depositAmount = parseInt(deposit.depositAmount) || 0;
    const hash = await generateHash(
      deposit.vaNumber,
      deposit.depositDate,
      deposit.depositAmount,
      deposit.depositTime,
    );

    // Check duplicate
    const [existing] = await db
      .select()
      .from(bankImportHistory)
      .where(and(eq(bankImportHistory.companyId, companyId), eq(bankImportHistory.hash, hash)));

    matches.push({
      deposit,
      vaNumber: deposit.vaNumber,
      invoiceId: invoice.id,
      invoiceNumber: invoice.documentNumber,
      clientName: deposit.remitterName,
      invoiceTotal: invoice.total,
      depositAmount,
      isFullPayment: depositAmount === invoice.total,
      isDuplicate: !!existing,
      hash,
    });
  }

  return matches;
}

/**
 * 消し込みを確定する: 請求書をpaidに更新 + 入金仕訳を生成
 */
export async function reconcileConfirm(
  user: { id: string; companyId: string },
  matches: ReconcileMatch[],
): Promise<{ created: string[]; skipped: string[] }> {
  const now = new Date().toISOString();
  const created: string[] = [];
  const skipped: string[] = [];

  // Get accounts
  const allAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.companyId, user.companyId));

  const bankAccount = allAccounts.find((a) => a.code === "1120"); // 普通預金
  const arAccount = allAccounts.find((a) => a.code === "1200"); // 売掛金

  if (!bankAccount || !arAccount) {
    throw new Error("必要な勘定科目（普通預金・売掛金）が見つかりません");
  }

  for (const match of matches) {
    if (match.isDuplicate) {
      skipped.push(match.hash);
      continue;
    }

    const entryId = ulid();

    // Create journal entry: 普通預金(debit) / 売掛金(credit)
    await db.insert(journalEntries).values({
      id: entryId,
      companyId: user.companyId,
      fiscalYearId: "",
      date: match.deposit.depositDate,
      description: `入金消し込み ${match.invoiceNumber} (VA: ${match.vaNumber})`,
      clientName: match.clientName,
      status: "confirmed",
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    });

    // Debit: 普通預金
    await db.insert(journalLines).values({
      id: ulid(),
      journalEntryId: entryId,
      side: "debit",
      accountId: bankAccount.id,
      amount: match.depositAmount,
      taxCategoryId: null,
      taxAmount: 0,
      sortOrder: 0,
    });

    // Credit: 売掛金
    await db.insert(journalLines).values({
      id: ulid(),
      journalEntryId: entryId,
      side: "credit",
      accountId: arAccount.id,
      amount: match.depositAmount,
      taxCategoryId: null,
      taxAmount: 0,
      sortOrder: 1,
    });

    // Record import history for duplicate detection
    await db.insert(bankImportHistory).values({
      id: ulid(),
      companyId: user.companyId,
      hash: match.hash,
      journalEntryId: entryId,
      importedAt: now,
    });

    // Update invoice status to paid
    await db
      .update(invoices)
      .set({ status: "paid", updatedAt: now })
      .where(eq(invoices.id, match.invoiceId));

    created.push(entryId);
  }

  return { created, skipped };
}
