export type Platform = "facebook" | "instagram" | "youtube";
export type ContentType = "text" | "image" | "video";
export type JobStatus = "draft" | "scheduled" | "processing" | "published" | "failed";

export interface Keyword {
  id: number;
  keyword: string;
  category: string;
  is_active: number;
  created_at: string;
}

export interface ContentJob {
  id: string;
  title: string;
  content_type: ContentType;
  target_platforms: Platform[];
  status: JobStatus;
  prompt_template: string;
  scheduled_at: string;
  publish_every_other_day: number;
  last_run_at: string | null;
  next_run_at: string | null;
  generated_text: string | null;
  generated_image_url: string | null;
  generated_video_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

