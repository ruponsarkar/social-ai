import axios from "axios";
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

interface AiServiceResponse {
  ai?: string;
  data?: {
    text?: string;
    caption?: string;
    hashtags?: string[];
    content_type?: string;
  };
}

const joinKeywords = (keywords: string[]) => keywords.length ? keywords.join(", ") : "general growth";

const buildTextPrompt = (input: GenerateContentInput) => {
  const keywordsText = joinKeywords(input.keywords);

  return [
    `Create a ${input.contentType} social media post for our platform.`,
    `Title: ${input.title}`,
    `Keywords: ${keywordsText}`,
    `Requirements: ${input.promptTemplate}`,
    "Write final publish-ready copy in a clear, engaging, human tone."
  ].join("\n");
};

const generateTextFromAiService = async (input: GenerateContentInput) => {
  const response = await axios.post<AiServiceResponse>(`${env.AI_SERVICE_URL}/chat`, {
    session_id: `job-${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    // message: buildTextPrompt(input)
    message: input.promptTemplate
  }, {
    timeout: 30000
  });

  const text = response.data?.data?.text || response.data?.ai;
  const caption = response.data?.data?.caption;
  const hashtags = response.data?.data?.hashtags || [];

  if (!text) {
    throw new Error("AI service returned an empty text response");
  }

  const hashtagsText = hashtags.length > 0 ? `\n\n${hashtags.map((tag) => tag.startsWith("#") ? tag : `#${tag}`).join(" ")}` : "";

  return {
    text: `${caption ? `${caption}\n\n` : ""} ${text}${hashtagsText}`.trim()
    // text: `${text}${caption ? `\n\n${caption}` : ""}${hashtagsText}`.trim()
  };
};

export const generateContent = async (input: GenerateContentInput): Promise<GeneratedContent> => {
  const keywordsText = joinKeywords(input.keywords);
  const baseText = `Title: ${input.title}\nFocus keywords: ${keywordsText}\nPrompt: ${input.promptTemplate}`;

  if (env.AI_TEXT_PROVIDER !== "mock" && input.contentType === "text") {
    try {
      console.log("creating text from gemini ");
      return await generateTextFromAiService(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown AI service error";
      console.error(`[ai] Falling back to mock text generation: ${message}`);
    }
  }

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
