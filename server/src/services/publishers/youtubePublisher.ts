import axios from "axios";
import mime from "mime-types";
import { env } from "../../config/env.js";
import type { ContentJob } from "../../types/index.js";
import type { PlatformConnection } from "./connectionService.js";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YOUTUBE_UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos";

const guessMimeType = (sourceUrl: string, responseContentType?: string | null) => {
  if (responseContentType && responseContentType !== "application/octet-stream") {
    return responseContentType;
  }

  const detected = mime.lookup(sourceUrl);
  return detected || "video/mp4";
};

const refreshYouTubeAccessToken = async (connection: PlatformConnection) => {
  if (!connection.refresh_token) {
    return connection.access_token!;
  }

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return connection.access_token!;
  }

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    refresh_token: connection.refresh_token,
    grant_type: "refresh_token"
  });

  const response = await axios.post<{ access_token: string }>(GOOGLE_TOKEN_URL, params, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    }
  });

  return response.data.access_token;
};

const downloadVideoAsset = async (videoUrl: string) => {
  const response = await axios.get<ArrayBuffer>(videoUrl, {
    responseType: "arraybuffer"
  });

  const contentTypeHeader = response.headers["content-type"];
  const contentLengthHeader = response.headers["content-length"];

  return {
    buffer: Buffer.from(response.data),
    contentType: guessMimeType(videoUrl, contentTypeHeader),
    contentLength: Number(contentLengthHeader ?? 0)
  };
};

export const publishToYouTube = async (job: ContentJob, connection: PlatformConnection) => {
  if (!job.generated_video_url) {
    throw new Error("YouTube publishing requires generated_video_url");
  }

  const accessToken = await refreshYouTubeAccessToken(connection);
  const asset = await downloadVideoAsset(job.generated_video_url);

  const metadata = {
    snippet: {
      title: job.title,
      description: job.generated_text ?? job.title,
      categoryId: env.YOUTUBE_DEFAULT_CATEGORY_ID,
      tags: [job.title, "AI content", "shorts"]
    },
    status: {
      privacyStatus: env.YOUTUBE_DEFAULT_PRIVACY_STATUS,
      selfDeclaredMadeForKids: false
    }
  };

  const resumableSession = await axios.post(
    `${YOUTUBE_UPLOAD_URL}?uploadType=resumable&part=snippet,status`,
    metadata,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(asset.contentLength || asset.buffer.length),
        "X-Upload-Content-Type": asset.contentType
      },
      validateStatus: (status) => status >= 200 && status < 400
    }
  );

  const uploadUrl = resumableSession.headers.location as string | undefined;

  if (!uploadUrl) {
    throw new Error("YouTube resumable upload URL was not returned");
  }

  const uploadResponse = await axios.put<{ id: string }>(uploadUrl, asset.buffer, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": asset.contentType,
      "Content-Length": String(asset.buffer.length)
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity
  });

  return { externalPostId: uploadResponse.data.id, raw: uploadResponse.data };
};

