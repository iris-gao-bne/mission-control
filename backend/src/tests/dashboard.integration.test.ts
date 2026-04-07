import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../app";
import { prisma } from "../lib/prisma";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const PASSWORD = "password123";

const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

let orgId: string;
let leadId: string;
let crew1Id: string; // assigned to IN_PROGRESS mission, skill proficiency 4
let crew2Id: string; // skill proficiency 2 only (below skillDepth threshold)
let crew3Id: string; // on leave now, no skills
let skillAId: string;

let directorToken: string;
let leadToken: string;
let crew1Token: string;
let crew2Token: string;

async function login(slug: string, email: string) {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ slug, email, password: PASSWORD });
  return res.body.token as string;
}

beforeAll(async () => {
  const pw = await bcrypt.hash(PASSWORD, 10);

  const org = await prisma.organisation.create({
    data: { name: "Dash Org", slug: "dash-org" },
  });
  orgId = org.id;

  await prisma.user.create({
    data: {
      email: "director@dash.org",
      password: pw,
      name: "Director",
      role: "DIRECTOR",
      orgId,
    },
  });
  const lead = await prisma.user.create({
    data: {
      email: "lead@dash.org",
      password: pw,
      name: "Lead",
      role: "MISSION_LEAD",
      orgId,
    },
  });
  leadId = lead.id;
  const c1 = await prisma.user.create({
    data: {
      email: "crew1@dash.org",
      password: pw,
      name: "Crew One",
      role: "CREW_MEMBER",
      orgId,
    },
  });
  const c2 = await prisma.user.create({
    data: {
      email: "crew2@dash.org",
      password: pw,
      name: "Crew Two",
      role: "CREW_MEMBER",
      orgId,
    },
  });
  const c3 = await prisma.user.create({
    data: {
      email: "crew3@dash.org",
      password: pw,
      name: "Crew Three",
      role: "CREW_MEMBER",
      orgId,
    },
  });
  crew1Id = c1.id;
  crew2Id = c2.id;
  crew3Id = c3.id;

  const skillA = await prisma.skill.create({
    data: { name: "EVA", category: "Extravehicular", orgId },
  });
  skillAId = skillA.id;

  // crew1: proficiency 4 — counts toward skillDepth (>= 3)
  await prisma.crewSkill.create({
    data: { userId: crew1Id, skillId: skillAId, proficiencyLevel: 4 },
  });
  // crew2: proficiency 2 — does NOT count toward skillDepth
  await prisma.crewSkill.create({
    data: { userId: crew2Id, skillId: skillAId, proficiencyLevel: 2 },
  });
  // crew3: no skills

  // crew3 is on leave right now
  await prisma.availability.create({
    data: {
      userId: crew3Id,
      startDate: inDays(-1),
      endDate: inDays(10),
      reason: "Annual Leave",
    },
  });

  // ── Missions ──────────────────────────────────────────────────────────────

  // 1 DRAFT
  await prisma.mission.create({
    data: {
      name: "Draft Mission",
      startDate: inDays(60),
      endDate: inDays(70),
      status: "DRAFT",
      orgId,
      createdById: leadId,
    },
  });

  // 2 SUBMITTED — both appear in pendingApprovals
  await prisma.mission.create({
    data: {
      name: "Submitted Alpha",
      startDate: inDays(30),
      endDate: inDays(40),
      status: "SUBMITTED",
      orgId,
      createdById: leadId,
    },
  });
  await prisma.mission.create({
    data: {
      name: "Submitted Beta",
      startDate: inDays(35),
      endDate: inDays(45),
      status: "SUBMITTED",
      orgId,
      createdById: leadId,
    },
  });

  // APPROVED — starts in 15 days (within 30-day window), headcount 2 but only 1 assigned
  // → appears in upcomingMissions AND missionsNeedingCrew
  const approvedNear = await prisma.mission.create({
    data: {
      name: "Approved Near",
      startDate: inDays(15),
      endDate: inDays(25),
      status: "APPROVED",
      orgId,
      createdById: leadId,
    },
  });
  const req = await prisma.missionRequirement.create({
    data: {
      missionId: approvedNear.id,
      skillId: skillAId,
      minProficiency: 2,
      headcount: 2,
    },
  });
  // Only 1 of 2 required slots filled
  await prisma.missionAssignment.create({
    data: {
      missionId: approvedNear.id,
      userId: crew2Id,
      missionRequirementId: req.id,
    },
  });

  // APPROVED — starts in 45 days (beyond 30-day window)
  // → does NOT appear in upcomingMissions
  const approvedFar = await prisma.mission.create({
    data: {
      name: "Approved Far",
      startDate: inDays(45),
      endDate: inDays(55),
      status: "APPROVED",
      orgId,
      createdById: leadId,
    },
  });
  const req2 = await prisma.missionRequirement.create({
    data: {
      missionId: approvedFar.id,
      skillId: skillAId,
      minProficiency: 2,
      headcount: 1,
    },
  });
  // Fully staffed — does NOT count toward missionsNeedingCrew
  await prisma.missionAssignment.create({
    data: {
      missionId: approvedFar.id,
      userId: crew1Id,
      missionRequirementId: req2.id,
    },
  });

  // IN_PROGRESS — crew1 is assigned
  const active = await prisma.mission.create({
    data: {
      name: "Active Mission",
      startDate: inDays(-5),
      endDate: inDays(10),
      status: "IN_PROGRESS",
      orgId,
      createdById: leadId,
    },
  });
  await prisma.missionAssignment.create({
    data: { missionId: active.id, userId: crew1Id },
  });

  // 1 COMPLETED
  await prisma.mission.create({
    data: {
      name: "Done Mission",
      startDate: inDays(-30),
      endDate: inDays(-20),
      status: "COMPLETED",
      orgId,
      createdById: leadId,
    },
  });

  directorToken = await login("dash-org", "director@dash.org");
  leadToken = await login("dash-org", "lead@dash.org");
  crew1Token = await login("dash-org", "crew1@dash.org");
  crew2Token = await login("dash-org", "crew2@dash.org");
});

