import { z } from "zod";

export const requirementSchema = z.object({
  skillId: z.string().cuid(),
  minProficiency: z.number().int().min(1).max(5),
  headcount: z.number().int().min(1).default(1),
});

export const createMissionSchema = z
  .object({
    name: z.string().min(1).max(100),
    description: z.string().max(1000).optional(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    requirements: z.array(requirementSchema).default([]),
  })
  .refine((d) => new Date(d.endDate) > new Date(d.startDate), {
    message: "endDate must be after startDate",
    path: ["endDate"],
  });

export const updateMissionSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(1000).nullable().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    requirements: z.array(requirementSchema).optional(),
  })
  .refine(
    (d) => {
      if (d.startDate && d.endDate)
        return new Date(d.endDate) > new Date(d.startDate);
      return true;
    },
    { message: "endDate must be after startDate", path: ["endDate"] },
  );

export const MISSION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

export const transitionSchema = z.object({
  to: z.enum(MISSION_STATUSES),
  reason: z.string().max(500).optional(),
});

export type CreateMissionInput = z.infer<typeof createMissionSchema>;
export type UpdateMissionInput = z.infer<typeof updateMissionSchema>;
export type RequirementInput = z.infer<typeof requirementSchema>;
export type TransitionInput = z.infer<typeof transitionSchema>;
