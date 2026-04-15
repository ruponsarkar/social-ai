import axios from "axios";
import { readFileSync } from "fs";
import FormData from "form-data";
import { env } from "../../config/env.js";
import type { ContentJob } from "../../types/index.js";
import type { PlatformConnection } from "./connectionService.js";

const META_BASE_URL = `https://graph.facebook.com/${env.META_GRAPH_VERSION}`;

const postForm = async <T>(path: string, form: Record<string, string | number | boolean | undefined>) => {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(form)) {
    if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  }

  const response = await axios.post<T>(`${META_BASE_URL}${path}`, params, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    }
  });

  return response.data;
};

const postMultipart = async <T>(path: string, form: Record<string, string | number | boolean | Buffer | undefined>) => {
  const formData = new FormData();

  for (const [key, value] of Object.entries(form)) {
    if (value !== undefined && value !== null) {
      if (Buffer.isBuffer(value)) {
        formData.append(key, value, { filename: "image.png" });
      } else {
        formData.append(key, String(value));
      }
    }
  }

  const response = await axios.post<T>(`${META_BASE_URL}${path}`, formData, {
    headers: formData.getHeaders()
  });

  return response.data;
};

const getJson = async <T>(path: string, query: Record<string, string>) => {
  const response = await axios.get<T>(`${META_BASE_URL}${path}`, {
    params: query
  });

  return response.data;
};

const requirePageId = (connection: PlatformConnection, platformLabel: string) => {
  if (!connection.page_id) {
    throw new Error(`${platformLabel} connection is missing page_id`);
  }

  return connection.page_id;
};

export const publishToFacebook = async (job: ContentJob, connection: PlatformConnection) => {
  const pageId = requirePageId(connection, "Facebook");
  const accessToken = connection.access_token!;

  if (job.content_type === "video") {
    if (!job.generated_video_url) {
      throw new Error("Facebook video publishing requires generated_video_url");
    }

    const data = await postForm<{ id: string }>(`/${pageId}/videos`, {
      access_token: accessToken,
      file_url: job.generated_video_url,
      title: job.title,
      description: job.generated_text ?? job.title
    });

    return { externalPostId: data.id, raw: data };
  }

  if (job.content_type === "image") {
    if (!job.generated_image_url && !job.generated_image_path) {
      throw new Error("Facebook image publishing requires generated_image_url or generated_image_path");
    }

    const form: Record<string, string | number | boolean | Buffer | undefined> = {
      access_token: accessToken,
      caption: job.generated_text ?? job.title,
      published: true
    };

    // If local path is available, read and upload file directly; otherwise use URL
    if (job.generated_image_path) {
      try {
        const imageBuffer = readFileSync(job.generated_image_path);
        form.source = imageBuffer;
      } catch (error) {
        console.warn(`Failed to read local image from ${job.generated_image_path}, falling back to URL`);
        if (job.generated_image_url) {
          form.url = job.generated_image_url;
        }
      }
    } else if (job.generated_image_url) {
      form.url = job.generated_image_url;
    }

    const data = form.source
      ? await postMultipart<{ post_id?: string; id?: string }>(`/${pageId}/photos`, form)
      : await postForm<{ post_id?: string; id?: string }>(`/${pageId}/photos`, form as Record<string, string | number | boolean | undefined>);

    return { externalPostId: data.post_id ?? data.id ?? "facebook_photo_created", raw: data };
  }

  const data = await postForm<{ id: string }>(`/${pageId}/feed`, {
    access_token: accessToken,
    message: job.generated_text ?? job.title
  });

  return { externalPostId: data.id, raw: data };
};

const pollInstagramContainer = async (containerId: string, accessToken: string) => {
  const start = Date.now();
  const timeoutMs = 5 * 60 * 1000;

  while (Date.now() - start < timeoutMs) {
    const data = await getJson<{ status_code?: string; status?: string; error_message?: string }>(
      `/${containerId}`,
      {
        access_token: accessToken,
        fields: "status_code,status,error_message"
      }
    );

    const status = data.status_code ?? data.status ?? "UNKNOWN";

    if (status === "FINISHED" || status === "PUBLISHED") {
      return;
    }

    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(data.error_message ?? `Instagram media container failed with status ${status}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  throw new Error("Timed out waiting for Instagram media container to finish processing");
};

export const publishToInstagram = async (job: ContentJob, connection: PlatformConnection) => {
  const igUserId = requirePageId(connection, "Instagram");
  const accessToken = connection.access_token!;

  if (job.content_type === "text") {
    throw new Error("Instagram API does not support text-only feed publishing; use image or video jobs for Instagram");
  }

  const containerRequest: Record<string, string | number | boolean | undefined> = {
    access_token: accessToken,
    caption: job.generated_text ?? job.title
  };

  if (job.content_type === "image") {
    if (!job.generated_image_url && !job.generated_image_path) {
      throw new Error("Instagram image publishing requires generated_image_url or generated_image_path");
    }

    // For Instagram, always use the public URL (generated_image_url)
    containerRequest.image_url = job.generated_image_url || "";
  }

  if (job.content_type === "video") {
    if (!job.generated_video_url) {
      throw new Error("Instagram video publishing requires generated_video_url");
    }

    containerRequest.media_type = "REELS";
    containerRequest.video_url = job.generated_video_url;
    containerRequest.share_to_feed = true;
  }

  const container = await postForm<{ id: string }>(`/${igUserId}/media`, containerRequest);

  if (job.content_type === "video") {
    await pollInstagramContainer(container.id, accessToken);
  }

  const published = await postForm<{ id: string }>(`/${igUserId}/media_publish`, {
    access_token: accessToken,
    creation_id: container.id
  });

  return { externalPostId: published.id, raw: published };
};

