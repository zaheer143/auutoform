import { Router } from "express";
import { requireApiKey } from "../middlewares/apiKey.middleware.js";
import { getExtensionProfile } from "../controllers/extension.controller.js";

export const extensionRouter = Router();

/**
 * Billing gate:
 * - Blocks revoked keys
 * - Blocks inactive/expired keys (402)
 * - Allows active keys through to controller
 *
 * NOTE:
 * requireApiKey must attach the ApiKey record to req.apiKey or req.apiKeyRecord
 */
function requireActiveSubscription(req, res, next) {
  const apiKeyRecord = req.apiKeyRecord || req.apiKey;

  if (!apiKeyRecord) {
    // If this happens, your requireApiKey middleware isn't attaching the record.
    return res.status(500).json({
      error: "APIKEY_MIDDLEWARE_MISCONFIG",
      message: "API key record not found on request. Check requireApiKey middleware.",
    });
  }

  // revoked => unauthorized (rotation/disabled)
  if (apiKeyRecord.revokedAt) {
    return res.status(401).json({
      error: "KEY_REVOKED",
      message: "API key was revoked. Rotate API key and update extension.",
    });
  }

  // inactive/expired => payment required
  const activeUntil = apiKeyRecord.activeUntil ? new Date(apiKeyRecord.activeUntil) : null;
  const now = new Date();

  if (!apiKeyRecord.isActive || !activeUntil || activeUntil <= now) {
    return res.status(402).json({
      error: "PAYMENT_REQUIRED",
      message: "API key inactive or expired. Please pay to activate.",
      activeUntil: apiKeyRecord.activeUntil || null,
    });
  }

  return next();
}

extensionRouter.get("/profile", requireApiKey, requireActiveSubscription, getExtensionProfile);
