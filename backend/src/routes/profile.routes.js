import { Router } from "express";
import {
  getOrCreateDefaultProfile,
  updateProfile
} from "../controllers/profile.controller.js";

export const profileRouter = Router();

// TEMP for v0: one hardcoded user. In v1 we add OTP auth and use real userId.
const DEMO_USER_ID = "demo_user_1";

profileRouter.get("/", (req, res, next) =>
  getOrCreateDefaultProfile(req, res, next, DEMO_USER_ID)
);

profileRouter.put("/", (req, res, next) =>
  updateProfile(req, res, next, DEMO_USER_ID)
);
