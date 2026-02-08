import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { lucia } from "@/lib/auth/lucia";
import { getSession } from "@/lib/auth/session";

export async function POST() {
  const { session } = await getSession();
  if (session) {
    await lucia.invalidateSession(session.id);
  }

  const sessionCookie = lucia.createBlankSessionCookie();
  const cookieStore = await cookies();
  cookieStore.set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes,
  );

  return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"));
}
