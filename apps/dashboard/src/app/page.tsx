import Link from "next/link";
import {
  ArrowRight, Bot, Building2, Calendar, BarChart3,
  Shield, Zap, Globe, Check, Sparkles, Users,
  CheckCircle2, TrendingUp, Clock, Star,
} from "lucide-react";

/* ─── Navbar ──────────────────────────────────────────────────────── */
function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="text-base font-bold text-gray-900">Anthyx</span>
        </div>
        <nav className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Features</a>
          <a href="#how-it-works" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">How it works</a>
          <a href="#pricing" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Pricing</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors hidden sm:block">
            Sign in
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
          >
            Get started <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ─── Dashboard Preview (hero visual) ────────────────────────────── */
function DashboardPreview() {
  const bars = [45, 70, 55, 85, 60, 95, 75, 88, 65, 100, 80, 92];
  return (
    <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-200 bg-gray-50">
      {/* Browser chrome */}
      <div className="bg-gray-100 border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 mx-4">
          <div className="bg-white rounded-md px-3 py-1 text-xs text-gray-400 border border-gray-200 max-w-xs">
            app.anthyx.io/dashboard
          </div>
        </div>
      </div>
      {/* App shell */}
      <div className="flex h-64">
        {/* Sidebar */}
        <div className="w-40 bg-white border-r border-gray-200 p-3 flex flex-col gap-1 shrink-0">
          <div className="flex items-center gap-2 px-2 py-2 mb-1">
            <div className="w-5 h-5 bg-green-600 rounded-md flex items-center justify-center">
              <Zap className="w-3 h-3 text-white fill-white" />
            </div>
            <div className="text-xs font-bold text-gray-900">Anthyx</div>
          </div>
          {[
            { label: "Overview", active: true },
            { label: "Brands", active: false },
            { label: "Agents", active: false },
            { label: "Plans", active: false },
            { label: "Review Queue", active: false },
          ].map(({ label, active }) => (
            <div
              key={label}
              className={`px-2 py-1.5 rounded-lg flex items-center gap-2 ${active ? "bg-green-50" : ""}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${active ? "bg-green-600" : "bg-gray-300"}`} />
              <div className={`text-xs ${active ? "text-green-700 font-medium" : "text-gray-500"}`}>{label}</div>
            </div>
          ))}
        </div>
        {/* Main */}
        <div className="flex-1 p-4 bg-gray-50 overflow-hidden">
          <div className="text-xs font-semibold text-gray-700 mb-3">Overview · Last 30 days</div>
          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { label: "Posts", value: "2,847", color: "text-gray-900" },
              { label: "Pending", value: "12", color: "text-amber-600" },
              { label: "Platforms", value: "6", color: "text-gray-900" },
              { label: "Engagement", value: "4.2%", color: "text-green-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-lg p-2 border border-gray-200">
                <div className="text-[9px] text-gray-400 mb-1">{label}</div>
                <div className={`text-sm font-bold ${color}`}>{value}</div>
              </div>
            ))}
          </div>
          {/* Mini chart */}
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="text-[9px] text-gray-400 mb-2">Posts by platform</div>
            <div className="flex items-end gap-1 h-16">
              {bars.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{
                    height: `${h}%`,
                    backgroundColor: i % 3 === 0 ? "#16a34a" : i % 3 === 1 ? "#4ade80" : "#bbf7d0",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Hero ────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="pt-32 pb-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-medium mb-6">
            <Sparkles className="w-3 h-3" />
            AI-powered marketing automation
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 tracking-tight leading-tight mb-6">
            Your brand, everywhere,{" "}
            <span className="bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
              automatically.
            </span>
          </h1>
          <p className="text-xl text-gray-500 leading-relaxed mb-8 max-w-2xl mx-auto">
            Anthyx trains AI agents on your brand identity, then plans, writes, and publishes
            content across every social platform — while you stay in control with a human review loop.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register"
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
            >
              Start free 14-day trial <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#how-it-works"
              className="px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-xl transition-colors border border-gray-200 text-sm"
            >
              See how it works
            </a>
          </div>
          <p className="text-xs text-gray-400 mt-4">No credit card required · Cancel anytime</p>
        </div>
        <div className="max-w-4xl mx-auto">
          <DashboardPreview />
        </div>
      </div>
    </section>
  );
}

