import { prisma } from "../db/prisma.js";
import { hashToken } from "../utils/token.js";

const API_KEY_HEADER = "x-api-key";

export async function requireApiKey(req, res, next) {
  try {
    // 1) Prefer x-api-key header (extension-friendly)
    const headerKey =
      req.headers[API_KEY_HEADER] || req.headers[API_KEY_HEADER.toLowerCase()];

    // 2) Fallback to Authorization: Bearer <token>
    const auth = req.headers.authorization || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    const bearerKey = m?.[1];

    const token = (headerKey || bearerKey || "").toString().trim();

    if (!token) {
      return res.status(401).json({
        ok: false,
        error: "Missing API key. Send header x-api-key: <key> or Authorization: Bearer <key>",
      });
    }

    const tokenHash = hashToken(token);

    const key = await prisma.apiKey.findUnique({
      where: { tokenHash },
    });

    if (!key) {
      return res.status(401).json({ ok: false, error: "Invalid API key" });
    }

    if (key.revokedAt) {
      return res.status(401).json({
        ok: false,
        error: "API key revoked. Rotate API key and update extension.",
      });
    }

    // ✅ Attach full record for billing gate + downstream handlers
    req.apiKeyRecord = key;

    // ✅ Keep existing behavior for controllers
    req.user = { id: key.userId };

    return next();
  } catch (err) {
    return next(err);
  }
}
