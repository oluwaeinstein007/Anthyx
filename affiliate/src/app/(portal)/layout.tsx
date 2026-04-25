import { AffiliateSidebar } from "@/components/sidebar";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <AffiliateSidebar />
      <main className="flex-1 overflow-y-auto bg-gray-950">
        <div className="p-8 max-w-5xl mx-auto min-h-full">{children}</div>
      </main>
    </div>
  );
}
