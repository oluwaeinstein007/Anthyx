"use client";

interface UsageMeter {
  label: string;
  used: number;
  included: number;
  overage: number;
}

interface UsageMetersProps {
  posts: UsageMeter;
  accounts: UsageMeter;
  brands: UsageMeter;
}

function Meter({ label, used, included, overage }: UsageMeter) {
  const pct = included > 0 ? Math.min((used / included) * 100, 100) : 0;
  const overLimit = used > included;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className={overLimit ? "text-red-600 font-semibold" : "text-gray-500"}>
          {used} / {included === -1 ? "∞" : included}
          {overage > 0 && <span className="ml-1 text-red-500">(+{overage} overage)</span>}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            overLimit ? "bg-red-500" : pct > 80 ? "bg-yellow-400" : "bg-green-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function UsageMeters({ posts, accounts, brands }: UsageMetersProps) {
  return (
    <div className="rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
        This billing period
      </h3>
      <Meter {...posts} />
      <Meter {...accounts} />
      <Meter {...brands} />
    </div>
  );
}
