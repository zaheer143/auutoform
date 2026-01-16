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
 * Accept both camelCase (frontend/extension) and snake_case (DB).
 * Normalize input into snake_case keys only.
 */
function normalizeProfileBody(body) {
  const b = body || {};

  // helper: choose first defined value from a list
  const pick = (...vals) => {
    for (const v of vals) {
      if (v !== undefined) return v;
    }
    return undefined;
  };

  return {
    first_name: pick(b.first_name, b.firstName),
    last_name: pick(b.last_name, b.lastName),
    email: pick(b.email),
    phone: pick(b.phone),
    city: pick(b.city),

    current_company: pick(b.current_company, b.currentCompany),
    role_title: pick(b.role_title, b.roleTitle),

    total_experience_years: pick(b.total_experience_years, b.totalExperienceYears),
    notice_period_days: pick(b.notice_period_days, b.noticePeriodDays),

    current_ctc: pick(b.current_ctc, b.currentCtc),
    expected_ctc: pick(b.expected_ctc, b.expectedCtc),

    linkedin_url: pick(b.linkedin_url, b.linkedinUrl),
    github_url: pick(b.github_url, b.githubUrl),
    portfolio_url: pick(b.portfolio_url, b.portfolioUrl),

    education: pick(b.education),
    work_authorization: pick(b.work_authorization, b.workAuthorization),
    preferred_locations: pick(b.preferred_locations, b.preferredLocations),
    relocation: pick(b.relocation)
  };
}

/**
 * Pick only allowed DB columns from normalized body.
 * IMPORTANT: We keep values even if null, but only if the key was provided.
 * This prevents accidental wiping unless caller explicitly sends null.
 */
function pickAllowedFields(rawBody) {
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

  const normalized = normalizeProfileBody(rawBody);

  // We only include fields that were explicitly present in the incoming payload
  // in either snake_case or camelCase form.
  const incoming = rawBody || {};
  const provided = new Set(Object.keys(incoming));

  const aliasProvided = (snake, camel) =>
    provided.has(snake) || (camel && provided.has(camel));

  const snakeToCamel = {
    first_name: "firstName",
    last_name: "lastName",
    current_company: "currentCompany",
    role_title: "roleTitle",
    total_experience_years: "totalExperienceYears",
    notice_period_days: "noticePeriodDays",
    current_ctc: "currentCtc",
    expected_ctc: "expectedCtc",
    linkedin_url: "linkedinUrl",
    github_url: "githubUrl",
    portfolio_url: "portfolioUrl",
    work_authorization: "workAuthorization",
    preferred_locations: "preferredLocations"
  };

  const fields = [];
  const values = [];

  for (const key of allowed) {
    const camel = snakeToCamel[key];
    if (aliasProvided(key, camel)) {
      fields.push(key);
      values.push(normalized[key]);
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
      return res.status(400).json({
        error:
          "No valid profile fields provided. Send camelCase (firstName) or snake_case (first_name)."
      });
    }

    // IMPORTANT: profiles must have UNIQUE(api_key) (you already do)
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
 * Create/update profile.
 */
profileRouter.put("/", requireApiKey, upsertProfile);
