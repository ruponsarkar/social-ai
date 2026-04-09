import type { Request, Response } from "express";
import { pool } from "../db/pool.js";

export const getKeywords = async (_req: Request, res: Response) => {
  const [rows] = await pool.query("SELECT * FROM keywords ORDER BY created_at DESC");
  res.json(rows);
};

export const createKeyword = async (req: Request, res: Response) => {
  const { keyword, category } = req.body as { keyword: string; category: string };

  await pool.execute(
    "INSERT INTO keywords (keyword, category) VALUES (?, ?)",
    [keyword, category || "general"]
  );

  res.status(201).json({ message: "Keyword created" });
};

