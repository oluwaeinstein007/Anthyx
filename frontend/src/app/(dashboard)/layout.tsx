import { Sidebar } from "@/components/sidebar";
import { EmailVerifyBanner } from "@/components/email-verify-banner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <EmailVerifyBanner />
        <main className="flex-1 overflow-y-auto">
          <div className="p-8 max-w-7xl mx-auto min-h-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