afterAll(async () => {
  await prisma.missionAssignment.deleteMany();
  await prisma.missionRequirement.deleteMany();
  await prisma.mission.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.crewSkill.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organisation.deleteMany();
  await prisma.$disconnect();
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe("GET /api/dashboard — auth", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/dashboard");
    expect(res.status).toBe(401);
  });
});

// ─── Director dashboard ───────────────────────────────────────────────────────

describe("GET /api/dashboard — Director", () => {
  let body: Record<string, any>;

  beforeAll(async () => {
    const res = await request(app)
      .get("/api/dashboard")
      .set("Authorization", `Bearer ${directorToken}`);
    expect(res.status).toBe(200);
    body = res.body;
  });

  it("returns missionsByStatus with all 7 statuses", () => {
    expect(body.missionsByStatus).toMatchObject({
      DRAFT: 1,
      SUBMITTED: 2,
      APPROVED: 2,
      IN_PROGRESS: 1,
      COMPLETED: 1,
      REJECTED: 0,
      CANCELLED: 0,
    });
  });

  it("zero-fills statuses that have no missions", () => {
    expect(body.missionsByStatus.REJECTED).toBe(0);
    expect(body.missionsByStatus.CANCELLED).toBe(0);
  });

  it("returns pendingApprovals as a list of SUBMITTED missions", () => {
    expect(body.pendingApprovals).toHaveLength(2);
  });

  it("each pending approval includes name, dates, and createdBy", () => {
    const approval = body.pendingApprovals[0];
    expect(approval.name).toBeDefined();
    expect(approval.startDate).toBeDefined();
    expect(approval.endDate).toBeDefined();
    expect(approval.createdBy.name).toBeDefined();
    expect(approval.createdBy.email).toBeDefined();
  });

  it("pendingApprovals does not include updatedAt", () => {
    expect(body.pendingApprovals[0].updatedAt).toBeUndefined();
  });

  it("returns upcomingMissions — only APPROVED within 30 days", () => {
    expect(body.upcomingMissions).toHaveLength(1);
    expect(body.upcomingMissions[0].name).toBe("Approved Near");
  });

  it("does not include APPROVED missions starting beyond 30 days in upcomingMissions", () => {
    const names = body.upcomingMissions.map((m: { name: string }) => m.name);
    expect(names).not.toContain("Approved Far");
  });

  it("returns correct crew totals", () => {
    expect(body.crew.total).toBe(3);
  });

  it("crew.onActiveMissions counts crew assigned to IN_PROGRESS missions", () => {
    // crew1 is assigned to the IN_PROGRESS mission AND approvedFar (not IN_PROGRESS), only counts once
    expect(body.crew.onActiveMissions).toBe(1);
  });

  it("crew.onLeave counts crew with a blackout window covering today", () => {
    expect(body.crew.onLeave).toBe(1); // crew3 is on leave
  });

  it("crew.available = total - onActiveMissions - onLeave", () => {
    const { total, onActiveMissions, onLeave, available } = body.crew;
    expect(available).toBe(total - onActiveMissions - onLeave);
  });

  it("crew.skillDepth counts only crew with at least one skill at proficiency >= 3", () => {
    // crew1: proficiency 4 ✓ | crew2: proficiency 2 ✗ | crew3: no skills ✗
    expect(body.crew.skillDepth).toBe(1);
  });

  it("missionsNeedingCrew counts APPROVED missions with unfilled requirement slots", () => {
    // approvedNear: headcount 2, assigned 1 → needs crew
    // approvedFar: headcount 1, assigned 1 → fully staffed
    expect(body.missionsNeedingCrew).toBe(1);
  });

  it("does not include myMissions or myNextMission", () => {
    expect(body.myMissions).toBeUndefined();
    expect(body.myNextMission).toBeUndefined();
  });
});

