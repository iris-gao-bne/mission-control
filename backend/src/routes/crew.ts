import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { replaceSkillsSchema, replaceAvailabilitySchema } from "../types/crew";
import {
  listCrew,
  getCrewMember,
  replaceSkills,
  replaceAvailability,
  CrewError,
} from "../services/crew.service";

export const crewRouter = Router();

crewRouter.use(authenticate);

function handleError(res: Response, err: unknown) {
  if (err instanceof CrewError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}

// GET /api/crew
crewRouter.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await listCrew(req.user!));
  } catch (err) {
    handleError(res, err);
  }
});

// GET /api/crew/:id
crewRouter.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await getCrewMember(req.params.id, req.user!));
  } catch (err) {
    handleError(res, err);
  }
});

// PATCH /api/crew/:id/skills
crewRouter.patch(
  "/:id/skills",
  async (req: Request, res: Response): Promise<void> => {
    const parsed = replaceSkillsSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({
          error: "Invalid request",
          details: parsed.error.flatten().fieldErrors,
        });
      return;
    }
    try {
      res.json(await replaceSkills(req.params.id, parsed.data, req.user!));
    } catch (err) {
      handleError(res, err);
    }
  },
);

// PATCH /api/crew/:id/availability
crewRouter.patch(
  "/:id/availability",
  async (req: Request, res: Response): Promise<void> => {
    const parsed = replaceAvailabilitySchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({
          error: "Invalid request",
          details: parsed.error.flatten().fieldErrors,
        });
      return;
    }
    try {
      res.json(
        await replaceAvailability(req.params.id, parsed.data, req.user!),
      );
    } catch (err) {
      handleError(res, err);
    }
  },
);
