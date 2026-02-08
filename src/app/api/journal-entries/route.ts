import { NextResponse } from "next/server";
import { eq, desc, and, gte, lte, like, or } from "drizzle-orm";
import { ulid } from "ulid";
import { db } from "@/db";
import { journalEntries, journalLines, accounts } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { journalEntrySchema } from "@/lib/validators/journal";

/** GET /api/journal-entries — list journal entries with lines */
export async function GET(request: Request) {
  const { user } = await requireAuth();
  const url = new URL(request.url);
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");
  const search = url.searchParams.get("search");
  const status = url.searchParams.get("status");

  const conditions = [eq(journalEntries.companyId, user.companyId)];
  if (dateFrom) conditions.push(gte(journalEntries.date, dateFrom));
  if (dateTo) conditions.push(lte(journalEntries.date, dateTo));
  if (status === "draft" || status === "confirmed") {
    conditions.push(eq(journalEntries.status, status));
  }
  if (search) {
    conditions.push(
      or(
        like(journalEntries.description, `%${search}%`),
        like(journalEntries.clientName, `%${search}%`),
      )!,
    );
  }

  const entries = await db
    .select()
    .from(journalEntries)
    .where(and(...conditions))
    .orderBy(desc(journalEntries.date), desc(journalEntries.createdAt));

  // Fetch lines for all entries
  const entryIds = entries.map((e) => e.id);
  const allLines =
    entryIds.length > 0
      ? (await db
          .select({
            line: journalLines,
            accountCode: accounts.code,
            accountName: accounts.name,
          })
          .from(journalLines)
          .leftJoin(accounts, eq(journalLines.accountId, accounts.id))
        ).filter((row) => entryIds.includes(row.line.journalEntryId))
      : [];

  const linesByEntry = new Map<string, typeof allLines>();
  for (const row of allLines) {
    const existing = linesByEntry.get(row.line.journalEntryId) || [];
    existing.push(row);
    linesByEntry.set(row.line.journalEntryId, existing);
  }

  const result = entries.map((entry) => ({
    ...entry,
    lines: (linesByEntry.get(entry.id) || []).map((row) => ({
      ...row.line,
      accountCode: row.accountCode,
      accountName: row.accountName,
    })),
  }));

  return NextResponse.json(result);
}

/** POST /api/journal-entries — create a new journal entry */
export async function POST(request: Request) {
  const { user } = await requireAuth();
  const body = await request.json();

  const parsed = journalEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "バリデーションエラー", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const now = new Date().toISOString();
  const entryId = ulid();

  // Determine fiscal year (simple: find by date range)
  // For now, we'll store a placeholder — proper fiscal year lookup should be added
  const fiscalYearId = ""; // TODO: look up from fiscal_years table

  await db.insert(journalEntries)
    .values({
      id: entryId,
      companyId: user.companyId,
      fiscalYearId,
      date: data.date,
      description: data.description || null,
      clientName: data.clientName || null,
      status: data.status,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    });

  for (let i = 0; i < data.lines.length; i++) {
    const line = data.lines[i];
    await db.insert(journalLines)
      .values({
        id: ulid(),
        journalEntryId: entryId,
        side: line.side,
        accountId: line.accountId,
        amount: line.amount,
        taxCategoryId: line.taxCategoryId || null,
        taxAmount: line.taxAmount,
        description: line.description || null,
        sortOrder: i,
      });
  }

  return NextResponse.json({ id: entryId }, { status: 201 });
}
