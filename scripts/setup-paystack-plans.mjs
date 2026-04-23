#!/usr/bin/env node
/**
 * Creates (or retrieves) all Paystack subscription plans and updates .env
 * with the resulting plan codes.
 *
 * Usage:
 *   node scripts/setup-paystack-plans.mjs
 *
 * Requires PAYSTACK_SECRET_KEY to be set in .env (or the environment).
 *
 * Safe to re-run — existing plans are looked up by name and reused.
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ENV_FILE = resolve(ROOT, ".env");

// ── Load .env manually (no dotenv dependency needed) ─────────────────────────

function parseEnv(raw) {
  const vars = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

const envRaw = readFileSync(ENV_FILE, "utf8");
const env = parseEnv(envRaw);

const SECRET = process.env["PAYSTACK_SECRET_KEY"] ?? env["PAYSTACK_SECRET_KEY"] ?? "";
if (!SECRET || SECRET === "sk_test_...") {
  console.error("ERROR: PAYSTACK_SECRET_KEY is not set in .env");
  process.exit(1);
}

// ── Plan definitions ──────────────────────────────────────────────────────────
// Amounts in smallest currency unit (kobo for NGN, cents for USD)
// Matches PLAN_TIER_CONFIGS in packages/types/src/billing.ts

// Amounts in kobo (NGN). 100 kobo = ₦1.
// Update these before going live to match your actual NGN pricing.
// Annual = monthly × 12 with ~17% discount (matches annualPrice in billing.ts).
const PLANS = [
  { envKey: "PAYSTACK_PLAN_STARTER_MONTHLY",  name: "Anthyx Starter Monthly",  amount:  7500_00, interval: "monthly"  },
  { envKey: "PAYSTACK_PLAN_STARTER_ANNUAL",   name: "Anthyx Starter Annual",   amount: 75000_00, interval: "annually" },
  { envKey: "PAYSTACK_PLAN_GROWTH_MONTHLY",   name: "Anthyx Growth Monthly",   amount: 22000_00, interval: "monthly"  },
  { envKey: "PAYSTACK_PLAN_GROWTH_ANNUAL",    name: "Anthyx Growth Annual",    amount: 21900_00 * 12, interval: "annually" },
  { envKey: "PAYSTACK_PLAN_AGENCY_MONTHLY",   name: "Anthyx Agency Monthly",   amount: 59900_00, interval: "monthly"  },
  { envKey: "PAYSTACK_PLAN_AGENCY_ANNUAL",    name: "Anthyx Agency Annual",    amount: 47900_00 * 12, interval: "annually" },
  { envKey: "PAYSTACK_PLAN_SCALE_MONTHLY",    name: "Anthyx Scale Monthly",    amount: 149900_00, interval: "monthly" },
  { envKey: "PAYSTACK_PLAN_SCALE_ANNUAL",     name: "Anthyx Scale Annual",     amount: 119900_00 * 12, interval: "annually" },
];

// ── Paystack API helpers ──────────────────────────────────────────────────────

async function paystackGet(path) {
  const res = await fetch(`https://api.paystack.co${path}`, {
    headers: { Authorization: `Bearer ${SECRET}` },
  });
  const json = await res.json();
  if (!json.status) throw new Error(`Paystack GET ${path}: ${json.message}`);
  return json.data;
}

async function paystackPost(path, body) {
  const res = await fetch(`https://api.paystack.co${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.status) throw new Error(`Paystack POST ${path}: ${json.message}`);
  return json.data;
}

// ── Fetch existing plans (paginated) ─────────────────────────────────────────

async function fetchAllPlans() {
  let page = 1;
  const all = [];
  while (true) {
    const data = await paystackGet(`/plan?perPage=50&page=${page}`);
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
    if (data.length < 50) break;
    page++;
  }
  return all;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Fetching existing Paystack plans...");
  const existing = await fetchAllPlans();
  const byName = Object.fromEntries(existing.map((p) => [p.name, p.plan_code]));

  const results = {};

  for (const plan of PLANS) {
    if (byName[plan.name]) {
      console.log(`  [EXISTING] ${plan.name} → ${byName[plan.name]}`);
      results[plan.envKey] = byName[plan.name];
      continue;
    }

    console.log(`  [CREATING] ${plan.name} (${plan.interval}, ${plan.amount})...`);
    const created = await paystackPost("/plan", {
      name: plan.name,
      amount: plan.amount,
      interval: plan.interval,
    });
    console.log(`             → ${created.plan_code}`);
    results[plan.envKey] = created.plan_code;
  }

  // ── Update .env ─────────────────────────────────────────────────────────────

  let updated = envRaw;
  for (const [key, code] of Object.entries(results)) {
    // Replace lines like:  KEY=PLN_  or  KEY=PLN_abc123
    updated = updated.replace(
      new RegExp(`^(${key}=).*$`, "m"),
      `$1${code}`,
    );
  }

  writeFileSync(ENV_FILE, updated, "utf8");
  console.log("\n.env updated with plan codes:");
  for (const [key, code] of Object.entries(results)) {
    console.log(`  ${key}=${code}`);
  }
  console.log("\nDone. Restart the API for changes to take effect.");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
