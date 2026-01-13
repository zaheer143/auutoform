import crypto from "crypto";

// Generates a random API key (shown ONCE to user)
export function generateToken() {
  return crypto.randomBytes(32).toString("hex"); // 64 chars
}

// Hash before storing in DB (never store raw token)
export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
