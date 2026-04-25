"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Building2, Users, CreditCard, BarChart3,
  Tag, Flag, ListChecks, Inbox, LogOut, Shield, Handshake,
} from "lucide-react";
import { api } from "@/lib/api";

const NAV = [
  { label: "Overview",      href: "/dashboard",                  icon: LayoutDashboard },
  { label: "Organizations", href: "/dashboard/organizations",    icon: Building2 },
  { label: "Users",         href: "/dashboard/users",            icon: Users },
  { label: "Subscriptions", href: "/dashboard/subscriptions",    icon: CreditCard },
  { label: "Promo Codes",   href: "/dashboard/promo-codes",      icon: Tag },
  { label: "Feature Flags", href: "/dashboard/feature-flags",    icon: Flag },
  { label: "Affiliates",    href: "/dashboard/affiliates",       icon: Handshake },
  { label: "Posts",         href: "/dashboard/posts",            icon: ListChecks },
  { label: "Audit Log",     href: "/dashboard/audit-log",        icon: Inbox },
  { label: "Analytics",     href: "/dashboard/analytics",        icon: BarChart3 },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    try { await api.post("/auth/logout"); } catch { /* ignore */ }
    router.push("/login");
  }

  return (
    <aside className="w-56 bg-gray-950 border-r border-gray-800 flex flex-col shrink-0">
      <div className="h-14 px-4 flex items-center gap-2.5 border-b border-gray-800">
        <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center shrink-0">
          <Shield className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-sm font-bold text-white">Admin</span>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ label, href, icon: Icon }) => {
          const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href} href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                active ? "bg-red-950 text-red-400 font-medium" : "text-gray-400 hover:text-white hover:bg-gray-900"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-gray-800">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-red-400 hover:bg-gray-900 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </aside>
  );
}
