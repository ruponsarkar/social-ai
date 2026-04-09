import { env } from "../../config/env.js";
import type { ContentType } from "../../types/index.js";

interface GenerateContentInput {
  title: string;
  promptTemplate: string;
  keywords: string[];
  contentType: ContentType;
}

interface GeneratedContent {
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
}

const joinKeywords = (keywords: string[]) => keywords.length ? keywords.join(", ") : "general growth";

export const generateContent = async (input: GenerateContentInput): Promise<GeneratedContent> => {
  const keywordsText = joinKeywords(input.keywords);
  const baseText = `Title: ${input.title}\nFocus keywords: ${keywordsText}\nPrompt: ${input.promptTemplate}`;

  if (env.AI_TEXT_PROVIDER === "mock" || env.AI_IMAGE_PROVIDER === "mock" || env.AI_VIDEO_PROVIDER === "mock") {
    if (input.contentType === "video") {
      return {
        text: `Short video script about ${keywordsText}. Hook the audience in 3 seconds, deliver one practical insight, then end with a CTA.`,
        videoUrl: "https://example.com/mock-short-video.mp4"
      };
    }

    if (input.contentType === "image") {
      return {
        text: `Caption generated from keywords: ${keywordsText}.`,
        imageUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80"
      };
    }

    return {
      text: `${baseText}\n\nGenerated social post:\nBuild trust with consistent content, clear messaging, and one actionable tip your audience can use today.`
    };
  }

  return {
    text: `${baseText}\n\nConfigure a real AI provider in server/src/services/ai/contentGenerator.ts`,
    imageUrl: input.contentType === "image" ? "https://example.com/replace-with-real-image-url.jpg" : undefined,
    videoUrl: input.contentType === "video" ? "https://example.com/replace-with-real-video-url.mp4" : undefined
  };
};

