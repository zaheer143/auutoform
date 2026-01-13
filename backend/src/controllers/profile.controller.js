import { z } from "zod";
import * as profileService from "../services/profile.service.js";

const UpdateProfileSchema = z.object({
  label: z.string().min(1).max(60).optional(),

  fullName: z.string().max(120).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  state: z.string().max(80).optional().nullable(),
  country: z.string().max(80).optional().nullable(),
  linkedin: z.string().max(200).optional().nullable(),
  github: z.string().max(200).optional().nullable(),
  website: z.string().max(200).optional().nullable(),
  yearsExp: z.string().max(20).optional().nullable(),
  currentCtc: z.string().max(40).optional().nullable(),
  expectedCtc: z.string().max(40).optional().nullable(),
  noticePeriod: z.string().max(40).optional().nullable(),
  summary: z.string().max(2000).optional().nullable()
});

export async function getOrCreateDefaultProfile(_req, res, next, userId) {
  try {
    const profile = await profileService.getOrCreateDefaultProfile(userId);
    res.json({ ok: true, profile });
  } catch (e) {
    next(e);
  }
}

export async function updateProfile(req, res, next, userId) {
  try {
    const parsed = UpdateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: "Invalid payload",
        details: parsed.error.flatten().fieldErrors
      });
    }

    const profile = await profileService.updateDefaultProfile(userId, parsed.data);
    res.json({ ok: true, profile });
  } catch (e) {
    next(e);
  }
}
