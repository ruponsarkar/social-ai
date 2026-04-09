import { Router } from "express";
import { getDashboardStats } from "../controllers/dashboardController.js";
import { createKeyword, getKeywords } from "../controllers/keywordController.js";
import { createJob, deleteJob, getJobs, runSchedulerNow } from "../controllers/jobController.js";
import { getConnections, upsertConnection } from "../controllers/connectionController.js";
import {
  googleOAuthCallback,
  metaOAuthCallback,
  startGoogleOAuth,
  startMetaOAuth
} from "../controllers/oauthController.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true });
});

router.get("/dashboard/stats", getDashboardStats);
router.get("/keywords", getKeywords);
router.post("/keywords", createKeyword);
router.get("/jobs", getJobs);
router.post("/jobs", createJob);
router.post("/jobs/run-now", runSchedulerNow);
router.delete("/jobs/:id", deleteJob);
router.get("/connections", getConnections);
router.post("/connections", upsertConnection);
router.get("/oauth/meta/start", startMetaOAuth);
router.get("/oauth/meta/callback", metaOAuthCallback);
router.get("/oauth/google/start", startGoogleOAuth);
router.get("/oauth/google/callback", googleOAuthCallback);

export default router;
