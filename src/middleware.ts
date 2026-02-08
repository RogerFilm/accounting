import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Public routes that don't need auth
  const publicPaths = ["/login", "/api/auth/login"];
  const isPublic = publicPaths.some((p) => request.nextUrl.pathname.startsWith(p));

  if (isPublic) {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionCookie = request.cookies.get("auth_session");
  if (!sessionCookie && !request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