/* ─── Trust bar ───────────────────────────────────────────────────── */
function TrustBar() {
  const platforms = ["Instagram", "X (Twitter)", "LinkedIn", "Facebook", "TikTok", "Telegram"];
  return (
    <section className="py-12 border-y border-gray-100 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-6">
          Publishes natively to
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {platforms.map((p) => (
            <span key={p} className="text-sm font-semibold text-gray-400">{p}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Features ────────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: Building2,
    title: "Brand intelligence",
    desc: "Upload PDFs, URLs, or paste your brand guidelines. Anthyx extracts your voice, tone, values, and audience in minutes.",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: Bot,
    title: "Multi-agent pipeline",
    desc: "Multiple specialised AI agents work in parallel — one plans, one writes, one schedules — each trained on your brand.",
    color: "bg-purple-50 text-purple-600",
  },
  {
    icon: CheckCircle2,
    title: "Human review loop",
    desc: "Every post hits your review queue before it goes live. Approve, edit, or veto with one click. You're always in control.",
    color: "bg-amber-50 text-amber-600",
  },
  {
    icon: Globe,
    title: "6 platform publishing",
    desc: "Instagram, X, LinkedIn, Facebook, TikTok, and Telegram — all managed from a single unified dashboard.",
    color: "bg-green-50 text-green-600",
  },
  {
    icon: Calendar,
    title: "30-day content calendars",
    desc: "AI generates a full month of platform-native posts in seconds. Edit, rearrange, or regenerate any post individually.",
    color: "bg-rose-50 text-rose-600",
  },
  {
    icon: BarChart3,
    title: "Engagement analytics",
    desc: "Track post performance, engagement rates, and top-performing platforms. Know what's working and do more of it.",
    color: "bg-indigo-50 text-indigo-600",
  },
];

function Features() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4">
            Everything your marketing team needs
          </h2>
          <p className="text-lg text-gray-500">
            From brand ingestion to publishing analytics — one platform, fully automated.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, desc, color }) => (
            <div
              key={title}
              className="p-6 bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── How it works ────────────────────────────────────────────────── */
const STEPS = [
  {
    num: "01",
    icon: Building2,
    title: "Connect your brand",
    desc: "Upload your brand docs, set your tone of voice, link your social accounts. Takes 5 minutes.",
  },
  {
    num: "02",
    icon: Bot,
    title: "AI agents plan & create",
    desc: "Your dedicated agents generate a full 30-day content calendar, tailored to each platform's native format.",
  },
  {
    num: "03",
    icon: CheckCircle2,
    title: "Review, approve, publish",
    desc: "Check your queue, tweak any post you want, hit approve. Anthyx handles scheduling and publishing automatically.",
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4">
            Live in under 10 minutes
          </h2>
          <p className="text-lg text-gray-500">
            No complex setup. No agency retainer. Just connect, create, and go.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map(({ num, icon: Icon, title, desc }, i) => (
            <div key={num} className="relative">
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[calc(50%+2.5rem)] right-0 h-px bg-gray-200 z-0" />
              )}
              <div className="relative z-10 text-center">
                <div className="inline-flex w-16 h-16 rounded-2xl bg-white border border-gray-200 shadow-sm items-center justify-center mb-4">
                  <Icon className="w-7 h-7 text-green-600" />
                </div>
                <div className="text-xs font-bold text-green-600 mb-2 uppercase tracking-widest">{num}</div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Pricing ─────────────────────────────────────────────────────── */
const PLANS = [
  {
    name: "Starter",
    price: 29,
    desc: "Perfect for solo creators and small brands.",
    features: ["1 brand", "2 AI agents", "5 social accounts", "200 posts / month", "Content review queue", "Basic analytics"],
    cta: "Start free trial",
    highlight: false,
  },
  {
    name: "Growth",
    price: 79,
    desc: "For growing teams that need more power.",
    features: ["3 brands", "6 AI agents", "15 social accounts", "1,000 posts / month", "Feedback loop", "AI image generation", "Advanced analytics"],
    cta: "Start free trial",
    highlight: true,
  },
  {
    name: "Agency",
    price: 199,
    desc: "For agencies managing multiple clients.",
    features: ["10 brands", "20 AI agents", "50 social accounts", "5,000 posts / month", "White-label dashboard", "IP rotation", "Priority support"],
    cta: "Start free trial",
    highlight: false,
  },
];

function Pricing() {
  return (
    <section id="pricing" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-lg text-gray-500">
            Start free for 14 days. No credit card required.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLANS.map(({ name, price, desc, features, cta, highlight }) => (
            <div
              key={name}
              className={`relative rounded-2xl p-8 flex flex-col ${
                highlight
                  ? "bg-green-600 text-white shadow-xl shadow-green-200 ring-2 ring-green-600"
                  : "bg-white border border-gray-200"
              }`}
            >
              {highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-amber-400 text-amber-900 text-xs font-bold rounded-full">
                    Most popular
                  </span>
                </div>
              )}
              <div className="mb-6">
                <h3 className={`text-lg font-bold mb-1 ${highlight ? "text-white" : "text-gray-900"}`}>{name}</h3>
                <p className={`text-sm mb-4 ${highlight ? "text-green-100" : "text-gray-500"}`}>{desc}</p>
                <div className="flex items-baseline gap-1">
                  <span className={`text-4xl font-bold ${highlight ? "text-white" : "text-gray-900"}`}>${price}</span>
                  <span className={`text-sm ${highlight ? "text-green-100" : "text-gray-400"}`}>/month</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className={`w-4 h-4 mt-0.5 shrink-0 ${highlight ? "text-green-200" : "text-green-600"}`} />
                    <span className={highlight ? "text-green-50" : "text-gray-600"}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className={`w-full py-2.5 rounded-xl text-sm font-medium text-center transition-colors ${
                  highlight
                    ? "bg-white text-green-700 hover:bg-green-50"
                    : "bg-green-600 hover:bg-green-700 text-white"
                }`}
              >
                {cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-gray-400 mt-8">
          Need more? <Link href="/register" className="text-green-600 hover:underline font-medium">Contact us for Scale pricing →</Link>
        </p>
      </div>
    </section>
  );
}

/* ─── Stats ───────────────────────────────────────────────────────── */
function Stats() {
  const items = [
    { icon: Users, value: "500+", label: "Marketing teams" },
    { icon: TrendingUp, value: "2M+", label: "Posts published" },
    { icon: Clock, value: "12h", label: "Saved per week" },
    { icon: Star, value: "4.9/5", label: "Average rating" },
  ];
  return (
    <section className="py-16 px-6 bg-gray-900">
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
        {items.map(({ icon: Icon, value, label }) => (
          <div key={label} className="text-center">
            <Icon className="w-5 h-5 text-green-400 mx-auto mb-2" />
            <div className="text-3xl font-bold text-white mb-1">{value}</div>
            <div className="text-sm text-gray-400">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── CTA ─────────────────────────────────────────────────────────── */
function CTA() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-medium mb-6">
          <Shield className="w-3 h-3" /> No credit card required
        </div>
        <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight mb-6">
          Ready to put your marketing<br />on autopilot?
        </h2>
        <p className="text-lg text-gray-500 mb-8">
          Join teams that use Anthyx to publish consistently, stay on brand, and reclaim hours every week.
        </p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 px-8 py-4 bg-green-600 hover:bg-green-700 text-white text-base font-semibold rounded-xl transition-colors shadow-lg shadow-green-200"
        >
          Start your free trial <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </section>
  );
}

/* ─── Footer ──────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="border-t border-gray-100 py-12 px-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-white fill-white" />
              </div>
              <span className="text-sm font-bold text-gray-900">Anthyx</span>
            </div>
            <p className="text-sm text-gray-500 max-w-xs">
              Autonomous AI marketing platform for modern teams.
            </p>
          </div>
          <div className="flex gap-16">
            <div>
              <div className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3">Product</div>
              <ul className="space-y-2">
                {["Features", "Pricing", "How it works"].map((l) => (
                  <li key={l}><a href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3">Account</div>
              <ul className="space-y-2">
                <li><Link href="/login" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Sign in</Link></li>
                <li><Link href="/register" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Create account</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} Anthyx. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Privacy</a>
            <a href="#" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─── Page ────────────────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <Hero />
      <TrustBar />
      <Features />
      <HowItWorks />
      <Stats />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  );
}
