import { pool } from "../../db/pool.js";
import type { Platform } from "../../types/index.js";

export interface PlatformConnection {
  id: number;
  platform: Platform;
  account_name: string;
  access_token: string | null;
  refresh_token: string | null;
  page_id: string | null;
  channel_id: string | null;
  is_active: number;
}

export const getActiveConnection = async (platform: Platform): Promise<PlatformConnection> => {
  const [rows] = await pool.query(
    `SELECT *
     FROM platform_connections
     WHERE platform = ? AND is_active = 1
     ORDER BY updated_at DESC, created_at DESC
     LIMIT 1`,
    [platform]
  );

  const connection = (rows as PlatformConnection[])[0];

  if (!connection) {
    throw new Error(`No active ${platform} connection found`);
  }

  if (!connection.access_token) {
    throw new Error(`No access token stored for ${platform}`);
  }

  return connection;
};

