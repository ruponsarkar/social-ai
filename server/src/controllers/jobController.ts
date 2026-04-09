import type { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../db/pool.js";
import { processDueJobs } from "../services/scheduler/jobProcessor.js";

export const getJobs = async (_req: Request, res: Response) => {
  const [rows] = await pool.query("SELECT * FROM content_jobs ORDER BY scheduled_at ASC");
  const jobs = (rows as Array<Record<string, unknown>>).map((row) => ({
    ...row,
    target_platforms: JSON.parse(String(row.target_platforms ?? "[]"))
  }));
  res.json(jobs);
};

export const createJob = async (req: Request, res: Response) => {
  const {
    title,
    contentType,
    targetPlatforms,
    promptTemplate,
    scheduledAt,
    publishEveryOtherDay,
    keywordIds
  } = req.body as {
    title: string;
    contentType: "text" | "image" | "video";
    targetPlatforms: string[];
    promptTemplate: string;
    scheduledAt: string;
    publishEveryOtherDay: boolean;
    keywordIds: number[];
  };

  const id = uuidv4();

  await pool.execute(
    `INSERT INTO content_jobs
     (id, title, content_type, target_platforms, status, prompt_template, scheduled_at, publish_every_other_day, next_run_at)
     VALUES (?, ?, ?, ?, 'scheduled', ?, ?, ?, ?)`,
    [
      id,
      title,
      contentType,
      JSON.stringify(targetPlatforms),
      promptTemplate,
      scheduledAt,
      publishEveryOtherDay ? 1 : 0,
      scheduledAt
    ]
  );

  for (const keywordId of keywordIds || []) {
    await pool.execute(
      "INSERT INTO content_job_keywords (job_id, keyword_id) VALUES (?, ?)",
      [id, keywordId]
    );
  }

  res.status(201).json({ id, message: "Job created and scheduled" });
};

export const runSchedulerNow = async (_req: Request, res: Response) => {
  const result = await processDueJobs();
  res.json({ message: "Scheduler executed", result });
};

export const deleteJob = async (req: Request, res: Response) => {
  const { id } = req.params;

  await pool.execute("DELETE FROM content_jobs WHERE id = ?", [id]);
  res.json({ message: "Job deleted" });
};
