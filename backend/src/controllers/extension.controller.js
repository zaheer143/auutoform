import { prisma } from "../db/prisma.js";

export async function getExtensionProfile(req, res, next) {
  try {
    const userId = req.user.id;

    const profile = await prisma.profile.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" }
    });

    if (!profile) {
      return res.status(404).json({ ok: false, error: "No profile found" });
    }

    // Send only fields extension needs (avoid leaking internal IDs)
    const safeProfile = {
      fullName: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      address: profile.address,
      city: profile.city,
      state: profile.state,
      country: profile.country,
      linkedin: profile.linkedin,
      github: profile.github,
      website: profile.website,
      yearsExp: profile.yearsExp,
      currentCtc: profile.currentCtc,
      expectedCtc: profile.expectedCtc,
      noticePeriod: profile.noticePeriod,
      summary: profile.summary
    };

    res.json({ ok: true, profile: safeProfile });
  } catch (err) {
    next(err);
  }
}
