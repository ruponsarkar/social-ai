import type { Request, Response } from "express";
import { pool } from "../db/pool.js";

export const getConnections = async (_req: Request, res: Response) => {
  const [rows] = await pool.query(
    `SELECT id, platform, account_name, page_id, channel_id, is_active, created_at, updated_at
     FROM platform_connections
     ORDER BY created_at DESC`
  );
  res.json(rows);
};

export const upsertConnection = async (req: Request, res: Response) => {
  const { platform, accountName, accessToken, refreshToken, pageId, channelId } = req.body as {
    platform: "facebook" | "instagram" | "youtube";
    accountName: string;
    accessToken?: string;
    refreshToken?: string;
    pageId?: string;
    channelId?: string;
  };

  await pool.execute(
    `INSERT INTO platform_connections (platform, account_name, access_token, refresh_token, page_id, channel_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [platform, accountName, accessToken ?? null, refreshToken ?? null, pageId ?? null, channelId ?? null]
  );

  res.status(201).json({ message: "Connection stored" });
};
