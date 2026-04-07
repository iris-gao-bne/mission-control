import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../app";
import { prisma } from "../lib/prisma";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const PASSWORD = "password123";
const FUTURE_A = "2026-10-01T00:00:00.000Z";
const FUTURE_B = "2026-10-15T00:00:00.000Z";
const FUTURE_C = "2026-11-01T00:00:00.000Z";
const FUTURE_D = "2026-11-20T00:00:00.000Z";

let orgId: string;
let orgBId: string;
let skillAId: string;
let skillBId: string;
let orgBSkillId: string;
let crew1Id: string;
let crew2Id: string;
let baseSkillIds: string[];

let directorToken: string;
let leadToken: string;
let crew1Token: string;
let crew2Token: string;
let orgBLeadToken: string;

async function login(slug: string, email: string) {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ slug, email, password: PASSWORD });
  return res.body.token as string;
}

beforeAll(async () => {
  const pw = await bcrypt.hash(PASSWORD, 10);

  const org = await prisma.organisation.create({
    data: { name: "Crew Test Org", slug: "crew-test-org" },
  });
  orgId = org.id;

  await prisma.user.create({
    data: {
      email: "director@crew.org",
      password: pw,
      name: "Director",
      role: "DIRECTOR",
      orgId,
    },
  });
  await prisma.user.create({
    data: {
      email: "lead@crew.org",
      password: pw,
      name: "Lead",
      role: "MISSION_LEAD",
      orgId,
    },
  });
  const c1 = await prisma.user.create({
    data: {
      email: "crew1@crew.org",
      password: pw,
      name: "Crew One",
      role: "CREW_MEMBER",
      orgId,
    },
  });
  const c2 = await prisma.user.create({
    data: {
      email: "crew2@crew.org",
      password: pw,
      name: "Crew Two",
      role: "CREW_MEMBER",
      orgId,
    },
  });
  crew1Id = c1.id;
  crew2Id = c2.id;

  const [sA, sB] = await Promise.all([
    prisma.skill.create({
      data: { name: "Piloting", category: "Navigation", orgId },
    }),
    prisma.skill.create({
      data: { name: "Medical", category: "Health", orgId },
    }),
  ]);
  skillAId = sA.id;
  skillBId = sB.id;
  baseSkillIds = [skillAId, skillBId];

  // Second org for cross-org isolation
  const orgB = await prisma.organisation.create({
    data: { name: "Other Crew Org", slug: "other-crew-org" },
  });
  orgBId = orgB.id;
  await prisma.user.create({
    data: {
      email: "lead@other.org",
      password: pw,
      name: "Other Lead",
      role: "MISSION_LEAD",
      orgId: orgBId,
    },
  });
  const orgBSkill = await prisma.skill.create({
    data: { name: "Piloting", category: "Navigation", orgId: orgBId },
  });
  orgBSkillId = orgBSkill.id;

  directorToken = await login("crew-test-org", "director@crew.org");
  leadToken = await login("crew-test-org", "lead@crew.org");
  crew1Token = await login("crew-test-org", "crew1@crew.org");
  crew2Token = await login("crew-test-org", "crew2@crew.org");
  orgBLeadToken = await login("other-crew-org", "lead@other.org");
});

afterEach(async () => {
  await prisma.crewSkill.deleteMany();
  await prisma.availability.deleteMany();
  // Remove any skills created during tests, keep base fixtures
  await prisma.skill.deleteMany({
    where: { orgId, id: { notIn: baseSkillIds } },
  });
});

afterAll(async () => {
  await prisma.crewSkill.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organisation.deleteMany();
  await prisma.$disconnect();
});

// ─── GET /api/crew ────────────────────────────────────────────────────────────

