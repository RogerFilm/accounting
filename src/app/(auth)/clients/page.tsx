"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Users } from "lucide-react";

interface Client {
  id: string;
  name: string;
  address: string | null;
  email: string | null;
  contactPerson: string | null;
  invoiceRegistrationNumber: string | null;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    setLoading(true);
    const res = await fetch("/api/clients");
    if (res.ok) setClients(await res.json());
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const body: Record<string, string> = {};
    for (const [key, value] of form.entries()) {
      if (value) body[key] = value as string;
    }
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      toast({ variant: "success", title: "取引先を追加しました" });
      setShowForm(false);
      fetchClients();
    } else {
      toast({ variant: "error", title: "保存に失敗しました" });
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ variant: "success", title: "取引先を削除しました" });
      fetchClients();
    } else {
      toast({ variant: "error", title: "削除に失敗しました" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">取引先</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" />
          取引先追加
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>新規取引先</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="name">取引先名 *</Label>
                <Input id="name" name="name" required />
              </div>
              <div>
                <Label htmlFor="contactPerson">担当者</Label>
                <Input id="contactPerson" name="contactPerson" />
              </div>
              <div>
                <Label htmlFor="address">住所</Label>
                <Input id="address" name="address" />
              </div>
              <div>
                <Label htmlFor="email">メール</Label>
                <Input id="email" name="email" type="email" />
              </div>
              <div>
                <Label htmlFor="phone">電話番号</Label>
                <Input id="phone" name="phone" />
              </div>
              <div>
                <Label htmlFor="invoiceRegistrationNumber">登録番号</Label>
                <Input
                  id="invoiceRegistrationNumber"
                  name="invoiceRegistrationNumber"
                  placeholder="T1234567890123"
                />
              </div>
              <div className="col-span-1 md:col-span-2 flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "保存中..." : "保存"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  キャンセル
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <Users className="h-10 w-10" />
              <p className="text-sm">取引先がありません</p>
              <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
                <Plus className="mr-1 h-3 w-3" />
                取引先追加
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>取引先名</TableHead>
                    <TableHead>担当者</TableHead>
                    <TableHead>住所</TableHead>
                    <TableHead>メール</TableHead>
                    <TableHead>登録番号</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.contactPerson || "-"}</TableCell>
                      <TableCell className="text-sm">{c.address || "-"}</TableCell>
                      <TableCell className="text-sm">{c.email || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {c.invoiceRegistrationNumber || "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(c.id)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget);
          setDeleteTarget(null);
        }}
        title="取引先を削除"
        message="この取引先を削除しますか？関連データに影響する可能性があります。"
        confirmLabel="削除"
        destructive
      />
    </div>
  );
}
