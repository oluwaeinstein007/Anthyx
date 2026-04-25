import cron from "node-cron";
import { findAndInvoiceExpiredPeriods } from "../services/billing/overage";

// Runs nightly at 2:00 AM to invoice any billing periods that ended
cron.schedule("0 2 * * *", async () => {
  console.log("[OverageWorker] Running nightly overage invoicing...");
  try {
    await findAndInvoiceExpiredPeriods();
    console.log("[OverageWorker] Overage invoicing complete.");
  } catch (err) {
    console.error("[OverageWorker] Overage invoicing failed:", err);
  }
});

console.log("[OverageWorker] Nightly overage cron scheduled (2:00 AM)");
