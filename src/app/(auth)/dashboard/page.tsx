import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { journalEntries, journalLines, accounts } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { formatYen } from "@/lib/utils/currency";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function DashboardPage() {
  const { user } = await requireAuth();

  // Current month range
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;

  // Count entries this month
  const [monthEntries] = await db
    .select({ count: sql<number>`count(*)` })
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.companyId, user.companyId),
        gte(journalEntries.date, monthStart),
        lte(journalEntries.date, monthEnd),
      ),
    );

  // Count draft entries
  const [draftEntries] = await db
    .select({ count: sql<number>`count(*)` })
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.companyId, user.companyId),
        eq(journalEntries.status, "draft"),
      ),
    );

  // Recent entries
  const recentEntries = await db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.companyId, user.companyId))
    .orderBy(sql`${journalEntries.date} desc`)
    .limit(10);

  // Get lines for recent entries
  const recentIds = recentEntries.map((e) => e.id);
  const rawLines =
    recentIds.length > 0
      ? await db
          .select({
            journalEntryId: journalLines.journalEntryId,
            side: journalLines.side,
            amount: journalLines.amount,
            accountName: accounts.name,
            accountCode: accounts.code,
          })
          .from(journalLines)
          .leftJoin(accounts, eq(journalLines.accountId, accounts.id))
      : [];
  const recentLines = rawLines.filter((row) => recentIds.includes(row.journalEntryId));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ダッシュボード</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-[#2864f0]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              今月の仕訳数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#2864f0]">{monthEntries?.count ?? 0}<span className="text-lg ml-1">件</span></div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-400">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              下書き
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{draftEntries?.count ?? 0}<span className="text-lg ml-1">件</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              クイック操作
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href="/journal/new"
              className="inline-flex items-center rounded-md bg-[#2864f0] px-4 py-2 text-sm font-medium text-white hover:bg-[#2864f0]/90 transition-colors"
            >
              仕訳入力
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>最近の仕訳</CardTitle>
        </CardHeader>
        <CardContent>
          {recentEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">仕訳がまだありません</p>
          ) : (
            <div className="space-y-3">
              {recentEntries.map((entry) => {
                const lines = recentLines.filter(
                  (l) => l.journalEntryId === entry.id,
                );
                const debitLines = lines.filter((l) => l.side === "debit");
                const creditLines = lines.filter((l) => l.side === "credit");
                const totalAmount = debitLines.reduce((s, l) => s + l.amount, 0);

                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-md border border-border p-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{entry.date}</span>
                        <Badge
                          variant={entry.status === "confirmed" ? "default" : "secondary"}
                        >
                          {entry.status === "confirmed" ? "確定" : "下書き"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {debitLines.map((l) => `${l.accountCode} ${l.accountName}`).join(", ")}
                        {" / "}
                        {creditLines.map((l) => `${l.accountCode} ${l.accountName}`).join(", ")}
                      </div>
                      {entry.description && (
                        <div className="text-xs text-muted-foreground">
                          {entry.description}
                        </div>
                      )}
                    </div>
                    <div className="text-right font-mono text-sm font-medium">
                      {formatYen(totalAmount)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
