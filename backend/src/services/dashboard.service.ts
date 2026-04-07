import { prisma } from "../lib/prisma";
import { AuthUser } from "../middleware/auth";
import { ROLES } from "../types/role";
import { MISSION_STATUSES } from "../types/mission";

export async function getDashboard(requestingUser: AuthUser) {
  const { orgId, role, id: userId } = requestingUser;

  if (role === ROLES.CREW_MEMBER) {
    return getCrewDashboard(userId, orgId);
  }
  return getOrgDashboard(orgId, role);
}

// ─── Org-level dashboard (Director + Mission Lead) ────────────────────────────

async function getOrgDashboard(orgId: string, role: string) {
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    statusGroups,
    pendingApprovals,
    upcomingMissions,
    crewTotal,
    crewOnActiveMissions,
    crewOnLeave,
    skillDepthRows,
    approvedMissions,
  ] = await Promise.all([
    // Mission counts grouped by status
    prisma.mission.groupBy({
      by: ["status"],
      where: { orgId },
      _count: true,
    }),

    // Pending approvals — Director only, oldest first so most urgent surfaces first
    role === ROLES.DIRECTOR
      ? prisma.mission.findMany({
          where: { orgId, status: "SUBMITTED" },
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            createdBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { updatedAt: "asc" },
        })
      : null,

    // Upcoming: APPROVED missions starting within 30 days
    prisma.mission.findMany({
      where: {
        orgId,
        status: "APPROVED",
        startDate: { gte: now, lte: in30Days },
      },
      select: { id: true, name: true, startDate: true, endDate: true },
      orderBy: { startDate: "asc" },
    }),

    // Crew totals
    prisma.user.count({ where: { orgId, role: ROLES.CREW_MEMBER } }),
    prisma.user.count({
      where: {
        orgId,
        role: ROLES.CREW_MEMBER,
        assignments: { some: { mission: { status: "IN_PROGRESS" } } },
      },
    }),
    prisma.user.count({
      where: {
        orgId,
        role: ROLES.CREW_MEMBER,
        availability: {
          some: { startDate: { lte: now }, endDate: { gte: now } },
        },
      },
    }),

    // Skill depth: distinct crew members with at least one skill at proficiency >= 3
    prisma.crewSkill.findMany({
      where: {
        proficiencyLevel: { gte: 3 },
        user: { orgId, role: ROLES.CREW_MEMBER },
      },
      select: { userId: true },
      distinct: ["userId"],
    }),

    // APPROVED missions with requirement assignment counts — for gap detection
    prisma.mission.findMany({
      where: { orgId, status: "APPROVED" },
      include: {
        requirements: {
          include: { _count: { select: { assignments: true } } },
        },
      },
    }),
  ]);

  // Build missionsByStatus with zero-fill for statuses that have no missions
  const missionsByStatus = Object.fromEntries(
    MISSION_STATUSES.map((s) => [
      s,
      statusGroups.find((g) => g.status === s)?._count ?? 0,
    ]),
  );

  const crewAvailable = Math.max(
    0,
    crewTotal - crewOnActiveMissions - crewOnLeave,
  );
  const skillDepth = skillDepthRows.length;

  // A mission "needs crew" if any requirement has fewer assignments than its headcount
  const missionsNeedingCrew = approvedMissions.filter((m) =>
    m.requirements.some((r) => r._count.assignments < r.headcount),
  ).length;

  return {
    missionsByStatus,
    ...(role === ROLES.DIRECTOR && { pendingApprovals }),
    upcomingMissions,
    crew: {
      total: crewTotal,
      onActiveMissions: crewOnActiveMissions,
      onLeave: crewOnLeave,
      available: crewAvailable,
      skillDepth,
    },
    missionsNeedingCrew,
  };
}

// ─── Crew member dashboard ────────────────────────────────────────────────────

async function getCrewDashboard(userId: string, orgId: string) {
  const now = new Date();

  const myMissions = await prisma.mission.findMany({
    where: { orgId, assignments: { some: { userId } } },
    select: {
      id: true,
      name: true,
      status: true,
      startDate: true,
      endDate: true,
    },
    orderBy: { startDate: "asc" },
  });

  // Next mission: nearest APPROVED or currently IN_PROGRESS
  const myNextMission =
    myMissions.find(
      (m) =>
        (m.status === "APPROVED" && m.startDate >= now) ||
        m.status === "IN_PROGRESS",
    ) ?? null;

  return { myMissions, myNextMission };
}
