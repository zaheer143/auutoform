import { Router } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { prisma } from "../db/prisma.js";
import { hashToken } from "../utils/token.js";

export const billingRouter = Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * POST /api/billing/create-order
 * body: { apiKey: "<raw_api_key>" }
 * returns: { keyId, orderId, amount, currency }
 */
billingRouter.post("/create-order", async (req, res) => {
  try {
    const { apiKey } = req.body || {};
    if (!apiKey || String(apiKey).trim().length < 10) {
      return res.status(400).json({ ok: false, error: "apiKey required" });
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ ok: false, error: "Razorpay keys not configured" });
    }

    const tokenHash = hashToken(String(apiKey).trim());

    const keyRow = await prisma.apiKey.findUnique({
      where: { tokenHash },
    });

    if (!keyRow) {
      return res.status(404).json({ ok: false, error: "Invalid apiKey" });
    }

    if (keyRow.revokedAt) {
      return res.status(401).json({ ok: false, error: "API key revoked. Rotate and pay again." });
    }

    const priceInr = Number(process.env.PRICE_INR || 199);
    const amount = Math.round(priceInr * 100); // paise

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `autoform_${Date.now()}`,
      notes: {
        apiKeyId: keyRow.id,
        userId: keyRow.userId,
      },
    });

    return res.json({
      ok: true,
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "create-order failed",
    });
  }
});

/**
 * POST /api/billing/verify
 * body: {
 *   apiKey: "<raw_api_key>",
 *   razorpay_order_id,
 *   razorpay_payment_id,
 *   razorpay_signature
 * }
 */
billingRouter.post("/verify", async (req, res) => {
  try {
    const {
      apiKey,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body || {};

    if (!apiKey || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ ok: false, error: "Missing fields" });
    }

    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ ok: false, error: "Razorpay secret not configured" });
    }

    // ✅ Signature verification
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return res.status(400).json({ ok: false, error: "Invalid signature" });
    }

    const tokenHash = hashToken(String(apiKey).trim());
    const keyRow = await prisma.apiKey.findUnique({
      where: { tokenHash },
    });

    if (!keyRow) {
      return res.status(404).json({ ok: false, error: "Invalid apiKey" });
    }

    if (keyRow.revokedAt) {
      return res.status(401).json({ ok: false, error: "API key revoked. Rotate and pay again." });
    }

    // ✅ Activate for 30 days
    const now = new Date();
    const activeUntil = addDays(now, 30);

    await prisma.apiKey.update({
      where: { id: keyRow.id },
      data: {
        isActive: true,
        activeUntil,
        plan: "monthly",
        lastPaymentId: razorpay_payment_id,
        lastOrderId: razorpay_order_id,
      },
    });

    return res.json({
      ok: true,
      message: "Payment verified. API key activated for 30 days.",
      activeUntil,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "verify failed" });
  }
});
