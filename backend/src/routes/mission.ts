import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import {
  createMissionSchema,
  updateMissionSchema,
  transitionSchema,
} from "../types/mission";
import {
  listMissions,
  getMission,
  createMission,
  updateMission,
  deleteMission,
  transition,
  MissionError,
} from "../services/missions.service";
import { ROLES } from "../types/role";

export const missionRouter = Router();

missionRouter.use(authenticate);

function handleError(res: Response, err: unknown) {
  if (err instanceof MissionError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}

// GET /api/missions
missionRouter.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const missions = await listMissions(req.user!);
    res.json(missions);
  } catch (err) {
    handleError(res, err);
  }
});

// POST /api/missions — Mission Lead only
missionRouter.post(
  "/",
  requireRole(ROLES.MISSION_LEAD, ROLES.DIRECTOR),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = createMissionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }
    try {
      const mission = await createMission(parsed.data, req.user!);
      res.status(201).json(mission);
    } catch (err) {
      handleError(res, err);
    }
  },
);

// GET /api/missions/:id
missionRouter.get(
  "/:id",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const mission = await getMission(req.params.id, req.user!);
      res.json(mission);
    } catch (err) {
      handleError(res, err);
    }
  },
);

// PATCH /api/missions/:id — Mission Lead only
missionRouter.patch(
  "/:id",
  requireRole(ROLES.MISSION_LEAD, ROLES.DIRECTOR),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = updateMissionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }
    try {
      const mission = await updateMission(
        req.params.id,
        parsed.data,
        req.user!,
      );
      res.json(mission);
    } catch (err) {
      handleError(res, err);
    }
  },
);

// POST /api/missions/:id/transition — all authenticated roles (permissions enforced in service)
missionRouter.post(
  "/:id/transition",
  async (req: Request, res: Response): Promise<void> => {
    const parsed = transitionSchema.safeParse(req.body);
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
      const mission = await transition(req.params.id, parsed.data, req.user!);
      res.json(mission);
    } catch (err) {
      handleError(res, err);
    }
  },
);

// DELETE /api/missions/:id — Mission Lead only
missionRouter.delete(
  "/:id",
  requireRole(ROLES.MISSION_LEAD, ROLES.DIRECTOR),
  async (req: Request, res: Response): Promise<void> => {
    try {
      await deleteMission(req.params.id, req.user!);
      res.status(204).send();
    } catch (err) {
      handleError(res, err);
    }
  },
);
