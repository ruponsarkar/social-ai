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

const insertPublishedContent = async (
  jobId: string,
  platform: Platform,
  text: string | null,
  imageUrl: string | null,
  videoUrl: string | null,
  aiSource: string | null,
  aiResponsePayload: unknown,
  externalPostId: string | null
) => {
  await pool.execute(
    `INSERT INTO published_content (job_id, platform, content_text, content_image_url, content_video_url, ai_source, ai_response_payload, external_post_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      jobId,
      platform,
      text,
      imageUrl,
      videoUrl,
      aiSource,
      aiResponsePayload ? JSON.stringify(aiResponsePayload) : null,
      externalPostId
    ]
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
    await insertPublishedContent(
      job.id,
      platform,
      job.generated_text,
      job.generated_image_url,
      job.generated_video_url,
      job.ai_source,
      job.ai_response_payload,
      result.externalPostId
    );
    return { ok: true, platform, externalPostId: result.externalPostId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown publishing error";
    await insertLog(job.id, platform, "failed", payload, undefined, message);
    return { ok: false, platform, error: message };
  }
};
