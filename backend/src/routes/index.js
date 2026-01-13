import { Router } from "express";

import { healthRouter } from "./health.routes.js";
import { keyRouter } from "./key.routes.js";
import { profileRouter } from "./profile.routes.js";
import { extensionRouter } from "./extension.routes.js";
import { billingRouter } from "./billing.routes.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/key", keyRouter);
apiRouter.use("/profile", profileRouter);
apiRouter.use("/extension", extensionRouter);
apiRouter.use("/billing", billingRouter);