// ─── Mission Lead dashboard ───────────────────────────────────────────────────

describe("GET /api/dashboard — Mission Lead", () => {
  let body: Record<string, any>;

  beforeAll(async () => {
    const res = await request(app)
      .get("/api/dashboard")
      .set("Authorization", `Bearer ${leadToken}`);
    expect(res.status).toBe(200);
    body = res.body;
  });

  it("does not include pendingApprovals", () => {
    expect(body.pendingApprovals).toBeUndefined();
  });

  it("includes missionsByStatus", () => {
    expect(body.missionsByStatus).toBeDefined();
    expect(body.missionsByStatus.SUBMITTED).toBe(2);
  });

  it("includes upcomingMissions", () => {
    expect(body.upcomingMissions).toHaveLength(1);
  });

  it("includes crew snapshot", () => {
    expect(body.crew.total).toBe(3);
    expect(body.crew.skillDepth).toBe(1);
  });

  it("includes missionsNeedingCrew", () => {
    expect(body.missionsNeedingCrew).toBe(1);
  });

  it("does not include myMissions or myNextMission", () => {
    expect(body.myMissions).toBeUndefined();
    expect(body.myNextMission).toBeUndefined();
  });
});

// ─── Crew member dashboard ────────────────────────────────────────────────────

describe("GET /api/dashboard — Crew Member", () => {
  it("returns myMissions with all assigned missions", async () => {
    const res = await request(app)
      .get("/api/dashboard")
      .set("Authorization", `Bearer ${crew1Token}`);
    expect(res.status).toBe(200);
    // crew1 is assigned to IN_PROGRESS and approvedFar
    expect(res.body.myMissions).toHaveLength(2);
    const statuses = res.body.myMissions.map(
      (m: { status: string }) => m.status,
    );
    expect(statuses).toContain("IN_PROGRESS");
    expect(statuses).toContain("APPROVED");
  });

  it("myNextMission is the IN_PROGRESS mission when one exists", async () => {
    const res = await request(app)
      .get("/api/dashboard")
      .set("Authorization", `Bearer ${crew1Token}`);
    expect(res.body.myNextMission).not.toBeNull();
    expect(res.body.myNextMission.status).toBe("IN_PROGRESS");
  });

  it("returns myNextMission as null when crew has no active or upcoming assignments", async () => {
    // crew2 is assigned to approvedNear (APPROVED, 15 days away) — should return that
    // Actually crew2 IS assigned to approvedNear, so let's use crew3 who has no assignments
    const crew3Token = await request(app)
      .post("/api/auth/login")
      .send({ slug: "dash-org", email: "crew3@dash.org", password: PASSWORD })
      .then((r) => r.body.token);

    const res = await request(app)
      .get("/api/dashboard")
      .set("Authorization", `Bearer ${crew3Token}`);
    expect(res.body.myNextMission).toBeNull();
    expect(res.body.myMissions).toEqual([]);
  });

  it("myNextMission is the upcoming APPROVED mission when no IN_PROGRESS exists", async () => {
    // crew2 is assigned to approvedNear (APPROVED, 15 days away) — not IN_PROGRESS
    const res = await request(app)
      .get("/api/dashboard")
      .set("Authorization", `Bearer ${crew2Token}`);
    expect(res.body.myNextMission).not.toBeNull();
    expect(res.body.myNextMission.status).toBe("APPROVED");
    expect(res.body.myNextMission.name).toBe("Approved Near");
  });

  it("does not include org-level metrics", async () => {
    const res = await request(app)
      .get("/api/dashboard")
      .set("Authorization", `Bearer ${crew1Token}`);
    expect(res.body.missionsByStatus).toBeUndefined();
    expect(res.body.pendingApprovals).toBeUndefined();
    expect(res.body.crew).toBeUndefined();
    expect(res.body.missionsNeedingCrew).toBeUndefined();
  });

  it("each mission in myMissions includes id, name, status, startDate, endDate", async () => {
    const res = await request(app)
      .get("/api/dashboard")
      .set("Authorization", `Bearer ${crew1Token}`);
    const m = res.body.myMissions[0];
    expect(m.id).toBeDefined();
    expect(m.name).toBeDefined();
    expect(m.status).toBeDefined();
    expect(m.startDate).toBeDefined();
    expect(m.endDate).toBeDefined();
  });
});
