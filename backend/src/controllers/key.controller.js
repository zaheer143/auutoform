import { prisma } from "../db/prisma.js";
import { generateToken, hashToken } from "../utils/token.js";

export async function createKey(_req, res, next, userId) {
  try {
    // Ensure demo user exists (v0)
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId }
    });

    // Generate token and store only hash
    const token = generateToken();
    const tokenHash = hashToken(token);

    await prisma.apiKey.create({
      data: {
        userId,
        tokenHash,
        label: "Extension"
      }
    });

    // Return RAW token ONCE
    res.json({ ok: true, apiKey: token });
  } catch (err) {
    next(err);
  }
}
