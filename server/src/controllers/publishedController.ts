import type { Request, Response } from "express";
import { pool } from "../db/pool.js";

export const getPublishedPosts = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    // Get total count
    const [countResult] = await pool.query(
      "SELECT COUNT(*) as total FROM published_content"
    );
    const total = (countResult as Array<{ total: number }>)[0].total;

    // Get published posts with pagination
    const [rows] = await pool.query(`
      SELECT
        pc.*,
        cj.title as job_title,
        cj.content_type,
        cj.prompt_template,
        cj.target_platforms,
        cj.created_at as job_created_at
      FROM published_content pc
      LEFT JOIN content_jobs cj ON pc.job_id = cj.id
      ORDER BY pc.published_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    const publishedPosts = (rows as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      target_platforms: JSON.parse(String(row.target_platforms ?? "[]"))
    }));

    res.json({
      publishedPosts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching published posts:", error);
    res.status(500).json({ error: "Failed to fetch published posts" });
  }
};