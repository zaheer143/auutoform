import express from "express";
import { db } from "../db/db.js";

export const profileRouter = express.Router();

/**
 * Resolve api_key_id from x-api-key header
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

    req.api_key_id = r.rows[0].id;
    return next();
  } catch (e) {
    console.error("API key lookup error:", e);
    return res.status(500).json({ error: "Auth failed" });
  }
}

/**
 * GET /api/profile
 * Returns the profile for the given API key.
 */
profileRouter.get("/", requireApiKey, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT *
       FROM profiles
       WHERE api_key_id = $1
       LIMIT 1`,
      [req.api_key_id]
    );

    return res.json({ profile: r.rows[0] || null });
  } catch (e) {
    console.error("GET /api/profile error:", e);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
});

/**
 * POST /api/profile
 * Creates or updates the profile for the given API key.
 * (Profile is created ONLY when user saves details — not during /api/key.)
 */
profileRouter.post("/", requireApiKey, async (req, res) => {
  try {
    // Only allow known fields (extend anytime)
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
      "portfolio_url",
      "education",
      "work_authorization",
      "preferred_locations",
      "relocation"
    ];

    const body = req.body || {};
    const fields = [];
    const values = [req.api_key_id]; // $1 reserved for api_key_id
    let idx = 2;

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        fields.push(key);
        values.push(body[key]);
        idx++;
      }
    }

    // If user sent nothing, don’t create junk rows
    if (fields.length === 0) {
      return res.status(400).json({ error: "No valid profile fields provided" });
    }

    // Build an upsert:
    // - inserts api_key_id + provided fields
    // - on conflict(api_key_id) updates only provided fields
    const insertCols = ["api_key_id", ...fields];
    const insertParams = insertCols.map((_, i) => `$${i + 1}`);

    const updateSet = fields.map((c) => `${c} = EXCLUDED.${c}`).join(", ");

    const q = `
      INSERT INTO profiles (${insertCols.join(", ")})
      VALUES (${insertParams.join(", ")})
      ON CONFLICT (api_key_id)
      DO UPDATE SET ${updateSet}
      RETURNING *;
    `;

    const r = await db.query(q, values);

    return res.json({ profile: r.rows[0] });
  } catch (e) {
    console.error("POST /api/profile error:", e);
    return res.status(500).json({ error: "Failed to save profile" });
  }
});
