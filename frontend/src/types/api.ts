// ─── Auth ─────────────────────────────────────────────────────────────────────

export type Role = 'DIRECTOR' | 'MISSION_LEAD' | 'CREW_MEMBER'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: Role
  orgId: string
  orgName: string
  orgSlug: string
}

export interface LoginResponse {
  token: string
  user: AuthUser
}

// ─── Skills ───────────────────────────────────────────────────────────────────

export interface Skill {
  id: string
  name: string
  category: string
  orgId: string
}

export interface CrewSkill {
  proficiencyLevel: number
  skill: Pick<Skill, 'id' | 'name' | 'category'>
}

// ─── Availability ─────────────────────────────────────────────────────────────

export interface Availability {
  id: string
  startDate: string
  endDate: string
  reason: string | null
}

// ─── Crew ─────────────────────────────────────────────────────────────────────

export interface CrewMember {
  id: string
  name: string
  email: string
  role: Role
  skills: CrewSkill[]
}

export interface CrewMemberDetail extends CrewMember {
  availability: Availability[]
}

// ─── Missions ─────────────────────────────────────────────────────────────────

export type MissionStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'

export interface MissionRequirement {
  id: string
  skillId: string
  minProficiency: number
  headcount: number
  skill: Pick<Skill, 'id' | 'name' | 'category'>
  assignments: MissionAssignment[]
}

export interface MissionAssignment {
  id: string
  assignedAt: string
  missionRequirementId: string | null
  user: Pick<AuthUser, 'id' | 'name' | 'email' | 'role'>
}

export interface Mission {
  id: string
  name: string
  description: string | null
  startDate: string
  endDate: string
  status: MissionStatus
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
  orgId: string
  createdBy: { id: string; name: string; email: string }
  requirements: MissionRequirement[]
  assignments: MissionAssignment[]
}
