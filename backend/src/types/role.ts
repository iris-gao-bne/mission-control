export const ROLES = {
  DIRECTOR: "DIRECTOR",
  MISSION_LEAD: "MISSION_LEAD",
  CREW_MEMBER: "CREW_MEMBER",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
