import cron from "node-cron";
import { processDueJobs } from "./jobProcessor.js";

export const startScheduler = () => {
  console.log("[scheduler] Cron started and checking every minute");
  cron.schedule("* * * * *", async () => {
    try {
      await processDueJobs();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown cron error";
      console.error(`[scheduler] Cron cycle failed: ${message}`);
    }
  });
};
