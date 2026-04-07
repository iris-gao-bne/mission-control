import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../app";
import { prisma } from "../lib/prisma";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const PASSWORD = "password123";

let orgId: string;
let orgBId: string;
let skillAId: string;
let skillBId: string;
let orgBSkillId: string;

let leadToken: string; // lead1 — mission creator
let lead2Token: string; // lead2 — different lead in same org
let directorToken: string;
let crewToken: string;
let crewUserId: string;
let orgBLeadToken: string;

const FUTURE_START = "2026-09-01T00:00:00.000Z";
const FUTURE_END = "2026-09-15T00:00:00.000Z";

async function login(slug: string, email: string) {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ slug, email, password: PASSWORD });
  return res.body.token as string;
}

beforeAll(async () => {
  const pw = await bcrypt.hash(PASSWORD, 10);

  // Primary org
  const org = await prisma.organisation.create({
    data: { name: "Mission Test Org", slug: "mission-test-org" },
  });
  orgId = org.id;

  await prisma.user.create({
    data: {
      email: "director@m.org",
      password: pw,
      name: "Director",
      role: "DIRECTOR",
      orgId,
    },
  });
  await prisma.user.create({
    data: {
      email: "lead1@m.org",
      password: pw,
      name: "Lead One",
      role: "MISSION_LEAD",
      orgId,
    },
  });
  await prisma.user.create({
    data: {
      email: "lead2@m.org",
      password: pw,
      name: "Lead Two",
      role: "MISSION_LEAD",
      orgId,
    },
  });
  const crew = await prisma.user.create({
    data: {
      email: "crew@m.org",
      password: pw,
      name: "Crew",
      role: "CREW_MEMBER",
      orgId,
    },
  });
  crewUserId = crew.id;

  const [sA, sB] = await Promise.all([
    prisma.skill.create({ data: { name: "Skill A", category: "Cat", orgId } }),
    prisma.skill.create({ data: { name: "Skill B", category: "Cat", orgId } }),
  ]);
  skillAId = sA.id;
  skillBId = sB.id;

  // Second org — used for cross-org isolation
  const orgB = await prisma.organisation.create({
    data: { name: "Other Org", slug: "other-org-m" },
  });
  orgBId = orgB.id;
  await prisma.user.create({
    data: {
      email: "lead@b.org",
      password: pw,
      name: "Other Lead",
      role: "MISSION_LEAD",
      orgId: orgBId,
    },
  });
  const orgBSkill = await prisma.skill.create({
    data: { name: "Skill A", category: "Cat", orgId: orgBId },
  });
  orgBSkillId = orgBSkill.id;

  // Tokens
  directorToken = await login("mission-test-org", "director@m.org");
  leadToken = await login("mission-test-org", "lead1@m.org");
  lead2Token = await login("mission-test-org", "lead2@m.org");
  crewToken = await login("mission-test-org", "crew@m.org");
  orgBLeadToken = await login("other-org-m", "lead@b.org");
});

afterEach(async () => {
  // Clean up missions between tests — order matters for FK constraints
  await prisma.missionAssignment.deleteMany();
  await prisma.missionRequirement.deleteMany();
  await prisma.mission.deleteMany();
});

