import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function SettingsPage() {
  const { user } = await requireAuth();

  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, user.companyId));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">設定</h1>

      <Card>
        <CardHeader>
          <CardTitle>会社情報</CardTitle>
        </CardHeader>
        <CardContent>
          {company ? (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="font-medium text-muted-foreground">法人名</dt>
                <dd>{company.name}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">住所</dt>
                <dd>{company.address || "未設定"}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">適格請求書発行事業者登録番号</dt>
                <dd>{company.invoiceRegistrationNumber || "未設定"}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">事業年度開始月</dt>
                <dd>{company.fiscalYearStartMonth}月</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">課税方式</dt>
                <dd>{company.taxMethod === "standard" ? "本則課税" : "簡易課税"}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">会社情報が見つかりません</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ユーザー情報</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-medium text-muted-foreground">名前</dt>
              <dd>{user.name}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">メールアドレス</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">権限</dt>
              <dd>{user.role === "owner" ? "管理者" : "税理士"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
