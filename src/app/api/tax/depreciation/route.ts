import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "@/db";
import { fixedAssets, accounts, journalEntries, journalLines, companies } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import {
  generateDepreciationSchedule,
  getCurrentYearDepreciation,
} from "@/lib/accounting/depreciation";

/**
 * GET /api/tax/depreciation — Get depreciation schedule for all assets.
 * Query: ?fiscalYear=2024
 */
export async function GET(request: Request) {
  const { user } = await requireAuth();
  const url = new URL(request.url);
  const fiscalYear = url.searchParams.get("fiscalYear") || String(new Date().getFullYear());

  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, user.companyId))
    .limit(1);

  const fyEndMonth = company?.fiscalYearEndMonth || 3;
  const fyStartMonth = (fyEndMonth % 12) + 1;

  const assets = await db
    .select()
    .from(fixedAssets)
    .where(eq(fixedAssets.companyId, user.companyId));

  const results = assets
    .filter((a) => !a.disposalDate)
    .map((asset) => {
      const schedule = generateDepreciationSchedule({
        acquisitionCost: asset.acquisitionCost,
        residualValue: asset.residualValue,
        usefulLife: asset.usefulLife,
        depreciationMethod: asset.depreciationMethod as "straight_line" | "declining_balance" | "immediate" | "bulk_3year",
        acquisitionDate: asset.acquisitionDate,
        fiscalYearStartMonth: fyStartMonth,
      });

      const currentRow = schedule.find((r) => r.fiscalYear === fiscalYear);
      const accumulated = schedule
        .filter((r) => r.fiscalYear <= fiscalYear)
        .reduce((s, r) => s + r.depreciationAmount, 0);

      return {
        asset,
        schedule,
        currentYearAmount: currentRow?.depreciationAmount || 0,
        accumulatedDepreciation: accumulated,
        bookValue: asset.acquisitionCost - accumulated,
      };
    });

  const totalCurrentYear = results.reduce((s, r) => s + r.currentYearAmount, 0);

  return NextResponse.json({
    fiscalYear,
    assets: results,
    totalCurrentYear,
  });
}

/**
 * POST /api/tax/depreciation — Generate depreciation journal entries for fiscal year.
 * Body: { fiscalYear: "2024" }
 */
export async function POST(request: Request) {
  const { user } = await requireAuth();
  const body = await request.json();
  const fiscalYear = body.fiscalYear || String(new Date().getFullYear());

  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, user.companyId))
    .limit(1);

  const fyEndMonth2 = company?.fiscalYearEndMonth || 3;
  const fyStartMonth2 = (fyEndMonth2 % 12) + 1;
  const fyEndYear = fyStartMonth2 === 1 ? parseInt(fiscalYear) : parseInt(fiscalYear) + 1;
  const fyEndDate = `${fyEndYear}-${String(fyEndMonth2).padStart(2, "0")}-${fyEndMonth2 === 2 ? "28" : ["04", "06", "09", "11"].includes(String(fyEndMonth2).padStart(2, "0")) ? "30" : "31"}`;

  const allAssets = await db
    .select()
    .from(fixedAssets)
    .where(eq(fixedAssets.companyId, user.companyId));
  const assets = allAssets.filter((a) => !a.disposalDate);

  const now = new Date().toISOString();
  const created: string[] = [];

  for (const asset of assets) {
    const amount = getCurrentYearDepreciation(
      {
        acquisitionCost: asset.acquisitionCost,
        residualValue: asset.residualValue,
        usefulLife: asset.usefulLife,
        depreciationMethod: asset.depreciationMethod as "straight_line" | "declining_balance" | "immediate" | "bulk_3year",
        acquisitionDate: asset.acquisitionDate,
        fiscalYearStartMonth: fyStartMonth2,
      },
      fiscalYear,
    );

    if (amount <= 0) continue;

    const entryId = ulid();

    // 減価償却費(debit) / 減価償却累計額(credit)
    // If no specific depreciation account set, use the asset's account
    await db.insert(journalEntries)
      .values({
        id: entryId,
        companyId: user.companyId,
        fiscalYearId: "",
        date: fyEndDate,
        description: `減価償却費 ${asset.name}`,
        clientName: null,
        status: "draft",
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      });

    await db.insert(journalLines)
      .values({
        id: ulid(),
        journalEntryId: entryId,
        side: "debit",
        accountId: asset.depreciationAccountId,
        amount,
        taxCategoryId: null,
        taxAmount: 0,
        sortOrder: 0,
      });

    // Credit side: use accumulated depreciation account or the asset account
    await db.insert(journalLines)
      .values({
        id: ulid(),
        journalEntryId: entryId,
        side: "credit",
        accountId: asset.accountId, // 固定資産科目から直接減額
        amount,
        taxCategoryId: null,
        taxAmount: 0,
        sortOrder: 1,
      });

    created.push(entryId);
  }

  return NextResponse.json({
    created: created.length,
    journalEntryIds: created,
  });
}
