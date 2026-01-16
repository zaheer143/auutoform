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

function pickAllowedFields(body) {
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

  const data = body || {};
  const fields = [];
  const values = [];

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      fields.push(key);
      values.push(data[key]);
    }
  }

  return { fields, values };
}

/**
 * GET /api/profile
 * Returns profile row for this API key.
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

    return res.json({ profile: r.rows[0] || null });
  } catch (e) {
    console.error("GET /api/profile error:", e);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
});

/**
 * UPSERT helper used by POST and PUT
 */
async function upsertProfile(req, res) {
  try {
    const { fields, values } = pickAllowedFields(req.body);

    if (fields.length === 0) {
      return res.status(400).json({ error: "No valid profile fields provided" });
    }

    // Ensure api_key exists in table for our WHERE/UNIQUE strategy
    // IMPORTANT: profiles table must have UNIQUE(api_key) for ON CONFLICT to work
    const insertCols = ["api_key", ...fields, "updated_at"];
    const params = insertCols.map((_, i) => `$${i + 1}`);

    const insertValues = [req.apiKey, ...values, new Date().toISOString()];

    const updateSet = [
      ...fields.map((c) => `${c} = EXCLUDED.${c}`),
      "updated_at = now()"
    ].join(", ");

    const q = `
      INSERT INTO profiles (${insertCols.join(", ")})
      VALUES (${params.join(", ")})
      ON CONFLICT (api_key)
      DO UPDATE SET ${updateSet}
      RETURNING *;
    `;

    const r = await db.query(q, insertValues);
    return res.json({ profile: r.rows[0] });
  } catch (e) {
    console.error("SAVE /api/profile error:", e);
    return res.status(500).json({ error: "Failed to save profile" });
  }
}

/**
 * POST /api/profile
 * Create/update profile.
 */
profileRouter.post("/", requireApiKey, upsertProfile);

/**
 * PUT /api/profile
 * Create/update profile (frontend currently uses PUT).
 */
profileRouter.put("/", requireApiKey, upsertProfile);
