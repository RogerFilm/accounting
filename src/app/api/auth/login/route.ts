import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { lucia } from "@/lib/auth/lucia";
import { verifyPassword } from "@/lib/auth/password";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "メールアドレスとパスワードを入力してください" },
      { status: 400 },
    );
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email));

  if (!user) {
    return NextResponse.json(
      { error: "メールアドレスまたはパスワードが正しくありません" },
      { status: 401 },
    );
  }

  const validPassword = await verifyPassword(password, user.hashedPassword);
  if (!validPassword) {
    return NextResponse.json(
      { error: "メールアドレスまたはパスワードが正しくありません" },
      { status: 401 },
    );
  }

  const session = await lucia.createSession(user.id, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  const cookieStore = await cookies();
  cookieStore.set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes,
  );

  return NextResponse.json({ success: true });
}
