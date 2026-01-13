import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),

  DATABASE_URL: z.string().min(10),
  CORS_ORIGIN: z.string().min(4)
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // Fail fast. This prevents “works locally, breaks on Railway”.
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
