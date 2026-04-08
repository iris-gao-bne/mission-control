import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { replaceSkillsSchema, replaceAvailabilitySchema } from "../types/crew";
import {
  listCrew,
  getCrewMember,
  replaceSkills,
  replaceAvailability,
  updateAssignmentStatus,
  CrewError,
} from "../services/crew.service";
import { z } from "zod";

const assignmentStatusSchema = z.object({
  status: z.enum(["CONFIRMED", "DECLINED"]),
});

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
      res.status(400).json({
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
      res.status(400).json({
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

// PATCH /api/crew/:id/assignments/:assignmentId — crew member only
crewRouter.patch(
  "/:id/assignments/:assignmentId",
  async (req: Request, res: Response): Promise<void> => {
    const parsed = assignmentStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }
    try {
      res.json(
        await updateAssignmentStatus(
          req.params.id,
          req.params.assignmentId,
          parsed.data.status,
          req.user!,
        ),
      );
    } catch (err) {
      handleError(res, err);
    }
  },
);
