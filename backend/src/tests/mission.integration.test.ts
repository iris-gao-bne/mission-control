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
    await createMissionViaApi(lead2Token, { name: "Unassigned" });

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

  it("allows a director to create a mission", async () => {
    const res = await createMissionViaApi(directorToken);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("DRAFT");
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

// ─── POST /api/missions/:id/transition ───────────────────────────────────────

async function callTransition(missionId: string, token: string, body: object) {
  return request(app)
    .post(`/api/missions/${missionId}/transition`)
    .set("Authorization", `Bearer ${token}`)
    .send(body);
}

describe("POST /api/missions/:id/transition", () => {
  // ── Request-level validation ────────────────────────────────────────────────

  it("returns 401 without a token", async () => {
    const mission = await seedMissionWithStatus("DRAFT");
    const res = await request(app)
      .post(`/api/missions/${mission.id}/transition`)
      .send({ to: "SUBMITTED" });
    expect(res.status).toBe(401);
  });

  it("returns 400 for an unrecognised target status", async () => {
    const mission = await seedMissionWithStatus("DRAFT");
    const res = await callTransition(mission.id, leadToken, { to: "LAUNCHED" });
    expect(res.status).toBe(400);
    expect(res.body.details.to).toBeDefined();
  });

  it("returns 404 for a mission belonging to a different org", async () => {
    const mission = await seedMissionWithStatus("DRAFT");
    const res = await callTransition(mission.id, orgBLeadToken, {
      to: "SUBMITTED",
    });
    expect(res.status).toBe(404);
  });

  it("returns the full mission shape on a successful transition", async () => {
    const mission = await seedMissionWithStatus("DRAFT");
    const res = await callTransition(mission.id, leadToken, {
      to: "SUBMITTED",
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("SUBMITTED");
    expect(res.body.requirements).toBeDefined();
    expect(res.body.assignments).toBeDefined();
    expect(res.body.createdBy).toBeDefined();
  });

  // ── Happy paths — all valid transitions ─────────────────────────────────────

  describe("DRAFT → SUBMITTED", () => {
    it("succeeds when performed by the owning mission lead", async () => {
      const mission = await seedMissionWithStatus("DRAFT");
      const res = await callTransition(mission.id, leadToken, {
        to: "SUBMITTED",
      });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("SUBMITTED");
    });

    it("succeeds when performed by a director", async () => {
      const mission = await seedMissionWithStatus("DRAFT");
      const res = await callTransition(mission.id, directorToken, {
        to: "SUBMITTED",
      });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("SUBMITTED");
    });
  });

  describe("DRAFT → CANCELLED", () => {
    it("succeeds when performed by the owning mission lead", async () => {
      const mission = await seedMissionWithStatus("DRAFT");
      const res = await callTransition(mission.id, leadToken, {
        to: "CANCELLED",
      });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("CANCELLED");
    });

    it("succeeds when performed by a director", async () => {
      const mission = await seedMissionWithStatus("DRAFT");
      const res = await callTransition(mission.id, directorToken, {
        to: "CANCELLED",
      });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("CANCELLED");
    });
  });

  describe("SUBMITTED → APPROVED", () => {
    it("succeeds when performed by a director", async () => {
      const mission = await seedMissionWithStatus("SUBMITTED");
      const res = await callTransition(mission.id, directorToken, {
        to: "APPROVED",
      });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("APPROVED");
    });
  });

  describe("SUBMITTED → REJECTED", () => {
    it("succeeds with an optional reason", async () => {
      const mission = await seedMissionWithStatus("SUBMITTED");
      const res = await callTransition(mission.id, directorToken, {
        to: "REJECTED",
        reason: "Insufficient EVA headcount for mission window",
      });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("REJECTED");
      expect(res.body.rejectionReason).toBe(
        "Insufficient EVA headcount for mission window",
      );
    });

    it("succeeds without a reason — rejectionReason is null", async () => {
      const mission = await seedMissionWithStatus("SUBMITTED");
      const res = await callTransition(mission.id, directorToken, {
        to: "REJECTED",
      });
      expect(res.status).toBe(200);
      expect(res.body.rejectionReason).toBeNull();
    });
  });

  describe("SUBMITTED → CANCELLED", () => {
    it("succeeds when performed by a director", async () => {
      const mission = await seedMissionWithStatus("SUBMITTED");
      const res = await callTransition(mission.id, directorToken, {
        to: "CANCELLED",
      });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("CANCELLED");
    });

    it("succeeds when performed by the owning mission lead", async () => {
      const mission = await seedMissionWithStatus("SUBMITTED");
      const res = await callTransition(mission.id, leadToken, {
        to: "CANCELLED",
      });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("CANCELLED");
    });
  });

  describe("APPROVED → IN_PROGRESS", () => {
    it("succeeds when performed by a director", async () => {
      const mission = await seedMissionWithStatus("APPROVED");
      const res = await callTransition(mission.id, directorToken, {
        to: "IN_PROGRESS",
      });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("IN_PROGRESS");
    });
  });

  describe("APPROVED → CANCELLED", () => {
    it("succeeds when performed by a director", async () => {
      const mission = await seedMissionWithStatus("APPROVED");
      const res = await callTransition(mission.id, directorToken, {
        to: "CANCELLED",
      });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("CANCELLED");
    });
  });

  describe("IN_PROGRESS → COMPLETED", () => {
    it("succeeds when performed by a director", async () => {
      const mission = await seedMissionWithStatus("IN_PROGRESS");
      const res = await callTransition(mission.id, directorToken, {
        to: "COMPLETED",
      });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("COMPLETED");
    });
  });

  describe("IN_PROGRESS → CANCELLED", () => {
    it("succeeds when performed by a director", async () => {
      const mission = await seedMissionWithStatus("IN_PROGRESS");
      const res = await callTransition(mission.id, directorToken, {
        to: "CANCELLED",
      });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("CANCELLED");
    });
  });

  describe("REJECTED → DRAFT (reopen)", () => {
    it("succeeds when performed by the owning mission lead", async () => {
      const mission = await seedMissionWithStatus("REJECTED");
      const res = await callTransition(mission.id, leadToken, { to: "DRAFT" });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("DRAFT");
    });

    it("clears rejectionReason on reopen", async () => {
      const mission = await seedMissionWithStatus("SUBMITTED");
      await callTransition(mission.id, directorToken, {
        to: "REJECTED",
        reason: "Needs more crew",
      });

      const reopen = await callTransition(mission.id, leadToken, {
        to: "DRAFT",
      });
      expect(reopen.status).toBe(200);
      expect(reopen.body.rejectionReason).toBeNull();
    });
  });

  // ── Permission violations ───────────────────────────────────────────────────

  describe("permission enforcement", () => {
    it("returns 403 when a non-owner lead tries to submit", async () => {
      const mission = await seedMissionWithStatus("DRAFT");
      const res = await callTransition(mission.id, lead2Token, {
        to: "SUBMITTED",
      });
      expect(res.status).toBe(403);
    });

    it("returns 403 when a crew member tries to submit", async () => {
      const mission = await seedMissionWithStatus("DRAFT");
      const res = await callTransition(mission.id, crewToken, {
        to: "SUBMITTED",
      });
      expect(res.status).toBe(403);
    });

    it("returns 403 when a mission lead tries to approve", async () => {
      const mission = await seedMissionWithStatus("SUBMITTED");
      const res = await callTransition(mission.id, leadToken, {
        to: "APPROVED",
      });
      expect(res.status).toBe(403);
    });

    it("returns 403 when a mission lead tries to reject", async () => {
      const mission = await seedMissionWithStatus("SUBMITTED");
      const res = await callTransition(mission.id, leadToken, {
        to: "REJECTED",
      });
      expect(res.status).toBe(403);
    });

    it("returns 403 when a mission lead tries to start an approved mission", async () => {
      const mission = await seedMissionWithStatus("APPROVED");
      const res = await callTransition(mission.id, leadToken, {
        to: "IN_PROGRESS",
      });
      expect(res.status).toBe(403);
    });

    it("returns 403 when a mission lead tries to cancel an approved mission", async () => {
      const mission = await seedMissionWithStatus("APPROVED");
      const res = await callTransition(mission.id, leadToken, {
        to: "CANCELLED",
      });
      expect(res.status).toBe(403);
    });

    it("returns 403 when a mission lead tries to complete an in-progress mission", async () => {
      const mission = await seedMissionWithStatus("IN_PROGRESS");
      const res = await callTransition(mission.id, leadToken, {
        to: "COMPLETED",
      });
      expect(res.status).toBe(403);
    });

    it("returns 403 when a director tries to reopen a rejected mission (owner only)", async () => {
      const mission = await seedMissionWithStatus("REJECTED");
      const res = await callTransition(mission.id, directorToken, {
        to: "DRAFT",
      });
      expect(res.status).toBe(403);
    });

    it("returns 403 when a non-owner lead tries to reopen a rejected mission", async () => {
      const mission = await seedMissionWithStatus("REJECTED");
      const res = await callTransition(mission.id, lead2Token, { to: "DRAFT" });
      expect(res.status).toBe(403);
    });
  });

  // ── Invalid state machine moves ─────────────────────────────────────────────

  describe("invalid transitions", () => {
    it("returns 409 for DRAFT → APPROVED (skips SUBMITTED)", async () => {
      const mission = await seedMissionWithStatus("DRAFT");
      const res = await callTransition(mission.id, directorToken, {
        to: "APPROVED",
      });
      expect(res.status).toBe(409);
    });

    it("returns 409 for APPROVED → SUBMITTED (backwards)", async () => {
      const mission = await seedMissionWithStatus("APPROVED");
      const res = await callTransition(mission.id, directorToken, {
        to: "SUBMITTED",
      });
      expect(res.status).toBe(409);
    });

    it("returns 409 for IN_PROGRESS → APPROVED (backwards)", async () => {
      const mission = await seedMissionWithStatus("IN_PROGRESS");
      const res = await callTransition(mission.id, directorToken, {
        to: "APPROVED",
      });
      expect(res.status).toBe(409);
    });

    it("returns 409 for REJECTED → SUBMITTED (must reopen to DRAFT first)", async () => {
      const mission = await seedMissionWithStatus("REJECTED");
      const res = await callTransition(mission.id, leadToken, {
        to: "SUBMITTED",
      });
      expect(res.status).toBe(409);
    });

    it("returns 409 when trying to transition out of the terminal COMPLETED state", async () => {
      const mission = await seedMissionWithStatus("COMPLETED");
      const res = await callTransition(mission.id, directorToken, {
        to: "DRAFT",
      });
      expect(res.status).toBe(409);
    });

    it("returns 409 when trying to transition out of the terminal CANCELLED state", async () => {
      const mission = await seedMissionWithStatus("CANCELLED");
      const res = await callTransition(mission.id, directorToken, {
        to: "DRAFT",
      });
      expect(res.status).toBe(409);
    });
  });
});

// ─── GET /api/missions/:id/match ─────────────────────────────────────────────

describe("GET /api/missions/:id/match", () => {
  // mc1: skillA(4) + skillB(4), available          → score: proficiency 32 + avail 30 + workload 30 = 92
  // mc2: skillA(5) + skillB(5), on leave in window → score: proficiency 40 + avail  0 + workload 30 = 70
  // mc3: skillA(2), below any min-3 threshold → hard-filtered out of suggestions
  // unusedSkill: no crew member has this → guarantees "no candidates" gap scenario
  let mc1Id: string;
  let mc2Id: string;
  let mc3Id: string;
  let unusedSkillId: string;

  async function makeApproved(
    reqs: { skillId: string; minProficiency: number; headcount: number }[] = [],
  ) {
    const lead = await prisma.user.findFirstOrThrow({
      where: { orgId, role: "MISSION_LEAD", email: "lead1@m.org" },
    });
    const mission = await prisma.mission.create({
      data: {
        name: "Match Mission",
        startDate: new Date(FUTURE_START),
        endDate: new Date(FUTURE_END),
        status: "APPROVED",
        orgId,
        createdById: lead.id,
      },
    });
    if (reqs.length > 0) {
      await prisma.missionRequirement.createMany({
        data: reqs.map((r) => ({ missionId: mission.id, ...r })),
      });
    }
    return mission;
  }

  beforeAll(async () => {
    const pw = await bcrypt.hash(PASSWORD, 10);
    const [c1, c2, c3] = await Promise.all([
      prisma.user.create({
        data: {
          email: "mc1@m.org",
          password: pw,
          name: "MC One",
          role: "CREW_MEMBER",
          orgId,
        },
      }),
      prisma.user.create({
        data: {
          email: "mc2@m.org",
          password: pw,
          name: "MC Two",
          role: "CREW_MEMBER",
          orgId,
        },
      }),
      prisma.user.create({
        data: {
          email: "mc3@m.org",
          password: pw,
          name: "MC Three",
          role: "CREW_MEMBER",
          orgId,
        },
      }),
    ]);
    mc1Id = c1.id;
    mc2Id = c2.id;
    mc3Id = c3.id;

    await Promise.all([
      prisma.crewSkill.create({
        data: { userId: mc1Id, skillId: skillAId, proficiencyLevel: 4 },
      }),
      prisma.crewSkill.create({
        data: { userId: mc1Id, skillId: skillBId, proficiencyLevel: 4 },
      }),
      prisma.crewSkill.create({
        data: { userId: mc2Id, skillId: skillAId, proficiencyLevel: 5 },
      }),
      prisma.crewSkill.create({
        data: { userId: mc2Id, skillId: skillBId, proficiencyLevel: 5 },
      }),
      prisma.crewSkill.create({
        data: { userId: mc3Id, skillId: skillAId, proficiencyLevel: 2 },
      }),
    ]);
    // mc2 is on leave for the entire mission window
    await prisma.availability.create({
      data: {
        userId: mc2Id,
        startDate: new Date(FUTURE_START),
        endDate: new Date(FUTURE_END),
        reason: "Leave",
      },
    });

    // A skill nobody holds — used to trigger the "no candidates" gap path
    const unusedSkill = await prisma.skill.create({
      data: { name: "Unused Skill", category: "Test", orgId },
    });
    unusedSkillId = unusedSkill.id;
  });

  afterAll(async () => {
    await prisma.availability.deleteMany({
      where: { userId: { in: [mc1Id, mc2Id, mc3Id] } },
    });
    await prisma.crewSkill.deleteMany({
      where: { userId: { in: [mc1Id, mc2Id, mc3Id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [mc1Id, mc2Id, mc3Id] } },
    });
    await prisma.skill.deleteMany({ where: { id: unusedSkillId } });
  });

  // ── Auth and permissions ──────────────────────────────────────────────────

  it("returns 401 without a token", async () => {
    const mission = await makeApproved();
    const res = await request(app).get(`/api/missions/${mission.id}/match`);
    expect(res.status).toBe(401);
  });

  it("returns 403 for a crew member", async () => {
    const mission = await makeApproved();
    const res = await request(app)
      .get(`/api/missions/${mission.id}/match`)
      .set("Authorization", `Bearer ${crewToken}`);
    expect(res.status).toBe(403);
  });

  it("returns 404 for a non-existent mission id", async () => {
    const res = await request(app)
      .get("/api/missions/nonexistentid000000000000/match")
      .set("Authorization", `Bearer ${leadToken}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for a mission in a different org", async () => {
    const mission = await makeApproved();
    const res = await request(app)
      .get(`/api/missions/${mission.id}/match`)
      .set("Authorization", `Bearer ${orgBLeadToken}`);
    expect(res.status).toBe(404);
  });

  it("returns 409 for a DRAFT mission", async () => {
    const mission = await seedMissionWithStatus("DRAFT");
    const res = await request(app)
      .get(`/api/missions/${mission.id}/match`)
      .set("Authorization", `Bearer ${leadToken}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/APPROVED/);
  });

  it("returns 409 for an IN_PROGRESS mission", async () => {
    const mission = await seedMissionWithStatus("IN_PROGRESS");
    const res = await request(app)
      .get(`/api/missions/${mission.id}/match`)
      .set("Authorization", `Bearer ${leadToken}`);
    expect(res.status).toBe(409);
  });

  // ── Response structure ────────────────────────────────────────────────────

  it("returns correct top-level shape: missionId, fullyMatched, requirements", async () => {
    const mission = await makeApproved([
      { skillId: skillAId, minProficiency: 3, headcount: 1 },
    ]);
    const res = await request(app)
      .get(`/api/missions/${mission.id}/match`)
      .set("Authorization", `Bearer ${leadToken}`);
    expect(res.status).toBe(200);
    expect(res.body.missionId).toBe(mission.id);
    expect(typeof res.body.fullyMatched).toBe("boolean");
    expect(Array.isArray(res.body.requirements)).toBe(true);
  });

  it("mission with no requirements returns fullyMatched: true and empty requirements", async () => {
    const mission = await makeApproved();
    const res = await request(app)
      .get(`/api/missions/${mission.id}/match`)
      .set("Authorization", `Bearer ${leadToken}`);
    expect(res.status).toBe(200);
    expect(res.body.fullyMatched).toBe(true);
    expect(res.body.requirements).toEqual([]);
  });

  it("each requirement includes skill, minProficiency, headcount, suggestions, filled, unfilled", async () => {
    const mission = await makeApproved([
      { skillId: skillAId, minProficiency: 3, headcount: 1 },
    ]);
    const res = await request(app)
      .get(`/api/missions/${mission.id}/match`)
      .set("Authorization", `Bearer ${leadToken}`);
    const req = res.body.requirements[0];
    expect(req.skill.id).toBe(skillAId);
    expect(req.minProficiency).toBe(3);
    expect(req.headcount).toBe(1);
    expect(Array.isArray(req.suggestions)).toBe(true);
    expect(typeof req.filled).toBe("number");
    expect(typeof req.unfilled).toBe("number");
  });

  it("each suggestion includes a score breakdown that sums to the total", async () => {
    const mission = await makeApproved([
      { skillId: skillAId, minProficiency: 3, headcount: 1 },
    ]);
    const res = await request(app)
      .get(`/api/missions/${mission.id}/match`)
      .set("Authorization", `Bearer ${leadToken}`);
    const suggestion = res.body.requirements[0].suggestions[0];
    const { proficiency, availability, workload } = suggestion.breakdown;
    expect(suggestion.score).toBe(proficiency + availability + workload);
  });

  // ── Scoring ───────────────────────────────────────────────────────────────

  it("hard filter: excludes crew whose proficiency is below minProficiency", async () => {
    // mc3 has skillA proficiency 2; requirement needs min 3
    const mission = await makeApproved([
      { skillId: skillAId, minProficiency: 3, headcount: 1 },
    ]);
    const res = await request(app)
      .get(`/api/missions/${mission.id}/match`)
      .set("Authorization", `Bearer ${leadToken}`);
    const ids = res.body.requirements[0].suggestions.map(
      (s: { userId: string }) => s.userId,
    );
    expect(ids).not.toContain(mc3Id);
  });

  it("crew on leave during the mission window gets availability score of 0", async () => {
    // mc2 (prof 5) is on leave for the whole mission window
    const mission = await makeApproved([
      { skillId: skillAId, minProficiency: 3, headcount: 1 },
    ]);
    const res = await request(app)
      .get(`/api/missions/${mission.id}/match`)
      .set("Authorization", `Bearer ${leadToken}`);
    const mc2Suggestion = res.body.requirements[0].suggestions.find(
      (s: { userId: string }) => s.userId === mc2Id,
    );
    expect(mc2Suggestion.breakdown.availability).toBe(0);
  });

  it("crew with no active missions gets maximum workload score of 30", async () => {
    const mission = await makeApproved([
      { skillId: skillAId, minProficiency: 3, headcount: 1 },
    ]);
    const res = await request(app)
      .get(`/api/missions/${mission.id}/match`)
      .set("Authorization", `Bearer ${leadToken}`);
    const mc1Suggestion = res.body.requirements[0].suggestions.find(
      (s: { userId: string }) => s.userId === mc1Id,
    );
    expect(mc1Suggestion.breakdown.workload).toBe(30);
  });

  it("crew on an active IN_PROGRESS mission gets a reduced workload score", async () => {
    // Assign mc1 to a separate IN_PROGRESS mission first (workload ceiling = 3)
    const lead = await prisma.user.findFirstOrThrow({
      where: { orgId, role: "MISSION_LEAD", email: "lead1@m.org" },
    });
    const activeMission = await prisma.mission.create({
      data: {
        name: "Active",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-06-01"),
        status: "IN_PROGRESS",
        orgId,
        createdById: lead.id,
      },
    });
    await prisma.missionAssignment.create({
      data: { missionId: activeMission.id, userId: mc1Id },
    });

    const mission = await makeApproved([
      { skillId: skillAId, minProficiency: 3, headcount: 1 },
    ]);
    const res = await request(app)
      .get(`/api/missions/${mission.id}/match`)
      .set("Authorization", `Bearer ${leadToken}`);

    const mc1Suggestion = res.body.requirements[0].suggestions.find(
      (s: { userId: string }) => s.userId === mc1Id,
    );
    // 1 active assignment out of ceiling 3 → workload = 30 * (1 - 1/3) = 20
    expect(mc1Suggestion.breakdown.workload).toBe(20);
  });

  it("higher proficiency scores higher on the proficiency component", async () => {
    // mc2 (prof 5) vs mc1 (prof 4)
    const mission = await makeApproved([
      { skillId: skillAId, minProficiency: 3, headcount: 1 },
    ]);
    const res = await request(app)
      .get(`/api/missions/${mission.id}/match`)
      .set("Authorization", `Bearer ${leadToken}`);
    const suggestions = res.body.requirements[0].suggestions;
    const mc1 = suggestions.find((s: { userId: string }) => s.userId === mc1Id);
    const mc2 = suggestions.find((s: { userId: string }) => s.userId === mc2Id);
    expect(mc2.breakdown.proficiency).toBeGreaterThan(
      mc1.breakdown.proficiency,
    );
  });

  it("assigned candidates appear first in suggestions, unassigned sorted by score after", async () => {
    const mission = await makeApproved([
      { skillId: skillAId, minProficiency: 3, headcount: 1 },
    ]);
    const res = await request(app)
      .get(`/api/missions/${mission.id}/match`)
      .set("Authorization", `Bearer ${leadToken}`);
    const suggestions = res.body.requirements[0].suggestions;
    const firstUnassignedIdx = suggestions.findIndex(
      (s: { assigned: boolean }) => !s.assigned,
    );
    const lastAssignedIdx = suggestions.reduce(
      (last: number, s: { assigned: boolean }, i: number) =>
        s.assigned ? i : last,
      -1,
    );
    if (firstUnassignedIdx !== -1 && lastAssignedIdx !== -1) {
      expect(lastAssignedIdx).toBeLessThan(firstUnassignedIdx);
    }
  });

  // ── Match results ─────────────────────────────────────────────────────────

  it("fullyMatched: true and filled === headcount when all slots can be filled", async () => {
    // mc1 qualifies (prof 4 >= 3, available)
    const mission = await makeApproved([
      { skillId: skillAId, minProficiency: 3, headcount: 1 },
    ]);
    const res = await request(app)
      .get(`/api/missions/${mission.id}/match`)
      .set("Authorization", `Bearer ${leadToken}`);
    expect(res.body.fullyMatched).toBe(true);
    expect(res.body.requirements[0].filled).toBe(1);
    expect(res.body.requirements[0].unfilled).toBe(0);
  });

  it("gap 'no candidates': no suggestions and gap message when no crew have the required skill", async () => {
    // unusedSkill: no crew member holds it
    const mission = await makeApproved([
      { skillId: unusedSkillId, minProficiency: 1, headcount: 1 },
    ]);
    const res = await request(app)
      .get(`/api/missions/${mission.id}/match`)
      .set("Authorization", `Bearer ${leadToken}`);
    const req = res.body.requirements[0];
    expect(res.body.fullyMatched).toBe(false);
    expect(req.suggestions).toHaveLength(0);
    expect(req.filled).toBe(0);
    expect(req.unfilled).toBe(1);
    expect(req.gap).toMatch(/proficiency/);
  });

  it("gap 'insufficient candidates': headcount exceeds the number of qualifying crew", async () => {
    // headcount 3, but only mc1 (prof 4) and mc2 (prof 5) qualify; mc3 (prof 2) is excluded
    const mission = await makeApproved([
      { skillId: skillAId, minProficiency: 3, headcount: 3 },
    ]);
    const res = await request(app)
      .get(`/api/missions/${mission.id}/match`)
      .set("Authorization", `Bearer ${leadToken}`);
    const req = res.body.requirements[0];
    expect(res.body.fullyMatched).toBe(false);
    expect(req.suggestions.length).toBeGreaterThan(0);
    expect(req.filled).toBe(2);
    expect(req.unfilled).toBe(1);
    expect(req.gap).toMatch(/[Ii]nsufficient/);
  });

  it("greedy pool depletion: a candidate assigned to one requirement is unavailable for the next", async () => {
    // req1 needs skillA, req2 needs skillB — mc1 and mc2 both have both skills
    // mc1 (available, score 92) is assigned to req1 first and depleted from the pool
    // mc2 (on leave, score 70) then fills req2 — both requirements are satisfied
    const lead = await prisma.user.findFirstOrThrow({
      where: { orgId, role: "MISSION_LEAD", email: "lead1@m.org" },
    });
    const mission = await prisma.mission.create({
      data: {
        name: "Depletion Mission",
        startDate: new Date(FUTURE_START),
        endDate: new Date(FUTURE_END),
        status: "APPROVED",
        orgId,
        createdById: lead.id,
      },
    });
    await prisma.missionRequirement.createMany({
      data: [
        {
          missionId: mission.id,
          skillId: skillAId,
          minProficiency: 3,
          headcount: 1,
        },
        {
          missionId: mission.id,
          skillId: skillBId,
          minProficiency: 3,
          headcount: 1,
        },
      ],
    });

    const res = await request(app)
      .get(`/api/missions/${mission.id}/match`)
      .set("Authorization", `Bearer ${leadToken}`);

    expect(res.body.fullyMatched).toBe(true);
    const [req1, req2] = res.body.requirements;
    const req1Assigned = req1.suggestions.filter(
      (s: { assigned: boolean }) => s.assigned,
    );
    const req2Assigned = req2.suggestions.filter(
      (s: { assigned: boolean }) => s.assigned,
    );
    expect(req1Assigned).toHaveLength(1);
    expect(req2Assigned).toHaveLength(1);
    // Pool depletion: the same candidate cannot be assigned to both requirements
    expect(req1Assigned[0].userId).not.toBe(req2Assigned[0].userId);
  });
});

// ─── POST /api/missions/:id/assign ───────────────────────────────────────────

describe("POST /api/missions/:id/assign", () => {
  let assignCrew2Id: string;

  async function makeApprovedWithReq() {
    const lead = await prisma.user.findFirstOrThrow({
      where: { orgId, role: "MISSION_LEAD", email: "lead1@m.org" },
    });
    const mission = await prisma.mission.create({
      data: {
        name: "Assign Mission",
        startDate: new Date(FUTURE_START),
        endDate: new Date(FUTURE_END),
        status: "APPROVED",
        orgId,
        createdById: lead.id,
      },
    });
    const req = await prisma.missionRequirement.create({
      data: {
        missionId: mission.id,
        skillId: skillAId,
        minProficiency: 1,
        headcount: 2,
      },
    });
    return { mission, req };
  }

  async function callAssign(
    missionId: string,
    token: string,
    assignments: object[],
  ) {
    return request(app)
      .post(`/api/missions/${missionId}/assign`)
      .set("Authorization", `Bearer ${token}`)
      .send({ assignments });
  }

  beforeAll(async () => {
    const pw = await bcrypt.hash(PASSWORD, 10);
    const c = await prisma.user.create({
      data: {
        email: "ac2@m.org",
        password: pw,
        name: "Assign Crew 2",
        role: "CREW_MEMBER",
        orgId,
      },
    });
    assignCrew2Id = c.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: assignCrew2Id } });
  });

  // ── Auth and permissions ──────────────────────────────────────────────────

  it("returns 401 without a token", async () => {
    const { mission } = await makeApprovedWithReq();
    const res = await request(app)
      .post(`/api/missions/${mission.id}/assign`)
      .send({ assignments: [] });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a crew member", async () => {
    const { mission } = await makeApprovedWithReq();
    const res = await callAssign(mission.id, crewToken, []);
    expect(res.status).toBe(403);
  });

  it("returns 404 for a non-existent mission", async () => {
    const res = await callAssign("nonexistentid000000000000", leadToken, []);
    expect(res.status).toBe(404);
  });

  it("returns 404 for a mission in a different org", async () => {
    const { mission } = await makeApprovedWithReq();
    const res = await callAssign(mission.id, orgBLeadToken, []);
    expect(res.status).toBe(404);
  });

  it("returns 409 for a non-APPROVED mission", async () => {
    const mission = await seedMissionWithStatus("IN_PROGRESS");
    const res = await callAssign(mission.id, directorToken, [
      { userId: crewUserId },
    ]);
    expect(res.status).toBe(409);
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it("director commits assignments and returns 204", async () => {
    const { mission } = await makeApprovedWithReq();
    const res = await callAssign(mission.id, directorToken, [
      { userId: crewUserId },
    ]);
    expect(res.status).toBe(204);
  });

  it("mission lead commits assignments and returns 204", async () => {
    const { mission } = await makeApprovedWithReq();
    const res = await callAssign(mission.id, leadToken, [
      { userId: crewUserId },
    ]);
    expect(res.status).toBe(204);
  });

  it("assignments are persisted and visible via GET /missions/:id", async () => {
    const { mission } = await makeApprovedWithReq();
    await callAssign(mission.id, leadToken, [{ userId: crewUserId }]);

    const get = await request(app)
      .get(`/api/missions/${mission.id}`)
      .set("Authorization", `Bearer ${leadToken}`);

    expect(get.body.assignments).toHaveLength(1);
    expect(get.body.assignments[0].user.id).toBe(crewUserId);
  });

  it("stores requirementId on the assignment when provided", async () => {
    const { mission, req } = await makeApprovedWithReq();
    await callAssign(mission.id, leadToken, [
      { userId: crewUserId, requirementId: req.id },
    ]);

    const get = await request(app)
      .get(`/api/missions/${mission.id}`)
      .set("Authorization", `Bearer ${leadToken}`);

    expect(get.body.assignments[0].missionRequirementId).toBe(req.id);
  });

  it("stores null requirementId when requirementId is omitted", async () => {
    const { mission } = await makeApprovedWithReq();
    await callAssign(mission.id, leadToken, [{ userId: crewUserId }]);

    const get = await request(app)
      .get(`/api/missions/${mission.id}`)
      .set("Authorization", `Bearer ${leadToken}`);

    expect(get.body.assignments[0].missionRequirementId).toBeNull();
  });

  it("replaces all previous assignments with the new list (replace-all)", async () => {
    const { mission } = await makeApprovedWithReq();
    await callAssign(mission.id, leadToken, [{ userId: crewUserId }]);
    await callAssign(mission.id, leadToken, [{ userId: assignCrew2Id }]);

    const get = await request(app)
      .get(`/api/missions/${mission.id}`)
      .set("Authorization", `Bearer ${leadToken}`);

    expect(get.body.assignments).toHaveLength(1);
    expect(get.body.assignments[0].user.id).toBe(assignCrew2Id);
  });

  it("empty assignments array clears all existing assignments", async () => {
    const { mission } = await makeApprovedWithReq();
    await callAssign(mission.id, leadToken, [{ userId: crewUserId }]);
    await callAssign(mission.id, leadToken, []);

    const get = await request(app)
      .get(`/api/missions/${mission.id}`)
      .set("Authorization", `Bearer ${leadToken}`);

    expect(get.body.assignments).toHaveLength(0);
  });

  it("can assign multiple crew members in a single call", async () => {
    const { mission } = await makeApprovedWithReq();
    await callAssign(mission.id, leadToken, [
      { userId: crewUserId },
      { userId: assignCrew2Id },
    ]);

    const get = await request(app)
      .get(`/api/missions/${mission.id}`)
      .set("Authorization", `Bearer ${leadToken}`);

    expect(get.body.assignments).toHaveLength(2);
  });

  // ── Validation ────────────────────────────────────────────────────────────

  it("returns 400 when a userId belongs to a different org", async () => {
    const pw = await bcrypt.hash(PASSWORD, 10);
    const orgBCrew = await prisma.user.create({
      data: {
        email: "orgbcrew@b.org",
        password: pw,
        name: "OrgB Crew",
        role: "CREW_MEMBER",
        orgId: orgBId,
      },
    });
    const { mission } = await makeApprovedWithReq();
    const res = await callAssign(mission.id, leadToken, [
      { userId: orgBCrew.id },
    ]);
    expect(res.status).toBe(400);
    await prisma.user.delete({ where: { id: orgBCrew.id } });
  });

  it("returns 400 when a requirementId does not belong to this mission", async () => {
    const { mission: m1 } = await makeApprovedWithReq();
    const { req: otherReq } = await makeApprovedWithReq();
    const res = await callAssign(m1.id, leadToken, [
      { userId: crewUserId, requirementId: otherReq.id },
    ]);
    expect(res.status).toBe(400);
  });

  it("returns 400 when the assignments field is missing", async () => {
    const { mission } = await makeApprovedWithReq();
    const res = await request(app)
      .post(`/api/missions/${mission.id}/assign`)
      .set("Authorization", `Bearer ${leadToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 when a userId is not a valid cuid", async () => {
    const { mission } = await makeApprovedWithReq();
    const res = await callAssign(mission.id, leadToken, [
      { userId: "not-a-valid-id" },
    ]);
    expect(res.status).toBe(400);
  });
});
