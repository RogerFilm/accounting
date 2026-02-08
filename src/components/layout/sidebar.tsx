"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BookOpen,
  LayoutDashboard,
  FileText,
  BookMarked,
  List,
  Settings,
  LogOut,
  Receipt,
  Users,
  UserPlus,
  Upload,
  BarChart3,
  Calculator,
  Menu,
  X,
  ChevronRight,
  PenLine,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  chevron?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

function getNavSections(role?: string): NavSection[] {
  const settingsItems: NavItem[] = [
    { href: "/settings", label: "設定", icon: Settings },
  ];
  if (role === "admin") {
    settingsItems.push({ href: "/users", label: "ユーザー管理", icon: Users });
  }

  return [
    {
      label: "会計",
      items: [
        { href: "/dashboard", label: "ホーム", icon: LayoutDashboard },
        { href: "/journal/new", label: "取引入力", icon: PenLine },
        { href: "/journal", label: "仕訳帳", icon: BookOpen },
        { href: "/ledger", label: "会計帳簿", icon: BookMarked, chevron: true },
      ],
    },
    {
      label: "経理",
      items: [
        { href: "/invoices", label: "請求書", icon: Receipt },
        { href: "/clients", label: "取引先", icon: UserPlus },
      ],
    },
    {
      label: "レポート",
      items: [
        { href: "/reports", label: "分析・レポート", icon: BarChart3, chevron: true },
        { href: "/accounts", label: "勘定科目", icon: List },
      ],
    },
    {
      label: "決算",
      items: [
        { href: "/tax", label: "決算・申告", icon: Calculator, chevron: true },
        { href: "/import", label: "データ取込", icon: Upload },
      ],
    },
    {
      label: "設定",
      items: settingsItems,
    },
  ];
}

function AppLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="rf-grad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0b3a42" />
          <stop offset="40%" stopColor="#0f4a53" />
          <stop offset="60%" stopColor="#1a6e7a" />
          <stop offset="100%" stopColor="#4eddd0" />
        </linearGradient>
      </defs>
      <rect width="28" height="28" rx="6" fill="url(#rf-grad)" />
      <text x="14" y="19" textAnchor="middle" fill="#eaf8f6" fontSize="13" fontWeight="bold" fontFamily="Arial, Helvetica, sans-serif">RF</text>
    </svg>
  );
}

function NavContent({ pathname, onNavigate, role }: { pathname: string; onNavigate?: () => void; role?: string }) {
  const navSections = getNavSections(role);
  return (
    <>
      {/* Logo */}
      <div className="flex h-12 items-center gap-2 border-b border-white/50 px-4 shrink-0">
        <Link
          href="/dashboard"
          className="flex items-center gap-2"
          onClick={onNavigate}
        >
          <AppLogo className="h-6 w-6" />
          <span className="text-base font-bold text-foreground tracking-tight">RogerFilm</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navSections.map((section) => (
          <div key={section.label} className="mb-1">
            <div className="px-4 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {section.label}
            </div>
            {section.items.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : item.href === "/journal/new"
                    ? pathname === "/journal/new"
                    : pathname.startsWith(item.href) && item.href !== "/journal/new";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "mx-2 flex items-center gap-2.5 rounded px-2.5 py-[7px] text-[13px] font-medium transition-colors",
                    isActive
                      ? "bg-white/70 text-[#2864f0] shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                      : "text-[#555] hover:bg-white/40 hover:text-foreground",
                  )}
                >
                  <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-[#2864f0]" : "text-[#8a8f9c]")} />
                  <span className="flex-1">{item.label}</span>
                  {item.chevron && <ChevronRight className="h-3.5 w-3.5 text-[#ccc]" />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="border-t border-white/50 p-2 shrink-0">
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="mx-0 flex w-full items-center gap-2.5 rounded px-2.5 py-[7px] text-[13px] font-medium text-[#555] transition-colors hover:bg-white/40 hover:text-foreground"
          >
            <LogOut className="h-4 w-4 text-[#8a8f9c]" />
            ログアウト
          </button>
        </form>
      </div>
    </>
  );
}

interface SidebarProps {
  user?: { role: string };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile header */}
      <div className="sticky top-0 z-40 flex h-12 items-center gap-3 border-b border-border bg-white px-4 md:hidden">
        <button onClick={() => setMobileOpen(true)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/dashboard" className="flex items-center gap-2">
          <AppLogo className="h-5 w-5" />
          <span className="text-sm font-bold text-foreground">会計</span>
        </Link>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex h-screen w-52 flex-col border-r border-border bg-[#eef3fb] shrink-0 shadow-[2px_0_8px_rgba(0,0,0,0.06)]">
        <NavContent pathname={pathname} role={user?.role} />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="fixed inset-y-0 left-0 flex w-52 flex-col bg-[#eef3fb] shadow-xl">
            <div className="absolute right-2 top-2.5">
              <button onClick={() => setMobileOpen(false)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavContent pathname={pathname} onNavigate={() => setMobileOpen(false)} role={user?.role} />
          </aside>
        </div>
      )}
    </>
  );
}
