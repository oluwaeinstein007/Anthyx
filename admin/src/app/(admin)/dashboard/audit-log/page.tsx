"use client";

import { Info } from "lucide-react";

export default function AuditLogPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-white">Audit Log</h1>
        <p className="text-sm text-gray-500 mt-1">Admin action history</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 flex flex-col items-center justify-center text-center">
        <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center mb-4">
          <Info className="w-5 h-5 text-gray-500" />
        </div>
        <p className="text-sm font-medium text-white mb-1">Audit log not yet implemented</p>
        <p className="text-xs text-gray-500 max-w-xs">
          Add an <code className="bg-gray-800 px-1 rounded">audit_logs</code> table to the database schema and a{" "}
          <code className="bg-gray-800 px-1 rounded">GET /admin/audit-log</code> endpoint to surface events here.
        </p>
      </div>
    </div>
  );
}
