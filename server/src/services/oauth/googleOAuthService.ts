import axios from "axios";
import { env } from "../../config/env.js";
import { pool } from "../../db/pool.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const YOUTUBE_CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels";

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/youtube.upload"
];

const assertGoogleOAuthConfigured = () => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    throw new Error("Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.");
  }
};

export const getGoogleAuthorizationUrl = async (state: string) => {
  assertGoogleOAuthConfigured();
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: GOOGLE_SCOPES.join(" "),
    state
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
};

export const handleGoogleCallback = async (code: string) => {
  assertGoogleOAuthConfigured();

  if (!code) {
    throw new Error("Google did not return an authorization code");
  }

  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    grant_type: "authorization_code"
  });

  const tokenResponse = await axios.post<{
    access_token: string;
    refresh_token?: string;
  }>(GOOGLE_TOKEN_URL, body, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    }
  });

  const accessToken = tokenResponse.data.access_token;
  const refreshToken = tokenResponse.data.refresh_token ?? null;

  const [userInfoResponse, channelResponse] = await Promise.all([
    axios.get<{ email?: string; name?: string }>(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` }
    }),
    axios.get<{
      items?: Array<{
        id: string;
        snippet?: {
          title?: string;
        };
      }>;
    }>(YOUTUBE_CHANNELS_URL, {
      params: {
        mine: "true",
        part: "snippet"
      },
      headers: { Authorization: `Bearer ${accessToken}` }
    })
  ]);

  const primaryChannel = channelResponse.data.items?.[0];
  const accountName =
    primaryChannel?.snippet?.title ||
    userInfoResponse.data.name ||
    userInfoResponse.data.email ||
    "YouTube Channel";

  await pool.execute(
    `INSERT INTO platform_connections (platform, account_name, access_token, refresh_token, channel_id)
     VALUES ('youtube', ?, ?, ?, ?)`,
    [accountName, accessToken, refreshToken, primaryChannel?.id ?? null]
  );

  return {
    accountName,
    channelId: primaryChannel?.id ?? null
  };
};