afterAll(async () => {
  await prisma.skill.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organisation.deleteMany();
  await prisma.$disconnect();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function createMissionViaApi(token = leadToken, overrides = {}) {
  const res = await request(app)
    .post("/api/missions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Test Mission",
      startDate: FUTURE_START,
      endDate: FUTURE_END,
      ...overrides,
    });
  return res;
}

async function seedMissionWithStatus(status: string) {
  const lead = await prisma.user.findFirstOrThrow({
    where: { orgId, role: "MISSION_LEAD", email: "lead1@m.org" },
  });
  return prisma.mission.create({
    data: {
      name: "Status Mission",
      startDate: new Date(FUTURE_START),
      endDate: new Date(FUTURE_END),
      status,
      orgId,
      createdById: lead.id,
    },
  });
}

// ─── GET /api/missions ────────────────────────────────────────────────────────

describe("GET /api/missions", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/missions");
    expect(res.status).toBe(401);
  });

  it("returns all org missions for a mission lead", async () => {
    await createMissionViaApi();
    await createMissionViaApi(lead2Token, { name: "Lead 2 Mission" });

    const res = await request(app)
      .get("/api/missions")
      .set("Authorization", `Bearer ${leadToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("returns all org missions for a director", async () => {
    await createMissionViaApi();

    const res = await request(app)
      .get("/api/missions")
      .set("Authorization", `Bearer ${directorToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("each mission includes requirements and assignments", async () => {
    await createMissionViaApi(leadToken, {
      requirements: [{ skillId: skillAId, minProficiency: 3, headcount: 1 }],
    });

    const res = await request(app)
      .get("/api/missions")
      .set("Authorization", `Bearer ${leadToken}`);

    expect(res.status).toBe(200);
    const mission = res.body[0];
    expect(mission.requirements).toHaveLength(1);
    expect(mission.requirements[0].skill.id).toBe(skillAId);
    expect(mission.assignments).toEqual([]);
  });

  it("crew member sees only missions they are assigned to", async () => {
    const { body: assigned } = await createMissionViaApi();
    const { body: unassigned } = await createMissionViaApi(lead2Token, {
      name: "Unassigned",
    });

    await prisma.missionAssignment.create({
      data: { missionId: assigned.id, userId: crewUserId },
    });

    const res = await request(app)
      .get("/api/missions")
      .set("Authorization", `Bearer ${crewToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(assigned.id);
  });

  it("crew member with no assignments sees an empty list", async () => {
    await createMissionViaApi();

    const res = await request(app)
      .get("/api/missions")
      .set("Authorization", `Bearer ${crewToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("org B lead cannot see org A missions", async () => {
    await createMissionViaApi();

    const res = await request(app)
      .get("/api/missions")
      .set("Authorization", `Bearer ${orgBLeadToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─── POST /api/missions ───────────────────────────────────────────────────────

describe("POST /api/missions", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app)
      .post("/api/missions")
      .send({ name: "X", startDate: FUTURE_START, endDate: FUTURE_END });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a director", async () => {
    const res = await createMissionViaApi(directorToken);
    expect(res.status).toBe(403);
  });

  it("returns 403 for a crew member", async () => {
    const res = await createMissionViaApi(crewToken);
    expect(res.status).toBe(403);
  });

  it("creates a DRAFT mission without requirements", async () => {
    const res = await createMissionViaApi();

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("DRAFT");
    expect(res.body.name).toBe("Test Mission");
    expect(res.body.requirements).toEqual([]);
    expect(res.body.assignments).toEqual([]);
    expect(res.body.createdBy.email).toBe("lead1@m.org");
  });

  it("creates a mission with requirements", async () => {
    const res = await createMissionViaApi(leadToken, {
      requirements: [
        { skillId: skillAId, minProficiency: 3, headcount: 2 },
        { skillId: skillBId, minProficiency: 5, headcount: 1 },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.requirements).toHaveLength(2);
    const reqA = res.body.requirements.find(
      (r: { skill: { id: string } }) => r.skill.id === skillAId,
    );
    expect(reqA.minProficiency).toBe(3);
    expect(reqA.headcount).toBe(2);
  });

  it("returns 400 when endDate is before startDate", async () => {
    const res = await createMissionViaApi(leadToken, {
      startDate: FUTURE_END,
      endDate: FUTURE_START,
    });

    expect(res.status).toBe(400);
    expect(res.body.details.endDate).toBeDefined();
  });

  it("returns 400 when name is missing", async () => {
    const res = await request(app)
      .post("/api/missions")
      .set("Authorization", `Bearer ${leadToken}`)
      .send({ startDate: FUTURE_START, endDate: FUTURE_END });

    expect(res.status).toBe(400);
    expect(res.body.details.name).toBeDefined();
  });

  it("returns 400 when a skill belongs to a different org", async () => {
    const res = await createMissionViaApi(leadToken, {
      requirements: [{ skillId: orgBSkillId, minProficiency: 3, headcount: 1 }],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/skills not found/);
  });
});

// ─── GET /api/missions/:id ────────────────────────────────────────────────────

describe("GET /api/missions/:id", () => {
  it("returns 401 without a token", async () => {
    const { body } = await createMissionViaApi();
    const res = await request(app).get(`/api/missions/${body.id}`);
    expect(res.status).toBe(401);
  });

  it("returns the mission with full shape for a mission lead", async () => {
    const { body: created } = await createMissionViaApi(leadToken, {
      requirements: [{ skillId: skillAId, minProficiency: 4, headcount: 1 }],
    });

    const res = await request(app)
      .get(`/api/missions/${created.id}`)
      .set("Authorization", `Bearer ${leadToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.id);
    expect(res.body.requirements).toHaveLength(1);
    expect(res.body.assignments).toBeDefined();
    expect(res.body.createdBy).toBeDefined();
  });

  it("returns the mission for a director", async () => {
    const { body: created } = await createMissionViaApi();

    const res = await request(app)
      .get(`/api/missions/${created.id}`)
      .set("Authorization", `Bearer ${directorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.id);
  });

  it("returns the mission for a crew member who is assigned", async () => {
    const { body: created } = await createMissionViaApi();
    await prisma.missionAssignment.create({
      data: { missionId: created.id, userId: crewUserId },
    });

    const res = await request(app)
      .get(`/api/missions/${created.id}`)
      .set("Authorization", `Bearer ${crewToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.id);
  });

  it("returns 404 for a crew member who is not assigned", async () => {
    const { body: created } = await createMissionViaApi();

    const res = await request(app)
      .get(`/api/missions/${created.id}`)
      .set("Authorization", `Bearer ${crewToken}`);

    expect(res.status).toBe(404);
  });

  it("returns 404 for a non-existent mission id", async () => {
    const res = await request(app)
      .get("/api/missions/nonexistentid000000000000")
      .set("Authorization", `Bearer ${leadToken}`);

    expect(res.status).toBe(404);
  });

  it("returns 404 for a mission belonging to a different org", async () => {
    const { body: created } = await createMissionViaApi();

    const res = await request(app)
      .get(`/api/missions/${created.id}`)
      .set("Authorization", `Bearer ${orgBLeadToken}`);

    expect(res.status).toBe(404);
  });
});

// ─── PATCH /api/missions/:id ──────────────────────────────────────────────────

describe("PATCH /api/missions/:id", () => {
  it("returns 401 without a token", async () => {
    const { body } = await createMissionViaApi();
    const res = await request(app)
      .patch(`/api/missions/${body.id}`)
      .send({ name: "New" });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a director", async () => {
    const { body } = await createMissionViaApi();
    const res = await request(app)
      .patch(`/api/missions/${body.id}`)
      .set("Authorization", `Bearer ${directorToken}`)
      .send({ name: "New" });
    expect(res.status).toBe(403);
  });

  it("updates name and description", async () => {
    const { body: created } = await createMissionViaApi();

    const res = await request(app)
      .patch(`/api/missions/${created.id}`)
      .set("Authorization", `Bearer ${leadToken}`)
      .send({ name: "Updated Name", description: "New description" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated Name");
    expect(res.body.description).toBe("New description");
  });

  it("replaces requirements when a new requirements array is provided", async () => {
    const { body: created } = await createMissionViaApi(leadToken, {
      requirements: [{ skillId: skillAId, minProficiency: 3, headcount: 1 }],
    });
    expect(created.requirements).toHaveLength(1);

    const res = await request(app)
      .patch(`/api/missions/${created.id}`)
      .set("Authorization", `Bearer ${leadToken}`)
      .send({
        requirements: [
          { skillId: skillAId, minProficiency: 5, headcount: 2 },
          { skillId: skillBId, minProficiency: 2, headcount: 1 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.requirements).toHaveLength(2);
    const reqA = res.body.requirements.find(
      (r: { skill: { id: string } }) => r.skill.id === skillAId,
    );
    expect(reqA.minProficiency).toBe(5);
    expect(reqA.headcount).toBe(2);
  });

  it("clears all requirements when an empty array is sent", async () => {
    const { body: created } = await createMissionViaApi(leadToken, {
      requirements: [{ skillId: skillAId, minProficiency: 3, headcount: 1 }],
    });

    const res = await request(app)
      .patch(`/api/missions/${created.id}`)
      .set("Authorization", `Bearer ${leadToken}`)
      .send({ requirements: [] });

    expect(res.status).toBe(200);
    expect(res.body.requirements).toEqual([]);
  });

  it("does not touch requirements when the field is omitted", async () => {
    const { body: created } = await createMissionViaApi(leadToken, {
      requirements: [{ skillId: skillAId, minProficiency: 3, headcount: 1 }],
    });

    const res = await request(app)
      .patch(`/api/missions/${created.id}`)
      .set("Authorization", `Bearer ${leadToken}`)
      .send({ name: "Renamed Only" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Renamed Only");
    expect(res.body.requirements).toHaveLength(1);
  });

  it("returns 403 when a different mission lead tries to edit", async () => {
    const { body: created } = await createMissionViaApi(leadToken);

    const res = await request(app)
      .patch(`/api/missions/${created.id}`)
      .set("Authorization", `Bearer ${lead2Token}`)
      .send({ name: "Hijacked" });

    expect(res.status).toBe(403);
  });

  it("returns 409 when the mission is not in DRAFT status", async () => {
    const submitted = await seedMissionWithStatus("SUBMITTED");

    const res = await request(app)
      .patch(`/api/missions/${submitted.id}`)
      .set("Authorization", `Bearer ${leadToken}`)
      .send({ name: "New Name" });

    expect(res.status).toBe(409);
  });

  it("returns 400 when updated dates produce an invalid range", async () => {
    const { body: created } = await createMissionViaApi();

    const res = await request(app)
      .patch(`/api/missions/${created.id}`)
      .set("Authorization", `Bearer ${leadToken}`)
      .send({ endDate: "2020-01-01T00:00:00.000Z" }); // earlier than existing startDate

    expect(res.status).toBe(400);
  });

  it("returns 400 when a skill belongs to a different org", async () => {
    const { body: created } = await createMissionViaApi();

    const res = await request(app)
      .patch(`/api/missions/${created.id}`)
      .set("Authorization", `Bearer ${leadToken}`)
      .send({
        requirements: [
          { skillId: orgBSkillId, minProficiency: 3, headcount: 1 },
        ],
      });

    expect(res.status).toBe(400);
  });

  it("returns 404 for a mission belonging to a different org", async () => {
    const { body: created } = await createMissionViaApi();

    const res = await request(app)
      .patch(`/api/missions/${created.id}`)
      .set("Authorization", `Bearer ${orgBLeadToken}`)
      .send({ name: "Cross-org attempt" });

    expect(res.status).toBe(404);
  });
});

// ─── DELETE /api/missions/:id ─────────────────────────────────────────────────

describe("DELETE /api/missions/:id", () => {
  it("returns 401 without a token", async () => {
    const { body } = await createMissionViaApi();
    const res = await request(app).delete(`/api/missions/${body.id}`);
    expect(res.status).toBe(401);
  });

  it("returns 403 for a director", async () => {
    const { body } = await createMissionViaApi();
    const res = await request(app)
      .delete(`/api/missions/${body.id}`)
      .set("Authorization", `Bearer ${directorToken}`);
    expect(res.status).toBe(403);
  });

  it("deletes a DRAFT mission and returns 204", async () => {
    const { body: created } = await createMissionViaApi();

    const res = await request(app)
      .delete(`/api/missions/${created.id}`)
      .set("Authorization", `Bearer ${leadToken}`);

    expect(res.status).toBe(204);
  });

  it("mission is no longer accessible after deletion", async () => {
    const { body: created } = await createMissionViaApi();
    await request(app)
      .delete(`/api/missions/${created.id}`)
      .set("Authorization", `Bearer ${leadToken}`);

    const res = await request(app)
      .get(`/api/missions/${created.id}`)
      .set("Authorization", `Bearer ${leadToken}`);

    expect(res.status).toBe(404);
  });

  it("returns 403 when a different mission lead tries to delete", async () => {
    const { body: created } = await createMissionViaApi(leadToken);

    const res = await request(app)
      .delete(`/api/missions/${created.id}`)
      .set("Authorization", `Bearer ${lead2Token}`);

    expect(res.status).toBe(403);
  });

  it("returns 409 when the mission is not in DRAFT status", async () => {
    const submitted = await seedMissionWithStatus("SUBMITTED");

    const res = await request(app)
      .delete(`/api/missions/${submitted.id}`)
      .set("Authorization", `Bearer ${leadToken}`);

    expect(res.status).toBe(409);
  });

  it("returns 404 for a non-existent mission id", async () => {
    const res = await request(app)
      .delete("/api/missions/nonexistentid000000000000")
      .set("Authorization", `Bearer ${leadToken}`);

    expect(res.status).toBe(404);
  });

  it("returns 404 for a mission belonging to a different org", async () => {
    const { body: created } = await createMissionViaApi();

    const res = await request(app)
      .delete(`/api/missions/${created.id}`)
      .set("Authorization", `Bearer ${orgBLeadToken}`);

    expect(res.status).toBe(404);
  });
});
