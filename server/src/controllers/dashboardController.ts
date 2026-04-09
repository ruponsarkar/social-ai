import type { Request, Response } from "express";
import { pool } from "../db/pool.js";

const getCount = async (sql: string, key: string) => {
  const [rows] = await pool.query(sql);
  const firstRow = (rows as Array<Record<string, number>>)[0];
  return firstRow?.[key] ?? 0;
};

export const getDashboardStats = async (_req: Request, res: Response) => {
  const totalKeywords = await getCount("SELECT COUNT(*) AS totalKeywords FROM keywords", "totalKeywords");
  const totalJobs = await getCount("SELECT COUNT(*) AS totalJobs FROM content_jobs", "totalJobs");
  const scheduledJobs = await getCount(
    "SELECT COUNT(*) AS scheduledJobs FROM content_jobs WHERE status = 'scheduled'",
    "scheduledJobs"
  );
  const publishedJobs = await getCount(
    "SELECT COUNT(*) AS publishedJobs FROM content_jobs WHERE status = 'published'",
    "publishedJobs"
  );

  res.json({
    totalKeywords,
    totalJobs,
    scheduledJobs,
    publishedJobs
  });
};
