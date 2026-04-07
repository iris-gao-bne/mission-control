import { prisma } from "../lib/prisma";
import { CreateMissionInput, UpdateMissionInput } from "../types/mission";
import { AuthUser } from "../middleware/auth";
import { ROLES } from "../types/role";

// ─── Shared include — used for list and detail responses ─────────────────────

const missionInclude = {
  requirements: {
    include: { skill: { select: { id: true, name: true, category: true } } },
  },
  assignments: {
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  },
  createdBy: { select: { id: true, name: true, email: true } },
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export class MissionError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function assertMissionBelongsToOrg(missionId: string, orgId: string) {
  const mission = await prisma.mission.findUnique({ where: { id: missionId } });
  if (!mission || mission.orgId !== orgId) {
    throw new MissionError(404, "Mission not found");
  }
  return mission;
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function listMissions(requestingUser: AuthUser) {
  const { orgId, role, id: userId } = requestingUser;

  // Crew members only see missions they are assigned to
  const where =
    role === ROLES.CREW_MEMBER
      ? { orgId, assignments: { some: { userId } } }
      : { orgId };

  return prisma.mission.findMany({
    where,
    include: missionInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function getMission(missionId: string, requestingUser: AuthUser) {
  const { orgId, role, id: userId } = requestingUser;

  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
    include: missionInclude,
  });

  if (!mission || mission.orgId !== orgId) {
    throw new MissionError(404, "Mission not found");
  }

  // Crew members can only view missions they are assigned to
  if (
    role === ROLES.CREW_MEMBER &&
    !mission.assignments.some((a) => a.user.id === userId)
  ) {
    throw new MissionError(404, "Mission not found");
  }

  return mission;
}

export async function createMission(
  input: CreateMissionInput,
  requestingUser: AuthUser,
) {
  const { orgId, id: createdById } = requestingUser;
  const { requirements, ...missionData } = input;

  // Validate all skills belong to this org
  if (requirements.length > 0) {
    await assertSkillsBelongToOrg(
      requirements.map((r) => r.skillId),
      orgId,
    );
  }

  return prisma.$transaction(async (tx) => {
    const mission = await tx.mission.create({
      data: {
        ...missionData,
        startDate: new Date(missionData.startDate),
        endDate: new Date(missionData.endDate),
        orgId,
        createdById,
      },
    });

    if (requirements.length > 0) {
      await tx.missionRequirement.createMany({
        data: requirements.map((r) => ({ ...r, missionId: mission.id })),
      });
    }

    return tx.mission.findUniqueOrThrow({
      where: { id: mission.id },
      include: missionInclude,
    });
  });
}

export async function updateMission(
  missionId: string,
  input: UpdateMissionInput,
  requestingUser: AuthUser,
) {
  const { orgId, id: userId } = requestingUser;
  const mission = await assertMissionBelongsToOrg(missionId, orgId);

  if (mission.status !== "DRAFT") {
    throw new MissionError(409, "Only DRAFT missions can be edited");
  }

  if (mission.createdById !== userId) {
    throw new MissionError(
      403,
      "Only the mission creator can edit this mission",
    );
  }

  const { requirements, startDate, endDate, ...fields } = input;

  // Validate dates together if only one side is changing
  const resolvedStart = startDate ? new Date(startDate) : mission.startDate;
  const resolvedEnd = endDate ? new Date(endDate) : mission.endDate;
  if (resolvedEnd <= resolvedStart) {
    throw new MissionError(400, "endDate must be after startDate");
  }

  if (requirements !== undefined && requirements.length > 0) {
    await assertSkillsBelongToOrg(
      requirements.map((r) => r.skillId),
      orgId,
    );
  }

  return prisma.$transaction(async (tx) => {
    await tx.mission.update({
      where: { id: missionId },
      data: {
        ...fields,
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
      },
    });

    // Replace requirements when provided
    if (requirements !== undefined) {
      await tx.missionRequirement.deleteMany({ where: { missionId } });
      if (requirements.length > 0) {
        await tx.missionRequirement.createMany({
          data: requirements.map((r) => ({ ...r, missionId })),
        });
      }
    }

    return tx.mission.findUniqueOrThrow({
      where: { id: missionId },
      include: missionInclude,
    });
  });
}

export async function deleteMission(
  missionId: string,
  requestingUser: AuthUser,
) {
  const { orgId, id: userId } = requestingUser;
  const mission = await assertMissionBelongsToOrg(missionId, orgId);

  if (mission.status !== "DRAFT") {
    throw new MissionError(409, "Only DRAFT missions can be deleted");
  }

  if (mission.createdById !== userId) {
    throw new MissionError(
      403,
      "Only the mission creator can delete this mission",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.missionRequirement.deleteMany({ where: { missionId } });
    await tx.mission.delete({ where: { id: missionId } });
  });
}

async function assertSkillsBelongToOrg(skillIds: string[], orgId: string) {
  const skills = await prisma.skill.findMany({
    where: { id: { in: skillIds }, orgId },
    select: { id: true },
  });
  if (skills.length !== skillIds.length) {
    throw new MissionError(
      400,
      "One or more skills not found in this organisation",
    );
  }
}
