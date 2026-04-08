// ─── Auth ─────────────────────────────────────────────────────────────────────

export type Role = "DIRECTOR" | "MISSION_LEAD" | "CREW_MEMBER";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  orgId: string;
  orgName: string;
  orgSlug: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

// ─── Skills ───────────────────────────────────────────────────────────────────

export interface Skill {
  id: string;
  name: string;
  category: string;
  orgId: string;
}

export interface CrewSkill {
  proficiencyLevel: number;
  skill: Pick<Skill, "id" | "name" | "category">;
}

// ─── Availability ─────────────────────────────────────────────────────────────

export interface Availability {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
}

// ─── Crew ─────────────────────────────────────────────────────────────────────

export interface CrewMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  skills: CrewSkill[];
}

export interface CrewMemberDetail extends CrewMember {
  availability: Availability[];
}

// ─── Missions ─────────────────────────────────────────────────────────────────

export type MissionStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface MissionRequirement {
  id: string;
  skillId: string;
  minProficiency: number;
  headcount: number;
  skill: Pick<Skill, "id" | "name" | "category">;
  // assignments are not nested here — group from Mission.assignments by missionRequirementId
}

export interface MissionAssignment {
  id: string;
  assignedAt: string;
  missionRequirementId: string | null;
  user: Pick<AuthUser, "id" | "name" | "email" | "role">;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface PendingApproval {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  createdBy: { id: string; name: string; email: string };
}

export interface MissionSummary {
  id: string;
  name: string;
  status: MissionStatus;
  startDate: string;
  endDate: string;
}

export interface CrewStats {
  total: number;
  onActiveMissions: number;
  onLeave: number;
  available: number;
  skillDepth: number;
}

export interface OrgDashboardData {
  missionsByStatus: Record<MissionStatus, number>;
  pendingApprovals?: PendingApproval[]; // Director only
  upcomingMissions: MissionSummary[];
  crew: CrewStats;
  missionsNeedingCrew: number;
}

export interface CrewDashboardData {
  myMissions: MissionSummary[];
  myNextMission: MissionSummary | null;
}

export type DashboardData = OrgDashboardData | CrewDashboardData;

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isOrgDashboard(d: DashboardData): d is OrgDashboardData {
  return "missionsByStatus" in d;
}

export function isCrewDashboard(d: DashboardData): d is CrewDashboardData {
  return "myMissions" in d;
}

// ─── Missions ─────────────────────────────────────────────────────────────────

export interface Mission {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  status: MissionStatus;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  orgId: string;
  createdBy: { id: string; name: string; email: string };
  requirements: MissionRequirement[];
  assignments: MissionAssignment[];
}
