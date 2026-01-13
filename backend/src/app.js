import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { apiLimiter } from "./middlewares/rateLimit.js";
import { notFound, errorHandler } from "./middlewares/error.middleware.js";
import { keyRouter } from "./routes/key.routes.js";
import { extensionRouter } from "./routes/extension.routes.js";


import { healthRouter } from "./routes/health.routes.js";
import { profileRouter } from "./routes/profile.routes.js";


export function createApp() {
  const app = express();
  const allowedOrigins = new Set([
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ]);

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        // origin is undefined for curl/postman, and 'null' for file://
        if (!origin || origin === "null") return callback(null, true);
        if (allowedOrigins.has(origin)) return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: false
    })
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));
  app.use("/api", apiLimiter);

  app.use("/api/health", healthRouter);
  app.use("/api/profile", profileRouter);
  app.use("/api/key", keyRouter);
  app.use("/api/extension", extensionRouter);


  app.use(notFound);
  app.use(errorHandler);

  return app;
}
