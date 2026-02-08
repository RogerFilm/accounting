"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

function KaikeiLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="28" height="28" rx="6" fill="#2864f0" />
      <path
        d="M7 8.5h3v11H7v-11zM11.5 14l4-5.5h3.5l-4.2 5.2 4.5 5.8h-3.6L11.5 14z"
        fill="white"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });

    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || "ログインに失敗しました");
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f6f8]">
      <Card className="w-full max-w-sm shadow-md">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-3 flex items-center gap-2">
            <KaikeiLogo className="h-8 w-8" />
            <span className="text-xl font-bold text-foreground">会計</span>
          </div>
          <p className="text-sm text-muted-foreground">アカウントにログイン</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="admin@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "ログイン中..." : "ログイン"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
