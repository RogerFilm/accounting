import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Sidebar } from "@/components/layout/sidebar";
import { Toaster } from "@/components/ui/toaster";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await getSession();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-6">{children}</div>
      </main>
      <Toaster />
    </div>
  );
}
