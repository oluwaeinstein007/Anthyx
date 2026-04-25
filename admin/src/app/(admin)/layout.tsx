import { AdminSidebar } from "@/components/sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto bg-gray-950">
        <div className="p-8 max-w-7xl mx-auto min-h-full">{children}</div>
      </main>
    </div>
  );
}
