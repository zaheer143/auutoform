import express from "express";
import crypto from "crypto";
import { db } from "../db/db.js";

export const keyRouter = express.Router();

/**
 * POST /api/key
 * Creates a new API key only.
 *
 * Response:
 * { apiKey: "<plain_key>" }
 */
keyRouter.post("/", async (req, res) => {
  try {
    // Generate a strong random key (64 hex chars)
    const apiKey = crypto.randomBytes(32).toString("hex");

    // Insert into api_keys (your table must have: api_key, is_active, id default)
    const k = await db.query(
      `INSERT INTO api_keys (api_key, is_active)
       VALUES ($1, true)
       RETURNING id, api_key`,
      [apiKey]
    );

    return res.json({ apiKey: k.rows[0].api_key });
  } catch (e) {
    console.error("POST /api/key error:", e);
    return res.status(500).json({ error: "Failed to create API key" });
  }
});

/**
 * POST /api/key/rotate
 * Creates a NEW key and disables the old one.
 * Requires x-api-key header (old key).
 */
keyRouter.post("/rotate", async (req, res) => {
  try {
    const oldKey = (req.headers["x-api-key"] || "").trim();
    if (!oldKey) return res.status(401).json({ error: "Missing x-api-key" });

    const old = await db.query(
      `SELECT id FROM api_keys WHERE api_key = $1 AND is_active = true LIMIT 1`,
      [oldKey]
    );
    if (!old.rows.length) return res.status(401).json({ error: "Invalid API key" });

    const newKey = crypto.randomBytes(32).toString("hex");

    await db.query("BEGIN");

    // disable old
    await db.query(`UPDATE api_keys SET is_active = false WHERE id = $1`, [old.rows[0].id]);

    // create new
    await db.query(
      `INSERT INTO api_keys (api_key, is_active)
       VALUES ($1, true)`,
      [newKey]
    );

    await db.query("COMMIT");

    return res.json({ apiKey: newKey });
  } catch (e) {
    await db.query("ROLLBACK").catch(() => {});
    console.error("POST /api/key/rotate error:", e);
    return res.status(500).json({ error: "Failed to rotate API key" });
  }
});
