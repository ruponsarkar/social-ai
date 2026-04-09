import crypto from "crypto";
import { pool } from "../../db/pool.js";

export const createOAuthState = async (provider: "meta" | "google", returnTo?: string) => {
  const token = crypto.randomBytes(24).toString("hex");

  await pool.execute(
    `INSERT INTO oauth_states (provider, state_token, return_to, expires_at)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))`,
    [provider, token, returnTo ?? null]
  );

  return token;
};

export const consumeOAuthState = async (provider: "meta" | "google", token: string) => {
  const [rows] = await pool.query(
    `SELECT * FROM oauth_states
     WHERE provider = ? AND state_token = ? AND expires_at > NOW()
     LIMIT 1`,
    [provider, token]
  );

  const state = (rows as Array<{ id: number; return_to: string | null }>)[0];

  if (!state) {
    throw new Error("OAuth state is invalid or expired");
  }

  await pool.execute("DELETE FROM oauth_states WHERE id = ?", [state.id]);
  return state;
};

