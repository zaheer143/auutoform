import { Router } from "express";
import { createKey } from "../controllers/key.controller.js";

export const keyRouter = Router();

// v0: demo user only (we add real OTP auth later)
const DEMO_USER_ID = "demo_user_1";

keyRouter.post("/create", (req, res, next) =>
  createKey(req, res, next, DEMO_USER_ID)
);
