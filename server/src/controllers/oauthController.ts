import type { Request, Response } from "express";
import { env } from "../config/env.js";
import { getGoogleAuthorizationUrl, handleGoogleCallback } from "../services/oauth/googleOAuthService.js";
import { getMetaAuthorizationUrl, handleMetaCallback } from "../services/oauth/metaOAuthService.js";
import { consumeOAuthState, createOAuthState } from "../services/oauth/stateService.js";

const buildClientRedirect = (path: string, message: string) => {
  const target = new URL(path, env.CLIENT_ORIGIN);
  target.searchParams.set("message", message);
  return target.toString();
};

const getSafeReturnTo = (value: unknown) => {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return "/";
  }

  return value;
};

export const startMetaOAuth = async (req: Request, res: Response) => {
  const state = await createOAuthState("meta", getSafeReturnTo(req.query.returnTo));
  const url = await getMetaAuthorizationUrl(state);
  res.json({ url });
};

export const metaOAuthCallback = async (req: Request, res: Response) => {
  try {
    if (req.query.error) {
      throw new Error(String(req.query.error_description || req.query.error));
    }

    const code = String(req.query.code || "");
    const stateToken = String(req.query.state || "");
    const state = await consumeOAuthState("meta", stateToken);
    const result = await handleMetaCallback(code);

    res.redirect(
      buildClientRedirect(
        state.return_to || "/",
        `Meta connected. Imported ${result.facebookCount} Facebook page(s) and ${result.instagramCount} Instagram account(s).`
      )
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meta OAuth failed";
    res.redirect(buildClientRedirect("/", message));
  }
};

export const startGoogleOAuth = async (req: Request, res: Response) => {
  const state = await createOAuthState("google", getSafeReturnTo(req.query.returnTo));
  const url = await getGoogleAuthorizationUrl(state);
  res.json({ url });
};

export const googleOAuthCallback = async (req: Request, res: Response) => {
  try {
    if (req.query.error) {
      throw new Error(String(req.query.error_description || req.query.error));
    }

    const code = String(req.query.code || "");
    const stateToken = String(req.query.state || "");
    const state = await consumeOAuthState("google", stateToken);
    const result = await handleGoogleCallback(code);

    res.redirect(
      buildClientRedirect(
        state.return_to || "/",
        `YouTube connected for ${result.accountName}.`
      )
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google OAuth failed";
    res.redirect(buildClientRedirect("/", message));
  }
};
