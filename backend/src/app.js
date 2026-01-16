import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { apiLimiter } from "./middlewares/rateLimit.js";
import { notFound, errorHandler } from "./middlewares/error.middleware.js";

import { healthRouter } from "./routes/health.routes.js";
import { profileRouter } from "./routes/profile.routes.js";
import { keyRouter } from "./routes/key.routes.js";
import { extensionRouter } from "./routes/extension.routes.js";
import { billingRouter } from "./routes/billing.routes.js";

export function createApp() {
  const app = express();

  // ✅ REQUIRED on Railway / any proxy (fixes express-rate-limit X-Forwarded-For error)
  app.set("trust proxy", 1);

  const allowedOrigins = new Set([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);

  app.use(helmet());

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || origin === "null") return callback(null, true);
        if (allowedOrigins.has(origin)) return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
      credentials: false,
      optionsSuccessStatus: 204,
    })
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));

  // rate limit all /api routes
  app.use("/api", apiLimiter);

  // routes
  app.use("/api/health", healthRouter);
  app.use("/api/profile", profileRouter);
  app.use("/api/key", keyRouter);
  app.use("/api/extension", extensionRouter);
  app.use("/api/billing", billingRouter);

  // 404 + errors
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
