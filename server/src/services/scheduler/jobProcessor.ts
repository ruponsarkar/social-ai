import { pool } from "../../db/pool.js";
import { generateContent } from "../ai/contentGenerator.js";
import { publishToPlatform } from "../publishers/socialPublisher.js";
import { computeNextRunAt, formatAppDateTime, normalizeRepeatInterval } from "../../utils/date.js";
import type { ContentJob, Keyword, Platform, RepeatInterval } from "../../types/index.js";

const getPendingJobs = async (): Promise<ContentJob[]> => {
  const currentTime = formatAppDateTime();
  const [rows] = await pool.query(
    `SELECT * FROM content_jobs
     WHERE (
       status IN ('scheduled', 'failed')
       AND scheduled_at <= ?
     ) OR (
       status <> 'processing'
       AND (repeat_interval IS NOT NULL OR publish_every_other_day = 1)
       AND COALESCE(next_run_at, scheduled_at) <= ?
     )
     ORDER BY COALESCE(next_run_at, scheduled_at) ASC`
    ,
    [currentTime, currentTime]
  );

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    ...row,
    target_platforms: JSON.parse(String(row.target_platforms ?? "[]"))
  })) as ContentJob[];
};

const getKeywordsForJob = async (jobId: string): Promise<Keyword[]> => {
  const [rows] = await pool.query(
    `SELECT k.* FROM keywords k
     INNER JOIN content_job_keywords jk ON jk.keyword_id = k.id
     WHERE jk.job_id = ?`,
    [jobId]
  );

  return rows as Keyword[];
};

const getAlreadyPublishedPlatforms = async (jobId: string): Promise<Platform[]> => {
  const [rows] = await pool.query(
    `SELECT platform
     FROM publish_logs
     WHERE job_id = ? AND status = 'success'`,
    [jobId]
  );

  const platforms = (rows as Array<{ platform: Platform }>).map((row) => row.platform);
  return Array.from(new Set(platforms));
};

export const processDueJobs = async () => {
  const jobs = await getPendingJobs();
  console.log(`[scheduler] Found ${jobs.length} due job(s) at ${formatAppDateTime()}`);
  let processed = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      console.log(`[scheduler] Processing job ${job.id} (${job.title}) scheduled for ${job.scheduled_at}`);
      await pool.execute(
        "UPDATE content_jobs SET status = 'processing', error_message = NULL WHERE id = ?",
        [job.id]
      );

      const keywords = await getKeywordsForJob(job.id);
      const keywordList = keywords.map((item) => item.keyword);
      const generated = await generateContent({
        title: job.title,
        promptTemplate: job.prompt_template,
        keywords: keywordList,
        contentType: job.content_type
      });

      await pool.execute(
        `UPDATE content_jobs
         SET generated_text = ?, generated_image_url = ?, generated_image_path = ?, generated_video_url = ?, ai_source = ?, ai_response_payload = ?
         WHERE id = ?`,
        [
          generated.text ?? null,
          generated.imageUrl ?? null,
          (generated as any).imagePath ?? null,
          generated.videoUrl ?? null,
          generated.aiSource ?? null,
          generated.aiResponsePayload ? JSON.stringify(generated.aiResponsePayload) : null,
          job.id
        ]
      );

      const platforms = job.target_platforms as Platform[];
      const repeatInterval = normalizeRepeatInterval(
        job.repeat_interval as RepeatInterval | null,
        job.publish_every_other_day
      );
      const isRecurringJob = repeatInterval !== "none";
      const alreadyPublishedPlatforms = isRecurringJob ? [] : await getAlreadyPublishedPlatforms(job.id);
      const pendingPlatforms = platforms.filter((platform) => !alreadyPublishedPlatforms.includes(platform));
      const publishResults = [];
      const nextRunAt = computeNextRunAt(
        formatAppDateTime(),
        repeatInterval,
        job.publish_every_other_day
      );
      const hasRepeat = Boolean(nextRunAt);

      if (pendingPlatforms.length === 0) {
        await pool.execute(
          `UPDATE content_jobs
           SET status = ?, last_run_at = COALESCE(last_run_at, NOW()), next_run_at = ?, scheduled_at = COALESCE(?, scheduled_at)
           WHERE id = ?`,
          [hasRepeat ? "scheduled" : "published", nextRunAt, nextRunAt, job.id]
        );
        processed += 1;
        continue;
      }

      for (const platform of pendingPlatforms) {
        const result = await publishToPlatform(
          {
            ...job,
            generated_text: generated.text ?? (generated as any).caption ?? null,
            generated_image_url: generated.imageUrl ?? null,
            generated_image_path: (generated as any).imagePath ?? null,
            generated_video_url: generated.videoUrl ?? null,
            ai_source: generated.aiSource ?? null,
            ai_response_payload: generated.aiResponsePayload ? JSON.stringify(generated.aiResponsePayload) : null
          },
          platform
        );
        publishResults.push(result);
      }

      const failedPublishes = publishResults.filter((result) => !result.ok);

      if (failedPublishes.length > 0) {
        throw new Error(
          failedPublishes
            .map((result) => `${result.platform}: ${"error" in result ? result.error : "Unknown platform failure"}`)
            .join(" | ")
        );
      }

      await pool.execute(
        `UPDATE content_jobs
         SET status = ?, last_run_at = NOW(), next_run_at = ?, scheduled_at = COALESCE(?, scheduled_at)
         WHERE id = ?`,
        [hasRepeat ? "scheduled" : "published", nextRunAt, nextRunAt, job.id]
      );
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown job processing error";
      await pool.execute(
        "UPDATE content_jobs SET status = 'failed', error_message = ? WHERE id = ?",
        [message, job.id]
      );
      failed += 1;
      console.error(`[scheduler] Job ${job.id} failed: ${message}`);
    }
  }

  return {
    found: jobs.length,
    processed,
    failed
  };
};
