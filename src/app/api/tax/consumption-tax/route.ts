import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { calculateConsumptionTax, DEEMED_PURCHASE_RATES } from "@/lib/accounting/consumption-tax";

/**
 * GET /api/tax/consumption-tax — Calculate consumption tax.
 * Query: ?dateFrom=2024-04-01&dateTo=2025-03-31&method=simplified&businessType=5
 */
export async function GET(request: Request) {
  const { user } = await requireAuth();
  const url = new URL(request.url);

  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, user.companyId))
    .limit(1);

  const fyEndMonth = company?.fiscalYearEndMonth || 3;
  const fyStartMonth = (fyEndMonth % 12) + 1;
  const currentYear = new Date().getFullYear();
  const fyStartYear = new Date().getMonth() + 1 >= fyStartMonth ? currentYear : currentYear - 1;
  const fyEndYear = fyStartMonth === 1 ? fyStartYear : fyStartYear + 1;

  const dateFrom = url.searchParams.get("dateFrom")
    || `${fyStartYear}-${String(fyStartMonth).padStart(2, "0")}-01`;
  const dateTo = url.searchParams.get("dateTo")
    || `${fyEndYear}-${String(fyEndMonth).padStart(2, "0")}-31`;

  const method = (url.searchParams.get("method") || company?.taxMethod || "simplified") as "standard" | "simplified";
  const businessType = parseInt(url.searchParams.get("businessType") || "5");

  const result = await calculateConsumptionTax(
    user.companyId,
    dateFrom,
    dateTo,
    method,
    businessType,
  );

  return NextResponse.json({
    ...result,
    dateFrom,
    dateTo,
    deemedPurchaseRates: DEEMED_PURCHASE_RATES,
  });
}
