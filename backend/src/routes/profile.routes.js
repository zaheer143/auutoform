import express from "express";
import { db } from "../db/db.js";

export const profileRouter = express.Router();

/**
 * Auth: validate x-api-key exists and is active.
 */
async function requireApiKey(req, res, next) {
  try {
    const apiKey = (req.headers["x-api-key"] || "").toString().trim();
    if (!apiKey) return res.status(401).json({ error: "Missing x-api-key" });

    const r = await db.query(
      `SELECT id
       FROM api_keys
       WHERE api_key = $1 AND is_active = true
       LIMIT 1`,
      [apiKey]
    );

    if (!r.rows.length) return res.status(401).json({ error: "Invalid API key" });

    req.apiKey = apiKey;
    return next();
  } catch (e) {
    console.error("API key lookup error:", e);
    return res.status(500).json({ error: "Auth failed" });
  }
}

/**
 * GET /api/profile
 * Returns the profile row for this API key.
 */
profileRouter.get("/", requireApiKey, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT *
       FROM profiles
       WHERE api_key = $1
       LIMIT 1`,
      [req.apiKey]
    );

    // Return a flat object so extension can use fields directly
    return res.json(r.rows[0] || {});
  } catch (e) {
    console.error("GET /api/profile error:", e);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
});

/**
 * POST /api/profile
 * Upsert profile row keyed by api_key.
 */
profileRouter.post("/", requireApiKey, async (req, res) => {
  try {
    const allowed = [
      "first_name",
      "last_name",
      "email",
      "phone",
      "city",
      "current_company",
      "role_title",
      "total_experience_years",
      "notice_period_days",
      "current_ctc",
      "expected_ctc",
      "linkedin_url",
      "github_url",
      "portfolio_url"
    ];

    const body = req.body || {};
    const fields = [];
    const values = [req.apiKey]; // $1 = api_key

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        fields.push(key);
        values.push(body[key]);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: "No valid profile fields provided" });
    }

    const insertCols = ["api_key", ...fields, "updated_at"];
    const insertParams = insertCols.map((_, i) => `$${i + 1}`);

    // add updated_at value at end
    values.push(new Date().toISOString());

    const updateSet = [...fields.map((c) => `${c} = EXCLUDED.${c}`), "updated_at = now()"].join(", ");

    const q = `
      INSERT INTO profiles (${insertCols.join(", ")})
      VALUES (${insertParams.join(", ")})
      ON CONFLICT (api_key)
      DO UPDATE SET ${updateSet}
      RETURNING *;
    `;

    const r = await db.query(q, values);
    return res.json(r.rows[0]);
  } catch (e) {
    console.error("POST /api/profile error:", e);
    return res.status(500).json({ error: "Failed to save profile" });
  }
});
