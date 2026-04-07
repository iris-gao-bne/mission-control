import { z } from "zod";

export const skillEntrySchema = z.object({
  skillId: z.string().cuid(),
  proficiencyLevel: z.number().int().min(1).max(5),
});

export const replaceSkillsSchema = z
  .object({ skills: z.array(skillEntrySchema) })
  .refine(
    (d) => new Set(d.skills.map((s) => s.skillId)).size === d.skills.length,
    { message: "Duplicate skill entries are not allowed", path: ["skills"] },
  );

export const availabilityEntrySchema = z
  .object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    reason: z.string().max(200).optional(),
  })
  .refine((d) => new Date(d.endDate) > new Date(d.startDate), {
    message: "endDate must be after startDate",
    path: ["endDate"],
  });

export const replaceAvailabilitySchema = z.object({
  availability: z.array(availabilityEntrySchema),
});

export const createSkillSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(100),
});

export type SkillEntry = z.infer<typeof skillEntrySchema>;
export type ReplaceSkillsInput = z.infer<typeof replaceSkillsSchema>;
export type AvailabilityEntry = z.infer<typeof availabilityEntrySchema>;
export type ReplaceAvailabilityInput = z.infer<
  typeof replaceAvailabilitySchema
>;
export type CreateSkillInput = z.infer<typeof createSkillSchema>;
