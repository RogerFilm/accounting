import { cookies } from "next/headers";
import { lucia } from "./lucia";
import { cache } from "react";

export const getSession = cache(async () => {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(lucia.sessionCookieName)?.value ?? null;
  if (!sessionId) return { user: null, session: null };

  const result = await lucia.validateSession(sessionId);

  try {
    if (result.session && result.session.fresh) {
      const sessionCookie = lucia.createSessionCookie(result.session.id);
      cookieStore.set(
        sessionCookie.name,
        sessionCookie.value,
        sessionCookie.attributes,
      );
    }
    if (!result.session) {
      const sessionCookie = lucia.createBlankSessionCookie();
      cookieStore.set(
        sessionCookie.name,
        sessionCookie.value,
        sessionCookie.attributes,
      );
    }
  } catch {
    // Next.js throws when headers are already sent (Server Components)
  }

  return result;
});

export async function requireAuth() {
  const { user, session } = await getSession();
  if (!user || !session) {
    throw new Error("Unauthorized");
  }
  return { user, session };
}
