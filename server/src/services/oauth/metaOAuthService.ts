import axios from "axios";
import { env } from "../../config/env.js";
import { pool } from "../../db/pool.js";

const META_BASE = `https://graph.facebook.com/${env.META_GRAPH_VERSION}`;

type MetaPage = {
  id: string;
  name: string;
  access_token?: string;
};

type InstagramBusinessAccount = {
  id: string;
  username?: string;
};

const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "pages_manage_metadata",
  "instagram_basic",
  "instagram_content_publish",
  "business_management"
];

const assertMetaOAuthConfigured = () => {
  if (!env.META_APP_ID || !env.META_APP_SECRET || !env.META_REDIRECT_URI) {
    throw new Error("Meta OAuth is not configured. Set META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI.");
  }
};

const saveMetaConnection = async (input: {
  platform: "facebook" | "instagram";
  accountName: string;
  accessToken: string;
  pageId: string;
}) => {
  await pool.execute(
    `INSERT INTO platform_connections (platform, account_name, access_token, page_id)
     VALUES (?, ?, ?, ?)`,
    [input.platform, input.accountName, input.accessToken, input.pageId]
  );
};

const fetchUserPages = async (userAccessToken: string) => {
  const response = await axios.get<{ data: MetaPage[] }>(`${META_BASE}/me/accounts`, {
    params: {
      access_token: userAccessToken,
      fields: "id,name,access_token"
    }
  });

  return response.data.data ?? [];
};

const fetchInstagramBusinessAccount = async (pageId: string, pageAccessToken: string) => {
  const response = await axios.get<{ instagram_business_account?: InstagramBusinessAccount }>(`${META_BASE}/${pageId}`, {
    params: {
      access_token: pageAccessToken,
      fields: "instagram_business_account{id,username}"
    }
  });

  return response.data.instagram_business_account;
};

export const getMetaAuthorizationUrl = async (state: string) => {
  assertMetaOAuthConfigured();
  const params = new URLSearchParams({
    client_id: env.META_APP_ID,
    redirect_uri: env.META_REDIRECT_URI,
    scope: META_SCOPES.join(","),
    response_type: "code",
    state
  });

  return `https://www.facebook.com/${env.META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
};

export const handleMetaCallback = async (code: string) => {
  assertMetaOAuthConfigured();

  if (!code) {
    throw new Error("Meta did not return an authorization code");
  }

  const tokenResponse = await axios.get<{ access_token: string }>(`${META_BASE}/oauth/access_token`, {
    params: {
      client_id: env.META_APP_ID,
      client_secret: env.META_APP_SECRET,
      redirect_uri: env.META_REDIRECT_URI,
      code
    }
  });

  const shortLivedToken = tokenResponse.data.access_token;

  const longLivedResponse = await axios.get<{ access_token: string }>(`${META_BASE}/oauth/access_token`, {
    params: {
      grant_type: "fb_exchange_token",
      client_id: env.META_APP_ID,
      client_secret: env.META_APP_SECRET,
      fb_exchange_token: shortLivedToken
    }
  });

  const userAccessToken = longLivedResponse.data.access_token;
  const pages = await fetchUserPages(userAccessToken);

  let facebookCount = 0;
  let instagramCount = 0;

  for (const page of pages) {
    if (!page.access_token) {
      continue;
    }

    await saveMetaConnection({
      platform: "facebook",
      accountName: page.name,
      accessToken: page.access_token,
      pageId: page.id
    });
    facebookCount += 1;

    const instagramBusinessAccount = await fetchInstagramBusinessAccount(page.id, page.access_token);

    if (instagramBusinessAccount?.id) {
      await saveMetaConnection({
        platform: "instagram",
        accountName: instagramBusinessAccount.username || `${page.name} Instagram`,
        accessToken: page.access_token,
        pageId: instagramBusinessAccount.id
      });
      instagramCount += 1;
    }
  }

  return {
    facebookCount,
    instagramCount
  };
};
