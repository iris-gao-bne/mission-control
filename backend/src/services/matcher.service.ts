import { prisma } from "../lib/prisma";
import { AssignInput } from "../types/mission";

// ─── Constants ────────────────────────────────────────────────────────────────

// Max active IN_PROGRESS assignments before workload score hits zero
const WORKLOAD_CEILING = 3;

// ─── Error class ─────────────────────────────────────────────────────────────

export class MatcherError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// ─── Response types ───────────────────────────────────────────────────────────

export interface CandidateScore {
  userId: string;
  name: string;
  email: string;
  proficiency: number;
  score: number;
  breakdown: { proficiency: number; availability: number; workload: number };
  assigned: boolean;
}

export interface RequirementMatch {
  requirementId: string;
  skill: { id: string; name: string; category: string };
  minProficiency: number;
  headcount: number;
  suggestions: CandidateScore[];
  filled: number;
  unfilled: number;
  gap?: string;
}

export interface MatchResult {
  missionId: string;
  fullyMatched: boolean;
  requirements: RequirementMatch[];
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreProficiency(level: number): number {
  return (level / 5) * 40;
}

function scoreAvailability(
  blackouts: { startDate: Date; endDate: Date }[],
  missionStart: Date,
  missionEnd: Date,
): number {
  const blocked = blackouts.some(
    (b) => b.startDate <= missionEnd && b.endDate >= missionStart,
  );
  return blocked ? 0 : 30;
}

function scoreWorkload(activeCount: number): number {
  return Math.max(0, 30 * (1 - activeCount / WORKLOAD_CEILING));
}

// ─── Matcher ──────────────────────────────────────────────────────────────────

export async function runMatcher(
  missionId: string,
  orgId: string,
): Promise<MatchResult> {
  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
    include: { requirements: { include: { skill: true } } },
  });

  if (!mission || mission.orgId !== orgId) {
    throw new MatcherError(404, "Mission not found");
  }
  if (mission.status !== "APPROVED") {
    throw new MatcherError(409, "Matcher can only be run on APPROVED missions");
  }
  if (mission.requirements.length === 0) {
    return { missionId, fullyMatched: true, requirements: [] };
  }

  // Load crew with skills, current blackout windows, and active mission count
  const crew = await prisma.user.findMany({
    where: { orgId, role: "CREW_MEMBER" },
    include: {
      skills: true,
      availability: true,
      // Count only IN_PROGRESS assignments for workload score
      assignments: {
        where: { mission: { status: "IN_PROGRESS" } },
        select: { id: true },
      },
    },
  });

  type ScoredPair = {
    reqId: string;
    userId: string;
    proficiency: number;
    score: number;
    breakdown: { proficiency: number; availability: number; workload: number };
    assigned: boolean;
  };

  // Build all valid (requirement, candidate) pairs
  const allPairs: ScoredPair[] = [];

  for (const req of mission.requirements) {
    for (const candidate of crew) {
      const crewSkill = candidate.skills.find((s) => s.skillId === req.skillId);
      if (!crewSkill || crewSkill.proficiencyLevel < req.minProficiency)
        continue;

      const pScore = scoreProficiency(crewSkill.proficiencyLevel);
      const aScore = scoreAvailability(
        candidate.availability,
        mission.startDate,
        mission.endDate,
      );
      const wScore = scoreWorkload(candidate.assignments.length);

      allPairs.push({
        reqId: req.id,
        userId: candidate.id,
        proficiency: crewSkill.proficiencyLevel,
        score: Math.round(pScore + aScore + wScore),
        breakdown: {
          proficiency: Math.round(pScore),
          availability: Math.round(aScore),
          workload: Math.round(wScore),
        },
        assigned: false,
      });
    }
  }

  // Sort globally by score descending — highest score gets first pick
  allPairs.sort((a, b) => b.score - a.score);

  // Greedy assignment with global pool depletion
  // Once a candidate is assigned to any requirement they leave the pool entirely
  const assignedCandidates = new Set<string>();
  const filledSlots = new Map<string, number>(
    mission.requirements.map((r) => [r.id, 0]),
  );

  for (const pair of allPairs) {
    if (assignedCandidates.has(pair.userId)) continue;
    const filled = filledSlots.get(pair.reqId)!;
    const req = mission.requirements.find((r) => r.id === pair.reqId)!;
    if (filled >= req.headcount) continue;

    assignedCandidates.add(pair.userId);
    filledSlots.set(pair.reqId, filled + 1);
    pair.assigned = true;
  }

  // Build per-requirement response — all valid candidates with assigned flag
  const crewById = new Map(crew.map((c) => [c.id, c]));

  const requirements: RequirementMatch[] = mission.requirements.map((req) => {
    const suggestions: CandidateScore[] = allPairs
      .filter((p) => p.reqId === req.id)
      .map((p) => ({
        userId: p.userId,
        name: crewById.get(p.userId)!.name,
        email: crewById.get(p.userId)!.email,
        proficiency: p.proficiency,
        score: p.score,
        breakdown: p.breakdown,
        assigned: p.assigned,
      }))
      // Assigned candidates first, then by score descending
      .sort((a, b) => {
        if (a.assigned !== b.assigned) return a.assigned ? -1 : 1;
        return b.score - a.score;
      });

    const filled = filledSlots.get(req.id)!;
    const unfilled = req.headcount - filled;

    const result: RequirementMatch = {
      requirementId: req.id,
      skill: {
        id: req.skill.id,
        name: req.skill.name,
        category: req.skill.category,
      },
      minProficiency: req.minProficiency,
      headcount: req.headcount,
      suggestions,
      filled,
      unfilled,
    };

    if (unfilled > 0) {
      result.gap =
        suggestions.length === 0
          ? "No candidates meet the minimum proficiency requirement"
          : "Insufficient available candidates to fill all slots";
    }

    return result;
  });

  return {
    missionId,
    fullyMatched: requirements.every((r) => r.unfilled === 0),
    requirements,
  };
}

