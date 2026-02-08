import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "@/db";
import { accounts, taxCategories, journalEntries, journalLines } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { parseFreeeCSV } from "@/lib/import/freee/journal-parser";
import { autoMapAccounts, mapTaxCategory } from "@/lib/import/freee/account-mapper";

/**
 * POST /api/import/freee
 * action=preview: Parse CSV, auto-map accounts, return preview
 * action=confirm: Import journal entries with user-provided account mapping
 */
export async function POST(request: Request) {
  const { user } = await requireAuth();
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "preview";
  const body = await request.json();

  if (action === "confirm") {
    return await handleConfirm(user, body);
  }

  return await handlePreview(user, body);
}

async function handlePreview(
  user: { id: string; companyId: string },
  body: { csv: string },
) {
  if (!body.csv) {
    return NextResponse.json({ error: "CSVデータがありません" }, { status: 400 });
  }

  const parseResult = parseFreeeCSV(body.csv);

  if (parseResult.format === "unknown") {
    return NextResponse.json({
      ...parseResult,
      accountMappings: [],
    });
  }

  // Get internal accounts for auto-mapping
  const internalAccounts = await db
    .select({
      id: accounts.id,
      code: accounts.code,
      name: accounts.name,
      category: accounts.category,
    })
    .from(accounts)
    .where(eq(accounts.companyId, user.companyId));

  // Auto-map freee account names to internal accounts
  const accountMappings = autoMapAccounts(
    parseResult.accountNames,
    internalAccounts,
  );

  // Map tax categories
  const taxCategoryMappings: Record<string, string | null> = {};
  const freeTaxNames = new Set<string>();
  for (const entry of parseResult.entries) {
    for (const line of entry.lines) {
      if (line.taxCategory) freeTaxNames.add(line.taxCategory);
    }
  }
  for (const name of freeTaxNames) {
    taxCategoryMappings[name] = mapTaxCategory(name);
  }

  return NextResponse.json({
    format: parseResult.format,
    entries: parseResult.entries,
    accountNames: parseResult.accountNames,
    accountMappings,
    taxCategoryMappings,
    errors: parseResult.errors,
    summary: parseResult.summary,
  });
}

interface ConfirmBody {
  entries: Array<{
    date: string;
    description: string;
    clientName: string;
    lines: Array<{
      side: "debit" | "credit";
      accountId: string;
      amount: number;
      taxCategoryId: string | null;
      taxAmount: number;
    }>;
  }>;
}

async function handleConfirm(
  user: { id: string; companyId: string },
  body: ConfirmBody,
) {
  if (!body.entries || body.entries.length === 0) {
    return NextResponse.json({ error: "インポートする仕訳がありません" }, { status: 400 });
  }

  const now = new Date().toISOString();
  let created = 0;
  const errors: string[] = [];

  for (let i = 0; i < body.entries.length; i++) {
    const entry = body.entries[i];

    // Validate
    if (!entry.date || entry.lines.length === 0) {
      errors.push(`仕訳 ${i + 1}: 日付または明細がありません`);
      continue;
    }

    const debitTotal = entry.lines
      .filter((l) => l.side === "debit")
      .reduce((s, l) => s + l.amount, 0);
    const creditTotal = entry.lines
      .filter((l) => l.side === "credit")
      .reduce((s, l) => s + l.amount, 0);

    if (debitTotal !== creditTotal) {
      errors.push(
        `仕訳 ${i + 1}: 借方合計(${debitTotal}) ≠ 貸方合計(${creditTotal})`,
      );
      continue;
    }

    // Check all accounts are mapped
    const unmapped = entry.lines.filter((l) => !l.accountId);
    if (unmapped.length > 0) {
      errors.push(`仕訳 ${i + 1}: マッピングされていない科目があります`);
      continue;
    }

    const entryId = ulid();

    await db.insert(journalEntries)
      .values({
        id: entryId,
        companyId: user.companyId,
        fiscalYearId: "",
        date: entry.date,
        description: entry.description || "freee取込",
        clientName: entry.clientName || null,
        status: "confirmed",
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      });

    for (let j = 0; j < entry.lines.length; j++) {
      const line = entry.lines[j];
      await db.insert(journalLines)
        .values({
          id: ulid(),
          journalEntryId: entryId,
          side: line.side,
          accountId: line.accountId,
          amount: line.amount,
          taxCategoryId: line.taxCategoryId || null,
          taxAmount: line.taxAmount || 0,
          sortOrder: j,
        });
    }

    created++;
  }

  return NextResponse.json({
    created,
    total: body.entries.length,
    errors,
  });
}
