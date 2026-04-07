import { prisma } from "../lib/prisma";
import { AuthUser } from "../middleware/auth";
import { ROLES } from "../types/role";
import { ReplaceSkillsInput, ReplaceAvailabilityInput } from "../types/crew";

export class CrewError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// ─── Shared selects ───────────────────────────────────────────────────────────

const skillsSelect = {
  skills: {
    select: {
      proficiencyLevel: true,
      skill: { select: { id: true, name: true, category: true } },
    },
  },
} as const;

const listSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  ...skillsSelect,
} as const;

// ─── Guards ───────────────────────────────────────────────────────────────────

async function assertCanRead(targetUserId: string, requestingUser: AuthUser) {
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target || target.orgId !== requestingUser.orgId) {
    throw new CrewError(404, "User not found");
  }
  if (
    requestingUser.role === ROLES.CREW_MEMBER &&
    requestingUser.id !== targetUserId
  ) {
    throw new CrewError(404, "User not found");
  }
  return target;
}

async function assertCanWrite(targetUserId: string, requestingUser: AuthUser) {
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target || target.orgId !== requestingUser.orgId) {
    throw new CrewError(404, "User not found");
  }
  if (requestingUser.id !== targetUserId) {
    throw new CrewError(403, "You can only update your own profile");
  }
  return target;
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function listCrew(requestingUser: AuthUser) {
  const { orgId, role, id: userId } = requestingUser;

  const where =
    role === ROLES.CREW_MEMBER
      ? { orgId, id: userId, role: ROLES.CREW_MEMBER }
      : { orgId, role: ROLES.CREW_MEMBER };

  return prisma.user.findMany({
    where,
    select: listSelect,
    orderBy: { name: "asc" },
  });
}

export async function getCrewMember(
  targetUserId: string,
  requestingUser: AuthUser,
) {
  await assertCanRead(targetUserId, requestingUser);

  return prisma.user.findUniqueOrThrow({
    where: { id: targetUserId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      ...skillsSelect,
      availability: { orderBy: { startDate: "asc" } },
    },
  });
}

export async function replaceSkills(
  targetUserId: string,
  input: ReplaceSkillsInput,
  requestingUser: AuthUser,
) {
  await assertCanWrite(targetUserId, requestingUser);

  if (input.skills.length > 0) {
    const found = await prisma.skill.findMany({
      where: {
        id: { in: input.skills.map((s) => s.skillId) },
        orgId: requestingUser.orgId,
      },
      select: { id: true },
    });
    if (found.length !== input.skills.length) {
      throw new CrewError(
        400,
        "One or more skills not found in this organisation",
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    await tx.crewSkill.deleteMany({ where: { userId: targetUserId } });
    if (input.skills.length > 0) {
      await tx.crewSkill.createMany({
        data: input.skills.map((s) => ({
          userId: targetUserId,
          skillId: s.skillId,
          proficiencyLevel: s.proficiencyLevel,
        })),
      });
    }
    return tx.user.findUniqueOrThrow({
      where: { id: targetUserId },
      select: listSelect,
    });
  });
}

export async function replaceAvailability(
  targetUserId: string,
  input: ReplaceAvailabilityInput,
  requestingUser: AuthUser,
) {
  await assertCanWrite(targetUserId, requestingUser);

  return prisma.$transaction(async (tx) => {
    await tx.availability.deleteMany({ where: { userId: targetUserId } });
    if (input.availability.length > 0) {
      await tx.availability.createMany({
        data: input.availability.map((a) => ({
          userId: targetUserId,
          startDate: new Date(a.startDate),
          endDate: new Date(a.endDate),
          reason: a.reason,
        })),
      });
    }
    return tx.user.findUniqueOrThrow({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        ...skillsSelect,
        availability: { orderBy: { startDate: "asc" } },
      },
    });
  });
}
