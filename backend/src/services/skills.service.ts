import { prisma } from "../lib/prisma";
import { CreateSkillInput } from "../types/crew";

export class SkillError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function listSkills(orgId: string) {
  return prisma.skill.findMany({
    where: { orgId },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

export async function createSkill(input: CreateSkillInput, orgId: string) {
  const existing = await prisma.skill.findUnique({
    where: { name_orgId: { name: input.name, orgId } },
  });
  if (existing) {
    throw new SkillError(
      409,
      "A skill with this name already exists in this organisation",
    );
  }
  return prisma.skill.create({ data: { ...input, orgId } });
}

export async function deleteSkill(skillId: string, orgId: string) {
  const skill = await prisma.skill.findUnique({ where: { id: skillId } });
  if (!skill || skill.orgId !== orgId) {
    throw new SkillError(404, "Skill not found");
  }

  const [crewSkillCount, requirementCount] = await Promise.all([
    prisma.crewSkill.count({ where: { skillId } }),
    prisma.missionRequirement.count({ where: { skillId } }),
  ]);

  if (crewSkillCount > 0 || requirementCount > 0) {
    throw new SkillError(409, "Skill is in use and cannot be deleted");
  }

  await prisma.skill.delete({ where: { id: skillId } });
}
