import { Router } from "express";
import { requireApiKey } from "../middlewares/apiKey.middleware.js";
import { getExtensionProfile } from "../controllers/extension.controller.js";

export const extensionRouter = Router();

extensionRouter.get("/profile", requireApiKey, getExtensionProfile);