// ─── Assign ───────────────────────────────────────────────────────────────────

export async function commitAssignments(
  missionId: string,
  input: AssignInput,
  orgId: string,
) {
  const mission = await prisma.mission.findUnique({ where: { id: missionId } });
  if (!mission || mission.orgId !== orgId) {
    throw new MatcherError(404, "Mission not found");
  }
  if (mission.status !== "APPROVED") {
    throw new MatcherError(
      409,
      "Assignments can only be committed on APPROVED missions",
    );
  }

  const { assignments } = input;

  if (assignments.length > 0) {
    // Validate all userIds belong to this org and are crew members
    const userIds = [...new Set(assignments.map((a) => a.userId))];
    const validUsers = await prisma.user.findMany({
      where: { id: { in: userIds }, orgId, role: "CREW_MEMBER" },
      select: { id: true },
    });
    if (validUsers.length !== userIds.length) {
      throw new MatcherError(
        400,
        "One or more users not found or are not crew members in this organisation",
      );
    }

    // Validate any provided requirementIds belong to this mission
    const reqIds = [
      ...new Set(
        assignments.filter((a) => a.requirementId).map((a) => a.requirementId!),
      ),
    ];
    if (reqIds.length > 0) {
      const validReqs = await prisma.missionRequirement.findMany({
        where: { id: { in: reqIds }, missionId },
        select: { id: true },
      });
      if (validReqs.length !== reqIds.length) {
        throw new MatcherError(
          400,
          "One or more requirement IDs are invalid for this mission",
        );
      }
    }
  }

  // Replace all assignments atomically
  await prisma.$transaction(async (tx) => {
    await tx.missionAssignment.deleteMany({ where: { missionId } });
    if (assignments.length > 0) {
      await tx.missionAssignment.createMany({
        data: assignments.map((a) => ({
          missionId,
          userId: a.userId,
          missionRequirementId: a.requirementId ?? null,
        })),
      });
    }
  });
}
