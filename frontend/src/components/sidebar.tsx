"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Building2, Bot, Link2, Calendar,
  ClipboardCheck, BarChart3, CreditCard, LogOut, Zap, Settings,
  Megaphone, Users, Rss, Webhook, FileDown, FlaskConical, Inbox, Mail,
  ListChecks, FilePen,
} from "lucide-react";
import { api } from "@/lib/api";

const NAV = [
  { label: "Overview",     href: "/dashboard",             icon: LayoutDashboard },
  { label: "Brands",       href: "/dashboard/brands",      icon: Building2 },
  { label: "Agents",       href: "/dashboard/agents",      icon: Bot },
  { label: "Accounts",     href: "/dashboard/accounts",    icon: Link2 },
  { label: "Plans",        href: "/dashboard/plans",       icon: Calendar },
  { label: "Posts",        href: "/dashboard/posts",       icon: ListChecks },
  { label: "Create Post",  href: "/dashboard/posts/create", icon: FilePen },
  { label: "Campaigns",    href: "/dashboard/campaigns",   icon: Megaphone },
  { label: "Review Queue", href: "/dashboard/review",      icon: ClipboardCheck },
  { label: "A/B Tests",    href: "/dashboard/ab-tests",    icon: FlaskConical },
  { label: "Inbox",        href: "/dashboard/inbox",       icon: Inbox },
  { label: "Email",        href: "/dashboard/email",       icon: Mail },
  { label: "Analytics",    href: "/dashboard/analytics",   icon: BarChart3 },
  { label: "Repurpose",    href: "/dashboard/repurpose",   icon: Rss },
  { label: "Team",         href: "/dashboard/team",        icon: Users },
  { label: "Webhooks",     href: "/dashboard/webhooks",    icon: Webhook },
  { label: "Reports",      href: "/dashboard/reports",     icon: FileDown },
  { label: "Billing",      href: "/dashboard/billing",     icon: CreditCard },
  { label: "Settings",     href: "/dashboard/settings",    icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    try { await api.post("/auth/logout"); } catch { /* ignore */ }
    router.push("/login");
  }

  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col shrink-0">
      {/* Logo */}
      <div className="h-16 px-5 flex items-center gap-2.5 border-b border-gray-100">
        <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center shrink-0">
          <Zap className="w-3.5 h-3.5 text-white fill-white" />
        </div>
        <span className="text-sm font-bold text-gray-900">
          {process.env["NEXT_PUBLIC_PRODUCT_NAME"] ?? "Anthyx"}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ label, href, icon: Icon }) => {
          const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-green-50 text-green-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? "text-green-600" : "text-gray-400"}`} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 pb-4 border-t border-gray-100 pt-3">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0 text-gray-400" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
