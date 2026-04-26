"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AffiliateSidebar } from "@/components/sidebar";
import { api } from "@/lib/api";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api.get("/auth/me")
      .then(() => setReady(true))
      .catch(() => {
        router.replace("/login");
      });
  }, [router]);

  if (!ready) {
    return (
      <div className="flex h-screen bg-gray-950 items-center justify-center">
        <div className="w-5 h-5 border-2 border-gray-700 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <AffiliateSidebar />
      <main className="flex-1 overflow-y-auto bg-gray-950">
        <div className="p-8 max-w-5xl mx-auto min-h-full">{children}</div>
      </main>
    </div>
  );
}
