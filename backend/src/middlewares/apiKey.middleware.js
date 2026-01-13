import { prisma } from "../db/prisma.js";
import { hashToken } from "../utils/token.js";

export async function requireApiKey(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    const token = m?.[1];

    if (!token) {
      return res.status(401).json({ ok: false, error: "Missing API key" });
    }

    const tokenHash = hashToken(token);

    const key = await prisma.apiKey.findUnique({
      where: { tokenHash }
    });

    if (!key || key.revokedAt) {
      return res.status(401).json({ ok: false, error: "Invalid API key" });
    }

    req.user = { id: key.userId };
    next();
  } catch (err) {
    next(err);
  }
}
