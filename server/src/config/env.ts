import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  SERVER_ORIGIN: z.string().default("http://localhost:4000"),
  APP_TIMEZONE: z.string().default("Asia/Kolkata"),
  MYSQL_HOST: z.string().default("localhost"),
  MYSQL_PORT: z.coerce.number().default(3306),
  MYSQL_USER: z.string().default("root"),
  MYSQL_PASSWORD: z.string().default("password"),
  MYSQL_DATABASE: z.string().default("social_media_manager"),
  AI_TEXT_PROVIDER: z.string().default("mock"),
  AI_IMAGE_PROVIDER: z.string().default("mock"),
  AI_VIDEO_PROVIDER: z.string().default("mock"),
  OPENAI_API_KEY: z.string().optional(),
  META_APP_ID: z.string().default(""),
  META_APP_SECRET: z.string().default(""),
  META_GRAPH_VERSION: z.string().default("v22.0"),
  META_REDIRECT_URI: z.string().default("http://localhost:4000/api/oauth/meta/callback"),
  FACEBOOK_PAGE_ID: z.string().optional(),
  INSTAGRAM_BUSINESS_ID: z.string().optional(),
  YOUTUBE_CHANNEL_ID: z.string().optional(),
  YOUTUBE_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
  GOOGLE_REDIRECT_URI: z.string().default("http://localhost:4000/api/oauth/google/callback"),
  YOUTUBE_DEFAULT_PRIVACY_STATUS: z.enum(["private", "public", "unlisted"]).default("private"),
  YOUTUBE_DEFAULT_CATEGORY_ID: z.string().default("22")
});

export const env = envSchema.parse(process.env);