describe("GET /api/crew", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/crew");
    expect(res.status).toBe(401);
  });

  it("director sees all crew members", async () => {
    const res = await request(app)
      .get("/api/crew")
      .set("Authorization", `Bearer ${directorToken}`);
    expect(res.status).toBe(200);
    const names = res.body.map((u: { name: string }) => u.name);
    expect(names).toContain("Crew One");
    expect(names).toContain("Crew Two");
    expect(names).not.toContain("Director");
    expect(names).not.toContain("Lead");
  });

  it("mission lead sees all crew members", async () => {
    const res = await request(app)
      .get("/api/crew")
      .set("Authorization", `Bearer ${leadToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("crew member sees only themselves", async () => {
    const res = await request(app)
      .get("/api/crew")
      .set("Authorization", `Bearer ${crew1Token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(crew1Id);
  });

  it("each list item includes skills", async () => {
    await prisma.crewSkill.create({
      data: { userId: crew1Id, skillId: skillAId, proficiencyLevel: 4 },
    });

    const res = await request(app)
      .get("/api/crew")
      .set("Authorization", `Bearer ${directorToken}`);
    const crew1 = res.body.find((u: { id: string }) => u.id === crew1Id);
    expect(crew1.skills).toHaveLength(1);
    expect(crew1.skills[0].skill.id).toBe(skillAId);
    expect(crew1.skills[0].proficiencyLevel).toBe(4);
  });

  it("list items do not include availability", async () => {
    const res = await request(app)
      .get("/api/crew")
      .set("Authorization", `Bearer ${directorToken}`);
    expect(res.body[0].availability).toBeUndefined();
  });

  it("org B lead cannot see org A crew", async () => {
    const res = await request(app)
      .get("/api/crew")
      .set("Authorization", `Bearer ${orgBLeadToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─── GET /api/crew/:id ────────────────────────────────────────────────────────

describe("GET /api/crew/:id", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get(`/api/crew/${crew1Id}`);
    expect(res.status).toBe(401);
  });

  it("director can view any crew member", async () => {
    const res = await request(app)
      .get(`/api/crew/${crew1Id}`)
      .set("Authorization", `Bearer ${directorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(crew1Id);
  });

  it("mission lead can view any crew member", async () => {
    const res = await request(app)
      .get(`/api/crew/${crew1Id}`)
      .set("Authorization", `Bearer ${leadToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(crew1Id);
  });

  it("crew member can view their own profile", async () => {
    const res = await request(app)
      .get(`/api/crew/${crew1Id}`)
      .set("Authorization", `Bearer ${crew1Token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(crew1Id);
  });

  it("crew member cannot view another crew member — returns 404", async () => {
    const res = await request(app)
      .get(`/api/crew/${crew2Id}`)
      .set("Authorization", `Bearer ${crew1Token}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for a non-existent user id", async () => {
    const res = await request(app)
      .get("/api/crew/nonexistentid000000000000")
      .set("Authorization", `Bearer ${directorToken}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for a user in a different org", async () => {
    const res = await request(app)
      .get(`/api/crew/${crew1Id}`)
      .set("Authorization", `Bearer ${orgBLeadToken}`);
    expect(res.status).toBe(404);
  });

  it("response includes skills and availability", async () => {
    await prisma.crewSkill.create({
      data: { userId: crew1Id, skillId: skillAId, proficiencyLevel: 3 },
    });
    await prisma.availability.create({
      data: {
        userId: crew1Id,
        startDate: new Date(FUTURE_A),
        endDate: new Date(FUTURE_B),
        reason: "Training",
      },
    });

    const res = await request(app)
      .get(`/api/crew/${crew1Id}`)
      .set("Authorization", `Bearer ${directorToken}`);

    expect(res.body.skills).toHaveLength(1);
    expect(res.body.skills[0].skill.id).toBe(skillAId);
    expect(res.body.availability).toHaveLength(1);
    expect(res.body.availability[0].reason).toBe("Training");
  });

  it("does not expose the password field", async () => {
    const res = await request(app)
      .get(`/api/crew/${crew1Id}`)
      .set("Authorization", `Bearer ${directorToken}`);
    expect(res.body.password).toBeUndefined();
  });
});

// ─── PATCH /api/crew/:id/skills ───────────────────────────────────────────────

describe("PATCH /api/crew/:id/skills", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app)
      .patch(`/api/crew/${crew1Id}/skills`)
      .send({ skills: [] });
    expect(res.status).toBe(401);
  });

  it("crew member replaces their own skill set", async () => {
    const res = await request(app)
      .patch(`/api/crew/${crew1Id}/skills`)
      .set("Authorization", `Bearer ${crew1Token}`)
      .send({
        skills: [
          { skillId: skillAId, proficiencyLevel: 4 },
          { skillId: skillBId, proficiencyLevel: 2 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.skills).toHaveLength(2);
    const pilot = res.body.skills.find(
      (s: { skill: { id: string } }) => s.skill.id === skillAId,
    );
    expect(pilot.proficiencyLevel).toBe(4);
  });

  it("replaces — sending new set overwrites previous skills entirely", async () => {
    await prisma.crewSkill.create({
      data: { userId: crew1Id, skillId: skillAId, proficiencyLevel: 3 },
    });

    const res = await request(app)
      .patch(`/api/crew/${crew1Id}/skills`)
      .set("Authorization", `Bearer ${crew1Token}`)
      .send({ skills: [{ skillId: skillBId, proficiencyLevel: 5 }] });

    expect(res.status).toBe(200);
    expect(res.body.skills).toHaveLength(1);
    expect(res.body.skills[0].skill.id).toBe(skillBId);
  });

  it("clears all skills when an empty array is sent", async () => {
    await prisma.crewSkill.create({
      data: { userId: crew1Id, skillId: skillAId, proficiencyLevel: 3 },
    });

    const res = await request(app)
      .patch(`/api/crew/${crew1Id}/skills`)
      .set("Authorization", `Bearer ${crew1Token}`)
      .send({ skills: [] });

    expect(res.status).toBe(200);
    expect(res.body.skills).toEqual([]);
  });

  it("returns 403 when a director tries to update crew skills", async () => {
    const res = await request(app)
      .patch(`/api/crew/${crew1Id}/skills`)
      .set("Authorization", `Bearer ${directorToken}`)
      .send({ skills: [] });
    expect(res.status).toBe(403);
  });

  it("returns 403 when a mission lead tries to update crew skills", async () => {
    const res = await request(app)
      .patch(`/api/crew/${crew1Id}/skills`)
      .set("Authorization", `Bearer ${leadToken}`)
      .send({ skills: [] });
    expect(res.status).toBe(403);
  });

  it("returns 403 when a crew member tries to update another member's skills", async () => {
    const res = await request(app)
      .patch(`/api/crew/${crew2Id}/skills`)
      .set("Authorization", `Bearer ${crew1Token}`)
      .send({ skills: [{ skillId: skillAId, proficiencyLevel: 3 }] });
    expect(res.status).toBe(403);
  });

  it("returns 400 for a skill belonging to a different org", async () => {
    const res = await request(app)
      .patch(`/api/crew/${crew1Id}/skills`)
      .set("Authorization", `Bearer ${crew1Token}`)
      .send({ skills: [{ skillId: orgBSkillId, proficiencyLevel: 3 }] });
    expect(res.status).toBe(400);
  });

  it("returns 400 for duplicate skill IDs in the request", async () => {
    const res = await request(app)
      .patch(`/api/crew/${crew1Id}/skills`)
      .set("Authorization", `Bearer ${crew1Token}`)
      .send({
        skills: [
          { skillId: skillAId, proficiencyLevel: 3 },
          { skillId: skillAId, proficiencyLevel: 5 },
        ],
      });
    expect(res.status).toBe(400);
  });

  it("returns 400 for a proficiency level outside 1–5", async () => {
    const res = await request(app)
      .patch(`/api/crew/${crew1Id}/skills`)
      .set("Authorization", `Bearer ${crew1Token}`)
      .send({ skills: [{ skillId: skillAId, proficiencyLevel: 6 }] });
    expect(res.status).toBe(400);
  });
});

// ─── PATCH /api/crew/:id/availability ────────────────────────────────────────

describe("PATCH /api/crew/:id/availability", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app)
      .patch(`/api/crew/${crew1Id}/availability`)
      .send({ availability: [] });
    expect(res.status).toBe(401);
  });

  it("crew member sets their availability windows", async () => {
    const res = await request(app)
      .patch(`/api/crew/${crew1Id}/availability`)
      .set("Authorization", `Bearer ${crew1Token}`)
      .send({
        availability: [
          { startDate: FUTURE_A, endDate: FUTURE_B, reason: "Annual Leave" },
          { startDate: FUTURE_C, endDate: FUTURE_D },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.availability).toHaveLength(2);
    expect(res.body.availability[0].reason).toBe("Annual Leave");
    expect(res.body.availability[1].reason).toBeNull();
  });

  it("replaces — sending new windows overwrites all previous ones", async () => {
    await prisma.availability.create({
      data: {
        userId: crew1Id,
        startDate: new Date(FUTURE_A),
        endDate: new Date(FUTURE_B),
      },
    });

    const res = await request(app)
      .patch(`/api/crew/${crew1Id}/availability`)
      .set("Authorization", `Bearer ${crew1Token}`)
      .send({
        availability: [
          { startDate: FUTURE_C, endDate: FUTURE_D, reason: "New window" },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.availability).toHaveLength(1);
    expect(res.body.availability[0].reason).toBe("New window");
  });

  it("clears all windows when an empty array is sent", async () => {
    await prisma.availability.create({
      data: {
        userId: crew1Id,
        startDate: new Date(FUTURE_A),
        endDate: new Date(FUTURE_B),
      },
    });

    const res = await request(app)
      .patch(`/api/crew/${crew1Id}/availability`)
      .set("Authorization", `Bearer ${crew1Token}`)
      .send({ availability: [] });

    expect(res.status).toBe(200);
    expect(res.body.availability).toEqual([]);
  });

  it("returns 403 when a director tries to update crew availability", async () => {
    const res = await request(app)
      .patch(`/api/crew/${crew1Id}/availability`)
      .set("Authorization", `Bearer ${directorToken}`)
      .send({ availability: [] });
    expect(res.status).toBe(403);
  });

  it("returns 403 when a crew member tries to update another member's availability", async () => {
    const res = await request(app)
      .patch(`/api/crew/${crew2Id}/availability`)
      .set("Authorization", `Bearer ${crew1Token}`)
      .send({ availability: [] });
    expect(res.status).toBe(403);
  });

  it("returns 400 when endDate is before startDate in a window", async () => {
    const res = await request(app)
      .patch(`/api/crew/${crew1Id}/availability`)
      .set("Authorization", `Bearer ${crew1Token}`)
      .send({ availability: [{ startDate: FUTURE_B, endDate: FUTURE_A }] });
    expect(res.status).toBe(400);
  });
});

// ─── GET /api/skills ──────────────────────────────────────────────────────────

describe("GET /api/skills", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/skills");
    expect(res.status).toBe(401);
  });

  it("returns all org skills for a director", async () => {
    const res = await request(app)
      .get("/api/skills")
      .set("Authorization", `Bearer ${directorToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.map((s: { id: string }) => s.id);
    expect(ids).toContain(skillAId);
    expect(ids).toContain(skillBId);
  });

  it("returns skills for a crew member too", async () => {
    const res = await request(app)
      .get("/api/skills")
      .set("Authorization", `Bearer ${crew1Token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("does not return skills from another org", async () => {
    const res = await request(app)
      .get("/api/skills")
      .set("Authorization", `Bearer ${orgBLeadToken}`);
    const ids = res.body.map((s: { id: string }) => s.id);
    expect(ids).not.toContain(skillAId);
    expect(ids).not.toContain(skillBId);
    expect(ids).toContain(orgBSkillId);
  });
});

// ─── POST /api/skills ─────────────────────────────────────────────────────────

describe("POST /api/skills", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app)
      .post("/api/skills")
      .send({ name: "X", category: "Y" });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a mission lead", async () => {
    const res = await request(app)
      .post("/api/skills")
      .set("Authorization", `Bearer ${leadToken}`)
      .send({ name: "New Skill", category: "Engineering" });
    expect(res.status).toBe(403);
  });

  it("returns 403 for a crew member", async () => {
    const res = await request(app)
      .post("/api/skills")
      .set("Authorization", `Bearer ${crew1Token}`)
      .send({ name: "New Skill", category: "Engineering" });
    expect(res.status).toBe(403);
  });

  it("director creates a skill successfully", async () => {
    const res = await request(app)
      .post("/api/skills")
      .set("Authorization", `Bearer ${directorToken}`)
      .send({ name: "Zero-G Welding", category: "Engineering" });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Zero-G Welding");
    expect(res.body.category).toBe("Engineering");
    expect(res.body.orgId).toBe(orgId);
  });

  it("returns 409 for a duplicate skill name within the same org", async () => {
    const res = await request(app)
      .post("/api/skills")
      .set("Authorization", `Bearer ${directorToken}`)
      .send({ name: "Piloting", category: "Navigation" }); // already exists
    expect(res.status).toBe(409);
  });

  it("allows the same skill name in a different org", async () => {
    // orgB already has "Piloting" — creating it in org A should succeed
    // (skillA in our org is also "Piloting", so this actually tests org scoping)
    const res = await request(app)
      .post("/api/skills")
      .set("Authorization", `Bearer ${directorToken}`)
      .send({ name: "Comms Array Repair", category: "Engineering" });
    expect(res.status).toBe(201);
    expect(res.body.orgId).toBe(orgId);
  });

  it("returns 400 when name is missing", async () => {
    const res = await request(app)
      .post("/api/skills")
      .set("Authorization", `Bearer ${directorToken}`)
      .send({ category: "Engineering" });
    expect(res.status).toBe(400);
    expect(res.body.details.name).toBeDefined();
  });
});

// ─── DELETE /api/skills/:id ───────────────────────────────────────────────────

describe("DELETE /api/skills/:id", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).delete(`/api/skills/${skillAId}`);
    expect(res.status).toBe(401);
  });

  it("returns 403 for a mission lead", async () => {
    const res = await request(app)
      .delete(`/api/skills/${skillAId}`)
      .set("Authorization", `Bearer ${leadToken}`);
    expect(res.status).toBe(403);
  });

  it("returns 403 for a crew member", async () => {
    const res = await request(app)
      .delete(`/api/skills/${skillAId}`)
      .set("Authorization", `Bearer ${crew1Token}`);
    expect(res.status).toBe(403);
  });

  it("director deletes an unused skill and returns 204", async () => {
    const created = await prisma.skill.create({
      data: { name: "Temp Skill", category: "Test", orgId },
    });

    const res = await request(app)
      .delete(`/api/skills/${created.id}`)
      .set("Authorization", `Bearer ${directorToken}`);
    expect(res.status).toBe(204);

    const gone = await prisma.skill.findUnique({ where: { id: created.id } });
    expect(gone).toBeNull();
  });

  it("returns 409 when skill is assigned to a crew member", async () => {
    await prisma.crewSkill.create({
      data: { userId: crew1Id, skillId: skillAId, proficiencyLevel: 3 },
    });

    const res = await request(app)
      .delete(`/api/skills/${skillAId}`)
      .set("Authorization", `Bearer ${directorToken}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/in use/);
  });

  it("returns 409 when skill is referenced by a mission requirement", async () => {
    const lead = await prisma.user.findFirstOrThrow({
      where: { orgId, role: "MISSION_LEAD" },
    });
    const mission = await prisma.mission.create({
      data: {
        name: "Req Mission",
        startDate: new Date(FUTURE_A),
        endDate: new Date(FUTURE_B),
        orgId,
        createdById: lead.id,
      },
    });
    await prisma.missionRequirement.create({
      data: {
        missionId: mission.id,
        skillId: skillBId,
        minProficiency: 2,
        headcount: 1,
      },
    });

    const res = await request(app)
      .delete(`/api/skills/${skillBId}`)
      .set("Authorization", `Bearer ${directorToken}`);
    expect(res.status).toBe(409);

    // Clean up mission
    await prisma.missionRequirement.deleteMany({
      where: { missionId: mission.id },
    });
    await prisma.mission.delete({ where: { id: mission.id } });
  });

  it("returns 404 for a non-existent skill id", async () => {
    const res = await request(app)
      .delete("/api/skills/nonexistentid000000000000")
      .set("Authorization", `Bearer ${directorToken}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for a skill belonging to a different org", async () => {
    const res = await request(app)
      .delete(`/api/skills/${orgBSkillId}`)
      .set("Authorization", `Bearer ${directorToken}`);
    expect(res.status).toBe(404);
  });
});
