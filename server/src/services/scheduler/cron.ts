import cron from "node-cron";
import { env } from "../../config/env.js";
import { processDueJobs } from "./jobProcessor.js";

export const startScheduler = () => {
  console.log(`[scheduler] Cron started and checking every minute in timezone ${env.APP_TIMEZONE}`);
  cron.schedule("* * * * *", async () => {
    try {
      await processDueJobs();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown cron error";
      console.error(`[scheduler] Cron cycle failed: ${message}`);
    }
  }, {
    timezone: env.APP_TIMEZONE
  });
};
