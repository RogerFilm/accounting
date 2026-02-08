import { Lucia } from "lucia";
import { DrizzlePostgreSQLAdapter } from "@lucia-auth/adapter-drizzle";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";

const adapter = new DrizzlePostgreSQLAdapter(db, sessions, users);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    expires: false,
    attributes: {
      secure: process.env.NODE_ENV === "production",
    },
  },
  getUserAttributes: (attributes) => ({
    email: attributes.email,
    name: attributes.name,
    role: attributes.role,
    companyId: attributes.companyId,
  }),
});

declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: {
      email: string;
      name: string;
      role: "owner" | "accountant";
      companyId: string;
    };
  }
}
