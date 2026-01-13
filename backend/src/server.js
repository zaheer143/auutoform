import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { prisma } from "./db/prisma.js";
import { billingRouter } from "./routes/billing.routes.js";

const app = createApp();

/**
 * Mount routes BEFORE listen
 */
app.use("/api/billing", billingRouter);

/**
 * Start server
 */
app.listen(env.PORT, () => {
  console.log(`✅ Backend running on http://localhost:${env.PORT}`);
});

/**
 * Graceful shutdown
 */
process.on("SIGINT", async () => {
  console.log("🛑 Shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});
