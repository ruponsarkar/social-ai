import { pool } from "../../db/pool.js";
import type { ContentJob, Platform } from "../../types/index.js";
import { getActiveConnection } from "./connectionService.js";
import { publishToFacebook, publishToInstagram } from "./metaPublisher.js";
import { publishToYouTube } from "./youtubePublisher.js";

const insertLog = async (
  jobId: string,
  platform: Platform,
  status: "success" | "failed",
  payload: Record<string, unknown>,
  externalPostId?: string,
  errorMessage?: string
) => {
  await pool.execute(
    `INSERT INTO publish_logs (job_id, platform, status, external_post_id, payload, error_message)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [jobId, platform, status, externalPostId ?? null, JSON.stringify(payload), errorMessage ?? null]
  );
};

export const publishToPlatform = async (job: ContentJob, platform: Platform) => {
  const payload = {
    title: job.title,
    contentType: job.content_type,
    text: job.generated_text,
    imageUrl: job.generated_image_url,
    videoUrl: job.generated_video_url
  };

  try {
    const connection = await getActiveConnection(platform);
    const result =
      platform === "facebook"
        ? await publishToFacebook(job, connection)
        : platform === "instagram"
          ? await publishToInstagram(job, connection)
          : await publishToYouTube(job, connection);

    await insertLog(job.id, platform, "success", payload, result.externalPostId);
    return { ok: true, platform, externalPostId: result.externalPostId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown publishing error";
    await insertLog(job.id, platform, "failed", payload, undefined, message);
    return { ok: false, platform, error: message };
  }
};
